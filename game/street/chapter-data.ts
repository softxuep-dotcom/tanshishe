import type { EnemyKind } from './simulation.ts';

export type ChapterIndex = 0 | 1 | 2 | 3;
export type ChapterTheme = 'market' | 'yard' | 'mall' | 'arena';
export interface ChapterDefinition {
  code: string;
  name: string;
  theme: ChapterTheme;
  boss: EnemyKind;
  bossName: string;
  crates: boolean;
  food: boolean;
  segments: readonly [string, string, string];
}
export const CHAPTERS: readonly ChapterDefinition[] = [
  { code: '01', name: '南桥夜市', theme: 'market', boss: 'boss', bossName: '铁头', crates: false, food: true, segments: ['饭馆门前', '夜市街道', '停车区'] },
  { code: '02', name: '河边货场', theme: 'yard', boss: 'longleg', bossName: '长腿', crates: true, food: true, segments: ['仓库外围', '装卸区', '河岸训练点'] },
  { code: '03', name: '旧商业街', theme: 'mall', boss: 'luchuan', bossName: '陆川', crates: true, food: true, segments: ['游戏厅外', '卷帘街', '商场天桥'] },
  { code: '04', name: '黑桥赛场', theme: 'arena', boss: 'hanxiao', bossName: '韩骁', crates: false, food: true, segments: ['后台', '选手通道', '擂台'] },
];
export const CHAPTER_COUNT = CHAPTERS.length;
/** Name the boss that is actually on screen, which in the practice arena is not the chapter's boss. */
export const BOSS_NAMES: Record<string, string> = Object.fromEntries(CHAPTERS.map(c => [c.boss, c.bossName]));
export const bossDisplayName = (kind: string) => BOSS_NAMES[kind] ?? '';
export const isChapterIndex = (value: number): value is ChapterIndex =>
  Number.isInteger(value) && value >= 0 && value < CHAPTER_COUNT;
// Every chapter reuses the same three fighting streets; the boss shares the final one.
export const WAVE_BOUNDS: readonly { left: number; right: number }[] = [
  { left: 0, right: 455 }, { left: 410, right: 865 }, { left: 820, right: 1300 }, { left: 820, right: 1300 },
];
export const waveBounds = (wave: number) => WAVE_BOUNDS[Math.max(0, Math.min(WAVE_BOUNDS.length - 1, wave))];
