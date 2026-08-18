'use client'

import { getSessionMessages, getSessions, initSession, recognizeSpeech, stopMessage, type AiSessionMessage, type AiSessionSummary } from '@/api/ai-api'
import { blobToDataUrl, recordingToWav } from '@/lib/audio'
import { DefaultChatTransport, type UIMessage } from 'ai'
import { useChat } from '@ai-sdk/react'
import { Bot, CircleStop, LoaderCircle, MessageSquarePlus, Mic, Send, SquarePen, UserRound } from 'lucide-react'
import { FormEvent, KeyboardEvent, useEffect, useMemo, useRef, useState } from 'react'
import './chat-page.scss'

function getMessageText(message: UIMessage) {
  return message.parts
    .filter(part => part.type === 'text')
    .map(part => part.text)
    .join('')
}

function toUiMessage(message: AiSessionMessage): UIMessage {
  return {
    id: message.id,
    role: message.role,
    parts: [{ type: 'text', text: message.text }]
  }
}

export function ChatPage() {
  const [sessionId, setSessionId] = useState('')
  const [sessions, setSessions] = useState<AiSessionSummary[]>([])
  const [input, setInput] = useState('')
  const [initializing, setInitializing] = useState(true)
  const [recording, setRecording] = useState(false)
  const [recognizing, setRecognizing] = useState(false)
  const [error, setError] = useState('')
  const messagesRef = useRef<HTMLDivElement>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const mediaStreamRef = useRef<MediaStream | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const sessionIdRef = useRef('')
  const transport = useMemo(
    () =>
      new DefaultChatTransport<UIMessage>({
        api: '/api/ai/chat',
        prepareSendMessagesRequest: ({ messages }) => {
          const latestMessage = [...messages].reverse().find(message => message.role === 'user')
          return {
            body: {
              sessionId: sessionIdRef.current,
              message: latestMessage ? getMessageText(latestMessage) : ''
            }
          }
        }
      }),
    []
  )
  const {
    messages,
    setMessages,
    sendMessage,
    status,
    error: chatError,
    clearError,
    stop
  } = useChat<UIMessage>({ id: 'm4-chat', transport })
  const loading = status === 'submitted' || status === 'streaming'

  useEffect(() => {
    startNewSession()
    return () => mediaStreamRef.current?.getTracks().forEach(track => track.stop())
  }, [])

  useEffect(() => {
    const messagesElement = messagesRef.current
    if (!messagesElement) return
    messagesElement.scrollTop = messagesElement.scrollHeight
  }, [messages])

  async function startNewSession() {
    setInitializing(true)
    setError('')
    try {
      await fetch('/api/bookmark', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify((await window.rmst?.getBookmarks()) || [])
      })

      const nextSessionId = await initSession()
      setSessionId(nextSessionId)
      sessionIdRef.current = nextSessionId
      setMessages([])
      setSessions(await getSessions())
      clearError()
      setInput('')
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : String(nextError))
    } finally {
      setInitializing(false)
    }
  }

  async function submitMessage() {
    const content = input.trim()
    if (!content || loading || !sessionId) return

    setInput('')
    setError('')

    try {
      await sendMessage({ text: content })
      setSessions(await getSessions())
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : String(nextError))
    }
  }

  async function selectSession(nextSessionId: string) {
    if (nextSessionId === sessionId || loading || initializing) return

    setInitializing(true)
    setError('')
    try {
      const sessionMessages = await getSessionMessages(nextSessionId)
      setSessionId(nextSessionId)
      sessionIdRef.current = nextSessionId
      setMessages(sessionMessages.map(toUiMessage))
      clearError()
      setInput('')
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : String(nextError))
    } finally {
      setInitializing(false)
    }
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    submitMessage()
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      submitMessage()
    }
  }

  async function handleStop() {
    if (!sessionId) return
    stop()
    await stopMessage(sessionId).catch(() => undefined)
  }

  async function startRecording() {
    setError('')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, sampleRate: 16_000 }
      })
      const recorder = new MediaRecorder(stream)
      audioChunksRef.current = []
      // MediaRecorder 通过异步回调持续收集浏览器产生的音频片段。
      recorder.ondataavailable = event => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data)
      }
      recorder.onstop = async () => {
        setRecognizing(true)
        try {
          // 一次语音到文本：录音结束后转为 WAV，再发送 Base64 编码音频内容。
          const recordingBlob = new Blob(audioChunksRef.current, { type: recorder.mimeType })
          const wavBlob = await recordingToWav(recordingBlob)
          const text = await recognizeSpeech(await blobToDataUrl(wavBlob))
          setInput(current => `${current}${current && text ? ' ' : ''}${text}`)
        } catch (nextError) {
          setError(nextError instanceof Error ? nextError.message : String(nextError))
        } finally {
          setRecognizing(false)
          stream.getTracks().forEach(track => track.stop())
          mediaStreamRef.current = null
        }
      }
      mediaRecorderRef.current = recorder
      mediaStreamRef.current = stream
      recorder.start()
      setRecording(true)
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : '无法使用麦克风')
    }
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop()
    mediaRecorderRef.current = null
    setRecording(false)
  }

  return (
    <main className="chat-page">
      <aside className="chat-sidebar">
        <div className="brand">
          <span className="brand-mark">
            <Bot size={20} />
          </span>
          <div>
            <strong>AI</strong>
          </div>
        </div>

        <button className="new-chat-button" type="button" onClick={startNewSession} disabled={initializing || loading}>
          <MessageSquarePlus size={18} />
          新建对话
        </button>

        <div className="sidebar-section">
          <span className="sidebar-title">最近对话</span>
          <div className="conversation-list">
            {sessions.map(session => (
              <button
                className={`conversation-item ${session.id === sessionId ? 'active' : ''}`}
                key={session.id}
                type="button"
                onClick={() => selectSession(session.id)}
                disabled={initializing || loading}
              >
                <SquarePen size={16} />
                <span>{session.title}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="sidebar-status">
          <span className={sessionId ? 'status-dot online' : 'status-dot'} />
          <div>
            <strong>{sessionId ? '会话已连接' : '等待连接'}</strong>
            <span>{sessionId ? sessionId.slice(0, 12) : '请检查项目配置'}</span>
          </div>
        </div>
      </aside>

      <section className="chat-main">
        <header className="chat-header">
          <div>
            <h1>M4 智能助手</h1>
            <p>Ark Responses API · 流式对话</p>
          </div>
          <span className="model-badge">{initializing ? '连接中' : sessionId ? '在线' : '离线'}</span>
        </header>

        <div className="messages" ref={messagesRef}>
          {messages.length === 0 && (
            <article className="message assistant">
              <div className="message-avatar">
                <Bot size={19} />
              </div>
              <div className="message-body">
                <div className="message-meta">
                  <strong>M4 AI</strong>
                  <span>{new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
                <div className="message-content">你好, 有什么可以帮你？</div>
              </div>
            </article>
          )}
          {messages.map(message => (
            <article className={`message ${message.role}`} key={message.id}>
              <div className="message-avatar">{message.role === 'assistant' ? <Bot size={19} /> : <UserRound size={18} />}</div>
              <div className="message-body">
                <div className="message-meta">
                  <strong>{message.role === 'assistant' ? 'M4 AI' : '你'}</strong>
                  <span>{new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
                <div className="message-content">
                  {getMessageText(message) || (message.role === 'assistant' && loading ? (
                    <span className="typing-indicator">
                      <i />
                      <i />
                      <i />
                    </span>
                  ) : null)}
                </div>
              </div>
            </article>
          ))}
        </div>

        <footer className="composer-area">
          {(error || chatError?.message) && <div className="error-banner">{error || chatError?.message}</div>}
          <form className="composer" onSubmit={handleSubmit}>
            <textarea
              value={input}
              onChange={event => setInput(event.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={initializing ? '正在初始化会话...' : '输入你的问题'}
              rows={1}
              disabled={!sessionId || initializing}
            />
            <div className="composer-actions">
              <button
                className={`icon-button ${recording ? 'recording' : ''}`}
                type="button"
                title={recording ? '停止录音' : '语音输入'}
                onClick={recording ? stopRecording : startRecording}
                disabled={recognizing || loading || !sessionId}
              >
                {recognizing ? (
                  <LoaderCircle className="spin" size={19} />
                ) : recording ? (
                  <CircleStop size={19} />
                ) : (
                  <Mic size={19} />
                )}
              </button>
              {loading ? (
                <button className="stop-button" type="button" onClick={handleStop} title="停止生成">
                  <CircleStop size={18} />
                  停止
                </button>
              ) : (
                <button className="send-button" type="submit" disabled={!input.trim() || !sessionId} title="发送消息">
                  <Send size={18} />
                  发送
                </button>
              )}
            </div>
          </form>
          <p className="composer-hint">AI 生成内容可能存在错误，请核对重要信息。</p>
        </footer>
      </section>
    </main>
  )
}
