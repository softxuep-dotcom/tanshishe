'use client';
import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { HEROES, StreetGame, type Action, type Role, type EnemyKind } from '../../game/street/simulation';
import './street.css';

export default function StreetPage() {
  const [sim] = useState(() => new StreetGame()); const [, render] = useState(0);
  const host = useRef<HTMLDivElement>(null); const [ready, setReady] = useState(false); const [error, setError] = useState(false);
  const [role, setRole] = useState<Role>('chen'); const [trainingPanel, setTrainingPanel] = useState(false); const [muted, setMuted] = useState(false); const muteRef = useRef(false);
  const audio = useRef<AudioContext | null>(null); const stick = useRef<number | null>(null); const [knob, setKnob] = useState({ x: 0, y: 0 });
  const refresh = () => render(n => n + 1);
  function unlock() { try { audio.current ??= new AudioContext(); void audio.current.resume(); } catch {} }
  function sound(name: string) {
    const ctx = audio.current; if (!ctx || muteRef.current || ctx.state !== 'running') return;
    const oscillator = ctx.createOscillator(), gain = ctx.createGain(); const now = ctx.currentTime;
    oscillator.type = name === 'hit' || name === 'hurt' ? 'square' : 'triangle';
    oscillator.frequency.setValueAtTime(name === 'special' ? 250 : name === 'heal' ? 650 : name === 'hit' ? 125 : 85, now);
    oscillator.frequency.exponentialRampToValueAtTime(name === 'heal' ? 1000 : 35, now + .12);
    gain.gain.setValueAtTime(.045, now); gain.gain.exponentialRampToValueAtTime(.001, now + .14);
    oscillator.connect(gain); gain.connect(ctx.destination); oscillator.start(); oscillator.stop(now + .15);
  }
  useEffect(() => {
    let disposed = false; let game: { destroy: (remove: boolean) => void } | undefined;
    import('../../game/street/renderer').then(({ createStreetGame }) => { if (disposed || !host.current) return; game = createStreetGame(host.current, sim, () => render(n => n + 1), sound); setReady(true); }).catch(() => setError(true));
    const keys = new Set<string>();
    const move = () => { sim.mx = Number(keys.has('d') || keys.has('arrowright')) - Number(keys.has('a') || keys.has('arrowleft')); sim.my = Number(keys.has('s') || keys.has('arrowdown')) - Number(keys.has('w') || keys.has('arrowup')); };
    const down = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || /INPUT|TEXTAREA|SELECT/.test((e.target as HTMLElement)?.tagName)) return;
      const k = e.key.toLowerCase(); if (!['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright','j','k','l','i',' ','escape'].includes(k)) return;
      if (sim.phase !== 'playing') return; e.preventDefault(); unlock(); keys.add(k); move();
      if (k === 'j') sim.held = true;
      if (!e.repeat) { if (k === 'k' || k === ' ') sim.action('jump'); if (k === 'l') sim.action('throw'); if (k === 'i') sim.action('special'); if (k === 'escape') { sim.paused = !sim.paused; sim.clearInput(); keys.clear(); refresh(); } }
    };
    const up = (e: KeyboardEvent) => { keys.delete(e.key.toLowerCase()); move(); if (e.key.toLowerCase() === 'j') sim.held = false; };
    const blur = () => { keys.clear(); sim.clearInput(); stick.current = null; setKnob({ x: 0, y: 0 }); if (sim.phase === 'playing') sim.paused = true; refresh(); };
    const visibility = () => { if (document.hidden) blur(); };
    window.addEventListener('keydown', down); window.addEventListener('keyup', up); window.addEventListener('blur', blur); document.addEventListener('visibilitychange', visibility);
    return () => { disposed = true; game?.destroy(true); window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); window.removeEventListener('blur', blur); document.removeEventListener('visibilitychange', visibility); void audio.current?.close(); audio.current = null; };
  }, [sim]);
  function joystick(e: PointerEvent<HTMLDivElement>) {
    if (stick.current !== e.pointerId) return; const b = e.currentTarget.getBoundingClientRect(); const x = e.clientX - b.left - b.width / 2, y = e.clientY - b.top - b.height / 2;
    const scale = Math.max(1, Math.hypot(x, y) / 34); sim.mx = x / scale / 34; sim.my = y / scale / 34; setKnob({ x: x / scale, y: y / scale });
  }
  function releaseStick(e: PointerEvent<HTMLDivElement>) { if (stick.current !== e.pointerId) return; stick.current = null; sim.mx = 0; sim.my = 0; setKnob({ x: 0, y: 0 }); }
  function actionButton(action: Action, text: string, key: string) {
    return <button className={`street-action ${action}`} aria-label={text} onPointerDown={e => { e.preventDefault(); unlock(); e.currentTarget.setPointerCapture(e.pointerId); if (action === 'attack') sim.held = true; sim.action(action); }} onPointerUp={() => { if (action === 'attack') sim.held = false; }} onPointerCancel={() => { if (action === 'attack') sim.held = false; }} onLostPointerCapture={() => { if (action === 'attack') sim.held = false; }}><b>{text}</b><small>{key}</small></button>;
  }
  const play = sim.phase === 'playing'; const boss = sim.enemies.find(e => e.kind === 'boss');
  return <main className="street-shell">
    <div className="street-top"><span>第一章试玩</span><span>南桥街 <em>／ 最后一场</em></span><button onClick={() => { setMuted(!muted); muteRef.current = !muted; }}>声音 {muted ? '关' : '开'}</button></div>
    <section className="street-stage">
      {sim.phase === 'select' && ready && !error && <button className="training-entry" onClick={() => { unlock(); sim.startTraining(role); sim.paused = true; setTrainingPanel(true); refresh(); }}>练习场</button>}
      {sim.training && !trainingPanel && <button className="training-entry" onClick={() => { sim.paused = true; sim.clearInput(); setTrainingPanel(true); refresh(); }}>陪练设置</button>}
      {sim.training && trainingPanel && <div className="street-overlay training-panel">
        <h2>桥下练习场</h2><p>切换陪练会清除当前敌人；重置会恢复双方状态。</p>
        <label>角色 <select value={sim.role} onChange={e => { sim.role = e.target.value as Role; sim.resetTraining(); sim.paused = true; refresh(); }}>{(Object.keys(HEROES) as Role[]).map(id => <option key={id} value={id}>{HEROES[id].name}</option>)}</select></label>
        <label>陪练 <select value={sim.trainingEnemy} onChange={e => { sim.setTrainingOpponents(e.target.value as EnemyKind, sim.trainingCount); refresh(); }}><option value="punk">街头拳手</option><option value="runner">游斗快手</option><option value="tank">壮汉</option><option value="boss">铁头 Boss</option></select></label>
        <label>数量 <select value={sim.trainingCount} onChange={e => { sim.setTrainingOpponents(sim.trainingEnemy, Number(e.target.value)); refresh(); }}>{[1,2,3,4].map(n => <option key={n}>{n}</option>)}</select></label>
        <div className="training-options">{([['godMode','无敌'],['freezeEnemies','陪练不行动'],['showRanges','显示判定范围']] as const).map(([key,label]) => <label key={key}><input type="checkbox" checked={sim[key]} onChange={e => { sim[key] = e.target.checked; refresh(); }}/>{label}</label>)}</div>
        <div className="training-tools"><button onClick={() => { sim.hero.hp = sim.hero.max; refresh(); }}>回满生命</button><button onClick={() => { sim.rage = 100; refresh(); }}>补满怒气</button><button onClick={() => { sim.resetTraining(); sim.paused = true; refresh(); }}>重置战斗</button></div>
        <button className="street-primary" onClick={() => { sim.paused = false; setTrainingPanel(false); refresh(); }}>开始练习</button>
        <button className="street-secondary" onClick={() => { sim.start(sim.role); sim.phase = 'select'; setTrainingPanel(false); refresh(); }}>退出练习场</button>
      </div>}
      <div ref={host} className="street-canvas" />
      {play && <><div className="street-hud"><div><strong>{HEROES[sim.role].name}</strong><span className="street-hp"><i style={{ width: `${sim.hero.hp / sim.hero.max * 100}%` }} /></span><small>HP {Math.ceil(sim.hero.hp)}　<span className="street-rage">怒气 {sim.rage}/100</span></small></div><div className="street-chapter">01 / 南桥夜市<small>{boss ? '躲开冲撞，抓住破绽' : `清场 ${Math.min(sim.wave + 1, 3)}/3 · 击倒 ${sim.kills}`}</small></div><button onClick={() => { sim.paused = true; sim.clearInput(); refresh(); }}>Ⅱ</button></div>{sim.combo > 1 && <div className="street-combo"><b>{sim.combo}</b> HITS</div>}</>}
      {sim.phase === 'select' && <div className="street-overlay street-select"><p className="street-kicker">原创街头动作 · 第一章试玩</p><h1>南桥街<span>最后一场</span></h1><p className="street-subtitle">今晚这顿饭，得打完再吃。</p><div className="street-roster">{(Object.keys(HEROES) as Role[]).map((id, i) => <button key={id} className={role === id ? 'selected' : ''} onClick={() => setRole(id)}><span className={`street-portrait portrait-${id}`}><i /><b>{['拳','摔','踢'][i]}</b></span><strong>{HEROES[id].name}</strong><small>{HEROES[id].detail}</small></button>)}</div><button disabled={!ready || error} className="street-primary" onClick={() => { unlock(); sim.start(role); refresh(); }}>{error ? '加载失败，请刷新' : ready ? `选 ${HEROES[role].name} · 开打 →` : '正在准备夜市…'}</button><p className="street-help">电脑 WASD 移动 · J 连打 · K 跳跃 · L 抓投 · I 绝招<br />手机用摇杆和右侧按键，横屏更开阔</p></div>}
      {sim.phase === 'intro' && <div className="street-overlay street-story"><span className="street-kicker">第一关 / 饭还没吃完</span><h2>一副旧拳套，砸进了菜盘。</h2><p><b>打手</b>「陆川让带句话。今晚的比赛，你们别去。」</p><p><b>陈野</b>「他人呢？」</p><p><b>小满</b>「先把拳套拿出来。还有，桌子打坏了要赔。」</p><div className="street-tutorial">按住 <b>攻击</b> 连打　靠近小兵按 <b>抓投</b><br /><b>跳跃</b> 躲拳并接飞踢　50 怒气释放 <b>绝招</b></div><button className="street-primary" onClick={() => { sim.proceed(); refresh(); }}>推开椅子，出去打 →</button></div>}
      {sim.phase === 'bossIntro' && <div className="street-overlay street-story"><span className="street-kicker">关底 / 铁头</span><h2>「这条街，我说了算。」</h2><p><b>铁头</b>「陆川现在吃黑桥的饭，轮得到你们管？」</p><p><b>{HEROES[sim.role].name}</b>「我们找他吃顿饭，不用你批。」</p><div className="street-tutorial">红色预警后铁头会冲撞。<br />上下走位或跳跃避开，等他停下来反击。</div><button className="street-primary" onClick={() => { sim.proceed(); refresh(); }}>那就让开。</button></div>}
      {play && sim.paused && !trainingPanel && <div className="street-overlay street-story"><span className="street-kicker">歇口气</span><h2>夜市还在等你。</h2><button className="street-primary" onClick={() => { unlock(); sim.paused = false; refresh(); }}>继续打</button><button className="street-secondary" onClick={() => { if (sim.training) sim.resetTraining(); else sim.start(sim.role); refresh(); }}>重新挑战</button><button className="street-secondary" onClick={() => { sim.start(sim.role); sim.phase = 'select'; sim.paused = false; refresh(); }}>返回选人</button></div>}
      {(sim.phase === 'won' || sim.phase === 'lost') && <div className="street-overlay street-story"><span className="street-kicker">{sim.phase === 'won' ? '第一章完成 / 南桥夜市' : '倒下了，但饭还没吃'}</span><h2>{sim.phase === 'won' ? '「给陆川留个座。」' : '再来一次。'}</h2><p>{sim.phase === 'won' ? '林夏骑着摩托赶来：「手伸出来。别藏了，我看见了。」' : '别站在人堆中硬拼。抓投能撞倒后方敌人，绝招可以解围。'}</p><p>{sim.phase === 'won' ? '阿拓：「走吧，去河边货场找他。」' : `这次击倒 ${sim.kills} 人。换个打法再试。`}</p>{sim.phase === 'won' && <div className="street-tutorial">本次原型到这里结束。后续计划：河边货场 → 天桥上的陆川 → 黑桥赛场。</div>}<button className="street-primary" onClick={() => { if (sim.training) sim.resetTraining(); else sim.start(sim.role); refresh(); }}>再打一场</button><button className="street-secondary" onClick={() => { sim.start(sim.role); sim.phase = 'select'; refresh(); }}>换个角色</button></div>}
    </section>
    <div className={`street-controls ${play && !sim.paused ? '' : 'inactive'}`}>
      <div className="street-stick" aria-label="移动摇杆" onPointerDown={e => { if (stick.current !== null) return; stick.current = e.pointerId; e.currentTarget.setPointerCapture(e.pointerId); unlock(); joystick(e); }} onPointerMove={joystick} onPointerUp={releaseStick} onPointerCancel={releaseStick} onLostPointerCapture={releaseStick}><span>＋</span><i style={{ transform: `translate(${knob.x}px,${knob.y}px)` }} /></div>
      <div className="street-control-note">WASD 移动<br /><span>抓投破围 · 跳踢追击</span></div>
      <div className="street-buttons">{actionButton('throw', '抓投', 'L')}{actionButton('jump', '跳跃', 'K')}{actionButton('special', '绝招', 'I · 50怒气')}{actionButton('attack', '攻击', 'J · 按住')}</div>
    </div>
  </main>;
}


