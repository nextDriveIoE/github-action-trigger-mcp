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

  // Check environment variables first
  if (process.env.GITHUB_TOKEN) {
    config.githubToken = process.env.GITHUB_TOKEN;
    return config;
  }

  // Try to load from config file if environment variable is not set
  try {
    const configPath = path.join(os.homedir(), '.github-action-trigger-mcp', 'config.json');
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
    name: "github-action-trigger-mcp",
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
    const configDir = path.join(os.homedir(), '.github-action-trigger-mcp');
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
