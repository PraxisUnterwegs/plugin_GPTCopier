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

## 遇到的问题
| 问题 | 解决方案 |
|------|---------|
| 初始化 Git 仓库时默认沙箱拒绝 `.git` 写入 | 获授权后完成 `git init`。 |
| 嵌套列表转换时报 `list is not a function` | 递归函数参数与函数同名，已改为 `listElement`。 |
| 代码布局空白节点被写入 Markdown | 忽略纯空白文本节点，确保复制源码无缩进噪声。 |
| 公式作为普通文本时无 `$` / `$$` | 对明确数学符号、TeX 记号和 `sup/sub` 结构提供保守补全。 |
| Edge 自动化不可用 | 当前环境没有连接可操作的 Edge 实例，不能读取用户浏览器中的已安装扩展；不会因此登录或访问账户。 |
| TeX 命令边界 | MathML 初版转换生成 `\\timesH`；运算符命令必须保留尾随空格，避免被解析成不存在的长命令。 |

## 资源
- 需求原文：`/Users/jzf/.codex/attachments/034c5dc6-68aa-4f01-a58d-333f69987ade/pasted-text.txt`

## 视觉/浏览器发现
- 离线夹具已通过既有检查；用户提供的 Edge 扩展页截图清楚显示 GPTCopier 已启用、版本为 `0.2.0`，检查视图显示“无活动视图”。
