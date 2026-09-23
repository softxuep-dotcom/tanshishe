import { HEROES } from './simulation.ts';
import type { Role } from './combat-data.ts';

export interface Line { who: string; text: string; }
export interface Scene { kicker: string; title: string; lines: readonly Line[]; tutorial: readonly string[]; button: string; }
export interface Outcome { kicker: string; title: string; lines: readonly string[]; nextLabel: string | null; note: string | null; }
export interface ChapterScript { tip: string; intro: Scene; boss: Record<Role, Scene>; won: Outcome; }

/** `@hero` renders as whichever of the three friends the player picked. */
export const HERO_TOKEN = '@hero';
export const speaker = (who: string, role: Role) => who === HERO_TOKEN ? HEROES[role].name : who;

const ROLES: readonly Role[] = ['chen', 'tuo', 'man'];
/** Most boss scenes differ by a line or two, so build the three variants from one base. */
const perRole = (base: Omit<Scene, 'lines'>, lines: Record<Role, readonly Line[]>): Record<Role, Scene> =>
  Object.fromEntries(ROLES.map(role => [role, { ...base, lines: lines[role] }])) as Record<Role, Scene>;
const shared = (base: Omit<Scene, 'lines'>, lines: readonly Line[]) => perRole(base, { chen: lines, tuo: lines, man: lines });

