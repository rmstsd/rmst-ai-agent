import { createSession } from "@/server/ark-client";

export const runtime = "nodejs";

export async function POST() {
  try {
    return Response.json({ sessionId: await createSession() });
  } catch (error) {
    return Response.json(
      { message: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
