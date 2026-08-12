import { NextResponse } from "next/server";

export const runtime = "nodejs";

function getRequired(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not configured on the server.`);
  return value;
}

function extractAnswer(payload: unknown): string {
  if (typeof payload === "string") return payload;

  const p = payload as any;
  const candidates = [
    p?.output,
    p?.answer,
    p?.response,
    p?.result,
    p?.message,
    p?.data?.output,
    p?.data?.answer,
  ];

  for (const value of candidates) {
    if (typeof value === "string") return value;
  }

  if (Array.isArray(p?.messages)) {
    const last = [...p.messages].reverse().find((m: any) => m?.role === "assistant");
    if (typeof last?.content === "string") return last.content;
    if (Array.isArray(last?.content)) {
      const text = last.content
        .map((item: any) => item?.text)
        .filter(Boolean)
        .join("\n");
      if (text) return text;
    }
  }

  return JSON.stringify(payload, null, 2);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const message = typeof body?.message === "string" ? body.message.trim() : "";

    if (!message || message.length > 8000) {
      return NextResponse.json(
        { error: "Enter a prompt between 1 and 8000 characters." },
        { status: 400 }
      );
    }

    // These names directly map to the Python starter code supplied by the user.
    const apiKey = getRequired("ZABY_API_KEY");
    const agentId =
      process.env.ZABY_EXECUTABLE_AGENT_ID ||
      process.env.ZABY_AGENT_ID ||
      "7b5400ac-4214-433a-a371-41299b733cd6";

    const baseUrl = (
      process.env.ZABY_EXECUTABLE_BASE_URL || "https://genapi.zaby.io"
    ).replace(/\/$/, "");

    const response = await fetch(
      `${baseUrl}/api/v1/executable-agents/${agentId}/runs`,
      {
        method: "POST",
        headers: {
          "x-zaby-api-key": apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: [
            {
              content: [
                {
                  text: message,
                  type: "text",
                },
              ],
              role: "user",
            },
          ],
          mode: "sync",
          responseFormat: {
            type: "text",
          },
        }),
        signal: AbortSignal.timeout(60000),
        cache: "no-store",
      }
    );

    const raw = await response.text();

    let payload: unknown;
    try {
      payload = JSON.parse(raw);
    } catch {
      payload = raw;
    }

    if (!response.ok) {
      return NextResponse.json(
        {
          error: "Your Zaby executable agent returned an error.",
          detail:
            process.env.NODE_ENV === "development" ? payload : undefined,
        },
        { status: 502 }
      );
    }

    return NextResponse.json({
      answer: extractAnswer(payload),
    });
  } catch (error) {
    console.error(
      "/api/chat error:",
      error instanceof Error ? error.message : "unknown error"
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to reach the Zaby executable agent.",
      },
      { status: 500 }
    );
  }
}
