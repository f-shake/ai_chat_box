
<div align="center">

# AI Chat Box / AI 聊天助手

**一款基于 Vue 3 + TypeScript + Element Plus 的 AI 聊天客户端，支持任意兼容 OpenAI 协议的 API 接口。**

<p>
  <img src="https://img.shields.io/badge/status-%E8%BF%81%E7%A7%BB%E4%B8%AD-informational" alt="状态">
  <img src="https://img.shields.io/badge/build-Vite%20%2B%20Vue%203-blue" alt="构建工具">
  <img src="https://img.shields.io/badge/language-TypeScript-blue" alt="语言">
  <img src="https://img.shields.io/badge/UI-Element%20Plus-brightgreen" alt="UI框架">
</p>

</div>

---

## 🤖 关于本项目

**本项目完全由 AI 编写，人类未手写一行代码。**

从第一行 HTML 到最后一个 CSS 样式，从 JavaScript 逻辑到项目结构，全部由 AI 模型（Claude）根据需求对话生成。这是一个实验性的项目，旨在展示当前 AI 编码能力所能达到的边界——构建一个功能完整、界面精致、可直接使用的 Web 应用。

---

## ✨ 功能特性

- **多模型支持** — 兼容任意 OpenAI 协议 API（DeepSeek、GPT 等），支持自定义模型名称
- **流式响应** — 使用 SSE 协议实时流式显示 AI 回复，打字效果平滑自然
- **推理过程展示** — 支持 DeepSeek 等推理模型的思维链展示（可折叠，流式完成后自动收起）
- **联网搜索** — 内置多引擎搜索工具（搜狗/必应/360），支持 tool calling 循环
- **对话管理** — 多会话管理，支持新建、切换、重命名、删除，自动生成对话标题
- **预设提示词系统** — 内置 6 大类 20+ 预设提示词，支持自定义、搜索、分组管理
- **消息操作** — 复制（富文本/纯文本/Markdown/思考内容）、编辑、重新生成
- **文件上传** — 支持文本文件、图片、DOCX，拖拽/粘贴上传，图片自动压缩
- **配置持久化** — 所有设置自动保存至 IndexedDB（降级至 localStorage）
- **导出/导入** — JSON 多选导出、CSV 单对话导出，支持导入预览确认
- **加密分享** — 通过 AES-256-GCM 加密分享 API 配置
- **响应式设计** — 桌面端左侧栏布局，移动端抽屉式导航，触摸友好
- **暗色模式** — 跟随系统或手动切换，Element Plus 组件完整适配

---

## 🚀 快速开始

### 开发模式

```bash
npm install
npm run dev
```

### 生产构建

```bash
npm run build
npm run preview
```

### 搜索代理（可选）

联网搜索功能需要启动 Node.js 搜索代理：

```bash
node server.js
```

---

## ⚙️ 配置说明

| 参数 | 说明 | 默认值 |
|------|------|--------|
| API 地址 | OpenAI 兼容接口地址 | `https://api.deepseek.com/v1` |
| API 密钥 | 你的 API Key | — |
| 模型 | 模型名称（支持预设和自定义） | `deepseek-v4-flash` |
| 系统提示词 | 系统级 prompt | 聊天机器人预设 |
| Temperature | 生成温度 (0-2) | `0.7` |
| Max Tokens | 最大生成长度 | `0`（不限制）|
| Top P | 核采样参数 | `1.0` |
| 频率惩罚 | 频率惩罚系数 | `0.0` |
| 存在惩罚 | 存在惩罚系数 | `0.0` |
| 历史上限 | 包含的上下文轮数 | `20` |

---

## 📁 项目结构

```
ai-chat-box/
├── index.html              # Vite 入口
├── package.json            # 依赖配置
├── vite.config.ts          # Vite 构建配置
├── tsconfig.json           # TypeScript 配置
├── server.js               # Node.js 搜索代理（无需构建）
├── src/
│   ├── main.ts             # 应用入口
│   ├── App.vue             # 根组件（布局 + 抽屉式设置面板）
│   ├── router/             # Vue Router
│   ├── types/              # TypeScript 类型定义（6 个类型文件）
│   ├── stores/             # Pinia 状态管理（6 个 store）
│   ├── services/           # 服务层（API/DB/搜索）
│   ├── composables/        # 组合式函数（SSE流式/文件处理/剪贴板/加密/主题）
│   ├── components/
│   │   ├── layout/         # AppHeader, HistorySidebar, SettingsSidebar
│   │   ├── chat/           # 聊天核心（MessageBubble, ChatInput 等）
│   │   ├── settings/       # 设置面板（API/参数/预设/搜索/格式）
│   │   └── dialogs/        # 导出/导入/分享对话框
│   ├── utils/              # 工具函数
│   └── styles/             # 全局样式 + CSS 变量
└── data/
    └── presets.json        # 内置预设提示词
```

---

## 🧩 技术栈

| 技术 | 用途 |
|------|------|
| **Vue 3 (Composition API)** | UI 框架 |
| **TypeScript** | 类型安全 |
| **Vite** | 构建工具 |
| **Pinia** | 状态管理 |
| **Element Plus** | UI 组件库 |
| **marked** | Markdown → HTML 渲染 |
| **mammoth** | DOCX 解析 |
| **IndexedDB** | 数据持久化 |

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

## ⚠️ 当前状态

此版本是从 Vanilla JS 迁移到 Vue 3 + TypeScript + Element Plus 的重构版本，**尚未经过全面测试**，可能存在以下问题：

- 各浏览器兼容性未完整验证
- 边缘情况下的状态管理问题
- 移动端键盘适配可能不完善
- 部分功能细节待打磨

欢迎提交 Issue 反馈问题。

---

## 📜 许可

本项目基于 MIT 许可证开源。

---

## 🙏 致谢

- 本项目全部代码由 **Claude (Anthropic)** 生成
- [marked.js](https://marked.js.org/) — 轻量级 Markdown 解析器
- [Element Plus](https://element-plus.org/) — Vue 3 组件库
- 所有测试和反馈来自真实用户

---

<div align="center">
  <sub>完全由 AI 编写 · 从零到一 · 没有人类开发者的参与</sub>
  <br>
  <sub>Built entirely by AI — from concept to code</sub>
</div>
