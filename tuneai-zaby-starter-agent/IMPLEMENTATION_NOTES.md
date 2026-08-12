# TuneAI + Your Zaby Agent

This version preserves the supplied starter project and its dependencies.

Only the UI and `/api/chat` behavior were changed:
- The UI is now a YouTube song recommendation workspace.
- The browser sends the user's prompt to `/api/chat`.
- `/api/chat` sends the prompt to your executable agent using the exact API shape from your Python code.
- Agent ID defaults to `7b5400ac-4214-433a-a371-41299b733cd6`.
- Base URL defaults to `https://genapi.zaby.io`.
- `ZABY_API_KEY` stays server-side.

Run:
  bun install --frozen-lockfile
  cp .env.example .env.local
  bun run dev

Then open http://localhost:3000.

Put your real Zaby key in `.env.local`. Do not put it in page.tsx.
