"use client";

import {
  initSession,
  recognizeSpeech,
  sendMessage,
  stopMessage,
} from "@/api/ai-api";
import { blobToDataUrl, recordingToWav } from "@/lib/audio";
import type { ChatMessage, ChatStreamEvent } from "@/types/ai";
import {
  Bot,
  CircleStop,
  LoaderCircle,
  MessageSquarePlus,
  Mic,
  Send,
  SquarePen,
  UserRound,
} from "lucide-react";
import { FormEvent, KeyboardEvent, useEffect, useRef, useState } from "react";
import "./chat-page.scss";

const welcomeMessage: ChatMessage = {
  id: "welcome",
  role: "assistant",
  content: "你好，我是 M4 智能机器人大模型。有什么可以帮你？",
  createdAt: Date.now(),
  status: "done",
};

function createMessage(role: ChatMessage["role"], content: string): ChatMessage {
  return {
    id: crypto.randomUUID(),
    role,
    content,
    createdAt: Date.now(),
    status: role === "assistant" ? "streaming" : "done",
  };
}

export function ChatPage() {
  const [sessionId, setSessionId] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([welcomeMessage]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const [recording, setRecording] = useState(false);
  const [recognizing, setRecognizing] = useState(false);
  const [error, setError] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    startNewSession();
    return () => mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function startNewSession() {
    setInitializing(true);
    setError("");
    try {
      const nextSessionId = await initSession();
      setSessionId(nextSessionId);
      setMessages([{ ...welcomeMessage, id: crypto.randomUUID(), createdAt: Date.now() }]);
      setInput("");
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : String(nextError));
    } finally {
      setInitializing(false);
    }
  }

  function updateAssistantMessage(id: string, event: ChatStreamEvent) {
    setMessages((current) =>
      current.map((message) => {
        if (message.id !== id) return message;
        if (event.type === "Text") {
          return { ...message, content: message.content + event.text };
        }
        if (event.type === "Error") {
          return {
            ...message,
            content: message.content || event.message,
            status: "error",
          };
        }
        if (event.type === "Done") return { ...message, status: "done" };
        return message;
      }),
    );
  }

  async function submitMessage() {
    const content = input.trim();
    if (!content || loading || !sessionId) return;

    const userMessage = createMessage("user", content);
    const assistantMessage = createMessage("assistant", "");
    setMessages((current) => [...current, userMessage, assistantMessage]);
    setInput("");
    setError("");
    setLoading(true);

    try {
      await sendMessage(sessionId, content, (event) =>
        updateAssistantMessage(assistantMessage.id, event),
      );
      setMessages((current) =>
        current.map((message) =>
          message.id === assistantMessage.id && message.status === "streaming"
            ? { ...message, status: "done" }
            : message,
        ),
      );
    } catch (nextError) {
      const message = nextError instanceof Error ? nextError.message : String(nextError);
      updateAssistantMessage(assistantMessage.id, { type: "Error", message });
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    submitMessage();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      submitMessage();
    }
  }

  async function handleStop() {
    if (!sessionId) return;
    // 停止会话会取消服务端任务，客户端忽略由主动中断产生的请求异常。
    await stopMessage(sessionId).catch(() => undefined);
  }

  async function startRecording() {
    setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, sampleRate: 16_000 },
      });
      const recorder = new MediaRecorder(stream);
      audioChunksRef.current = [];
      // MediaRecorder 通过异步回调持续收集浏览器产生的音频片段。
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };
      recorder.onstop = async () => {
        setRecognizing(true);
        try {
          // 一次语音到文本：录音结束后转为 WAV，再发送 Base64 编码音频内容。
          const recordingBlob = new Blob(audioChunksRef.current, { type: recorder.mimeType });
          const wavBlob = await recordingToWav(recordingBlob);
          const text = await recognizeSpeech(await blobToDataUrl(wavBlob));
          setInput((current) => `${current}${current && text ? " " : ""}${text}`);
        } catch (nextError) {
          setError(nextError instanceof Error ? nextError.message : String(nextError));
        } finally {
          setRecognizing(false);
          stream.getTracks().forEach((track) => track.stop());
          mediaStreamRef.current = null;
        }
      };
      mediaRecorderRef.current = recorder;
      mediaStreamRef.current = stream;
      recorder.start();
      setRecording(true);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "无法使用麦克风");
    }
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop();
    mediaRecorderRef.current = null;
    setRecording(false);
  }

  return (
    <main className="chat-page">
      <aside className="chat-sidebar">
        <div className="brand">
          <span className="brand-mark"><Bot size={20} /></span>
          <div>
            <strong>M4 AI</strong>
            <span>个人学习控制台</span>
          </div>
        </div>

        <button className="new-chat-button" type="button" onClick={startNewSession} disabled={initializing || loading}>
          <MessageSquarePlus size={18} />
          新建对话
        </button>

        <div className="sidebar-section">
          <span className="sidebar-title">最近对话</span>
          <button className="conversation-item active" type="button">
            <SquarePen size={16} />
            <span>当前对话</span>
          </button>
        </div>

        <div className="sidebar-status">
          <span className={sessionId ? "status-dot online" : "status-dot"} />
          <div>
            <strong>{sessionId ? "会话已连接" : "等待连接"}</strong>
            <span>{sessionId ? sessionId.slice(0, 12) : "请检查项目配置"}</span>
          </div>
        </div>
      </aside>

      <section className="chat-main">
        <header className="chat-header">
          <div>
            <h1>M4 智能助手</h1>
            <p>Ark Responses API · 流式对话</p>
          </div>
          <span className="model-badge">{initializing ? "连接中" : sessionId ? "在线" : "离线"}</span>
        </header>

        <div className="messages">
          {messages.map((message) => (
            <article className={`message ${message.role}`} key={message.id}>
              <div className="message-avatar">
                {message.role === "assistant" ? <Bot size={19} /> : <UserRound size={18} />}
              </div>
              <div className="message-body">
                <div className="message-meta">
                  <strong>{message.role === "assistant" ? "M4 AI" : "你"}</strong>
                  <span>{new Date(message.createdAt).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}</span>
                </div>
                <div className={`message-content ${message.status === "error" ? "error" : ""}`}>
                  {message.content || <span className="typing-indicator"><i /><i /><i /></span>}
                </div>
              </div>
            </article>
          ))}
          <div ref={messagesEndRef} />
        </div>

        <footer className="composer-area">
          {error && <div className="error-banner">{error}</div>}
          <form className="composer" onSubmit={handleSubmit}>
            <textarea
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={initializing ? "正在初始化会话..." : "输入你的问题"}
              rows={1}
              disabled={!sessionId || initializing}
            />
            <div className="composer-actions">
              <button
                className={`icon-button ${recording ? "recording" : ""}`}
                type="button"
                title={recording ? "停止录音" : "语音输入"}
                onClick={recording ? stopRecording : startRecording}
                disabled={recognizing || loading || !sessionId}
              >
                {recognizing ? <LoaderCircle className="spin" size={19} /> : recording ? <CircleStop size={19} /> : <Mic size={19} />}
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
  );
}
