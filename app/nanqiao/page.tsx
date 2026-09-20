'use client';
import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { HEROES, StreetGame, isBoss, type Action, type Role, type EnemyKind } from '../../game/street/simulation';
import './street.css';
import { DoublePushRun, readStick } from '../../game/street/touch-input';

export default function StreetPage() {
  const [sim] = useState(() => new StreetGame()); const [, render] = useState(0);
  const host = useRef<HTMLDivElement>(null); const [ready, setReady] = useState(false); const [error, setError] = useState(false);
  const shell = useRef<HTMLElement>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [fullscreenMessage, setFullscreenMessage] = useState('');
  useEffect(() => {
    const changed = () => setFullscreen(document.fullscreenElement === shell.current);
    document.addEventListener('fullscreenchange', changed);
    return () => document.removeEventListener('fullscreenchange', changed);
  }, []);
  async function toggleFullscreen() {
    setFullscreenMessage('');
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else if (shell.current?.requestFullscreen) await shell.current.requestFullscreen();
      else setFullscreenMessage('此浏览器不支持全屏，请尝试从浏览器菜单添加到主屏幕。');
    } catch { setFullscreenMessage('未能进入全屏，请再点一次或使用支持全屏的浏览器。'); }
  }
  const [role, setRole] = useState<Role>('chen'); const [chapter, setChapter] = useState<0 | 1>(0); const [trainingPanel, setTrainingPanel] = useState(false); const [muted, setMuted] = useState(false); const muteRef = useRef(false);
  const audio = useRef<AudioContext | null>(null); const stick = useRef<number | null>(null); const [knob, setKnob] = useState({ x: 0, y: 0 });
  const attackPointer = useRef<number | null>(null);
  const touchRun = useRef(new DoublePushRun());
  useEffect(() => {
    if (sim.paused || sim.phase !== 'playing') {
      touchRun.current.reset(); stick.current = null; attackPointer.current = null;
      sim.clearInput(); setKnob({ x: 0, y: 0 });
    }
  }, [sim, sim.paused, sim.phase]);
  const refresh = () => render(n => n + 1);
  function unlock() { try { audio.current ??= new AudioContext(); void audio.current.resume(); } catch {} }
  function sound(name: string) {
    const ctx = audio.current; if (!ctx || muteRef.current || ctx.state !== 'running') return;
    const oscillator = ctx.createOscillator(), gain = ctx.createGain(); const now = ctx.currentTime;
    oscillator.type = name === 'hit' || name === 'heavy' || name === 'hurt' ? 'square' : 'triangle';
    oscillator.frequency.setValueAtTime(name === 'heavy' ? 65 : name === 'special' ? 250 : name === 'heal' ? 650 : name === 'hit' ? 125 : 85, now);
    oscillator.frequency.exponentialRampToValueAtTime(name === 'heal' ? 1000 : 35, now + .12);
    gain.gain.setValueAtTime(name === 'swing' ? .012 : name === 'heavy' ? .065 : .035, now); gain.gain.exponentialRampToValueAtTime(.001, now + .14);
    oscillator.connect(gain); gain.connect(ctx.destination); oscillator.start(); oscillator.stop(now + .15);
  }
  useEffect(() => {
    let disposed = false; let game: { destroy: (remove: boolean) => void } | undefined;
    import('../../game/street/renderer').then(({ createStreetGame }) => { if (disposed || !host.current) return; game = createStreetGame(host.current, sim, () => render(n => n + 1), sound); setReady(true); }).catch(() => setError(true));
    const keys = new Set<string>();
    const move = () => { sim.mx = Number(keys.has('d') || keys.has('arrowright')) - Number(keys.has('a') || keys.has('arrowleft')); sim.my = Number(keys.has('s') || keys.has('arrowdown')) - Number(keys.has('w') || keys.has('arrowup')); sim.sprint = keys.has('shift'); };
    const down = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || /INPUT|TEXTAREA|SELECT/.test((e.target as HTMLElement)?.tagName)) return;
      const k = e.key.toLowerCase(); if (!['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright','j','k','l','i',' ','escape','shift'].includes(k)) return;
      if (sim.paused && k !== 'escape') return;
      if (sim.phase !== 'playing') return; e.preventDefault(); unlock(); keys.add(k); move();
      if (k === 'j') sim.held = true;
      if (!e.repeat) { if (k === 'j') sim.requestAction('attack'); if (k === 'k' || k === ' ') sim.requestAction('jump'); if (k === 'l') sim.requestAction('throw'); if (k === 'i') sim.requestAction('special'); if (k === 'escape') { sim.paused = !sim.paused; sim.clearInput(); keys.clear(); refresh(); } }
    };
    const up = (e: KeyboardEvent) => { keys.delete(e.key.toLowerCase()); move(); if (e.key.toLowerCase() === 'j') sim.held = false; };
    const blur = () => { keys.clear(); sim.clearInput(); stick.current = null; attackPointer.current = null; setKnob({ x: 0, y: 0 }); if (sim.phase === 'playing') sim.paused = true; refresh(); };
    const visibility = () => { if (document.hidden) blur(); };
    window.addEventListener('keydown', down); window.addEventListener('keyup', up); window.addEventListener('blur', blur); document.addEventListener('visibilitychange', visibility);
    return () => { disposed = true; game?.destroy(true); window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); window.removeEventListener('blur', blur); document.removeEventListener('visibilitychange', visibility); void audio.current?.close(); audio.current = null; };
  }, [sim]);
  function joystick(e: PointerEvent<HTMLDivElement>) {
    if (stick.current !== e.pointerId) return; const b = e.currentTarget.getBoundingClientRect(); const x = e.clientX - b.left - b.width / 2, y = e.clientY - b.top - b.height / 2;
    const input = readStick(x, y, b.width / 2);
    sim.mx = input.x; sim.my = input.y;
    sim.sprint = touchRun.current.update(input.x, input.y, performance.now());
    setKnob({ x: input.knobX * .65, y: input.knobY * .65 });
  }
  function releaseStick(e: PointerEvent<HTMLDivElement>) {
    if (stick.current !== e.pointerId) return;
    if (e.type === 'pointerup') touchRun.current.update(0, 0, performance.now());
    else touchRun.current.reset();
    stick.current = null; sim.mx = 0; sim.my = 0; sim.sprint = false; setKnob({ x: 0, y: 0 });
  }
  function actionButton(action: Action, text: string, key: string) {
    const release = (e: PointerEvent<HTMLButtonElement>) => {
      if (action === 'attack' && attackPointer.current === e.pointerId) { attackPointer.current = null; sim.held = false; }
    };
    return <button className={`street-action ${action} ${action === 'throw' && sim.grabTarget ? 'available' : ''}`} aria-label={text} onPointerDown={e => {
      e.preventDefault();
      if (action === 'attack' && attackPointer.current !== null) return;
      unlock(); e.currentTarget.setPointerCapture(e.pointerId);
      if (action === 'attack') { attackPointer.current = e.pointerId; sim.held = true; }
      sim.requestAction(action);
    }} onPointerUp={release} onPointerCancel={release} onLostPointerCapture={release}><b>{text}</b><small>{key}</small></button>;
  }
  const play = sim.phase === 'playing'; const boss = sim.enemies.find(e => isBoss(e.kind));
  return <main ref={shell} className="street-shell">
    <div className="street-top"><span>两章试玩</span><span>南桥街 <em>／ 最后一场</em></span><div className="street-top-actions"><button aria-pressed={fullscreen} onClick={() => void toggleFullscreen()}>{fullscreen ? '退出全屏' : '全屏'}</button><button onClick={() => { setMuted(!muted); muteRef.current = !muted; }}>声音 {muted ? '关' : '开'}</button></div></div>
    {fullscreenMessage && <div className="street-fullscreen-message" role="status">{fullscreenMessage}<button aria-label="关闭提示" onClick={() => setFullscreenMessage('')}>×</button></div>}
    <section className="street-stage">
      {sim.phase === 'select' && ready && !error && <button className="training-entry" onClick={() => { unlock(); sim.startTraining(role); sim.paused = true; setTrainingPanel(true); refresh(); }}>练习场</button>}
      {sim.training && !trainingPanel && <button className="training-entry" onClick={() => { sim.paused = true; sim.clearInput(); setTrainingPanel(true); refresh(); }}>陪练设置</button>}
      {sim.training && trainingPanel && <div className="street-overlay training-panel">
        <h2>桥下练习场</h2><p>切换陪练会清除当前敌人；重置会恢复双方状态。</p>
        <label>角色 <select aria-label="角色" value={sim.role} onChange={e => { sim.role = e.target.value as Role; sim.resetTraining(); sim.paused = true; refresh(); }}>{(Object.keys(HEROES) as Role[]).map(id => <option key={id} value={id}>{HEROES[id].name}</option>)}</select></label>
        <label>陪练 <select aria-label="陪练" value={sim.trainingEnemy} onChange={e => { sim.setTrainingOpponents(e.target.value as EnemyKind, sim.trainingCount); refresh(); }}><option value="punk">街头拳手</option><option value="runner">游斗快手</option><option value="tank">壮汉</option><option value="boss">铁头 Boss</option><option value="slinger">投掷手</option><option value="longleg">长腿 Boss</option></select></label>
        <label>数量 <select aria-label="数量" value={sim.trainingCount} onChange={e => { sim.setTrainingOpponents(sim.trainingEnemy, Number(e.target.value)); refresh(); }}>{[1,2,3,4].map(n => <option key={n}>{n}</option>)}</select></label>
        <div className="training-options">{([['godMode','无敌'],['freezeEnemies','陪练不行动'],['showRanges','显示判定范围']] as const).map(([key,label]) => <label key={key}><input type="checkbox" checked={sim[key]} onChange={e => { sim[key] = e.target.checked; refresh(); }}/>{label}</label>)}</div>
        <div className="training-tools"><button onClick={() => { sim.hero.hp = sim.hero.max; refresh(); }}>回满生命</button><button onClick={() => { sim.rage = 100; refresh(); }}>补满怒气</button><button onClick={() => { sim.resetTraining(); sim.paused = true; refresh(); }}>重置战斗</button></div>
        <button className="street-primary" onClick={() => { sim.paused = false; setTrainingPanel(false); refresh(); }}>开始练习</button>
        <button className="street-secondary" onClick={() => { sim.start(sim.role); sim.phase = 'select'; setTrainingPanel(false); refresh(); }}>退出练习场</button>
      </div>}
      <div ref={host} className="street-canvas" />
      {play && <><div className="street-hud"><div><strong>{HEROES[sim.role].name}</strong><span className="street-hp"><i style={{ width: `${sim.hero.hp / sim.hero.max * 100}%` }} /></span><small>HP {Math.ceil(sim.hero.hp)}　<span className="street-rage">怒气 {sim.rage}/100</span></small></div><div className="street-chapter">{sim.training ? '练习场' : `${sim.chapter + 1} / ${sim.chapterName}`}<small>{boss ? (boss.kind === 'longleg' ? '避开长踢，近身反击' : '躲开冲撞，抓住破绽') : `清场 ${Math.min(sim.wave + 1, 3)}/3 · 击倒 ${sim.kills}`}</small></div><button onClick={() => { sim.paused = true; sim.clearInput(); refresh(); }}>Ⅱ</button></div>{sim.combo > 1 && <div className="street-combo"><b>{sim.combo}</b> HITS</div>}</>}
      {sim.phase === 'select' && <div className="street-overlay street-select"><p className="street-kicker">原创街头动作 · 两章试玩</p><h1>南桥街<span>最后一场</span></h1><p className="street-subtitle">今晚这顿饭，得打完再吃。</p><div className="street-roster">{(Object.keys(HEROES) as Role[]).map((id, i) => <button key={id} className={role === id ? 'selected' : ''} onClick={() => setRole(id)}><span className={`street-portrait portrait-${id}`}><i /><b>{['拳','摔','踢'][i]}</b></span><strong>{HEROES[id].name}</strong><small>{HEROES[id].detail}</small></button>)}</div><div className="chapter-picker">{([0,1] as const).map(n => <button key={n} aria-pressed={chapter===n} onClick={() => setChapter(n)}>{n===0 ? '01 南桥夜市' : '02 河边货场'}</button>)}</div><button disabled={!ready || error} className="street-primary" onClick={() => { unlock(); sim.start(role, chapter); refresh(); }}>{error ? '加载失败，请刷新' : ready ? `选 ${HEROES[role].name} · 开打 →` : '正在准备夜市…'}</button><p className="street-help">电脑 WASD 移动 · J 连打 · K 跳跃 · L 抓投 · I 绝招<br />手机用摇杆和右侧按键，横屏更开阔</p></div>}
      {sim.phase === 'intro' && <div className="street-overlay street-story"><span className="street-kicker">{sim.chapter===0 ? '第一关 / 饭还没吃完' : '第二关 / 他欠的是什么'}</span><h2>{sim.chapter===0 ? '一副旧拳套，砸进了菜盘。' : '河风吹过上锁的货场。'}</h2>{sim.chapter===0 ? <><p><b>打手</b>「陆川让带句话。今晚的比赛，你们别去。」</p><p><b>陈野</b>「他人呢？」</p><p><b>小满</b>「先把拳套拿出来。桌子打坏了要赔。」</p></> : <><p><b>小满</b>「练拳的地方，为什么要锁大门？」</p><p><b>阿拓</b>「怕人进来。」</p><p><b>陈野</b>「也可能怕人出去。」</p></>}<div className="street-tutorial">{sim.chapter===0 ? <>按住攻击连打 · 靠近抓投 · 跳跃接飞踢<br/>50 怒气释放绝招</> : <>靠近木箱按<b>抓投</b>举起，按<b>攻击</b>扔出<br/>再次抓投可放下；绿标箱破碎掉补给，木箱能挡罐子。</>}</div><button className="street-primary" onClick={() => { sim.proceed(); refresh(); }}>{sim.chapter===0?'推开椅子，出去打 →':'走，去货场 →'}</button></div>}
      {sim.phase === 'bossIntro' && <div className="street-overlay street-story"><span className="street-kicker">关底 / {sim.bossName}</span><h2>{sim.chapter===0 ? '「这条街，我说了算。」' : '「你回来一天，知道什么？」'}</h2><p><b>{sim.bossName}</b>{sim.chapter===0 ? '「陆川现在吃黑桥的饭，轮得到你们管？」' : '「他没地方住的时候，是韩哥收留的。」'}</p><p><b>{HEROES[sim.role].name}</b>{sim.chapter===0 ? '「我们找他吃顿饭，不用你批。」' : '「所以现在，他连比赛都不能自己打？」'}</p><div className="street-tutorial">{sim.chapter===0 ? <>红色预警后铁头会冲撞。<br/>上下走位或跳跃避开，停下后反击。</> : <>长腿蓄力后会踢向前方。<br/>上下走位或跳跃躲开，趁收腿时近身，也可投箱打断。</>}</div><button className="street-primary" onClick={() => { sim.proceed(); refresh(); }}>那就让开。</button></div>}
      {play && sim.paused && !trainingPanel && <div className="street-overlay street-story"><span className="street-kicker">歇口气</span><h2>夜市还在等你。</h2><button className="street-primary" onClick={() => { unlock(); sim.paused = false; refresh(); }}>继续打</button><button className="street-secondary" onClick={() => { if (sim.training) sim.resetTraining(); else sim.start(sim.role, sim.chapter); refresh(); }}>重新挑战</button><button className="street-secondary" onClick={() => { sim.start(sim.role); sim.phase = 'select'; sim.paused = false; refresh(); }}>返回选人</button></div>}
      {(sim.phase === 'won' || sim.phase === 'lost') && <div className="street-overlay street-story"><span className="street-kicker">{sim.phase==='won' ? sim.chapterName+' / 完成' : '倒下了，再来一场'}</span><h2>{sim.phase==='won' ? (sim.chapter===0?'「给陆川留个座。」':'「他一直留着你们的合照。」') : '换个打法，再来。'}</h2><p>{sim.phase==='won' ? (sim.chapter===0?'林夏：「手伸出来。别藏了，我看见了。」':'长腿：「搬了三次宿舍，都没扔。他现在在旧商场天桥。」') : '不要站在人堆里硬拼。跳跃躲投掷，抓投破围，绝招解围。'}</p><p>{sim.phase==='won' ? (sim.chapter===0?'阿拓：「走吧，去河边货场找他。」':'小满：「走。饭凉了可以热，人得叫回来。」') : '本场击倒 '+sim.kills+' 人。'}</p>{sim.phase==='won' && sim.chapter===0 && <button className="street-primary" onClick={() => { sim.nextChapter(); refresh(); }}>前往第二关 · 河边货场 →</button>}{sim.phase==='won' && sim.chapter===1 && <div className="street-tutorial">目前两章试玩到这里结束。下一站：天桥上的陆川。</div>}<button className={sim.phase==='won' && sim.chapter===0?'street-secondary':'street-primary'} onClick={() => { if(sim.training)sim.resetTraining();else sim.start(sim.role,sim.chapter);refresh(); }}>重玩本关</button><button className="street-secondary" onClick={() => { sim.start(sim.role);sim.phase='select';refresh(); }}>返回选人</button></div>}
    </section>
    <div className={`street-controls ${play && !sim.paused ? '' : 'inactive'}`}>
      <div className={`street-stick ${sim.running ? 'running' : ''}`} aria-label="移动摇杆，同方向快速推两次奔跑" onPointerDown={e => { if (stick.current !== null) return; stick.current = e.pointerId; e.currentTarget.setPointerCapture(e.pointerId); unlock(); joystick(e); }} onPointerMove={joystick} onPointerUp={releaseStick} onPointerCancel={releaseStick} onLostPointerCapture={releaseStick}><span>＋</span><i style={{ transform: `translate(${knob.x}px,${knob.y}px)` }} /><small>{sim.running ? '奔跑 · 点攻击冲刺' : '同方向双推奔跑'}</small></div>
      <div className="street-control-note">WASD 移动<br /><span>抓投破围 · 跳踢追击</span></div>
      <div className="street-buttons">{actionButton('throw', sim.carried ? '放下' : '抓投/举箱', 'L')}{actionButton('jump', '跳跃', 'K')}{actionButton('special', '绝招', 'I · 50怒气')}{actionButton('attack', sim.carried ? '投箱' : '攻击', sim.carried ? 'J · 扔出' : 'J · 按住')}</div>
    </div>
  </main>;
}



