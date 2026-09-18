# 钩子搬运工 / Hook & Haul

手机与桌面浏览器的 Phaser 2D 玩法原型。首页是新搬运原型；此前的《拖车大逃亡》保留在 `/convoy`。

## 运行

需要 Node 22.18+。安装依赖后运行 `npm run dev -- --host 0.0.0.0 --port 5173`。同一局域网的手机使用开发电脑的局域网 IP 和端口 5173；运行终端需要保持开启。线上试玩沿用现有 Sites 站点和访问权限。

## 怎么玩

- 按住货物牵引，松手脱钩。轻货主要靠近机器人，重货更多地拉动机器人。
- 按住蓝色固定点移动机器人，从不同方向搬运货物。
- 货物完整进入绿色区域且停稳后，点击装车。已就位货物仍能拉出来使用。
- 第三关可以借重箱压门，也可从右侧绕路；门洞有人或货时暂缓关门。
- 撤销免费；电脑按 Z 撤销、R 重来、Esc 暂停。
- 通关与声音设置保存在本地；刷新后当前房间从头开始。存储不可用仍可玩。

## 三个房间

1. 第一份委托：一次拉动与停放。
2. 换个角度：换位、绕过障碍、搬运不同重量货物。
3. 先用，后搬：把重箱作为压板工具，再一起装车。

## 工程与验证

- `game/hook/simulation.ts`：固定步长模拟、质量差、碰撞、交付、压板门与完整撤销。
- `game/hook/renderer.ts`：Phaser 场地、程序化精灵、直线钩索、指针输入和响应式缩放。
- `app/page.tsx` / `app/hook.css`：HUD、暂停、结算、进度保存与声音。
- `app/convoy/page.tsx` / `game/simulation.ts` / `game/renderer.ts`：保留的旧拖车原型。

验证命令：

```sh
node --test game/hook/simulation.test.mjs game/simulation.test.mjs
npx tsc --noEmit
npm run build
```

当前验证包括 11 项新模拟测试、12 项原有回归测试、浏览器触控通关、撤销、暂停、保存恢复、存储失败，以及五种尺寸和旋转屏幕检查。用户已在手机上通过三关，但认为操作缺少乐趣，当前暂停扩关。第二关货物目标提示已修正，详见试玩记录。全仓库 lint 存在原有组件及旧拖车代码告警；新增游戏源文件定向 lint 通过。

原型尚未接入 Poki SDK、广告或完成平台审核。

## 文档

- [新游戏设计](docs/POKI_GAME_DESIGN.md)
- [原型与试玩计划](docs/HOOK_MOVER_PROTOTYPE.md)
- [本次实现和验证记录](docs/HOOK_MOVER_PLAYTEST.md)
- [历史《车队劫持》方案](docs/CONVOY_HEIST_PLAN.md)
