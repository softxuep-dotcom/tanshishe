# GitHub Pages 发布与试玩

正式地址：https://softxuep-dotcom.github.io/tanshishe/

手机网页优先，推荐横屏。GitHub Pages 为公开试玩，不需要 ChatGPT 登录。旧 Sites 地址不再接收更新。

## 一键发布

1. 保存项目文件。
2. 双击根目录 `Publish-Game.cmd`。
3. 脚本会将本仓库所有未忽略的修改（含新增和删除）提交，然后推送 `main`，并打开 GitHub Actions 页面。
4. 等最新的 `Deploy game to GitHub Pages` 显示绿色成功，再双击 `Play-Game.cmd`，或在手机刷新正式地址。

本机需要 Git 已登录 GitHub。无需 Codex、Sites 插件、手工上传或长期发布密钥。请勿将私密文件放进未忽略的项目路径。脚本不会强制推送，遇到远端冲突会停止；请处理冲突后重试。

不想自动提交所有修改时，可以自行选择文件提交，再执行 `git push origin main`，同样触发部署。没有新提交的重复 push 不会触发工作流；可到 Actions 手动 Run workflow 重新发布。

`Publish-Game.cmd` 的成功只代表推送成功，最终以 Actions 的部署结果为准。测试或构建失败不会发布新版本。

## 流程与配置

- 仓库：https://github.com/softxuep-dotcom/tanshishe
- 工作流：`.github/workflows/deploy-pages.yml`
- 自动触发：推送到 `main`；也支持 Actions 手动触发。
- Node 24，npm ci，8 项战斗测试、TypeScript 检查、静态构建，然后部署 `dist/pages`。
- `npm run build:pages` 使用独立静态入口 `pages/`，复用游戏页面，通过 `vite.pages.config.ts` 设置 `/tanshishe/` 资源前缀，避开 SSR 路由导出。
- 普通 `npm run dev` 继续从 `/` 访问。Pages 静态产物需要从 `/tanshishe/` 路径访问。
- 仓库 Settings → Pages 的 Source 使用 GitHub Actions。

手机可访问正式网址，不要求开发电脑开机或同一 Wi-Fi。新版本未出现时，先确认 Actions 成功，再刷新或关闭旧标签重开。

## 仅检查一键入口

PowerShell：`./scripts/request-publish.ps1 -CheckOnly`。不会提交或推送。

GitHub 官方说明：https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages

