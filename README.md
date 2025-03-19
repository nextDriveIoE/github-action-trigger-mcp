# github-action-trigger-mcp MCP Server

A Model Context Protocol server

這是一個基於 TypeScript 的 MCP 服務器，實現了簡單的筆記系統和 GitHub Actions 查詢工具。它展示了 MCP 核心概念，提供：

- 代表具有 URI 和元數據的文本筆記的資源
- 用於創建新筆記的工具
- 用於生成筆記摘要的提示
- 用於獲取 GitHub 倉庫可用 GitHub Actions 的工具

## 功能

### 資源
- 通過 `note://` URI 列出和訪問筆記
- 每個筆記都有標題、內容和元數據
- 純文本 mime 類型用於簡單的內容訪問

### 工具
- `create_note` - 創建新的文本筆記
  - 以標題和內容作為必需參數
  - 將筆記存儲在服務器狀態中
- `get_github_actions` - 獲取 GitHub 倉庫上可用的 GitHub Actions
  - 必需參數：`owner`（倉庫擁有者，用戶名或組織）和 `repo`（倉庫名稱）
  - 可選參數：`token`（GitHub 個人訪問令牌，用於訪問私有倉庫或提高 API 速率限制）
  - 返回包含工作流程 ID、名稱、路徑、狀態、URL 和內容的 JSON 數據

### 提示
- `summarize_notes` - 生成所有存儲筆記的摘要
  - 包括所有筆記內容作為嵌入資源
  - 返回用於 LLM 摘要的結構化提示

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

## 安裝

### 基本安裝

要與 Claude Desktop 一起使用，添加服務器配置：

在 MacOS 上：`~/Library/Application Support/Claude/claude_desktop_config.json`
在 Windows 上：`%APPDATA%/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "github-action-trigger-mcp": {
      "command": "node",
      "args": [
        "/path/to/github-action-trigger-mcp/build/index.js"
      ]
    }
  }
}
```

### GitHub 令牌配置

如果您需要訪問私有倉庫或想要增加 API 請求限制，您可以配置 GitHub 個人訪問令牌。有兩種方式：

#### 方法一：環境變數

設置 `GITHUB_TOKEN` 環境變數：

```bash
# 在 Linux/MacOS 上
export GITHUB_TOKEN=your_github_token

# 在 Windows 上
set GITHUB_TOKEN=your_github_token
```

#### 方法二：配置文件

編輯配置文件：

```
~/.github-action-trigger-mcp/config.json
```

設置您的 GitHub 令牌：

```json
{
  "githubToken": "your_github_token"
}
```

服務器第一次啟動時會自動創建此配置文件的模板。

### 調試

由於 MCP 服務器通過 stdio 通信，調試可能具有挑戰性。我們建議使用 [MCP Inspector](https://github.com/modelcontextprotocol/inspector)，它可作為包腳本使用：

```bash
npm run inspector
```

Inspector 將提供一個 URL 以在您的瀏覽器中訪問調試工具。

## 使用示例

### 獲取 GitHub Actions

使用 `get_github_actions` 工具獲取倉庫的 GitHub Actions：

```json
{
  "owner": "用戶名或組織名",
  "repo": "倉庫名稱"
}
```

如果您已經配置了默認的 GitHub 令牌（通過環境變量或配置文件），在訪問私有倉庫時會自動使用它。如果需要覆蓋默認令牌，可以指定：

```json
{
  "owner": "用戶名或組織名",
  "repo": "倉庫名稱",
  "token": "在此請求中使用的替代令牌"
}
```

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
