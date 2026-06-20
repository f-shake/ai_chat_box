
<div align="center">

# AI Chat Box / AI 聊天助手

**一款纯前端、零依赖的 AI 聊天客户端，支持任意兼容 OpenAI 协议的 API 接口。**

<p>
  <img src="https://img.shields.io/badge/status-%E7%A8%B3%E5%AE%9A-brightgreen" alt="状态">
  <img src="https://img.shields.io/badge/build-%E9%9B%B6%E6%9E%84%E5%BB%BA-yellow" alt="零构建">
  <img src="https://img.shields.io/badge/dependencies-marked.js%20(CDN)%20only-blue" alt="依赖">
  <img src="https://img.shields.io/badge/language-Vanilla%20JavaScript-orange" alt="语言">
</p>

</div>

---

## 🤖 关于本项目

**本项目完全由 AI 编写，人类未手写一行代码。**

从第一行 HTML 到最后一个 CSS 样式，从 JavaScript 逻辑到项目结构，全部由 AI 模型（Claude）根据需求对话生成。这是一个实验性的项目，旨在展示当前 AI 编码能力所能达到的边界——构建一个功能完整、界面精致、可直接使用的 Web 应用。

---

## ✨ 功能特性

- **多模型支持** — 兼容任意 OpenAI 协议 API（DeepSeek、GPT、Claude 等），支持自定义模型名称
- **流式响应** — 使用 SSE 协议实时流式显示 AI 回复，打字效果平滑自然
- **推理过程展示** — 支持 DeepSeek-R1 等推理模型的思维链展示（可折叠）
- **对话管理** — 多会话管理，支持新建、切换、重命名、删除，自动生成对话标题
- **Agent / 提示词系统** — 内置 6 大类 20+ 预设提示词，支持自定义、搜索、分组管理
- **导出聊天记录** — 一键导出为 CSV 格式（含 BOM，完美支持中文）
- **连接测试** — 内置连接测试功能，实时显示 API 状态
- **消息操作** — 复制、重新生成、折叠/展开长消息
- **配置持久化** — 所有设置自动保存至 IndexedDB（降级至 localStorage）
- **响应式设计** — 桌面端三栏布局，移动端侧栏滑出，触摸友好
- **零构建步骤** — 打开即用，无需 Node.js、npm install、webpack

---

## 🖥️ 界面预览

```
┌──────────────────────────────────────────────────────────────┐
│  💬 AI 聊天助手                           🟢 已连接   ⚙️  │
├──────────┬───────────────────────────────┬──────────────────┤
│          │                               │   🔧 设置        │
│  历史记录 │    消息区域                    │  ─────────      │
│          │                               │  API 地址        │
│  📝 对话1 │  ┌─────────────────────────┐ │  API 密钥        │
│  📝 对话2 │  │ 用户消息                 │ │  模型选择        │
│  📝 对话3 │  └─────────────────────────┘ │  系统提示词      │
│          │  ┌─────────────────────────┐ │  参数调节        │
│  [+ 新建] │  │ AI 回复（流式输出）      │ │  ─────────      │
│          │  └─────────────────────────┘ │  🤖 Agent       │
│          │                               │  ─────────      │
│          │  ┌──────────────────────┐     │  📖 预设 prompt │
│          │  │ 输入消息...    [发送] │     │                 │
│          │  └──────────────────────┘     │                 │
└──────────┴───────────────────────────────┴──────────────────┘
```

---

## 🚀 快速开始

### 使用方式

1. **下载** 或克隆本仓库到本地
2. 用浏览器直接打开 `index.html`
3. 在右侧设置面板中填入你的 API 地址和密钥
4. 选择模型，开始聊天！

### 无需安装

```
git clone https://github.com/your-username/ai-chat-box.git
cd ai-chat-box
# 直接用浏览器打开 index.html 即可
```

---

## ⚙️ 配置说明

| 参数 | 说明 | 默认值 |
|------|------|--------|
| API 地址 | OpenAI 兼容接口地址 | `https://api.deepseek.com/v1` |
| API 密钥 | 你的 API Key | — |
| 模型 | 模型名称（支持预设和自定义） | `deepseek-v4-flash` |
| 系统提示词 | 系统级 prompt | 可自定义 |
| Temperature | 生成温度 (0-2) | `1.0` |
| Max Tokens | 最大生成长度 | `4096` |
| Top P | 核采样参数 | `1.0` |
| 频率惩罚 | 频率惩罚系数 | `0.0` |
| 存在惩罚 | 存在惩罚系数 | `0.0` |
| 历史上限 | 包含的上下文轮数 | `20` |
| 推理展示 | 显示思维链 | 可选 |

---

## 📁 项目结构

```
ai-chat-box/
├── index.html              # 主页面（单页应用）
├── README.md               # 本文件
├── css/
│   ├── layout.css          # 布局样式（头部、侧栏、响应式）
│   ├── components.css      # 组件样式（设置面板、按钮、弹窗等）
│   └── chat.css            # 聊天区域样式（消息气泡、输入框等）
├── js/
│   ├── init.js             # 应用入口和初始化
│   ├── api.js              # 网络层（API 请求、流式响应、导出）
│   ├── config.js           # 配置管理（持久化、模型预设、标签切换）
│   ├── conversations.js    # 对话引擎（CRUD、消息渲染、流式展示）
│   ├── prompts.js          # Agent 管理体系（预设、自定义、搜索）
│   ├── utils.js            # 工具函数（DOM 操作、Toast、Markdown）
│   └── db.js               # IndexedDB 持久化层（降级至 localStorage）
├── data/
│   └── presets.json        # 内置预设提示词
```

---

## 🧩 技术栈

| 技术 | 用途 |
|------|------|
| **Vanilla JavaScript (ES6+)** | 全部应用逻辑 |
| **HTML5** | 页面结构 |
| **CSS3** | 样式与布局 |
| **marked.js (CDN)** | Markdown → HTML 渲染（唯一外部依赖） |
| **IndexedDB / localStorage** | 数据持久化（降级策略） |
| **Fetch API + SSE** | 流式 API 通信 |
| **SVG** | 图标 |

**零构建工具、零后端、零数据库。**

---

## 🔌 兼容性

支持所有提供 **OpenAI 兼容 API** 的服务商：

- DeepSeek (`api.deepseek.com`)
- OpenAI (`api.openai.com`)
- 任何使用 `/v1/chat/completions` 接口的代理或本地服务（如 Ollama、vLLM、LocalAI 等）

---

## 🌏 浏览器支持

- Chrome / Edge (最新版)
- Firefox (最新版)
- Safari (最新版)
- 移动端浏览器（响应式适配）

---

## 📜 许可

本项目基于 MIT 许可证开源。

---

## 🙏 致谢

- 本项目全部代码由 **Claude (Anthropic)** 生成
- [marked.js](https://marked.js.org/) — 轻量级 Markdown 解析器
- 所有测试和反馈来自真实用户

---

<div align="center">
  <sub>完全由 AI 编写 · 从零到一 · 没有人类开发者的参与</sub>
  <br>
  <sub>Built entirely by AI — from concept to code</sub>
</div>
