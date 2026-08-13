import { recognizeSpeech } from "@/server/speech-client";
import { z } from "zod";

export const runtime = "nodejs";

const requestSchema = z.object({ data: z.string().min(1) });

export async function POST(request: Request) {
  const parsed = requestSchema.safeParse(await request.json());
  if (!parsed.success) return Response.json({ message: "音频数据不能为空" }, { status: 400 });

  try {
    return Response.json({ text: await recognizeSpeech(parsed.data.data) });
  } catch (error) {
    return Response.json(
      { message: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
