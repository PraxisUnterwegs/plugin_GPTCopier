# GPTCopier

一个零依赖的 Manifest V3 浏览器扩展。在 ChatGPT 的每条回答旁提供 `Copy MD` 和 `Copy Q&A MD`，复制的内容是可直接粘贴进 Obsidian、Typora 与 VS Code 的 Markdown 源码。

## 当前范围

- 已启用：ChatGPT（`chatgpt.com`）
- 已预留适配器：DeepSeek（`chat.deepseek.com`）、Gemini（`gemini.google.com`）
- 支持：标题、粗斜体、行内/块代码、KaTeX 原始 TeX、列表、表格、链接、引用、分隔线、图片
- 不读取账户、会话记录、Cookie 或网络请求；只在用户点击复制按钮时转换当前 DOM 中的消息。

## 本地加载（在 demo 确认后执行）

1. 打开 `chrome://extensions` 或 `edge://extensions`。
2. 开启“开发者模式”。
3. 选择“加载已解压的扩展程序”，并选择本项目根目录。
4. 在目标站点任意对话中点击 `Copy MD` 或 `Copy Q&A MD`。

## 开发与验证

无需安装依赖。执行：

```bash
npm test
```

它会检查所有 JavaScript 语法并启动本地 demo 测试页的脚本验证。`demo/index.html` 是一个完全离线的 ChatGPT 风格夹具，专用于验证转换与 UI 注入；不需要访问或登录任何 AI 服务。

本次离线验证录制的演示视频为 [`demo/GPTCopier-offline-demo.mp4`](demo/GPTCopier-offline-demo.mp4)。

## 架构

- `src/sites/adapters.js`：站点匹配、消息角色、内容与操作区发现。
- `src/markdown/`：小型 DOM walker，公式、表格和清理规则独立。
- `src/content/`：按钮 UI 与 SPA MutationObserver。
- `demo/`：离线演示和可复现实例。

新增站点时实现或配置一个 `SiteAdapter`，不需要触碰 Markdown 转换逻辑。
