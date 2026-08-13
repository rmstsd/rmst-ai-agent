import type { ChatStreamEvent } from "@/types/ai";

interface FunctionCall {
  name: string;
  args?: string;
  callId: string;
}

async function readError(response: Response) {
  const result = (await response.json().catch(() => null)) as { message?: string } | null;
  return result?.message ?? `请求失败（${response.status}）`;
}

async function consumeEventStream(
  response: Response,
  onEvent: (event: ChatStreamEvent) => void,
) {
  if (!response.ok) throw new Error(await readError(response));
  if (!response.body) throw new Error("服务端没有返回消息流");

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  const functionCalls: FunctionCall[] = [];

  while (true) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value, { stream: !done }).replaceAll("\r\n", "\n");
    const blocks = buffer.split("\n\n");
    buffer = blocks.pop() ?? "";

    for (const block of blocks) {
      const data = block
        .split("\n")
        .find((line) => line.startsWith("data:"))
        ?.slice(5)
        .trim();
      if (!data) continue;

      const event = JSON.parse(data) as ChatStreamEvent;
      onEvent(event);
      if (event.type === "Function") functionCalls.push(event);
    }

    if (done) break;
  }

  return functionCalls;
}

export async function initSession() {
  const response = await fetch("/api/ai/session", { method: "POST" });
  if (!response.ok) throw new Error(await readError(response));
  const result = (await response.json()) as { sessionId: string };
  return result.sessionId;
}

export async function sendMessage(
  sessionId: string,
  message: string,
  onEvent: (event: ChatStreamEvent) => void,
) {
  let functionCalls = await consumeEventStream(
    await fetch("/api/ai/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId, message }),
    }),
    onEvent,
  );

  while (functionCalls.length > 0) {
    const currentCalls = functionCalls;
    functionCalls = [];

    for (const call of currentCalls) {
      const nextCalls = await consumeEventStream(
        await fetch("/api/ai/call-function", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId, ...call }),
        }),
        onEvent,
      );
      functionCalls.push(...nextCalls);
    }
  }
}

export async function stopMessage(sessionId: string) {
  const response = await fetch("/api/ai/stop", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionId }),
  });
  if (!response.ok) throw new Error(await readError(response));
}

export async function recognizeSpeech(data: string) {
  const response = await fetch("/api/ai/speech-recognize", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ data }),
  });
  if (!response.ok) throw new Error(await readError(response));
  const result = (await response.json()) as { text: string };
  return result.text;
}
