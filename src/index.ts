#!/usr/bin/env node

/**
 * MCP server that implements a simple notes system and GitHub Actions tools.
 * It demonstrates core MCP concepts like resources and tools by allowing:
 * - Listing notes as resources
 * - Reading individual notes
 * - Creating new notes via a tool
 * - Summarizing all notes via a prompt
 * - Getting available GitHub Actions for a repository
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import axios from "axios";
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

/**
 * Custom logger that uses stderr to avoid interfering with MCP JSON responses.
 */
const logger = {
  info: (...args: any[]) => console.error('[INFO]', ...args),
  error: (...args: any[]) => console.error('[ERROR]', ...args),
  warn: (...args: any[]) => console.error('[WARN]', ...args),
  debug: (...args: any[]) => console.error('[DEBUG]', ...args)
};

/**
 * Type alias for a note object.
 */
type Note = { title: string, content: string };

/**
 * Simple in-memory storage for notes.
 * In a real implementation, this would likely be backed by a database.
 */
const notes: { [id: string]: Note } = {
  "1": { title: "First Note", content: "This is note 1" },
  "2": { title: "Second Note", content: "This is note 2" }
};

/**
 * Configuration interface for the server.
 */
interface Config {
  githubToken?: string;
}

/**
 * Load configuration from file or environment variables.
 * Priority: Environment variables > Config file
 */
function loadConfig(): Config {
const config: Config = {};

// Check environment variables with priority
// 1. GITHUB_PERSONAL_ACCESS_TOKEN - 專為 Claude Desktop 配置設計
// 2. GITHUB_TOKEN - 傳統的環境變量名稱
if (process.env.GITHUB_PERSONAL_ACCESS_TOKEN) {
  config.githubToken = process.env.GITHUB_PERSONAL_ACCESS_TOKEN;
    logger.info('Using GitHub token from GITHUB_PERSONAL_ACCESS_TOKEN environment variable');
    return config;
  }
  
  if (process.env.GITHUB_TOKEN) {
    config.githubToken = process.env.GITHUB_TOKEN;
    logger.info('Using GitHub token from GITHUB_TOKEN environment variable');
    return config;
  }

  // Try to load from config file if environment variable is not set
  try {
    const configPath = path.join(os.homedir(), '.nextdriveioe-github-action-trigger-mcp', 'config.json');
    if (fs.existsSync(configPath)) {
      const fileConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      if (fileConfig.githubToken) {
        config.githubToken = fileConfig.githubToken;
      }
    }
  } catch (error) {
    logger.error('Failed to load config file:', error);
  }

  return config;
}

// Load configuration
const config = loadConfig();

/**
 * Create an MCP server with capabilities for resources (to list/read notes),
 * tools (to create new notes and get GitHub Actions), and prompts (to summarize notes).
 */
const server = new Server(
  {
    name: "@nextdriveioe/github-action-trigger-mcp",
    version: "0.1.0",
  },
  {
    capabilities: {
      resources: {},
      tools: {},
      prompts: {},
    },
  }
);

/**
 * Handler for listing available notes as resources.
 * Each note is exposed as a resource with:
 * - A note:// URI scheme
 * - Plain text MIME type
 * - Human readable name and description (now including the note title)
 */
server.setRequestHandler(ListResourcesRequestSchema, async () => {
  return {
    resources: Object.entries(notes).map(([id, note]) => ({
      uri: `note:///${id}`,
      mimeType: "text/plain",
      name: note.title,
      description: `A text note: ${note.title}`
    }))
  };
});

/**
 * Handler for reading the contents of a specific note.
 * Takes a note:// URI and returns the note content as plain text.
 */
server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const url = new URL(request.params.uri);
  const id = url.pathname.replace(/^\//, '');
  const note = notes[id];

  if (!note) {
    throw new Error(`Note ${id} not found`);
  }

  return {
    contents: [{
      uri: request.params.uri,
      mimeType: "text/plain",
      text: note.content
    }]
  };
});

