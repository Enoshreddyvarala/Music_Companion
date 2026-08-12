import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const { query } = await request.json();
    if (typeof query !== "string" || !query.trim()) return NextResponse.json({ error: "Query is required." }, { status: 400 });
    const key = process.env.TAVILY_API_KEY;
    if (!key) return NextResponse.json({ error: "TAVILY_API_KEY is not configured." }, { status: 500 });
    const response = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ api_key: key, query: query.trim(), search_depth: "advanced", topic: "general", max_results: 5, include_answer: true }),
      signal: AbortSignal.timeout(30000),
      cache: "no-store",
    });
    const data = await response.json();
    if (!response.ok) return NextResponse.json({ error: "Tavily search failed." }, { status: 502 });
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "Unable to reach Tavily." }, { status: 500 });
  }
}
