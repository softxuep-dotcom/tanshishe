'use client';

import { Component, useCallback, useEffect, useRef, useState, type ReactNode, type KeyboardEvent } from 'react';
import { ArrowRight, Check, Package, Pause, Play, RotateCcw, Truck, Undo2, Volume2, VolumeX } from 'lucide-react';
import type { Game } from 'phaser';
import { HookGame, LEVELS, type HookSnapshot } from '../game/hook/simulation';
import './hook.css';

const SAVE_KEY = 'hook-and-haul-progress-v1';
type Progress = { completed: number[]; lastLevel: number; sound: boolean };
const emptyProgress = (): Progress => ({ completed: [], lastLevel: 0, sound: true });

function RobotMark() {
  return <svg viewBox="0 0 40 40" aria-hidden="true"><path d="M20 4v5m0-5h7" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" /><rect x="8" y="10" width="25" height="23" rx="8" fill="currentColor" /><rect x="12" y="15" width="17" height="9" rx="4" fill="#f8d279" /><circle cx="16.5" cy="19.5" r="1.6" fill="currentColor" /><circle cx="24.5" cy="19.5" r="1.6" fill="currentColor" /><path d="M13 35h4m8 0h4M4 17v9m33-9v9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" /></svg>;
}

class GameErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    if (this.state.failed) return <main className="hook-app hook-fallback"><section className="hook-dialog"><span className="hook-eyebrow">HOOK &amp; HAUL</span><h2>工场需要重新启动</h2><p>刚才遇到了加载问题，刷新后再试一次。</p><button className="hook-primary" onClick={() => window.location.reload()}><RotateCcw size={18} />刷新重试</button></section></main>;
    return this.props.children;
  }
}

