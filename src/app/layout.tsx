import type { Metadata } from 'next'
import './tailwind.css'
import './globals.scss'

export const metadata: Metadata = {
  title: 'AI Agent',
  description: ''
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  )
}
