# AI 翻译 - 浏览器扩展

在网页中翻译选中文字或整页内容，支持本地 Ollama、云端 MiniMax、GitHub Copilot、ChatGPT、Chrome 内置 AI，并提供可选的句型学习与单词学习功能。

## 功能

- **右键翻译**：选中文字后右键「Ollama 翻译选中内容」
- **页面翻译（可视区域优先）**：左键打开扩展弹窗后点击「开始页面翻译」，或在网页右键选择「Ollama 翻译整个页面（可视区域优先）」，先翻译当前可视区域，滚动后继续翻译新出现内容
- **快捷键翻译**：`Alt+T` 翻译当前选中内容（可在扩展快捷方式中修改）
- **多厂家切换**：`Ollama（本地）`、`MiniMax（云端）`、`GitHub Copilot`、`ChatGPT（设备登录）`、`Chrome 内置 AI`
- **模型选择**：Ollama 使用本地模型列表；MiniMax / GitHub Copilot / ChatGPT 可手动指定模型；ChatGPT 默认模型为 `gpt-5.3-codex-spark`
- **中英双向翻译**：默认目标为中文时，英文等内容译为中文；识别到中文原文时自动改译英语。中英文混合页面会按每段语言分别处理
- **单词朗读**：英文单词翻译结果支持美式发音，使用有道词典音频接口
- **翻译偏好**：默认翻译语言在「翻译偏好」卡片中设置
- **学习模式**（可选）：翻译后展示句型分析（主语/谓语/状语等）

## 前置条件

- Node.js 18+
- Chrome（开发者模式）
- 如使用 Ollama：本机已安装 [Ollama](https://ollama.com)，并至少拉取一个模型（例如 `ollama pull qwen2.5:7b`）
- 如使用 MiniMax：准备可用的 MiniMax API Key
- 如使用 GitHub Copilot：准备一个已启用 Device Flow 的 GitHub OAuth App Client ID，并使用设备登录完成授权
- 如使用 ChatGPT：账号需要开通 Codex，并在 ChatGPT 安全设置或工作区权限中允许设备码登录；`gpt-5.3-codex-spark` 预览模型需要相应账号权限

## 配置指引（重点）

`npm run dev` 后，打开扩展设置页：

1. 在「翻译引擎」卡片的 **API 厂家** 下拉框中选择厂家。
2. 选择 `MiniMax` 后：
   - **MiniMax API 地址** 默认值：`https://api.minimaxi.com/v1`
   - **MiniMax API Key** 输入框在 API 地址下方
   - 点击 **测试连接** 后，会尝试校验连接并拉取模型列表（如果接口返回可用模型）
   - **模型** 默认值：`MiniMax-M2.5`
3. 选择 `GitHub Copilot` 后：
   - 先填写 `GitHub OAuth App Client ID`
   - 点击 **开始设备登录**，在 GitHub 页面完成授权
   - **模型** 默认值：`openai/gpt-4.1`
4. 选择 `ChatGPT（设备登录）` 后：
   - 点击 **开始设备登录**
   - 在自动打开的 OpenAI 页面输入扩展显示的一次性验证码
   - 授权成功后扩展会自动保存并刷新令牌；令牌只保存在 `chrome.storage.local`，不会进入浏览器同步设置
   - **模型** 默认值：`gpt-5.3-codex-spark`

ChatGPT 设备登录使用 OpenAI 官方 Codex 流程，详见 [Codex authentication](https://learn.chatgpt.com/docs/auth#preferred-device-code-authentication-beta)。

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

# 测试（包含语言策略、批量翻译与 DOM 页面翻译）
npm test

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
│   │   ├── translationService.js
│   │   ├── pageTranslationService.js
│   │   ├── translationMessageHandlers.js
│   │   ├── ollama.js
│   │   └── sentenceStudy.js
│   ├── shared/
│   │   ├── chatgpt-auth.js
│   │   ├── chatgpt-codex-api.js
│   │   ├── minimax-api.js
│   │   ├── translation-language.js
│   │   └── settings.js
│   └── icons/
└── package.json
```