function HookPlayground() {
  const host = useRef<HTMLDivElement>(null);
  const [simulation] = useState(() => new HookGame());
  const sim = useRef(simulation);
  const [view, setView] = useState<HookSnapshot>(() => simulation.snapshot());
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(false);
  const [sound, setSound] = useState(true);
  const [completed, setCompleted] = useState<number[]>([]);
  const [saveAvailable, setSaveAvailable] = useState(true);
  const progress = useRef<Progress>(emptyProgress());
  const soundEnabled = useRef(true);
  const audio = useRef<AudioContext | null>(null);
  const lastSnapshot = useRef('');
  const dialog = useRef<HTMLDialogElement>(null);

  const persist = useCallback(() => {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(progress.current)); }
    catch { setSaveAvailable(false); }
  }, []);

  const publish = useCallback((snapshot: HookSnapshot) => {
    let changed = false;
    if (snapshot.levelIndex !== progress.current.lastLevel) {
      progress.current.lastLevel = snapshot.levelIndex;
      changed = true;
    }
    if (snapshot.phase === 'won' && !progress.current.completed.includes(snapshot.levelIndex)) {
      progress.current.completed = [...progress.current.completed, snapshot.levelIndex].sort((a, b) => a - b);
      setCompleted([...progress.current.completed]);
      changed = true;
    }
    if (changed) persist();
    const serialized = JSON.stringify(snapshot);
    if (serialized !== lastSnapshot.current) {
      lastSnapshot.current = serialized;
      setView(snapshot);
    }
  }, [persist]);

  const unlockAudio = useCallback(() => {
    if (!soundEnabled.current) return;
    try {
      const AudioConstructor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!audio.current && AudioConstructor) audio.current = new AudioConstructor();
      if (audio.current?.state === 'suspended') void audio.current.resume().catch(() => {});
    } catch { /* Sound is optional; the game remains playable without it. */ }
  }, []);

  useEffect(() => {
    let disposed = false;
    let game: Game | undefined;
    const currentSimulation = sim.current;
    try {
      const raw: unknown = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null');
      if (raw && typeof raw === 'object') {
        const saved = raw as Partial<Progress>;
        const done = Array.isArray(saved.completed) ? [...new Set(saved.completed.filter(n => Number.isInteger(n) && n >= 0 && n < LEVELS.length))] : [];
        const last = typeof saved.lastLevel === 'number' && Number.isInteger(saved.lastLevel) && saved.lastLevel >= 0 && saved.lastLevel < LEVELS.length ? saved.lastLevel : 0;
        progress.current = { completed: done, lastLevel: last, sound: saved.sound !== false };
        soundEnabled.current = progress.current.sound;
        setSound(progress.current.sound);
        setCompleted(done);
        currentSimulation.loadLevel(last);
        publish(currentSimulation.snapshot());
      }
    } catch { setSaveAvailable(false); }

    const tone = (kind: string) => {
      const ctx = audio.current;
      if (!ctx || ctx.state !== 'running' || !soundEnabled.current || disposed) return;
      const notes = kind === 'win' ? [523.25, 659.25, 783.99, 1046.5] : kind === 'dock' ? [587.33, 783.99] : kind === 'gate' ? [392, 523.25] : kind === 'bump' ? [125] : [440];
      try {
        notes.forEach((frequency, index) => {
          const oscillator = ctx.createOscillator();
          const gain = ctx.createGain();
          const start = ctx.currentTime + index * 0.08;
          oscillator.type = kind === 'bump' ? 'triangle' : 'sine';
          oscillator.frequency.setValueAtTime(frequency, start);
          oscillator.frequency.exponentialRampToValueAtTime(frequency * (kind === 'bump' ? 0.55 : 1.04), start + 0.12);
          gain.gain.setValueAtTime(0.0001, start);
          gain.gain.exponentialRampToValueAtTime(kind === 'bump' ? 0.035 : 0.065, start + 0.01);
          gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.2);
          oscillator.connect(gain);
          gain.connect(ctx.destination);
          oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
          oscillator.start(start);
          oscillator.stop(start + 0.22);
        });
      } catch { /* Audio interruptions must not interrupt movement. */ }
    };

    import('../game/hook/renderer').then(({ createHookGame }) => {
      if (disposed || !host.current) return;
      game = createHookGame(host.current, currentSimulation, snapshot => {
        if (!disposed) publish(snapshot);
      }, () => { if (!disposed) setReady(true); }, tone);
    }).catch(() => { if (!disposed) setError(true); });

    const pause = () => {
      currentSimulation.endPull();
      if (currentSimulation.snapshot().phase === 'playing') currentSimulation.pause();
      publish(currentSimulation.snapshot());
      if (audio.current?.state === 'running') void audio.current.suspend().catch(() => {});
    };
    const visibility = () => { if (document.hidden) pause(); };
    window.addEventListener('pointerdown', unlockAudio, { passive: true });
    window.addEventListener('keydown', unlockAudio);
    window.addEventListener('blur', pause);
    document.addEventListener('visibilitychange', visibility);

    return () => {
      disposed = true;
      currentSimulation.endPull();
      game?.destroy(true);
      window.removeEventListener('pointerdown', unlockAudio);
      window.removeEventListener('keydown', unlockAudio);
      window.removeEventListener('blur', pause);
      document.removeEventListener('visibilitychange', visibility);
      const context = audio.current;
      audio.current = null;
      if (context && context.state !== 'closed') void context.close().catch(() => {});
    };
  }, [publish, unlockAudio]);

  useEffect(() => {
    if (view.phase !== 'playing') {
      sim.current.endPull();
      dialog.current?.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus({ preventScroll: true });
    }
  }, [view.phase]);

  const update = (action: () => unknown) => {
    unlockAudio();
    action();
    publish(sim.current.snapshot());
  };
  const loadLevel = (index: number) => update(() => sim.current.loadLevel(index));
  const toggleSound = () => {
    const next = !soundEnabled.current;
    soundEnabled.current = next;
    progress.current.sound = next;
    setSound(next);
    persist();
    if (next) unlockAudio();
    else if (audio.current?.state === 'running') void audio.current.suspend().catch(() => {});
  };
  const keepDialogFocus = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key !== 'Tab') return;
    const buttons = dialog.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)');
    if (!buttons?.length) return;
    const first = buttons[0], last = buttons[buttons.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  };

  const active = ready && view.phase === 'playing' && !error;
  const isLast = view.levelIndex === LEVELS.length - 1;
  const allComplete = completed.length === LEVELS.length;
  const unlocked = Math.min(LEVELS.length - 1, completed.length ? Math.max(...completed) + 1 : 0);
  const roomSelection = <div className="hook-room-list" aria-label="选择房间">{LEVELS.map((level, index) => <button key={index} disabled={!ready || index > unlocked} className={view.levelIndex === index ? 'hook-room is-current' : 'hook-room'} onClick={() => loadLevel(index)} aria-label={`房间 ${index + 1}：${level.title}${completed.includes(index) ? '，已完成' : ''}`}><span>{completed.includes(index) ? <Check size={15} strokeWidth={3} /> : String(index + 1).padStart(2, '0')}</span><b>{level.title}</b>{completed.includes(index) && <small>已完成</small>}</button>)}</div>;

  return <main className="hook-app">
    <div className="hook-shell">
      <header className="hook-header">
        <div className="hook-brand"><span className="hook-brand-mark"><RobotMark /></span><div><h1>钩子搬运工</h1><span>HOOK &amp; HAUL</span></div></div>
        <div className="hook-tools">
          <button className="hook-icon" title="撤销上次牵引（Z）" aria-label="撤销上次牵引" disabled={!active || !view.canUndo} onClick={() => update(() => sim.current.undo())}><Undo2 size={19} /></button>
          <button className="hook-icon hook-sound" title={sound ? '关闭声音' : '开启声音'} aria-label={sound ? '关闭声音' : '开启声音'} aria-pressed={sound} onClick={toggleSound}>{sound ? <Volume2 size={18} /> : <VolumeX size={18} />}</button>
          <button className="hook-icon" title={view.phase === 'paused' ? '继续游戏' : '暂停（Esc）'} aria-label={view.phase === 'paused' ? '继续游戏' : '暂停游戏'} disabled={!ready || view.phase === 'won' || error} onClick={() => update(() => view.phase === 'paused' ? sim.current.resume() : sim.current.pause())}>{view.phase === 'paused' ? <Play size={18} fill="currentColor" /> : <Pause size={18} fill="currentColor" />}</button>
        </div>
      </header>

      <section className="hook-mission" aria-label="当前任务">
        <div className="hook-mission-text"><span className="hook-eyebrow">ROOM {String(view.levelIndex + 1).padStart(2, '0')}<i />{String(LEVELS.length).padStart(2, '0')}</span><h2>{view.title}</h2><p>{view.subtitle}</p></div>
        <div className={`hook-cargo-count${view.canShip || view.phase === 'won' ? ' is-ready' : ''}`}><Package size={20} strokeWidth={1.8} /><strong>{view.delivered}<span> / {view.total}</span></strong><small>货物就位</small></div>
      </section>

      <section className="hook-field" aria-label="搬运工场">
        <div className="hook-canvas" ref={host} role="application" aria-label="按住货箱或锚点牵引，松手停下。轻货靠近你，重物拉动你。" />
        {!ready && !error && <output className="hook-loading"><span className="hook-loading-robot"><RobotMark /></span><span className="hook-loading-label">工场准备中…</span></output>}
        {error && <div className="hook-scrim"><section className="hook-dialog" role="alert"><span className="hook-eyebrow">稍等一下</span><h2>工场没能打开</h2><p>请刷新页面，再试一次。</p><button className="hook-primary" onClick={() => window.location.reload()}><RotateCcw size={18} />刷新重试</button></section></div>}
        {ready && !error && view.phase !== 'playing' && <div className="hook-scrim"><dialog open className={`hook-dialog${view.phase === 'won' ? ' hook-result' : ''}`} ref={dialog} aria-modal="true" aria-labelledby="hook-dialog-title" onKeyDown={keepDialogFocus}>
          {view.phase === 'won' ? <>
            <span className="hook-stamp"><Check size={32} strokeWidth={3} /></span>
            <span className="hook-eyebrow">DELIVERY COMPLETE</span>
            <h2 id="hook-dialog-title">{allComplete ? '小工场，全部搞定！' : '这车装得漂亮！'}</h2>
            <p>{view.total} 件货物送达 · {view.moves} 次牵引<br />{isLast ? '换个顺序，还能搬得更顺吗？' : '下个房间，试试新的搬法。'}</p>
            {!isLast && <button className="hook-primary" onClick={() => loadLevel(view.levelIndex + 1)}>下个房间 <ArrowRight size={18} /></button>}
            {isLast && <button className="hook-primary" onClick={() => loadLevel(0)}>再逛一次工场 <RotateCcw size={18} /></button>}
            <button className="hook-secondary" onClick={() => update(() => sim.current.restart())}><RotateCcw size={15} />重玩这个房间</button>
            {allComplete && <><div className="hook-divider"><span>随时回来搬一趟</span></div>{roomSelection}</>}
          </> : <>
            <span className="hook-eyebrow">TAKE A LITTLE BREAK</span>
            <h2 id="hook-dialog-title">歇一会儿</h2>
            <p>货物和小机器人都在等你。</p>
            <button className="hook-primary" onClick={() => update(() => sim.current.resume())}><Play size={17} fill="currentColor" />继续搬运</button>
            <button className="hook-secondary" onClick={() => update(() => sim.current.restart())}><RotateCcw size={15} />重新开始这个房间</button>
            <div className="hook-divider"><span>选择房间</span></div>
            {roomSelection}
            <p className="hook-save-note">{saveAvailable ? '刷新会从本房间开头开始，已通关房间会保留。' : '浏览器暂不能保存进度，刷新后会重新开始。'}</p>
          </>}
        </dialog></div>}
      </section>

      <footer className="hook-footer">
        <div className="hook-help"><span className="hook-hint-dot" /><p aria-live="polite">{view.notice || view.hint}<small>按住牵引 · 松手停下</small></p></div>
        <button className={`hook-ship${view.canShip ? ' is-ready' : ''}`} disabled={!active || !view.canShip} onClick={() => update(() => sim.current.ship())}><Truck size={21} strokeWidth={1.9} /><span>装车<small>{view.canShip ? '出发吧！' : '等货物就位'}</small></span>{view.canShip && <ArrowRight size={15} />}</button>
        <span className="hook-desktop-keys">按住鼠标牵引<span>·</span>Z 撤销<span>·</span>R 重来</span>
      </footer>
    </div>
  </main>;
}

export default function Home() {
  return <GameErrorBoundary><HookPlayground /></GameErrorBoundary>;
}
