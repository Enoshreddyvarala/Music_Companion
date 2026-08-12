# Zaby AIUI external chat

A minimal Next.js reference application that securely streams the configured Zaby External App `lesson_tutor` route through a same-origin server boundary.

## Requirements

- [Bun](https://bun.sh/) 1.3.6
- access to a provisioned Zaby External App and its server-only provisioning API key

The repository configures the public npm registry for the `@zaby-ai` scope in `.npmrc`; no GitHub Packages credential is required.

## Install and run

Install the locked dependencies:

```bash
bun install --frozen-lockfile
```

Copy the environment template, fill every blank with the values for your approved External App, and keep the resulting file local:

```bash
cp .env.example .env.local
bun run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Server environment

All variables are server-only. Do not add a `NEXT_PUBLIC_` prefix.

| Variable | Required value | Purpose |
| --- | --- | --- |
| `ZABY_API_KEY` | `<provisioning-api-key>` | Secret used only by the Next.js server to mint runtime tokens. |
| `ZABY_PROVISIONING_BASE_URL` | `<provisioning-base-url>` | Base URL for the provisioning API. |
| `ZABY_GATEWAY_URL` | `<external-runtime-gateway-url>` | Base URL for the Cloudflare external runtime. |
| `ZABY_EXTERNAL_APP_ID` | `<external-app-uuid>` | Provisioned External App identifier used for token minting. |
| `ZABY_PUBLIC_APP_KEY` | `<public-app-key>` | Public application key used in the runtime route URL. |
| `ZABY_EXTERNAL_USER_ID` | `<policy-backed-external-user-id>` | Customer identity authorized by the configured policy. |
| `ZABY_ROUTE_NAME` | `lesson_tutor` | Allowlisted route; other values are rejected by server configuration. |

`getZabyConfig()` reads all seven variables at the server boundary and rejects a missing value. It removes trailing slashes from the two base URLs and currently accepts only `lesson_tutor` as the route name.

`.env.local` is ignored by Git. Never commit it, paste its contents into logs, or expose the provisioning key to client code.

## Request flow

```text
Browser chat UI
  -> POST /api/chat on the same Next.js origin
  -> process-local token lease obtains a short-lived server-channel runtime token
  -> Cloudflare External App /routes/lesson_tutor/run/aiui
  -> streamed SSE events return through the Next.js response
  -> AIUI React agent state applies text deltas to one stable assistant message
```

The browser submits only a byte-bounded JSON body containing a bounded message, conversation ID, and request ID. The Next.js server selects the configured gateway, External App, customer identity, and route; none can be overridden by the browser request.

The proxy preserves upstream SSE event framing and does not application-buffer the completed response. The UI models pending, streaming, and terminal lifecycle states, but visible multi-step text rendering depends on the gateway flushing deltas in separate network chunks. During the current live verification, the gateway batched `text_delta` and `completed` into one chunk, so the SSE lifecycle completed correctly while the final assistant text appeared at once.

## Runtime-token rotation

The server keeps one short-lived token lease per configured External App customer in process memory, reuses it only until a conservative pre-expiry threshold, and shares an in-flight mint across concurrent requests. When the gateway explicitly reports an expired token, stale grant, inactive token family, or stale routing revision, the server invalidates that exact rejected token, obtains one replacement, and retries once. Other authentication or conflict failures are not retried. Tokens are never persisted, logged, cached in browser storage, or placed in URLs.

The lease cache is process-local by design for this standalone reference. A multi-instance deployment would need a distributed lease or equivalent admission serialization to avoid cross-instance rotation races.

## Security boundaries

- The provisioning API key and runtime tokens remain in server-only code and process memory.
- The browser calls only the same-origin `/api/chat` endpoint; it never calls provisioning or the gateway directly.
- Client input cannot select an arbitrary gateway, External App, customer identity, or route.
- Upstream errors are converted to stable, sanitized responses without credential or provider-detail leakage.
- SSE is proxied without application buffering, and browser cancellation aborts the upstream request.
- The reference app does not log request bodies, provisioning credentials, bearer tokens, or complete upstream responses.

Production deployments still need application-specific authentication, authorization, rate limiting, and observability at the server boundary.

## Verification

Run the complete automated gate:

```bash
bun run test
bun run check-types
bun run lint
bun run build
```

For a live check, run `bun run dev`, send a short deterministic tutor prompt, and verify that `/api/chat` preserves a `text_delta` event followed by terminal completion. Record whether the live gateway flushes multiple chunks; do not treat upstream batching as a proxy failure. Stop a second response while it is active, and verify a sanitized failure plus Retry by temporarily using an invalid non-secret route value in `.env.local`; restore `lesson_tutor` afterward. Check both desktop and mobile widths, and confirm credentials are absent from browser storage, page URLs, client-visible configuration, logs, Git, and `.next` client assets.

## Explicitly deferred

- user login and session-derived customer identity
- lesson and course selection
- MCP authentication token forwarding
- quiz, flashcards, matching, debate, ranking, and teach-back routes
- persistent conversation history and layered memory controls
- speech-to-text
- production rate limiting, analytics, and distributed token leasing