export const STORY: readonly ChapterScript[] = [
  {
    tip: '连打清兵 · 走进敌人自动抓住 · 跳跃躲攻击',
    intro: {
      kicker: '第一关 / 饭还没吃完', title: '一副旧拳套，砸进了菜盘。',
      lines: [
        { who: '打手', text: '「陆川让带句话。今晚的比赛，你们别去。」' },
        { who: '陈野', text: '「他人呢？」' },
        { who: '小满', text: '「先把拳套拿出来。桌子打坏了要赔。」' },
      ],
      tutorial: ['按住攻击连打 · 走进敌人自动抓住，按攻击扔出 · 跳跃接飞踢', '50 怒气释放绝招'],
      button: '推开椅子，出去打 →',
    },
    boss: shared({
      kicker: '关底 / 铁头', title: '「这条街，我说了算。」',
      tutorial: ['红色预警后铁头会冲撞，上下走位或闪避躲开。', '冲撞结束，绿圈破绽开放 1.2 秒；此时攻击吃满伤害。'],
      button: '那就让开。',
    }, [
      { who: '铁头', text: '「陆川现在吃黑桥的饭，轮得到你们管？」' },
      { who: HERO_TOKEN, text: '「我们找他吃顿饭，不用你批。」' },
    ]),
    won: {
      kicker: '南桥夜市 / 完成', title: '「给陆川留个座。」',
      lines: ['林夏：「手伸出来。别藏了，我看见了。」', '阿拓：「走吧，去河边货场找他。」'],
      nextLabel: '前往第二关 · 河边货场 →', note: null,
    },
  },
  {
    tip: '靠近木箱按攻击举起 · 再按攻击扔出 · 绿标箱内有补给',
    intro: {
      kicker: '第二关 / 他欠的是什么', title: '河风吹过上锁的货场。',
      lines: [
        { who: '小满', text: '「练拳的地方，为什么要锁大门？」' },
        { who: '阿拓', text: '「怕人进来。」' },
        { who: '陈野', text: '「也可能怕人出去。」' },
      ],
      tutorial: ['身边没有敌人时靠近木箱按攻击举起，再按攻击扔出。', '绿标箱破碎掉补给，地面木箱能挡罐子。'],
      button: '走，去货场 →',
    },
    boss: perRole({
      kicker: '关底 / 长腿', title: '「他没地方住的时候，是韩哥收留的。」',
      tutorial: ['长腿蓄力后踢向前方，上下走位或闪避躲开。', '收腿后绿圈破绽开放 0.95 秒；窗口外只能造成 25% 伤害。'],
      button: '那就让他自己告诉我。',
    }, {
      chen: [
        { who: '长腿', text: '「你回来一天，知道什么？」' },
        { who: '陈野', text: '「所以现在，他连比赛都不能自己打？」' },
      ],
      tuo: [
        { who: '长腿', text: '「你们这些年问过他几次？」' },
        { who: '阿拓', text: '「问得少。所以今天亲自来。」' },
      ],
      man: [
        { who: '长腿', text: '「你们这些年问过他几次？」' },
        { who: '小满', text: '「那你让开，我当面问。」' },
      ],
    }),
    won: {
      kicker: '河边货场 / 完成', title: '「他一直留着你们的合照。」',
      lines: ['长腿：「搬了三次宿舍，都没扔。他现在在旧商场天桥。」', '小满：「走。饭凉了可以热，人得叫回来。」'],
      nextLabel: '前往第三关 · 旧商业街 →', note: null,
    },
  },
  {
    tip: '陆川会连拳，也会侧移反击 · 打完一串再进场',
    intro: {
      kicker: '第三关 / 你回来得太晚', title: '游戏厅关了门，褪色的招牌还挂着。',
      lines: [
        { who: '小满', text: '「这家还没拆啊。以前陆川输了，总说摇杆坏了。」' },
        { who: '阿拓', text: '「你每次都信。」' },
        { who: '打手', text: '「这边不通，换条路。找他的人，今晚都得等。」' },
        { who: HERO_TOKEN, text: '「我们找陆川。他在上面等着。」' },
      ],
      tutorial: ['卷帘街窄，木箱仍可举起扔出。', '天桥上只有陆川，不会再有小兵插进来。'],
      button: '穿过商业街 →',
    },
    boss: perRole({
      kicker: '关底 / 陆川', title: '天桥上只站着一个人。',
      tutorial: ['短连拳有明确前摇，上下走位或闪避可以躲开整串。', '他也会侧移一步再反冲；连拳打完或反击落空，绿圈破绽开放 0.8 秒。', '血量过半后连拳多一下、间隔更短。'],
      button: '按老规矩，来一场。',
    }, {
      chen: [
        { who: '陆川', text: '「回来怎么也不说一声？」' },
        { who: '陈野', text: '「想请你吃饭。电话打不通。」' },
        { who: '陆川', text: '「你凭什么觉得，你回来一句话，所有人就还在原地？」' },
        { who: '陈野', text: '「我知道我回来晚了。」' },
        { who: '陆川', text: '「你不知道。想过去，就按以前的规矩。」' },
      ],
      tuo: [
        { who: '阿拓', text: '「你的车，上回修完还没来取。」' },
        { who: '陆川', text: '「最近忙。」' },
        { who: '阿拓', text: '「咱们隔着两条街，已经半年没见了。」' },
        { who: '陆川', text: '「你也知道只有两条街？」' },
        { who: '阿拓', text: '「是我问得少。今天过来了。」' },
        { who: '陆川', text: '「那就按以前的规矩。」' },
      ],
      man: [
        { who: '小满', text: '「给你留了饭。你爱吃的。」' },
        { who: '陆川', text: '「我说过不用留。」' },
        { who: '小满', text: '「每次都说忙，你到底哪天有空？」' },
        { who: '陆川', text: '「别再把我当那个输了就躲进你家饭馆的小孩。」' },
        { who: '小满', text: '「那你自己回去，跟我妈说。」' },
        { who: '陆川', text: '「先过我这关。」' },
      ],
    }),
    won: {
      kicker: '旧商业街 / 完成', title: '「你们要找的那个陆川，没那么好了。」',
      lines: [
        '陆川：「我替他们拦过别人，也说过刚才那些话。」',
        '小满：「谁说我们几个就多好了？」阿拓：「欠别人的，回头一件件还。」',
        '陆川：「韩骁让我今晚输。他帮过我，我一直觉得……我不能拒绝。」',
        '@hero：「今晚这一场，你自己决定怎么打。」',
      ],
      nextLabel: '前往第四关 · 黑桥赛场 →', note: null,
    },
  },
  {
    tip: '韩骁三招轮换：连拳 · 长踢 · 冲撞 · 每串打完才有破绽',
    intro: {
      kicker: '第四关 / 这一场，自己打', title: '陆川没有按安排倒下。',
      lines: [
        { who: '场务', text: '「比赛暂停，谁也别乱走！」' },
        { who: '陆川', text: '「他们只是来比赛的，让他们出去。」' },
        { who: HERO_TOKEN, text: '「你带他们走。这里交给我。」' },
      ],
      tutorial: ['从后台打到擂台，三段全是黑桥的人。', '选手在开出口，陆川照顾伤员；上去的只有你。'],
      button: '从后台打上去 →',
    },
    boss: perRole({
      kicker: '关底 / 韩骁', title: '「你那几招，还是我教的。」',
      tutorial: ['韩骁按固定顺序轮换连拳、长踢和冲撞，各有独立前摇。', '整串打完或冲撞收势，绿圈破绽开放 0.7 秒，比前三关都短。', '血量过半后前摇更快、连拳多一下。'],
      button: '这一场，他自己打。',
    }, {
      chen: [
        { who: '韩骁', text: '「陆川最困难的时候，你们在哪？」' },
        { who: '陈野', text: '「不在。这件事我欠他。」' },
        { who: '陆川', text: '「不是他们带我走。是我要走。」' },
      ],
      tuo: [
        { who: '韩骁', text: '「陆川最困难的时候，你们在哪？」' },
        { who: '阿拓', text: '「没照顾到他，是我们的事。」' },
        { who: '陆川', text: '「不是他们带我走。是我要走。」' },
      ],
      man: [
        { who: '韩骁', text: '「陆川最困难的时候，你们在哪？」' },
        { who: '小满', text: '「你帮过他，他一直记着。」' },
        { who: '陆川', text: '「我记得。所以一直没舍得还手。」' },
      ],
    }),
    won: {
      kicker: '黑桥赛场 / 完成', title: '几周后，桥下拳馆重新开门。',
      lines: [
        '林夏和愿意作证的选手交出了证据，调查开始了。陆川说明了自己的参与。',
        '阿拓：「歪了，左边抬一点。」小满：「你刚才还说右边。」',
        '陆川：「以前这块就歪。」@hero：「那就对了。」',
        '招牌下的小字：打完架，记得回家吃饭。',
      ],
      nextLabel: null,
      note: '四关原型到此结束。序列帧动画、存档和 Poki SDK 仍未实现。',
    },
  },
];
