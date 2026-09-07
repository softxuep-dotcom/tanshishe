'use client';
import { useEffect, useRef, useState } from 'react';
import { CargoRun, type RunSnapshot, type Controls } from '../game/simulation';
import type { Game } from 'phaser';

const initial = new CargoRun().snapshot();
export default function Home() {
  const host = useRef<HTMLDivElement>(null);
  const run = useRef(new CargoRun());
  const input = useRef<Controls>({ left: false, right: false, brake: false });
  const [view, setView] = useState<RunSnapshot>(initial);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(false);
  const [sound, setSound] = useState(true);
  const soundEnabled = useRef(true);
  const audio = useRef<AudioContext | null>(null);
  const [best, setBest] = useState(0);
  useEffect(() => {
    type WebTool = { name: string; description: string; inputSchema: object; annotations: { readOnlyHint: boolean }; execute: (input: unknown) => unknown };
    const context = (document as unknown as { modelContext?: { registerTool: (tool: WebTool, options: { signal: AbortSignal }) => void | Promise<void> } }).modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    const validate = (value: unknown) => {
      if (value === null || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).length) throw new Error('Expected an empty object.');
    };
    const schema = { type: 'object', properties: {}, additionalProperties: false };
    const tools: WebTool[] = [
      { name: 'read_cargo_run', description: 'Read the current Cargo Escape timer, attached cargo, score, and game phase.', inputSchema: schema, annotations: { readOnlyHint: true }, execute: (value) => { validate(value); return run.current.snapshot(); } },
      { name: 'pause_cargo_run', description: 'Pause the current drive and show the pause menu. Already paused games remain paused.', inputSchema: schema, annotations: { readOnlyHint: false }, execute: (value) => {
        validate(value);
        input.current.left = input.current.right = input.current.brake = false;
        if (run.current.phase === 'playing' || run.current.phase === 'exiting') run.current.pause();
        const snapshot = run.current.snapshot(); setView(snapshot); return snapshot;
      } },
    ];
    for (const tool of tools) { try { void Promise.resolve(context.registerTool(tool, { signal: lifecycle.signal })).catch(() => {}); } catch {} }
    return () => lifecycle.abort();
  }, []);
  useEffect(() => {
    let disposed = false;
    let game: Game | undefined;
    try { setBest(Number(localStorage.getItem('cargo-best') || 0)); } catch {}
    const tone = (kind: string) => {
      const ctx = audio.current;
      if (!ctx || ctx.state !== 'running' || !soundEnabled.current) return;
      const oscillator = ctx.createOscillator(), gain = ctx.createGain();
      oscillator.type = kind === 'drop' ? 'triangle' : 'sine';
      const frequency = kind === 'pickup' ? 660 : kind === 'win' ? 880 : 150;
      oscillator.frequency.setValueAtTime(frequency, ctx.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(frequency * 0.6, ctx.currentTime + 0.14);
      gain.gain.setValueAtTime(0.065, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18);
      oscillator.connect(gain).connect(ctx.destination);
      oscillator.start(); oscillator.stop(ctx.currentTime + 0.19);
    };
    import('../game/renderer').then(({ createGame }) => {
      if (disposed || !host.current) return;
      game = createGame(host.current, run.current, input.current, (snapshot) => {
        if (disposed) return;
        setView(snapshot);
        if (snapshot.phase === 'won') setBest(previous => {
          const next = Math.max(previous, snapshot.score);
          try { localStorage.setItem('cargo-best', String(next)); } catch {}
          return next;
        });
      }, tone, () => { if (!disposed) setReady(true); });
    }).catch(() => { if (!disposed) setError(true); });
    const clear = () => { input.current.left = input.current.right = input.current.brake = false; };
    const pause = () => { clear(); if (run.current.phase === 'playing' || run.current.phase === 'exiting') { run.current.pause(); setView(run.current.snapshot()); } };
    const visibility = () => { if (document.hidden) pause(); };
    const key = (event: KeyboardEvent, pressed: boolean) => {
      const k = event.key.toLowerCase();
      if (['arrowleft', 'a', 'arrowright', 'd', 'arrowdown', 's', ' ', 'escape'].includes(k)) event.preventDefault();
      if (k === 'arrowleft' || k === 'a') input.current.left = pressed;
      if (k === 'arrowright' || k === 'd') input.current.right = pressed;
      if (k === 'arrowdown' || k === 's' || k === ' ') input.current.brake = pressed;
      if (k === 'escape' && pressed && !event.repeat) { run.current.pause(); setView(run.current.snapshot()); }
    };
    const down = (e: KeyboardEvent) => key(e, true), up = (e: KeyboardEvent) => key(e, false);
    window.addEventListener('keydown', down); window.addEventListener('keyup', up);
    window.addEventListener('blur', pause); document.addEventListener('visibilitychange', visibility);
    return () => {
      disposed = true; game?.destroy(true); clear();
      window.removeEventListener('keydown', down); window.removeEventListener('keyup', up);
      window.removeEventListener('blur', pause); document.removeEventListener('visibilitychange', visibility);
    };
  }, []);
  const start = () => {
    try {
      const AudioCtor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!audio.current && AudioCtor) audio.current = new AudioCtor();
      void audio.current?.resume().catch(() => {});
    } catch {}
    input.current.left = input.current.right = input.current.brake = false;
    run.current.start(); setView(run.current.snapshot());
  };
  const pointer = (action: keyof Controls) => ({
    onPointerDown: (e: React.PointerEvent<HTMLButtonElement>) => { e.preventDefault(); e.currentTarget.setPointerCapture(e.pointerId); input.current[action] = true; },
    onPointerUp: () => { input.current[action] = false; },
    onPointerCancel: () => { input.current[action] = false; },
    onLostPointerCapture: () => { input.current[action] = false; },
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
  });
  const seconds = Math.ceil(view.remaining);
  const active = view.phase === 'playing' || view.phase === 'exiting';
  return <main className="game-shell">
    <header className="topbar">
      <div className="brand"><span className="brand-mark">↗</span><div><h1>拖车大逃亡</h1><span>CARGO ESCAPE · 01</span></div></div>
      <div className="top-actions"><button className="icon-button" aria-label={sound ? '关闭声音' : '开启声音'} onClick={() => { soundEnabled.current = !sound; setSound(!sound); }}>{sound ? '♪' : '♩'}</button><button className="icon-button" aria-label="暂停游戏" disabled={!active} onClick={() => { run.current.pause(); setView(run.current.snapshot()); }}>Ⅱ</button></div>
    </header>
    <section className="dashboard" aria-label="游戏状态">
      <div><span className="stat-label">已挂接 / 目标</span><strong className={view.count >= 6 ? 'mint' : ''}>{String(view.count).padStart(2, '0')}<small> / 06</small></strong></div>
      <div className="timer"><span className="stat-label">仓库封门倒计时</span><strong className={seconds <= 20 ? 'danger' : ''}>{Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, '0')}</strong></div>
      <div className="value"><span className="stat-label">本车货值</span><strong>{view.value}<small> 分</small></strong></div>
    </section>
    <div className="playfield">
      <div className="canvas-host" ref={host} aria-label="仓库驾驶场地" />
      <div className={'mission ' + (view.count >= 6 ? 'unlocked' : '')} aria-live="polite">{view.phase === 'exiting' ? '正在交付，等车尾通过…' : view.count >= 6 ? '↑ 出口已开放 · 把整列车拉出去' : '靠近货物自动挂接 · 集齐 6 节开启出口'}</div>
      {view.toast && active && <div className="toast" key={view.toastId}>{view.toast}</div>}
      {!active && <div className="scrim"><section className="game-card">
        <span className="card-eyebrow">{view.phase === 'ready' ? '仓库 01 / 最后一趟' : view.phase === 'paused' ? '稍作休息' : view.phase === 'won' ? 'DELIVERY COMPLETE' : '仓库已封门'}</span>
        <h2>{view.phase === 'ready' ? <>多拉一点，<br />平安下班。</> : view.phase === 'paused' ? '货物等你回来' : view.phase === 'won' ? '整列安全送达！' : '就差那么一点'}</h2>
        {view.phase === 'ready' ? <>
          <p>120 秒内，挂上至少 <b>6 节</b>拖车，<br />从地图顶部的绿色出口撤离。</p>
          <div className="instructions"><span>↶ ↷</span><p>按住左右键转弯<br /><small>自动前进 · 中间按钮减速</small></p></div>
          <p className="fine-print">小心车尾碰货架，掉下的货可以重新接回。</p>
        </> : view.phase === 'paused' ? <p>倒计时已暂停。<br />继续后，车辆会自动前进。</p> : view.phase === 'won' ? <>
          <div className="result-score">{view.score}<small> 分</small></div><p>运出 {view.count} 节 · 货值 {view.value}<br />整单加成 ×{view.multiplier.toFixed(1)}</p><p className="fine-print">最佳交付 {best} 分 · 下次试试多带两节？</p>
        </> : <p>你挂上了 {view.count} 节，没能及时撤离。<br />下次收够 6 节，就试着向上找出口。</p>}
        {error ? <p role="alert">游戏加载失败，请刷新页面重试。</p> : <button className="primary-button" disabled={!ready} onClick={view.phase === 'paused' ? () => { run.current.pause(); setView(run.current.snapshot()); } : start}>{!ready ? '准备车辆…' : view.phase === 'ready' ? '出发拉货 →' : view.phase === 'paused' ? '继续驾驶 →' : '再跑一趟 ↻'}</button>}
        {view.phase === 'paused' && <button className="text-button" onClick={start}>重新开始</button>}
      </section></div>}
    </div>
    <footer className="controls"><div className="control-row">
      <button className="steer" aria-label="向左转" disabled={!active} {...pointer('left')}><span>↶</span>左转</button>
      <button className="brake" aria-label="按住减速" disabled={!active} {...pointer('brake')}><span>≋</span>减速</button>
      <button className="steer" aria-label="向右转" disabled={!active} {...pointer('right')}><span>↷</span>右转</button>
    </div><p>按住转向，松手直行 <span>·</span> 电脑也可用 ← → / 空格</p></footer>
  </main>;
}