/**
 * Handler that lists available tools.
 * Exposes a "create_note" tool and a "get_github_actions" tool.
 */
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "create_note",
        description: "Create a new note",
        inputSchema: {
          type: "object",
          properties: {
            title: {
              type: "string",
              description: "Title of the note"
            },
            content: {
              type: "string",
              description: "Text content of the note"
            }
          },
          required: ["title", "content"]
        }
      },
      {
        name: "get_github_actions",
        description: "Get available GitHub Actions for a repository",
        inputSchema: {
          type: "object",
          properties: {
            owner: {
              type: "string",
              description: "Owner of the repository (username or organization)"
            },
            repo: {
              type: "string",
              description: "Name of the repository"
            },
            token: {
              type: "string",
              description: "GitHub personal access token (optional)"
            }
          },
          required: ["owner", "repo"]
        }
      },
      {
        name: "get_github_action",
        description: "Get detailed information about a specific GitHub Action, including inputs and their requirements",
        inputSchema: {
          type: "object",
          properties: {
            owner: {
              type: "string",
              description: "Owner of the action (username or organization)"
            },
            repo: {
              type: "string",
              description: "Repository name of the action"
            },
            path: {
              type: "string",
              description: "Path to the action.yml or action.yaml file (usually just 'action.yml')"
            },
            ref: {
              type: "string",
              description: "Git reference (branch, tag, or commit SHA, default: main)"
            },
            token: {
              type: "string",
              description: "GitHub personal access token (optional)"
            }
          },
          required: ["owner", "repo"]
        }
      },
      {
        name: "trigger_github_action",
        description: "Trigger a GitHub workflow dispatch event with custom inputs",
        inputSchema: {
          type: "object",
          properties: {
            owner: {
              type: "string",
              description: "Owner of the repository (username or organization)"
            },
            repo: {
              type: "string",
              description: "Name of the repository"
            },
            workflow_id: {
              type: "string",
              description: "The ID or filename of the workflow to trigger"
            },
            ref: {
              type: "string",
              description: "The git reference to trigger the workflow on (default: main)"
            },
            inputs: {
              type: "object",
              description: "Inputs to pass to the workflow (must match the workflow's defined inputs)"
            },
            token: {
              type: "string",
              description: "GitHub personal access token (must have workflow scope)"
            }
          },
          required: ["owner", "repo", "workflow_id"]
        }
      }
    ]
  };
});

/**
 * Helper function to fetch GitHub Actions workflows from a repository.
 * @param owner Repository owner (username or organization)
 * @param repo Repository name
 * @param token Optional GitHub personal access token
 * @returns List of GitHub Action workflows
 */
/**
 * Helper function to trigger a GitHub workflow via workflow_dispatch event.
 * @param owner Repository owner (username or organization)
 * @param repo Repository name
 * @param workflow_id The ID or filename of the workflow to trigger
 * @param ref The git reference to trigger the workflow on (default: main)
 * @param inputs Inputs to pass to the workflow
 * @param token GitHub personal access token (must have workflow scope)
 * @returns The workflow run information
 */
async function triggerGitHubAction(owner: string, repo: string, workflow_id: string, ref: string = 'main', inputs: Record<string, any> = {}, token?: string) {
  // Use provided token or fall back to config token
  const authToken = token || config.githubToken;
  
  if (!authToken) {
    throw new Error('GitHub token is required to trigger workflow dispatch events');
  }
  
  try {
    const headers: Record<string, string> = {
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Authorization': `Bearer ${authToken}`
    };
    
    // Trigger the workflow_dispatch event
    const response = await axios.post(
      `https://api.github.com/repos/${owner}/${repo}/actions/workflows/${workflow_id}/dispatches`,
      {
        ref: ref,
        inputs: inputs
      },
      { headers }
    );
    
    // The workflow_dispatch endpoint returns 204 No Content when successful
    if (response.status === 204) {
      // Add a delay to allow the workflow to be created
      // GitHub needs a bit of time to process the request and create the run
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Get the latest workflow run to return more useful information
      const runsResponse = await axios.get(
        `https://api.github.com/repos/${owner}/${repo}/actions/workflows/${workflow_id}/runs?per_page=5`,
        { headers }
      );
      
      if (runsResponse.data.workflow_runs && runsResponse.data.workflow_runs.length > 0) {
        // Find the most recent run that was created around the time of our request
        const now = new Date();
        const recentRuns = runsResponse.data.workflow_runs
          .filter((run: any) => {
            const runDate = new Date(run.created_at);
            // Consider runs created in the last 10 seconds
            return (now.getTime() - runDate.getTime()) < 10000;
          })
          .sort((a: any, b: any) => {
            return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
          });
        
        const latestRun = recentRuns.length > 0 ? recentRuns[0] : runsResponse.data.workflow_runs[0];
        
        return {
          success: true,
          message: 'Workflow dispatch event triggered successfully',
          run: {
            id: latestRun.id,
            url: latestRun.html_url,
            status: latestRun.status,
            conclusion: latestRun.conclusion,
            created_at: latestRun.created_at,
            triggered_by: latestRun.triggering_actor?.login || 'API'
          }
        };
      }
      
      // If we couldn't find a recent run, it might still be creating
      return {
        success: true,
        message: 'Workflow dispatch event triggered successfully',
        note: 'Workflow run information not available yet. The run is being created. Check the repository Actions tab for status in a few seconds.'
      };
    }
    
    throw new Error(`Unexpected response status: ${response.status}`);
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const statusCode = error.response?.status;
      const errorMessage = error.response?.data?.message || error.message;
      
      if (statusCode === 404) {
        throw new Error(`Workflow not found or no permission: ${errorMessage}`);
      } else if (statusCode === 422) {
        throw new Error(`Validation failed: ${errorMessage}. This could be due to invalid inputs or the workflow doesn't support manual triggers.`);
      } else if (statusCode === 401 || statusCode === 403) {
        throw new Error(`Authentication failed: ${errorMessage}. Make sure your token has the 'workflow' scope.`);
      }
      
      throw new Error(`GitHub API error: ${statusCode} - ${errorMessage}`);
    }
    throw error;
  }
}

