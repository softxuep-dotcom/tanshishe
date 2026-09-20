import type { Metadata, Viewport } from 'next';
import './globals.css';
export const metadata: Metadata = { title: '南桥街：最后一场 · 四章原型', description: '三个街头伙伴，连拳、抓投、飞踢与绝招。原创像素清版动作游戏原型。', icons: { icon: `${process.env.GITHUB_PAGES === 'true' ? '/tanshishe' : ''}/favicon.svg` } };
export const viewport: Viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover', themeColor: '#101823' };
export default function RootLayout({ children }: { children: React.ReactNode }) { return <html lang="zh-CN"><body>{children}</body></html>; }

