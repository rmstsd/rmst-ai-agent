import type { Metadata } from 'next'
import './tailwind.css'
import './globals.scss'

export const metadata: Metadata = {
  title: 'M4 AI'
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  )
}
