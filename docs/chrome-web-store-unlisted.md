# Chrome Web Store 非公开发布指南

本项目使用 Chrome Web Store 的“非公开（Unlisted）”可见性。扩展不会出现在商店搜索结果中，只有获得商店直达链接的用户可以安装。安装完成后，Chrome 负责定期检查并自动安装已发布的新版本。

## 首次发布

1. 注册并登录 Chrome Web Store 开发者账号。
2. 在项目根目录执行 `npm run package:chrome`。
3. 打开 Chrome Web Store Developer Dashboard，创建新项目。
4. 上传 `artifacts/ai-translate-chrome-web-store-<版本号>.zip`。
5. 完成商店信息、隐私权规范和权限用途说明。
6. 在 Distribution 页面将 Visibility 设为 `Unlisted`。
7. 提交审核并发布。
8. 发布后保存商店直达链接，用该链接提供首次安装。

非公开项目同样需要遵守 Chrome Web Store 政策并接受审核。

## 现有开发版迁移

通过“加载已解压的扩展程序”安装的开发版不会自动切换成商店版。商店首次发布后，现有用户需要手动移除或停用开发版，再通过商店直达链接安装一次。两者的扩展 ID 通常不同，因此原开发版中的设置、学习记录和登录状态不会自动迁移，用户可能需要重新配置并登录。

完成这次商店安装后，后续版本才会进入 Chrome Web Store 的自动更新链路。

## 后续更新

1. 使用 `npm version patch`、`npm version minor` 或 `npm version major` 提高版本号。
2. 执行 `npm test`。
3. 执行 `npm run package:chrome`。
4. 在现有商店项目的 Package 页面上传新的 ZIP。
5. 提交审核并发布。

新版本发布后不需要用户重新安装。Chrome 通常会在启动时及此后每隔数小时检查更新，并在扩展空闲时安装。请勿在 `manifest.json` 中添加自托管 `update_url`。

## 权限用途说明参考

提交审核时应以实际功能为准填写。当前权限的主要用途如下：

- `storage`：保存用户设置、翻译缓存、学习记录和本地登录状态。
- `contextMenus`：提供选中文本、整页翻译和单词学习右键菜单。
- `activeTab`、`tabs`、`scripting`：识别当前标签页并执行用户主动触发的翻译及页面交互功能。
- `sidePanel`：提供可持续打开的翻译控制面板。
- `declarativeNetRequestWithHostAccess`：为有道发音及用户主动选择的翻译服务配置必要请求头。
- `<all_urls>`：在用户访问的网站中提供选词、悬停和整页翻译；页面文本仅按用户选择发送给其配置的翻译服务。

扩展包不能下载并执行远程 JavaScript；所有可执行代码均应包含在上传的 ZIP 中。

## 上传前检查

- ZIP 根目录直接包含 `manifest.json`，不能多套一层目录。
- `package.json` 与构建产物中的版本号一致，且新版本高于商店现有版本。
- 不包含密钥、开发 profile、测试文件、源码映射或 `.DS_Store`。
- 商店说明准确披露页面文本可能发送到用户选择的第三方翻译服务。
- 隐私政策与代码实际的数据存储、传输和删除行为一致。
