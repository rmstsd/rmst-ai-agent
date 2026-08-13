import { streamFunctionResult } from "@/server/ark-client";
import { createSseResponse } from "@/server/sse-response";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const requestSchema = z.object({
  sessionId: z.string().min(1),
  name: z.string().min(1),
  args: z.string().optional(),
  callId: z.string().min(1),
});

export async function POST(request: Request) {
  const parsed = requestSchema.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json({ message: "函数调用参数不正确" }, { status: 400 });
  }

  const { sessionId, name, args, callId } = parsed.data;
  return createSseResponse((send) =>
    streamFunctionResult(sessionId, name, args, callId, send),
  );
}
