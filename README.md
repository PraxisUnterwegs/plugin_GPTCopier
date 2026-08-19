# GPTCopier 0.3.0

一个零依赖的 Manifest V3 本地文本工具。它把 ChatGPT、DeepSeek、Gemini 或其他来源原生复制出的 LaTeX/Markdown 文本，转换为可以直接粘贴到 Obsidian、Typora、VS Code 等编辑器的 `$...$` / `$$...$$` 数学 Markdown。

## 使用方法

1. 在 AI 网站使用网站自带的复制按钮。
2. 点击浏览器工具栏中的 GPTCopier 图标，打开 `Paste & Convert` 页面。
3. 将原生复制文本手动粘贴到输入框。
4. 查看实时公式数量，点击 `Copy converted Markdown`。
5. 将转换结果粘贴到 Markdown 编辑器。

输入只存在于当前转换页面的内存中。扩展不会自动读取剪贴板，不会保存文本，不会联网，也没有任何网站访问权限。

## 转换规则

- `\\(...\\)` → `$...$`
- `\\[...\\]` → 独占行的 `$$...$$`
- 独占行 `[` / `]` 包围的明确 LaTeX 公式 → `$$...$$`
- `(h=g)`、`(S_{11})`、`(C)`、`(H,W)` 等明确数学括号 → `$...$`
- 已经带 `$` / `$$` 的公式、行内反引号和 fenced code block 保持不变
- 无法确定或没有闭合的定界符保持原文，并在页面显示警告

除公式定界符外，标题、列表、粗体、引用、链接等原生 Markdown 不会被重新排版。

## 安装与升级

1. 打开 `chrome://extensions` 或 `edge://extensions`。
2. 开启“开发者模式”。
3. 选择“加载已解压的扩展程序”，目录为本项目根目录。
4. 从旧版本升级时点击扩展卡片上的“重新加载”。
5. 点击扩展图标即可打开转换页面；ChatGPT 页面不再显示旧版注入按钮。

## 开发与验证

无需安装依赖：

```bash
npm test
```

测试覆盖 JavaScript 语法、公式转换、代码保护、误判边界、Manifest 版本与权限。`demo/index.html` 是完全离线的转换页夹具，不访问或登录任何 AI 服务。

新版离线演示：[`demo/GPTCopier-0.3.0-offline-demo.mp4`](demo/GPTCopier-0.3.0-offline-demo.mp4)。

## 架构

- `src/background.js`：点击扩展图标时打开本地转换页。
- `src/converter/convert.js`：纯文本 `convertNativeCopy(input)` 转换接口。
- `src/converter/index.html`：不持久化内容的 Paste & Convert 页面。
