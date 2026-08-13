'use client'

import dynamic from 'next/dynamic'

const ChatPage = dynamic(() => import('@/components/chat-page').then(module => module.ChatPage), { ssr: false })

export default function Home() {
  return <ChatPage />
}
