import type { Metadata, Viewport } from 'next';
import './globals.css';
export const metadata: Metadata = { title: '钩子搬运工 · Hook & Haul', description: '一根钩索，搬动货物，也移动自己。手机单指操作的物理搬运原型。', icons: { icon: '/favicon.svg' } };
export const viewport: Viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover', themeColor: '#f3efe4' };
export default function RootLayout({ children }: { children: React.ReactNode }) { return <html lang="zh-CN"><body>{children}</body></html>; }
