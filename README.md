[![MseeP.ai Security Assessment Badge](https://mseep.net/pr/nextdriveioe-github-action-trigger-mcp-badge.png)](https://mseep.ai/app/nextdriveioe-github-action-trigger-mcp)

# GitHub Action Trigger MCP Server

A Model Context Protocol server for GitHub Actions integration.

## Overview

This is a TypeScript-based MCP server designed for GitHub Actions integration. It provides the following features:

- Tool for fetching available GitHub Actions from a repository
- Tool for getting detailed information about a specific GitHub Action
- Tool for triggering GitHub workflow dispatch events
- Tool for fetching the latest releases from a GitHub repository

## Features

### Tools

- `get_github_actions` - Get available GitHub Actions for a repository
  - Required parameters: `owner` (repository owner, username or organization) and `repo` (repository name)
  - Optional parameters: `token` (GitHub personal access token, for accessing private repositories or increasing API rate limits)
  - Returns JSON data with workflow ID, name, path, state, URL, and content

- `get_github_action` - Get detailed information about a specific GitHub Action, including inputs and their requirements
  - Required parameters: `owner` (Action owner, username or organization) and `repo` (repository name of the action)
  - Optional parameters:
    - `path`: Path to the action definition file (default: 'action.yml')
    - `ref`: Git reference (branch, tag, or commit SHA, default: 'main')
    - `token`: GitHub personal access token (optional)
  - Returns detailed information about the Action, including name, description, author, inputs (and whether they're required), etc.

- `trigger_github_action` - Trigger a GitHub workflow and pass relevant parameters
  - Required parameters:
    - `owner`: Repository owner (username or organization)
    - `repo`: Repository name
    - `workflow_id`: The ID or filename of the workflow to trigger
  - Optional parameters:
    - `ref`: The git reference to trigger the workflow on (default: 'main')
    - `inputs`: Inputs to pass to the workflow (must match the workflow's defined inputs)
    - `token`: GitHub personal access token (must have the workflow scope)
  - Returns workflow run information, including status, URL, etc.

- `get_github_release` - Get the latest 2 releases from a GitHub repository
  - Required parameters: `owner` (repository owner, username or organization) and `repo` (repository name)
  - Optional parameters: `token` (GitHub personal access token, optional)
  - Returns information about the latest 2 releases

## Installation

### Recommended Installation: Using npx

The simplest way to install and use is via the `npx` command in your Claude Desktop configuration file without manual local installation:

```json
{
  "mcpServers": {
    "github-action-trigger-mcp": {
      "command": "npx",
      "args": [
        "-y",
        "@nextdrive/github-action-trigger-mcp"
      ],
      "env": {
        "GITHUB_PERSONAL_ACCESS_TOKEN": "your_github_token_here"
      }
    }
  }
}
```

Benefits of this method:
- No local package installation required
- Automatically uses the latest version
- Set up once and ready to use
- Built-in GitHub token configuration

### Local Installation

If you prefer to install manually, follow these steps:

1. Install the package:
```bash
npm install -g @nextdrive/github-action-trigger-mcp
```

2. Use in Claude Desktop configuration:

On MacOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
On Windows: `%APPDATA%/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "github-action-trigger-mcp": {
      "command": "@nextdrive/github-action-trigger-mcp",
      "env": {
        "GITHUB_PERSONAL_ACCESS_TOKEN": "your_github_token_here"
      }
    }
  }
}
```

### GitHub Token Configuration

To access the GitHub API, especially for private repositories or workflow triggers, you need to configure a GitHub personal access token. There are several ways to do this:

#### Method 1 (Recommended): Direct Configuration in Claude Desktop

Set the token directly in the Claude Desktop configuration file via the `env` field:

```json
"env": {
  "GITHUB_PERSONAL_ACCESS_TOKEN": "your_github_token_here"
}
```

#### Method 2: Global Environment Variable

Set the `GITHUB_TOKEN` environment variable:

```bash
# On Linux/MacOS
export GITHUB_TOKEN=your_github_token

# On Windows
set GITHUB_TOKEN=your_github_token
```

#### Method 3: Local Configuration File

Edit the configuration file:

```
~/.nextdrive-github-action-trigger-mcp/config.json
```

Set your GitHub token:

```json
{
  "githubToken": "your_github_token"
}
```

A template for this configuration file is automatically created the first time the server starts.

## Development

Install dependencies:
```bash
npm install
```

Build the server:
```bash
npm run build
```

For automatic rebuilding during development:
```bash
npm run watch
```

### Debugging

Use MCP Inspector for debugging:

```bash
npm run inspector
```

The Inspector will provide a URL to access the debugging tools in your browser.

## Publishing to npm

If you want to publish this package to npm, follow these steps:

1. Make sure you're logged in to npm and have permissions to publish to the `@nextdrive` organization:
   ```bash
   npm login
   ```

2. Build the project:
   ```bash
   npm run build
   ```

3. Publish to npm (organization-scoped packages are private by default, use `--access public` to make it public):
   ```bash
   npm publish --access public
   ```

After publishing, anyone can run this tool using the `npx @nextdrive/github-action-trigger-mcp` command or use it in their Claude Desktop configuration.

## Usage Examples

### Getting a List of GitHub Actions

Use the `get_github_actions` tool to get GitHub Actions for a repository:

```json
{
  "owner": "username-or-org",
  "repo": "repository-name"
}
```

If a default token is configured, it will be used automatically when accessing private repositories.

Example response:

```json
[
  {
    "id": 12345678,
    "name": "CI",
    "path": ".github/workflows/ci.yml",
    "state": "active",
    "url": "https://github.com/owner/repo/actions/workflows/ci.yml",
    "content": "name: CI\n\non:\n  push:\n    branches: [ main ]\n  pull_request:\n    branches: [ main ]\n\njobs:\n  build:\n    runs-on: ubuntu-latest\n    steps:\n    - uses: actions/checkout@v2\n    - name: Setup Node.js\n      uses: actions/setup-node@v2\n      with:\n        node-version: 16.x\n    - name: Install dependencies\n      run: npm ci\n    - name: Build\n      run: npm run build\n    - name: Test\n      run: npm test\n"
  }
]
```

### Getting Detailed GitHub Action Information

Use the `get_github_action` tool to get detailed information about a specific Action:

```json
{
  "owner": "actions",
  "repo": "checkout",
  "ref": "v4"
}
```

Example response:

```json
{
  "name": "Checkout",
  "description": "Check out a Git repository at a particular version",
  "author": "GitHub",
  "inputs": [
    {
      "name": "repository",
      "description": "Repository name with owner. For example, actions/checkout",
      "default": "",
      "required": false
    },
    {
      "name": "ref",
      "description": "The branch, tag or SHA to checkout.",
      "default": "",
      "required": false
    }
  ],
  "runs": {
    "using": "node20",
    "main": "dist/index.js"
  }
}
```

### Triggering a GitHub Workflow

Use the `trigger_github_action` tool to trigger a GitHub workflow:

```json
{
  "owner": "username-or-org",
  "repo": "repository-name",
  "workflow_id": "ci.yml",
  "inputs": {
    "deploy_environment": "production",
    "debug_enabled": "true"
  }
}
```

Example response:

```json
{
  "success": true,
  "message": "Workflow dispatch event triggered successfully",
  "run": {
    "id": 12345678,
    "url": "https://github.com/owner/repo/actions/runs/12345678",
    "status": "queued",
    "conclusion": null,
    "created_at": "2025-03-19T06:45:12Z",
    "triggered_by": "API"
  }
}
```

Note: Triggering workflows requires:
1. The workflow must be configured to support the `workflow_dispatch` event
2. The GitHub token must have the `workflow` scope permission
3. Input parameters passed must match those defined in the workflow

### Getting Latest Releases

Use the `get_github_release` tool to get the latest 2 releases from a repository:

```json
{
  "owner": "username-or-org",
  "repo": "repository-name"
}
```

Example response:

```json
{
  "count": 2,
  "releases": [
    {
      "id": 12345678,
      "name": "v1.0.0",
      "tag_name": "v1.0.0",
      "published_at": "2025-03-15T10:00:00Z",
      "draft": false,
      "prerelease": false,
      "html_url": "https://github.com/owner/repo/releases/tag/v1.0.0",
      "body": "Release notes for version 1.0.0",
      "assets": [
        {
          "name": "app-v1.0.0.zip",
          "size": 1234567,
          "download_count": 42,
          "browser_download_url": "https://github.com/owner/repo/releases/download/v1.0.0/app-v1.0.0.zip",
          "created_at": "2025-03-15T10:05:00Z",
          "updated_at": "2025-03-15T10:05:00Z"
        }
      ],
      "author": {
        "login": "username",
        "html_url": "https://github.com/username"
      }
    },
    {
      "id": 87654321,
      "name": "v0.9.0",
      "tag_name": "v0.9.0",
      "published_at": "2025-03-01T10:00:00Z",
      "draft": false,
      "prerelease": true,
      "html_url": "https://github.com/owner/repo/releases/tag/v0.9.0",
      "body": "Pre-release notes for version 0.9.0",
      "assets": [],
      "author": {
        "login": "username",
        "html_url": "https://github.com/username"
      }
    }
  ]
}
```