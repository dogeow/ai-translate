# Ollama / MiniMax / GitHub Copilot 翻译 - 浏览器扩展

在网页中翻译选中文字，支持本地 Ollama、云端 MiniMax、GitHub Copilot，并提供可选的句型学习模式。

## 功能

- **右键翻译**：选中文字后右键「Ollama 翻译选中内容」
- **页面翻译（可视区域优先）**：左键打开扩展弹窗后点击「开始页面翻译」，或在网页右键选择「Ollama 翻译整个页面（可视区域优先）」，先翻译当前可视区域，滚动后继续翻译新出现内容
- **快捷键翻译**：`Alt+T` 翻译当前选中内容（可在扩展快捷方式中修改）
- **多厂家切换**：`Ollama（本地）`、`MiniMax（云端）`、`GitHub Copilot`
- **模型选择**：Ollama 使用本地模型列表；MiniMax / GitHub Copilot 可手动指定模型；GitHub Copilot 默认模型为 `openai/gpt-4.1`
- **翻译偏好**：默认翻译语言单独放在「翻译偏好」卡片中设置
- **学习模式**（可选）：翻译后展示句型分析（主语/谓语/状语等）

## 前置条件

- Node.js 18+
- Chrome（开发者模式）
- 如使用 Ollama：本机已安装 [Ollama](https://ollama.com)，并至少拉取一个模型（例如 `ollama pull qwen2.5:7b`）
- 如使用 MiniMax：准备可用的 MiniMax API Key
- 如使用 GitHub Copilot：准备一个已启用 Device Flow 的 GitHub OAuth App Client ID，并使用设备登录完成授权

## 配置指引（重点）

`npm run dev` 后，打开扩展设置页：

1. 在「翻译引擎」卡片的 **API 厂家** 下拉框中选择厂家（`Ollama`、`MiniMax` 或 `GitHub Copilot`）。
2. 选择 `MiniMax` 后：
   - **MiniMax API 地址** 默认值：`https://api.minimaxi.com/v1`
   - **MiniMax API Key** 输入框在 API 地址下方
   - 点击 **测试连接** 后，会尝试校验连接并拉取模型列表（如果接口返回可用模型）
   - **模型** 默认值：`MiniMax-M2.5`
3. 选择 `GitHub Copilot` 后：
   - 先填写 `GitHub OAuth App Client ID`
   - 点击 **开始设备登录**，在 GitHub 页面完成授权
   - **模型** 默认值：`openai/gpt-4.1`

## 学习模式说明

- 学习模式入口：设置页「学习模式」页签中的「启用学习模式」。
- 开启时：翻译完成后会额外发起句型分析请求，并在结果中展示句型学习内容。
- 关闭时：仅发送翻译请求，不附带学习模式相关提示词请求。

## 开发

```bash
# 安装依赖
npm install

# 修改版本号（推荐）
npm version patch

# 开发模式（监听变化，自动重载）
npm run dev

# 构建
npm run build

# 构建并启动预览
npm start
```

版本号现在以 `package.json` 为单一来源。执行 `npm run dev`、`npm run build`、`npm start` 或 `npm version patch|minor|major` 时，会自动把版本同步到 `src/manifest.json`，不再需要手动维护两份。

## 更新提醒

扩展默认启用“发现新版本后提醒用户手动更新”，但**不会自动安装新包**。

版本清单 URL 已内置为：

`https://raw.githubusercontent.com/dogeow/ai-translate/main/latest.json`

发布新版本时，同步更新仓库根目录的 `latest.json` 即可。后台会定期检查该文件；如果发现更高版本，弹窗和设置页的「关于」页签都会提示用户打开更新页面。

## 安装

1. 运行 `npm run build`
2. Chrome 打开 `chrome://extensions/`，开启「开发者模式」
3. 点击「加载已解压的扩展程序」，选择 `dist/chromium` 目录

`extension build` 当前会输出到 `dist/chromium`。

## 项目结构

```text
browser-extension/
├── src/
│   ├── manifest.json
│   ├── popup.html / popup.css / popup.jsx   # React 弹窗入口
│   ├── popup/PopupApp.jsx
│   ├── options.html / options.css / options.jsx  # React 设置页挂载入口
│   ├── options/
│   │   ├── OptionsApp.jsx
│   │   ├── components/
│   │   ├── hooks/
│   │   └── lib/
│   ├── content/          # 注入页面的脚本（翻译气泡、选中等）
│   │   ├── tip/TipView.jsx
│   │   └── ...
│   ├── background.js    # 后台消息流、翻译请求与学习模式调度
│   ├── background/
│   │   ├── ollama.js
│   │   └── sentenceStudy.js
│   ├── shared/
│   │   ├── minimax-api.js
│   │   └── settings.js
│   └── icons/
└── package.json
```
