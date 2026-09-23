'use client';
import { useEffect, useRef, useState, type CSSProperties, type PointerEvent } from 'react';
import { BADGES, HEROES, PLAYABLE, StreetGame, isBoss, type Action, type Role, type EnemyKind } from '../../game/street/simulation';
import { CHAPTERS, bossDisplayName, type ChapterIndex } from '../../game/street/chapter-data';
import { HERO_TOKEN, STORY, speaker } from '../../game/street/story-data';
import './street.css';
import { AttackHold, DoublePushRun, readDpad } from '../../game/street/touch-input';

const GLYPHS = {
  expand: 'M1 1h6v2H3v4H1V1zm14 0v6h-2V3H9V1h6zM1 15V9h2v4h4v2H1zm14 0H9v-2h4V9h2v6z',
  shrink: 'M7 7H1V5h4V1h2v6zm2 0V1h2v4h4v2H9zM7 9v6H5v-4H1V9h6zm2 0h6v2h-4v4H9V9z',
  sound: 'M2 6h3l4-4v12l-4-4H2V6zm9 0h1.7v4H11V6zm3.4-2H16v8h-1.6V4z',
  mute: 'M2 6h3l4-4v12l-4-4H2V6zM14.6 1.9 16 3.3 4.4 14.9 3 13.5 14.6 1.9z',
  pause: 'M4 3h3v10H4V3zm5 0h3v10H9V3z',
};
function Glyph({ name }: { name: keyof typeof GLYPHS }) {
  return <svg className="glyph" viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d={GLYPHS[name]} /></svg>;
}
const roleColor = (role: Role) => `#${HEROES[role].color.toString(16).padStart(6, '0')}`;
const MOVE_LABELS: Record<string, string> = { combo: '连拳', counter: '侧移反击', kick: '长踢', charge: '冲撞' };

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
  const [role, setRole] = useState<Role>('chen'); const [chapter, setChapter] = useState<ChapterIndex>(0); const [trainingPanel, setTrainingPanel] = useState(false); const [muted, setMuted] = useState(false); const muteRef = useRef(false);
  const audio = useRef<AudioContext | null>(null); const stick = useRef<number | null>(null); const [pad, setPad] = useState('');
  const attackHold = useRef(new AttackHold());
  const touchRun = useRef(new DoublePushRun());
  useEffect(() => {
    if (sim.paused || sim.phase !== 'playing') {
      touchRun.current.reset(); stick.current = null; attackHold.current.reset();
      sim.clearInput(); setPad('');
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
      const k = e.key.toLowerCase(); if (!['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright','j','k','i','u',' ','escape','shift'].includes(k)) return;
      if (sim.paused && k !== 'escape') return;
      if (sim.phase !== 'playing') return; e.preventDefault(); unlock(); keys.add(k); move();
      if (k === 'j') sim.held = true;
      if (!e.repeat) { if (k === 'j') sim.requestAction('attack'); if (k === 'k' || k === ' ') sim.requestAction('jump'); if (k === 'i') sim.requestAction('special'); if (k === 'u') sim.requestAction('dodge'); if (k === 'escape') { sim.paused = !sim.paused; sim.clearInput(); keys.clear(); refresh(); } }
    };
    const up = (e: KeyboardEvent) => { keys.delete(e.key.toLowerCase()); move(); if (e.key.toLowerCase() === 'j') sim.held = false; };
    const blur = () => { keys.clear(); sim.clearInput(); stick.current = null; attackHold.current.reset(); setPad(''); if (sim.phase === 'playing') sim.paused = true; refresh(); };
    const visibility = () => { if (document.hidden) blur(); };
    window.addEventListener('keydown', down); window.addEventListener('keyup', up); window.addEventListener('blur', blur); document.addEventListener('visibilitychange', visibility);
    return () => { disposed = true; game?.destroy(true); window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); window.removeEventListener('blur', blur); document.removeEventListener('visibilitychange', visibility); void audio.current?.close(); audio.current = null; };
  }, [sim]);
  function joystick(e: PointerEvent<HTMLDivElement>) {
    if (stick.current !== e.pointerId) return; const b = e.currentTarget.getBoundingClientRect(); const x = e.clientX - b.left - b.width / 2, y = e.clientY - b.top - b.height / 2;
    const input = readDpad(x, y, b.width / 2);
    sim.mx = input.x; sim.my = input.y;
    sim.sprint = touchRun.current.update(input.x, input.y, performance.now());
    setPad(input.dir);
  }
  function releaseStick(e: PointerEvent<HTMLDivElement>) {
    if (stick.current !== e.pointerId) return;
    if (e.type === 'pointerup') touchRun.current.update(0, 0, performance.now());
    else touchRun.current.reset();
    stick.current = null; sim.mx = 0; sim.my = 0; sim.sprint = false; setPad('');
  }
  function actionButton(action: Action, text: string, key: string, hint: string) {
    const release = (e: PointerEvent<HTMLButtonElement>) => {
      if (action === 'attack' && attackHold.current.end(e.pointerId)) {
        if (e.type === 'pointerup') sim.held = false;
        else sim.stopHeldAttack();
      }
    };
    const recovering = action === 'dodge' && sim.dodgeCooldown > 0;
    const locked = action === 'special' && sim.rage < 50;
    const ready = action === 'special' && sim.rage >= 50;
    const state = [action, ready ? 'available' : '', recovering ? 'recovering' : '', locked ? 'locked' : ''].filter(Boolean).join(' ');
    return <button className={`street-action ${state}`} aria-label={text} style={{ '--cooldown': action === 'dodge' ? Math.min(1, sim.dodgeCooldown / .55) : 0 } as CSSProperties} onPointerDown={e => {
      e.preventDefault();
      if (sim.paused || sim.phase !== 'playing') return;
      if (action === 'attack' && !attackHold.current.begin(e.pointerId)) return;
      unlock(); e.currentTarget.setPointerCapture(e.pointerId);
      if (action === 'attack') sim.held = true;
      sim.requestAction(action);
    }} onPointerMove={e => {
      if (action === 'attack' && attackHold.current.move(e.pointerId, e.clientX, e.clientY, e.currentTarget.getBoundingClientRect())) sim.stopHeldAttack();
    }} onPointerUp={release} onPointerCancel={release} onLostPointerCapture={release}><b>{text}</b><small className="street-key">{key}</small><small className="street-touch-hint">{recovering ? '恢复中' : hint}</small></button>;
  }
  const play = sim.phase === 'playing'; const boss = sim.enemies.find(e => e.hp > 0 && isBoss(e.kind));
  const script = STORY[sim.chapter]; const bossScene = script.boss[sim.role];
  const heroName = (text: string) => text.split(HERO_TOKEN).join(HEROES[sim.role].name);
  const paragraphs = (lines: readonly string[]) => lines.map((text, i) => <span key={i}>{i > 0 && <br />}{text}</span>);
  const bossOpen = boss ? sim.isBossVulnerable(boss) : false;
  const bossMove = boss ? sim.bossPendingMove(boss) : null;
  const bossState = !boss ? ''
    : bossOpen ? `破绽 ${boss.vulnerable.toFixed(1)}s`
    : boss.motion !== 'grounded' ? '倒地恢复'
    : boss.guard > 0 ? '侧移中 · 霸体'
    : boss.wind > 0 && bossMove ? `${MOVE_LABELS[bossMove]}预警 · 霸体`
    : '霸体 · 破绽里才打得出硬直';
  const waveHint = sim.training ? `陪练剩余 ${sim.remainingEnemies} · 击倒 ${sim.kills}`
    : `剩余 ${sim.remainingEnemies}${sim.pendingEnemies ? ` · 待援 ${sim.pendingEnemies}` : ''}`;
  const shellStyle = { '--role': roleColor(sim.role) } as CSSProperties;
  const tools = <div className="hud-tools">
    <button className="icon-button" aria-pressed={fullscreen} aria-label={fullscreen ? '退出全屏' : '全屏'} onClick={() => void toggleFullscreen()}><Glyph name={fullscreen ? 'shrink' : 'expand'} /></button>
    <button className="icon-button" aria-pressed={!muted} aria-label={muted ? '打开声音' : '关闭声音'} onClick={() => { setMuted(!muted); muteRef.current = !muted; }}><Glyph name={muted ? 'mute' : 'sound'} /></button>
    <button className="icon-button" aria-label="暂停" onClick={() => { sim.paused = true; sim.clearInput(); refresh(); }}><Glyph name="pause" /></button>
  </div>;
  return <main ref={shell} className="street-shell" data-phase={sim.phase} data-playing={play ? 'yes' : 'no'} style={shellStyle}>
    {!play && <header className="street-top">
      <span className="street-brand">南桥街<em>最后一场</em></span>
      <span className="street-badge">四章原型</span>
      <div className="street-top-actions">
        <button className="icon-button" aria-pressed={fullscreen} aria-label={fullscreen ? '退出全屏' : '全屏'} onClick={() => void toggleFullscreen()}><Glyph name={fullscreen ? 'shrink' : 'expand'} /></button>
        <button className="icon-button" aria-pressed={!muted} aria-label={muted ? '打开声音' : '关闭声音'} onClick={() => { setMuted(!muted); muteRef.current = !muted; }}><Glyph name={muted ? 'mute' : 'sound'} /></button>
      </div>
    </header>}
    {fullscreenMessage && <div className="street-toast" role="status">{fullscreenMessage}<button aria-label="关闭提示" onClick={() => setFullscreenMessage('')}>×</button></div>}
    <section className="street-stage">
      {sim.phase === 'select' && ready && !error && <button className="training-entry" onClick={() => { unlock(); sim.startTraining(role); sim.paused = true; setTrainingPanel(true); refresh(); }}>练习场</button>}
      {sim.training && !trainingPanel && !sim.paused && <button className="training-entry" onClick={() => { sim.paused = true; sim.clearInput(); setTrainingPanel(true); refresh(); }}>陪练设置</button>}
      {sim.training && trainingPanel && <div className="street-overlay training-panel"><div className="street-plate">
        <span className="street-kicker">训练模式</span>
        <h2>桥下练习场</h2><p className="street-note">切换陪练会清除当前敌人；重置会恢复双方状态。</p>
        <div className="training-rows">
          {PLAYABLE.length > 1 && <label><span>角色</span><select aria-label="角色" value={sim.role} onChange={e => { sim.role = e.target.value as Role; sim.resetTraining(); sim.paused = true; refresh(); }}>{PLAYABLE.map(id => <option key={id} value={id}>{HEROES[id].name}</option>)}</select></label>}
          <label><span>陪练</span><select aria-label="陪练" value={sim.trainingEnemy} onChange={e => { sim.setTrainingOpponents(e.target.value as EnemyKind, sim.trainingCount); refresh(); }}><option value="punk">街头拳手</option><option value="runner">游斗快手</option><option value="tank">壮汉</option><option value="slinger">投掷手</option><option value="blocker">格挡兵</option><option value="grabber">扑抓兵</option><option value="boss">铁头 Boss</option><option value="longleg">长腿 Boss</option><option value="luchuan">陆川 Boss</option><option value="hanxiao">韩骁 Boss</option></select></label>
          <label><span>数量</span><select aria-label="数量" value={sim.trainingCount} onChange={e => { sim.setTrainingOpponents(sim.trainingEnemy, Number(e.target.value)); refresh(); }}>{[1,2,3,4].map(n => <option key={n}>{n}</option>)}</select></label>
        </div>
        <div className="training-options">{([['godMode','无敌'],['freezeEnemies','陪练不行动'],['showRanges','显示判定范围']] as const).map(([key,label]) => <label key={key} className="switch"><input type="checkbox" checked={sim[key]} onChange={e => { sim[key] = e.target.checked; refresh(); }}/><i aria-hidden="true" /><span>{label}</span></label>)}</div>
        <div className="training-tools"><button onClick={() => { sim.hero.hp = sim.hero.max; refresh(); }}>回满生命</button><button onClick={() => { sim.rage = 100; refresh(); }}>补满怒气</button><button onClick={() => { sim.resetTraining(); sim.paused = true; refresh(); }}>重置战斗</button></div>
        <div className="street-actions-row"><button className="street-primary" onClick={() => { sim.paused = false; setTrainingPanel(false); refresh(); }}>开始练习</button></div>
        <button className="street-secondary" onClick={() => { sim.start(sim.role); sim.phase = 'select'; setTrainingPanel(false); refresh(); }}>退出练习场</button>
      </div></div>}
      <div ref={host} className="street-canvas" />
      {play && <>
        <div className="street-hud">
          <div className="hud-hero">
            <div className="hud-name"><strong>{HEROES[sim.role].name}</strong><em>{Math.ceil(sim.hero.hp)}<i>/{sim.hero.max}</i></em></div>
            <div className="hud-bar hp"><u style={{ width: `${sim.hero.hp / sim.hero.max * 100}%` }} /><i style={{ width: `${sim.hero.hp / sim.hero.max * 100}%` }} /></div>
            <div className="hud-bar rage" data-ready={sim.rage >= 50 ? 'yes' : 'no'}><i style={{ width: `${sim.rage}%` }} /><b /></div>
            <small className="hud-rage-label">怒气 {sim.rage}/100{sim.rage >= 50 && <em>绝招就绪</em>}</small>
          </div>
          {boss && <div className="hud-boss" data-open={bossOpen ? 'yes' : 'no'}>
            <div className="hud-boss-name"><span>{bossDisplayName(boss.kind)}</span><em>{bossState}</em></div>
            <div className="hud-bar boss"><u style={{ width: `${boss.hp / boss.max * 100}%` }} /><i style={{ width: `${boss.hp / boss.max * 100}%` }} /></div>
          </div>}
          <div className="hud-right">
            <div className="hud-objective">
              <span>{sim.training ? '练习场' : `${sim.chapter + 1} · ${sim.chapterName}`}</span>
              {!sim.training && <div className="hud-waves" aria-label={`清场进度 ${Math.min(sim.wave + 1, 3)} / 3`}>{[0,1,2].map(i => <i key={i} data-state={i < sim.wave ? 'done' : i === sim.wave ? 'now' : 'next'} />)}</div>}
              <small>{waveHint}</small>
            </div>
            {tools}
          </div>
        </div>
        {sim.combo > 1 && <div className="street-combo" key={sim.combo}><b>{sim.combo}</b><span>HITS</span></div>}
        {sim.time < 9 && <div className="street-tip" style={{ opacity: Math.min(1, (9 - sim.time) / 1.5) }}>{script.tip}</div>}
      </>}
      {sim.phase === 'select' && <div className="street-overlay street-select">
        <p className="street-kicker">原创街头动作 · 四章原型</p>
        <h1>南桥街<span>最后一场</span></h1>
        <p className="street-subtitle">今晚这顿饭，得打完再吃。</p>
        <div className="street-roster">{PLAYABLE.map(id => <button key={id} className={`roster-card ${role === id ? 'selected' : ''}`} aria-pressed={role === id} style={{ '--role': roleColor(id) } as CSSProperties} onClick={() => setRole(id)}>
          <span className={`street-portrait portrait-${id}`}><i /><b>{BADGES[id]}</b></span>
          <strong>{HEROES[id].name}</strong>
          <small className="roster-title">{HEROES[id].title}</small>
          <span className="roster-stats">
            <span className="stat" style={{ '--v': HEROES[id].damage / 19 } as CSSProperties}><em>力</em><i aria-label={`力量 ${HEROES[id].damage}`} /></span>
            <span className="stat" style={{ '--v': HEROES[id].speed / 107 } as CSSProperties}><em>速</em><i aria-label={`速度 ${HEROES[id].speed}`} /></span>
          </span>
          <small className="roster-detail">{HEROES[id].detail}</small>
        </button>)}</div>
        <div className="chapter-picker">{CHAPTERS.map((c, n) => <button key={c.code} aria-pressed={chapter===n} onClick={() => setChapter(n as ChapterIndex)}><b>{c.code}</b><span>{c.name}</span></button>)}</div>
        <button disabled={!ready || error} className="street-primary" onClick={() => { unlock(); sim.start(role, chapter); refresh(); }}>{error ? '加载失败，请刷新' : ready ? `选 ${HEROES[role].name} · 开打 →` : '正在准备夜市…'}</button>
        <p className="street-help"><span>电脑</span> WASD 移动 · J 连打 · K 跳跃 · U 闪避 · I 绝招 · 走近敌人自动抓住<br /><span>手机</span> 左摇杆 + 右侧五键，横屏更开阔</p>
      </div>}
      {sim.phase === 'intro' && <div className="street-overlay street-story"><div className="street-plate">
        <span className="street-kicker">{script.intro.kicker}</span>
        <h2>{script.intro.title}</h2>
        <div className="street-lines">{script.intro.lines.map((line, i) => <p key={i}><b>{speaker(line.who, sim.role)}</b><span>{line.text}</span></p>)}</div>
        <div className="street-tutorial"><span className="street-tutorial-tag">操作</span>{paragraphs(script.intro.tutorial)}</div>
        <div className="street-actions-row"><button className="street-primary" onClick={() => { sim.proceed(); refresh(); }}>{script.intro.button}</button></div>
      </div></div>}
      {sim.phase === 'bossIntro' && <div className="street-overlay street-story"><div className="street-plate">
        <span className="street-kicker danger">{bossScene.kicker}</span>
        <h2>{bossScene.title}</h2>
        <div className="street-lines">{bossScene.lines.map((line, i) => <p key={i}><b>{speaker(line.who, sim.role)}</b><span>{line.text}</span></p>)}</div>
        <div className="street-tutorial"><span className="street-tutorial-tag">打法</span>{paragraphs(bossScene.tutorial)}</div>
        <div className="street-actions-row"><button className="street-primary" onClick={() => { sim.proceed(); refresh(); }}>{bossScene.button}</button></div>
      </div></div>}
      {play && sim.paused && !trainingPanel && <div className="street-overlay street-story"><div className="street-plate">
        <span className="street-kicker">歇口气</span>
        <h2>{sim.training ? '练习场还在等你。' : `${sim.chapterName}还在等你。`}</h2>
        <div className="street-actions-row"><button className="street-primary" onClick={() => { unlock(); sim.paused = false; refresh(); }}>继续打</button></div>
        <div className="street-actions-row"><button className="street-secondary" onClick={() => { if (sim.training) sim.resetTraining(); else sim.start(sim.role, sim.chapter); refresh(); }}>重新挑战</button><button className="street-secondary" onClick={() => { sim.start(sim.role); sim.phase = 'select'; sim.paused = false; refresh(); }}>返回选人</button></div>
      </div></div>}
      {(sim.phase === 'won' || sim.phase === 'lost') && <div className="street-overlay street-story"><div className="street-plate">
        <span className={`street-kicker ${sim.phase==='won' ? '' : 'danger'}`}>{sim.phase==='won' ? script.won.kicker : '倒下了，再来一场'}</span>
        <h2>{sim.phase==='won' ? heroName(script.won.title) : '换个打法，再来。'}</h2>
        <div className="street-lines">
          {sim.phase==='won'
            ? script.won.lines.map((line, i) => <p key={i}><span>{heroName(line)}</span></p>)
            : <><p><span>不要站在人堆里硬拼。跳跃躲投掷，走进敌人抓住扔出破围，绝招解围。</span></p><p><span>本场击倒 {sim.kills} 人。</span></p></>}
        </div>
        {sim.phase==='won' && script.won.note && <div className="street-tutorial"><span className="street-tutorial-tag">待续</span>{script.won.note}</div>}
        <div className="street-actions-row">
          {sim.phase==='won' && script.won.nextLabel && <button className="street-primary" onClick={() => { sim.nextChapter(); refresh(); }}>{script.won.nextLabel}</button>}
          <button className={sim.phase==='won' && script.won.nextLabel?'street-secondary':'street-primary'} onClick={() => { if(sim.training)sim.resetTraining();else sim.start(sim.role,sim.chapter);refresh(); }}>重玩本关</button>
        </div>
        <button className="street-secondary" onClick={() => { sim.start(sim.role);sim.phase='select';refresh(); }}>返回选人</button>
      </div></div>}
    </section>
    <div className={`street-controls ${play && !sim.paused ? '' : 'inactive'}`}>
      <div className={`street-stick street-dpad ${sim.running ? 'running' : ''}`} data-dir={pad} aria-label="方向键，同方向双击奔跑" onPointerDown={e => { if (stick.current !== null) return; stick.current = e.pointerId; e.currentTarget.setPointerCapture(e.pointerId); unlock(); joystick(e); }} onPointerMove={joystick} onPointerUp={releaseStick} onPointerCancel={releaseStick} onLostPointerCapture={releaseStick}><i className="u" /><i className="d" /><i className="l" /><i className="r" /><b /><small>{sim.running ? '奔跑 · 点攻击冲刺' : '同方向双击奔跑'}</small></div>
      <div className="street-control-note"><b>WASD</b> 移动 · <b>Shift</b> 奔跑<br /><span>U 闪避 · 走近敌人自动抓住 · 跳踢追击</span></div>
      <div className="street-buttons">{actionButton('dodge', '闪避', 'U', sim.carried ? '先放下木箱' : sim.hero.motion !== 'grounded' ? '落地可用' : '方向撤步')}{actionButton('special', '绝招', 'I', sim.rage >= 50 ? '可释放' : `${sim.rage}/50 怒气`)}{actionButton('jump', '跳跃', 'K', sim.running ? '滑铲' : '接攻击飞踢')}{actionButton('attack', sim.carried ? '投箱' : '攻击', sim.carried ? 'J 扔出' : 'J 按住', sim.carried ? '扔出' : '按住连打')}</div>
    </div>
  </main>;
}
