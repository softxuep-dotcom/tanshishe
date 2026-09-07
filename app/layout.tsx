import type { Metadata, Viewport } from 'next';
import './globals.css';
export const metadata: Metadata = { title: '拖车大逃亡 · Cargo Escape', description: '挂上货物，带整列拖车在仓库封门前平安撤离。手机竖屏驾驶小游戏。' };
export const viewport: Viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover', themeColor: '#102d31' };
export default function RootLayout({ children }: { children: React.ReactNode }) { return <html lang="zh-CN"><body>{children}</body></html>; }
