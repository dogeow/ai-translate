# AGENT.md

本文件为 AI 编程助手提供项目上下文，帮助快速理解代码结构与开发规范。

## 项目概述

**ollama-translate** 是一个 Chrome/Firefox 浏览器扩展，支持：

- 选中文字右键翻译、快捷键翻译（Alt+T）
- 整页翻译（可视区域优先，滚动后继续）
- 自动翻译模式（选中触发 / 悬停触发）
- 多厂家切换：本地 Ollama 与云端 MiniMax
- 可选学习模式：翻译后展示句型分析

## 技术栈

| 层         | 技术                            |
|------------|---------------------------------|
| 构建工具   | `extension`（基于 rspack）      |
| UI         | React 19（Popup / Options 页）  |
| 扩展脚本   | 原生 JS（Content Script / Background） |
| 样式       | 原生 CSS                        |
| 语言       | JavaScript（无 TypeScript）     |
| 目标浏览器 | Chrome、Firefox                 |

## 目录结构

```
src/
├── manifest.json            # 扩展清单（版本由 package.json 同步）
├── background.js            # Service Worker 入口（消息路由、翻译调度）
├── background/
│   ├── ollama.js            # Ollama HTTP 调用
│   └── sentenceStudy.js     # 学习模式：句型分析逻辑
├── content.js               # Content Script 入口
├── content/
│   ├── constants.js         # Content 层常量
│   ├── button.js            # 翻译触发按钮
│   ├── tip.js
│   ├── tip/TipView.jsx      # 翻译气泡 UI
│   ├── selection.js         # 选中文字检测
│   ├── pageTranslate.js     # 页面翻译逻辑
│   ├── shortcutHint.js      # 快捷键提示
│   └── styles.js            # Content 注入样式
├── popup/
│   ├── PopupApp.jsx         # 弹窗主组件
│   └── hooks/usePopupSettings.js # 弹窗设置状态
├── options/
│   ├── OptionsApp.jsx       # 设置页主组件
│   ├── components/          # HomeTab / LearningTab 等页签组件
│   ├── hooks/               # useSettings / useConnectionStatus 等
│   └── lib/                 # 工具函数、常量、Chrome API 封装
└── shared/
    ├── constants.js         # 全局常量（Provider、默认值）
    ├── settings.js          # 设置规范化与默认值（DEFAULT_SETTINGS）
    ├── minimax-api.js       # MiniMax API 调用
    ├── ollama-api.js        # Ollama API 辅助
    ├── ollama-errors.js     # Ollama 错误信息映射
    ├── model-utils.js       # 模型列表工具
    ├── ai-request-log.js    # AI 请求日志
    ├── update.js            # 版本更新检测
    └── utils/
        ├── textProcessing.js    # Prompt 构建、文本解析、流式处理
        ├── contextMenu.js       # 右键菜单创建与菜单 ID 常量
        ├── messaging.js         # 扩展消息通信工具
        ├── apiUtils.js          # HTTP 请求封装
        └── updateManager.js     # 更新管理器
tools/
└── sync-version.mjs          # 版本同步脚本（package.json → manifest.json）
extension.config.js           # 构建配置（目标浏览器、开发 profile）
```

## 开发命令

```bash
npm install           # 安装依赖
npm run dev           # 开发模式（监听变化，自动重载，Chrome + Firefox）
npm run build         # 生产构建 → dist/
npm start             # 构建后预览
npm version patch     # 升版本号（自动同步到 manifest.json）
```

构建产物在 `dist/chromium/` 和 `dist/firefox/`，Chrome 加载时选 `dist/chromium/`。
如果本地还留有 `dist/chrome/`，那通常是旧产物目录，不会被当前 `extension build` 更新。

---

## 关键架构

### 消息流

```
Content Script ──sendMessage──▶ background.js ──▶ Ollama / MiniMax API
               ◀──onMessage──────────────────
```
所有翻译请求由 Content Script 或 Popup 发出，经 background.js 统一调度。

### 设置存储

- 所有设置读写通过 `chrome.storage.sync`
- 默认值集中定义在 `src/shared/settings.js` 的 `DEFAULT_SETTINGS`
- 通用设置键统一使用 canonical 命名：`provider`、`autoTranslateMode`、`hoverTranslateScope`、`hoverTranslateDelayMs`、`pageTranslateConcurrency`、`pageTranslateBatchChars`
- 旧版 `ollama*` 通用键仅在 `src/shared/settings.js` 的迁移逻辑中保留兼容，不应在新代码中继续读写
- 全局常量（Provider 名称、URL、Key）定义在 `src/shared/constants.js`

### 翻译 Provider

| Provider | 文件                        | 说明                               |
|----------|-----------------------------|------------------------------------|
| ollama   | background/ollama.js        | 本地 Ollama HTTP 调用，支持流式    |
| minimax  | shared/minimax-api.js       | 云端 MiniMax，支持流式，区分国内/国际 |

新增 Provider 时：在 constants.js 添加常量，在 settings.js 添加默认值，在 background.js 添加路由分支。

### 整页翻译

`content/pageTranslate.js` 实现可视区域优先翻译：  
先翻译视口内节点，监听滚动后继续翻译新出现内容，批量请求通过 background.js 转发。

---

## 代码规范

- 语言：JavaScript（无 TypeScript），无需添加类型注解
- 模块：ESM（import/export），package.json 中 `"type": "module"`
- React：仅 Popup 和 Options 页使用，Content Script 用原生 DOM
- 常量：所有可配置默认值放在 shared/constants.js，勿在各文件硬编码
- 消息通信：使用 shared/utils/messaging.js 封装，勿直接调用 chrome.runtime.sendMessage
- 错误处理：Ollama 错误统一通过 shared/ollama-errors.js 映射为用户可读信息
- 注释：只在非显而易见的逻辑处写注释，勿写"初始化变量"等废话注释
- 文件大小：单文件尽量不超过 400 行，过长时拆分到对应子目录

---

## 版本管理

版本号以 package.json 为单一来源，  
tools/sync-version.mjs 在每次 dev/build/version 命令前自动同步到 src/manifest.json，  
不要手动修改 manifest.json 中的版本号。

---

## 发布流程

1. `npm version patch`（或 minor/major）
2. `npm run build`
3. 更新仓库根目录 latest.json → 触发扩展内更新提示

---

## 常见任务指引

### 添加新设置项

1. 在 `src/shared/constants.js` 添加 `DEFAULT_XXX` 常量
2. 在 `src/shared/settings.js` 的 `DEFAULT_SETTINGS` 中添加字段
3. 如果是通用设置项，优先沿用 canonical 存储命名，不要再新增 `ollama*` 前缀的通用键
4. 在 `src/options/components/` 对应 Tab 组件中添加 UI
5. 在 `src/options/hooks/useSettings.js` 中处理读写

### 添加新的翻译触发方式

1. 在 `src/shared/utils/contextMenu.js` 添加菜单 ID 常量和菜单项
2. 在 `src/background.js` 的 `onContextMenuClicked` 中添加处理分支

### 调试

- **Background**：Chrome DevTools → 扩展 Service Worker「检查视图」
- **Content Script**：普通页面 DevTools Console（过滤 ollama-translate）
- **Popup/Options**：右键扩展图标 → 审查弹出窗口