/**
 * Helper function to fetch a specific GitHub Action's metadata, including inputs and their requirements.
 * @param owner Owner of the action (username or organization)
 * @param repo Repository name of the action
 * @param path Path to the action.yml or action.yaml file (default: 'action.yml')
 * @param ref Git reference (branch, tag, or commit SHA, default: main)
 * @param token Optional GitHub personal access token
 * @returns Detailed information about the GitHub Action
 */
async function getGitHubAction(owner: string, repo: string, path: string = 'action.yml', ref: string = 'main', token?: string) {
  // Use provided token or fall back to config token
  const authToken = token || config.githubToken;
  
  try {
    const headers: Record<string, string> = {
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28'
    };
    
    if (authToken) {
      headers['Authorization'] = `Bearer ${authToken}`;
    }
    
    // First, try to get the action.yml file content
    const contentResponse = await axios.get(
      `https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${ref}`,
      { headers }
    );
    
    if (!contentResponse.data.content) {
      throw new Error(`Could not find ${path} file in ${owner}/${repo}`);
    }
    
    // Decode the base64 content
    const content = Buffer.from(contentResponse.data.content, 'base64').toString('utf-8');
    
    // Parse the YAML content
    const yaml = require('js-yaml');
    const actionDefinition = yaml.load(content);
    
    // Extract and format the inputs information
    const inputs = actionDefinition.inputs || {};
    const formattedInputs = Object.entries(inputs).map(([name, config]: [string, any]) => ({
      name,
      description: config.description || '',
      default: config.default,
      required: config.required === true,
      deprecationMessage: config.deprecationMessage,
    }));
    
    return {
      name: actionDefinition.name || '',
      description: actionDefinition.description || '',
      author: actionDefinition.author || '',
      inputs: formattedInputs,
      runs: actionDefinition.runs,
      branding: actionDefinition.branding,
      // Include original content for reference
      originalYaml: content
    };
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw new Error(`GitHub API error: ${error.response?.status} ${error.response?.statusText} - ${error.response?.data?.message || error.message}`);
    }
    throw error;
  }
}

async function getGitHubActions(owner: string, repo: string, token?: string) {
  // Use provided token or fall back to config token
  const authToken = token || config.githubToken;
  try {
    const headers: Record<string, string> = {
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28'
    };

    if (authToken) {
      headers['Authorization'] = `Bearer ${authToken}`;
    }

    // Fetch workflows from the GitHub API
    const workflowsResponse = await axios.get(
      `https://api.github.com/repos/${owner}/${repo}/actions/workflows`,
      { headers }
    );

    // Extract workflow information
    const workflows = workflowsResponse.data.workflows.map((workflow: any) => ({
      id: workflow.id,
      name: workflow.name,
      path: workflow.path,
      state: workflow.state,
      url: workflow.html_url
    }));

    // For each workflow, get the associated jobs
    const workflowDetails = await Promise.all(
      workflows.map(async (workflow: any) => {
        try {
          // Get the raw workflow file content
          const contentResponse = await axios.get(
            `https://api.github.com/repos/${owner}/${repo}/contents/${workflow.path}`,
            { headers }
          );

          const content = Buffer.from(contentResponse.data.content, 'base64').toString('utf-8');

          return {
            ...workflow,
            content
          };
        } catch (error) {
          // If we can't get the content, just return the workflow without it
          return workflow;
        }
      })
    );

    return workflowDetails;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw new Error(`GitHub API error: ${error.response?.status} ${error.response?.statusText} - ${error.response?.data?.message || error.message}`);
    }
    throw error;
  }
}

