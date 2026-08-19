# 发现与决策

## 需求
- 首发目标：ChatGPT 网页的每条 assistant 消息提供“Copy MD”与“Copy Q&A MD”。
- 复制结果必须是 Markdown 源码，并覆盖标题、粗斜体、行内/块代码、LaTeX、列表、表格、链接、引用和分隔线。
- SPA 页面需持续监听变化，且 Q&A 需回溯最近的 user 消息。
- DeepSeek 与 Gemini 暂不要求现在完整启用，但架构必须预留扩展空间。
- 需要本地测试与演示；用户审阅 demo 后再执行真实浏览器安装测试。

## 研究发现
- 项目目录初始为空，尚未存在用户代码或 Git 历史。
- 用户明确指定 Manifest V3，Chrome/Edge 均使用 Chromium 扩展接口，能共享一份包。
- 为避免访问真实 AI 账户，测试采用本地 HTTP 夹具，并复刻消息角色、Markdown、KaTeX、操作栏及动态页面所需的语义 DOM。
- 用户截图确认 Edge 扩展已启用且显示版本 `0.2.0`，因此失败并非扩展未重载，而是线上公式 DOM 与夹具仍不一致。
- Edge 后续显示 `0.2.1` 但页面仍只有两个旧按钮，证明扩展包更新与当前 SPA 页面中已经注入的 DOM/事件监听器是两个独立状态；布尔初始化标记会错误地阻止新版脚本接管。
- 用户提供的 `0.2.2` Math Debug 报告显示 ChatGPT 当前公式 DOM 只有 `.katex-display > .katex > .katex-html`，没有 MathML、TeX annotation、data 源或可用 aria 源；24 个候选的 `recovered` 全部为 `null`。
- 当前 KaTeX 视觉文本会把结构压平，例如 `T_1\to S_1` 变成带零宽字符的 `T1​→S1​`，直接 DOM 转换不再可靠。
- 用户提供的 ChatGPT 原生复制文本仍保留 `_`、`\to`、`\boxed`、`\text`、`\xrightarrow` 等 LaTeX 正文；主要缺口是 `\[` / `\]` 在部分粘贴链路中退化为独占行 `[` / `]`，因此可以在不访问网页的前提下修复定界符。

## 技术决策
| 决策 | 理由 |
|------|------|
| 原生 DOM walker | 对 KaTeX、代码块和 UI 排除可实现精细控制，避免默认 HTML 转 Markdown 库破坏结构。 |
| `SiteAdapter` 合约 | 使站点选择器和消息/动作区域发现可各自演进。 |
| CSS 使用自有 class 与低侵入布局 | 不依赖目标站随机 class，减少对原 UI 的影响。 |
| 以 classic content scripts 依序加载模块 | Manifest V3 content script 不需要额外 bundler 也能以共享命名空间维持职责分层。 |
| 公式文本回退 | 当网页未暴露 KaTeX/MathML 原始 TeX 时，带有明确数学信号的句内公式补 `$…$`，纯公式段落补 `$$…$$`；原始 TeX 的优先级更高。 |
| 文本容器一致处理 | 公式可能不在 `<p>` 内；`div`、列表以及根文本节点都必须应用同一个回退规则。 |
| 公式显示模式 | `.katex-display`、`MathJax_Display`、`data-display='block'` 等显式标志判断为块级；仅含公式的段落/块容器作为结构回退。 |
| MathML 结构恢复 | 用户样例中的 `RC×H×W` 源于 MathML 被当作视觉文本展开；需读取 `msup`、`msub`、`mathvariant=double-struck`、`mtext` 与 `menclose`。 |
| 公式源发现扩展 | 除 annotation/MathML 外，还需检查后代 `data-tex/data-latex/data-math`、aria label、screen-reader hidden source 与 MathJax 容器。 |
| 版本化 UI 完整性校验 | assistant 消息与控件组都记录 Manifest 版本，并要求三个稳定 action 各出现一次；不符合即整体重建，避免复用旧监听器。 |
| 放弃 KaTeX HTML 反解析 | 改为用户使用站点原生复制后手动粘贴；只规范化公式定界符，避免脆弱的站点 DOM 依赖。 |
| 独立扩展页面 | 点击工具栏图标打开本地标签页；不注入任何网站，不申请 host、tabs、activeTab 或 storage 权限。 |
| 内容仅驻留内存 | 不自动读取剪贴板、不持久化、不联网；输入变化时实时计算，只有用户点击复制才写入剪贴板。 |

## 遇到的问题
| 问题 | 解决方案 |
|------|---------|
| 初始化 Git 仓库时默认沙箱拒绝 `.git` 写入 | 获授权后完成 `git init`。 |
| 嵌套列表转换时报 `list is not a function` | 递归函数参数与函数同名，已改为 `listElement`。 |
| 代码布局空白节点被写入 Markdown | 忽略纯空白文本节点，确保复制源码无缩进噪声。 |
| 公式作为普通文本时无 `$` / `$$` | 对明确数学符号、TeX 记号和 `sup/sub` 结构提供保守补全。 |
| Edge 自动化不可用 | 当前环境没有连接可操作的 Edge 实例，不能读取用户浏览器中的已安装扩展；不会因此登录或访问账户。 |
| TeX 命令边界 | MathML 初版转换生成 `\\timesH`；运算符命令必须保留尾随空格，避免被解析成不存在的长命令。 |
| 旧按钮跨版本残留 | `data-gptcopier-initialized="true"` 无法表达代码版本；改用 `data-gptcopier-version` 并在启动/MutationObserver 共用的 scan 中执行升级。 |

## 资源
- 需求原文：`/Users/jzf/.codex/attachments/034c5dc6-68aa-4f01-a58d-333f69987ade/pasted-text.txt`
- 0.2.2 真实复制与 Math Debug 样例：`/Users/jzf/.codex/attachments/e302fd1a-3255-4f5b-861d-78a991954c4e/pasted-text.txt`

## 视觉/浏览器发现
- 离线夹具已通过既有检查；用户提供的 Edge 扩展页截图清楚显示 GPTCopier 已启用、版本为 `0.2.0`，检查视图显示“无活动视图”。
- 0.3.0 离线浏览器验收确认：输入保持不变，实时统计为 4 个公式，复制结果含正确块级/行内定界符，代码内容未变化，复制按钮反馈成功；Clear 与刷新都会清空内存内容。
