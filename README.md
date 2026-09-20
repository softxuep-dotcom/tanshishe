# 南桥街：最后一场

手机网页优先。双击 `Publish-Game.cmd` 提交并推送到 GitHub，自动部署 Pages；部署成功后双击 `Play-Game.cmd` 试玩。详见 [发布说明](docs/PUBLISHING.md) 和 [美术基调](docs/ART_DIRECTION.md)。

原创像素横版清关动作游戏原型。首页 `/` 直接进入游戏，旧试玩地址 `/nanqiao` 继续可用。

## 运行

需要 Node.js 22.18+。首次运行 `npm install`，然后执行 `npm run dev -- --host 0.0.0.0 --port 5173`。

电脑打开 http://localhost:5173/；手机连接同一局域网，使用电脑的局域网 IP 和端口 5173，推荐横屏。

## 内容与操作

三个可选角色：陈野、阿拓、小满。第一章包含三段街头清场、十个小兵和铁头 Boss，以及开场、Boss 前和结尾剧情。

第二章河边货场已加入：11 个小兵、投掷手、长腿 Boss，以及可举起投掷的木箱。绿标木箱破碎掉补给，地面木箱能挡罐子。通关夜市可继续，也能在选人页直接选第二关。练习场可测试全部现有敌人和木箱。

WASD / 方向键移动，J 连打，K / 空格跳跃，L 近身抓投，I 消耗 50 怒气释放绝招，Esc 暂停。手机使用摇杆和四个动作按钮。

靠近木箱按 L（抓投）举起，J（投箱）扔出，L（放下）落地。举箱时不能跳跃，受击会掉箱。

角色目前是程序绘制的像素样稿；后续章节、最终动画、存档、武器拾取和 Poki SDK 尚未实现。

## 工程

- `app/page.tsx`：首页入口。
- `app/nanqiao/`：游戏页面、操作、剧情和样式，同时兼容旧试玩地址。
- `game/street/`：独立战斗模拟、Phaser 渲染和模拟测试。
- `docs/NANQIAO_PROTOTYPE.md`：实现范围与原型边界。

## 验证与构建

```sh
node --experimental-strip-types --test game/street/simulation.test.mjs
npx tsc --noEmit
npm run build
```

静态产物位于 `dist/client`。发布目标已切换到 GitHub Pages，推送 main 自动部署，具体方式见发布说明。