/**
 * Handler for tools including create_note and get_github_actions.
 */
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  switch (request.params.name) {
    case "create_note": {
      const title = String(request.params.arguments?.title);
      const content = String(request.params.arguments?.content);
      if (!title || !content) {
        throw new Error("Title and content are required");
      }

      const id = String(Object.keys(notes).length + 1);
      notes[id] = { title, content };

      return {
        content: [{
          type: "text",
          text: `Created note ${id}: ${title}`
        }]
      };
    }

    case "get_github_actions": {
    const owner = String(request.params.arguments?.owner);
    const repo = String(request.params.arguments?.repo);
    const token = request.params.arguments?.token ? String(request.params.arguments?.token) : undefined;
    
    if (!owner || !repo) {
    throw new Error("Owner and repo are required");
    }

    try {
    const actions = await getGitHubActions(owner, repo, token);
    
    return {
    content: [{
    type: "text",
    text: JSON.stringify(actions, null, 2)
    }]
    };
    } catch (error) {
    if (error instanceof Error) {
    throw new Error(`Failed to get GitHub Actions: ${error.message}`);
    }
    throw error;
    }
    }
    
    case "get_github_action": {
      const owner = String(request.params.arguments?.owner);
      const repo = String(request.params.arguments?.repo);
      const path = request.params.arguments?.path ? String(request.params.arguments?.path) : 'action.yml';
      const ref = request.params.arguments?.ref ? String(request.params.arguments?.ref) : 'main';
      const token = request.params.arguments?.token ? String(request.params.arguments?.token) : undefined;
      
      if (!owner || !repo) {
        throw new Error("Owner and repo are required");
      }

      try {
        const actionDetails = await getGitHubAction(owner, repo, path, ref, token);
        
        return {
          content: [{
            type: "text",
            text: JSON.stringify(actionDetails, null, 2)
          }]
        };
      } catch (error) {
        if (error instanceof Error) {
          throw new Error(`Failed to get GitHub Action details: ${error.message}`);
        }
        throw error;
      }
    }
    
    case "trigger_github_action": {
      const owner = String(request.params.arguments?.owner);
      const repo = String(request.params.arguments?.repo);
      const workflow_id = String(request.params.arguments?.workflow_id);
      const ref = request.params.arguments?.ref ? String(request.params.arguments?.ref) : 'main';
      const inputs = request.params.arguments?.inputs || {};
      const token = request.params.arguments?.token ? String(request.params.arguments?.token) : undefined;
      
      if (!owner || !repo || !workflow_id) {
        throw new Error("Owner, repo, and workflow_id are required");
      }

      try {
        const result = await triggerGitHubAction(owner, repo, workflow_id, ref, inputs, token);
        
        return {
          content: [{
            type: "text",
            text: JSON.stringify(result, null, 2)
          }]
        };
      } catch (error) {
        if (error instanceof Error) {
          throw new Error(`Failed to trigger GitHub Action: ${error.message}`);
        }
        throw error;
      }
    }

    default:
      throw new Error("Unknown tool");
  }
});

/**
 * Handler that lists available prompts.
 * Exposes a single "summarize_notes" prompt that summarizes all notes.
 */
server.setRequestHandler(ListPromptsRequestSchema, async () => {
  return {
    prompts: [
      {
        name: "summarize_notes",
        description: "Summarize all notes",
      }
    ]
  };
});

/**
 * Handler for the summarize_notes prompt.
 * Returns a prompt that requests summarization of all notes, with the notes' contents embedded as resources.
 */
server.setRequestHandler(GetPromptRequestSchema, async (request) => {
  if (request.params.name !== "summarize_notes") {
    throw new Error("Unknown prompt");
  }

  const embeddedNotes = Object.entries(notes).map(([id, note]) => ({
    type: "resource" as const,
    resource: {
      uri: `note:///${id}`,
      mimeType: "text/plain",
      text: note.content
    }
  }));

  return {
    messages: [
      {
        role: "user",
        content: {
          type: "text",
          text: "Please summarize the following notes:"
        }
      },
      ...embeddedNotes.map(note => ({
        role: "user" as const,
        content: note
      })),
      {
        role: "user",
        content: {
          type: "text",
          text: "Provide a concise summary of all the notes above."
        }
      }
    ]
  };
});

/**
 * Start the server using stdio transport.
 * This allows the server to communicate via standard input/output streams.
 */
async function main() {
  // Ensure the config directory exists
  try {
    const configDir = path.join(os.homedir(), '.nextdriveioe-github-action-trigger-mcp');
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
      // Create a template config file if it doesn't exist
      const configPath = path.join(configDir, 'config.json');
      if (!fs.existsSync(configPath)) {
        fs.writeFileSync(configPath, JSON.stringify({
          githubToken: 'YOUR_GITHUB_TOKEN_HERE' // replace with your GitHub token
        }, null, 2), 'utf-8');
        logger.info(`Created template config file at ${configPath}`);
      }
    }
  } catch (error) {
    logger.error('Failed to create config directory:', error);
  }

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  logger.error("Server error:", error);
  process.exit(1);
});
