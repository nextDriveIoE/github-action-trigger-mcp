# github-action-trigger-mcp MCP Server

A Model Context Protocol server for GitHub Actions integration

這是一個基於 TypeScript 的 MCP 服務器，專為 GitHub Actions 整合設計。它提供了下列功能：

- 用於獲取 GitHub 倉庫可用 GitHub Actions 的工具
- 用於獲取特定 GitHub Action 詳細信息的工具
- 用於觸發 GitHub 工作流程的工具
- 簡單的筆記功能用於記錄和摘要

## 功能

### 工具
- `get_github_actions` - 獲取 GitHub 倉庫上可用的 GitHub Actions（工作流程）
  - 必需參數：`owner`（倉庫擁有者，用戶名或組織）和 `repo`（倉庫名稱）
  - 可選參數：`token`（GitHub 個人訪問令牌，用於訪問私有倉庫或提高 API 速率限制）
  - 返回包含工作流程 ID、名稱、路徑、狀態、URL 和內容的 JSON 數據
- `get_github_action` - 獲取特定 GitHub Action 的詳細信息，包括輸入參數及其要求
  - 必需參數：`owner`（Action 擁有者，用戶名或組織）和 `repo`（Action 的倉庫名稱）
  - 可選參數：
    - `path`：Action 定義文件的路徑（默認為 'action.yml'）
    - `ref`：Git 引用（分支、標籤或提交 SHA，默認為 'main'）
    - `token`：GitHub 個人訪問令牌（可選）
  - 返回 Action 的詳細信息，包括名稱、描述、作者、輸入參數（及其是否必填）等
- `trigger_github_action` - 觸發 GitHub 工作流程並傳遞相關參數
  - 必需參數：
    - `owner`：倉庫擁有者（用戶名或組織）
    - `repo`：倉庫名稱
    - `workflow_id`：要觸發的工作流程 ID 或文件名
  - 可選參數：
    - `ref`：觸發工作流程的 Git 引用（默認為 'main'）
    - `inputs`：傳遞給工作流程的輸入參數（必須匹配工作流程定義的輸入）
    - `token`：GitHub 個人訪問令牌（必須具有 workflow 權限範圍）
  - 返回工作流程運行信息，包括狀態、URL 等
- `create_note` - 創建新的文本筆記
  - 以標題和內容作為必需參數
  - 將筆記存儲在服務器狀態中

### 資源
- 通過 `note://` URI 列出和訪問筆記
- 每個筆記都有標題、內容和元數據

### 提示
- `summarize_notes` - 生成所有存儲筆記的摘要

## 安裝

### 推薦安裝方式：使用 npx

最簡單的安裝和使用方法是通過 Claude Desktop 配置文件中的 `npx` 命令直接引用，無需手動安裝到本地：

```json
{
  "mcpServers": {
    "github-action-trigger-mcp": {
      "command": "npx",
      "args": [
        "-y",
        "@nextdriveioe/github-action-trigger-mcp"
      ],
      "env": {
        "GITHUB_PERSONAL_ACCESS_TOKEN": "your_github_token_here"
      }
    }
  }
}
```

這種方法的優點：
- 無需本地安裝包
- 自動使用最新版本
- 一次設置，立即可用
- 內置了 GitHub 令牌配置

### 本地安裝方式

若要手動安裝，請執行以下步驟：

1. 安裝包：
```bash
npm install -g @nextdriveioe/github-action-trigger-mcp
```

2. 在 Claude Desktop 配置中使用：

在 MacOS 上：`~/Library/Application Support/Claude/claude_desktop_config.json`
在 Windows 上：`%APPDATA%/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "github-action-trigger-mcp": {
      "command": "@nextdriveioe/github-action-trigger-mcp",
      "env": {
        "GITHUB_PERSONAL_ACCESS_TOKEN": "your_github_token_here"
      }
    }
  }
}
```

### GitHub 令牌配置

要訪問 GitHub API，特別是私有倉庫或觸發工作流程，您需要配置 GitHub 個人訪問令牌。有以下幾種配置方式：

#### 方法一（推薦）：Claude Desktop 配置文件中直接設置

在 Claude Desktop 配置文件中通過 `env` 字段直接設置令牌：

```json
"env": {
  "GITHUB_PERSONAL_ACCESS_TOKEN": "your_github_token_here"
}
```

#### 方法二：全局環境變數

設置 `GITHUB_TOKEN` 環境變數：

```bash
# 在 Linux/MacOS 上
export GITHUB_TOKEN=your_github_token

# 在 Windows 上
set GITHUB_TOKEN=your_github_token
```

#### 方法三：本地配置文件

編輯配置文件：

```
~/.nextdriveioe-github-action-trigger-mcp/config.json
```

設置您的 GitHub 令牌：

```json
{
  "githubToken": "your_github_token"
}
```

服務器第一次啟動時會自動創建此配置文件的模板。

## 開發

安裝依賴：
```bash
npm install
```

構建服務器：
```bash
npm run build
```

用於自動重建的開發：
```bash
npm run watch
```

### 調試

使用 MCP Inspector 進行調試：

```bash
npm run inspector
```

Inspector 將提供一個 URL 以在您的瀏覽器中訪問調試工具。

## 發布到 npm

如果您想要將此包發布到 npm，請按照以下步驟操作：

1. 確保您已登錄到 npm，並且有權限發布到 `@nextdriveioe` 組織：
   ```bash
   npm login
   ```

2. 構建項目：
   ```bash
   npm run build
   ```

3. 發布到 npm（組織範圍的包預設為私有，使用 `--access public` 使其公開）：
   ```bash
   npm publish --access public
   ```

發布後，任何人都可以使用 `npx @nextdriveioe/github-action-trigger-mcp` 命令執行此工具，或在 Claude Desktop 配置中使用它。

## 使用示例

### 獲取 GitHub Actions 列表

使用 `get_github_actions` 工具獲取倉庫的 GitHub Actions：

```json
{
  "owner": "用戶名或組織名",
  "repo": "倉庫名稱"
}
```

如果已配置默認令牌，在訪問私有倉庫時會自動使用它。

返回示例：

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

### 獲取特定 GitHub Action 詳細信息

使用 `get_github_action` 工具獲取特定 Action 的詳細信息：

```json
{
  "owner": "actions",
  "repo": "checkout",
  "ref": "v4"
}
```

返回示例：

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

### 觸發 GitHub 工作流程

使用 `trigger_github_action` 工具觸發 GitHub 工作流程：

```json
{
  "owner": "用戶名或組織名",
  "repo": "倉庫名稱",
  "workflow_id": "ci.yml",
  "inputs": {
    "deploy_environment": "production",
    "debug_enabled": "true"
  }
}
```

返回示例：

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

注意：觸發工作流程需要：
1. 工作流程必須配置為支援 `workflow_dispatch` 事件
2. GitHub 令牌必須具有 `workflow` 範圍的權限
3. 傳遞的輸入參數必須與工作流程中定義的參數匹配
