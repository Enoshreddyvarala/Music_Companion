"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  time: string;
};

type Video = {
  id: string;
  url: string;
  title: string;
};

const prompts = [
  ["Late-night drive", "Recommend Telugu songs for a late-night drive."],
  ["Workout", "Give me energetic songs for a workout."],
  ["Study", "Recommend calm English songs for studying."],
  ["Nostalgic", "I feel nostalgic. Give me songs that match that mood."],
];

function Icon({
  name,
}: {
  name:
    | "spark"
    | "send"
    | "plus"
    | "copy"
    | "menu"
    | "play"
    | "music"
    | "external";
}) {
  const common = {
    width: 18,
    height: 18,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };

  const paths = {
    spark: (
      <>
        <path d="m12 3-1.1 4.1L7 8.2l3.9 1.1L12 13l1.1-3.7L17 8.2l-3.9-1.1L12 3Z" />
        <path d="m19 14-.7 2.3L16 17l2.3.7L19 20l.7-2.3L19 14Z" />
      </>
    ),

    send: (
      <>
        <path d="m22 2-7 20-4-9-9-4Z" />
        <path d="M22 2 11 13" />
      </>
    ),

    plus: (
      <>
        <path d="M12 5v14" />
        <path d="M5 12h14" />
      </>
    ),

    copy: (
      <>
        <rect x="9" y="9" width="11" height="11" rx="2" />
        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
      </>
    ),

    menu: (
      <>
        <path d="M4 6h16" />
        <path d="M4 12h16" />
        <path d="M4 18h16" />
      </>
    ),

    play: <path d="m9 6 10 6-10 6V6Z" />,

    music: (
      <>
        <path d="M9 18V5l10-2v13" />
        <circle cx="6" cy="18" r="3" />
        <circle cx="16" cy="16" r="3" />
      </>
    ),

    external: (
      <>
        <path d="M14 5h5v5" />
        <path d="m19 5-8 8" />
        <path d="M19 13v5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h5" />
      </>
    ),
  };

  return <svg {...common}>{paths[name]}</svg>;
}

function Clock() {
  const [time, setTime] = useState("");

  useEffect(() => {
    const update = () => {
      setTime(
        new Intl.DateTimeFormat("en-IN", {
          hour: "2-digit",
          minute: "2-digit",
        }).format(new Date())
      );
    };

    update();

    const interval = setInterval(update, 30000);

    return () => clearInterval(interval);
  }, []);

  return <span>{time}</span>;
}

/*
|--------------------------------------------------------------------------
| YouTube URL detection
|--------------------------------------------------------------------------
|
| Supports:
|
| https://www.youtube.com/watch?v=VIDEO_ID
| https://youtube.com/watch?v=VIDEO_ID
| https://youtu.be/VIDEO_ID
| https://www.youtube.com/embed/VIDEO_ID
|
| It also supports your current agent output where the host may be
| different but the URL contains /watch?v=VIDEO_ID.
|
*/

function extractYouTubeVideos(text: string): Video[] {
  const videos: Video[] = [];

  const addVideo = (id: string, url: string, title = "YouTube recommendation") => {
    const cleanId = id.trim();

    if (!cleanId) return;

    if (cleanId.length < 6 || cleanId.length > 20) return;

    if (!/^[a-zA-Z0-9_-]+$/.test(cleanId)) return;

    if (videos.some((video) => video.id === cleanId)) return;

    videos.push({
      id: cleanId,
      url,
      title,
    });
  };

  /*
   * Markdown:
   *
   * [Song Title](https://www.youtube.com/watch?v=abc123)
   */
  const markdownRegex =
    /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/gi;

  let match: RegExpExecArray | null;

  while ((match = markdownRegex.exec(text)) !== null) {
    const label = match[1];
    const url = match[2];

    const id = getYouTubeId(url);

    if (id) {
      addVideo(id, url, label);
    }
  }

  /*
   * Standard URLs.
   */
  const urlRegex =
    /https?:\/\/[^\s<>"')\]]+/gi;

  while ((match = urlRegex.exec(text)) !== null) {
    const rawUrl = match[0];

    const url = rawUrl.replace(/[.,!?;:]+$/, "");

    const id = getYouTubeId(url);

    if (id) {
      addVideo(id, url);
    }
  }

  /*
   * Handles cases where the agent returns:
   *
   * https://some-domain/watch?v=VIDEO_ID
   *
   * rather than youtube.com.
   */
  const watchRegex =
    /\/watch\?[^ \n]*\bv=([a-zA-Z0-9_-]{6,20})/gi;

  while ((match = watchRegex.exec(text)) !== null) {
    addVideo(
      match[1],
      `https://www.youtube.com/watch?v=${match[1]}`
    );
  }

  return videos;
}

function getYouTubeId(url: string): string | null {
  try {
    const parsed = new URL(url);

    /*
     * youtube.com/watch?v=
     */
    const queryId = parsed.searchParams.get("v");

    if (queryId) {
      return queryId;
    }

    /*
     * youtu.be/VIDEO_ID
     */
    if (
      parsed.hostname === "youtu.be" ||
      parsed.hostname === "www.youtu.be"
    ) {
      const id = parsed.pathname.split("/").filter(Boolean)[0];

      return id || null;
    }

    /*
     * youtube.com/embed/VIDEO_ID
     */
    const embedMatch = parsed.pathname.match(
      /\/embed\/([a-zA-Z0-9_-]+)/
    );

    if (embedMatch) {
      return embedMatch[1];
    }

    /*
     * youtube.com/shorts/VIDEO_ID
     */
    const shortsMatch = parsed.pathname.match(
      /\/shorts\/([a-zA-Z0-9_-]+)/
    );

    if (shortsMatch) {
      return shortsMatch[1];
    }

    return null;
  } catch {
    /*
     * If the URL isn't a valid URL but still contains
     * ?v=VIDEO_ID, extract it manually.
     */
    const match = url.match(
      /[?&]v=([a-zA-Z0-9_-]{6,20})/
    );

    return match?.[1] ?? null;
  }
}

/*
|--------------------------------------------------------------------------
| Remove YouTube URLs from the visible AI explanation.
|--------------------------------------------------------------------------
*/

function cleanAssistantText(text: string): string {
  let cleaned = text;

  /*
   * Remove markdown links:
   * [Song title](URL)
   */
  cleaned = cleaned.replace(
    /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/gi,
    (_, label) => label
  );

  /*
   * Remove normal URLs.
   */
  cleaned = cleaned.replace(
    /https?:\/\/[^\s<>"')\]]+/gi,
    ""
  );

  /*
   * Remove raw /watch?v=... URLs if the agent uses
   * a proxy/custom host.
   */
  cleaned = cleaned.replace(
    /\S*\/watch\?[^\s]*\bv=[a-zA-Z0-9_-]{6,20}[^\s]*/gi,
    ""
  );

  /*
   * Remove excess blank lines created by URL removal.
   */
  cleaned = cleaned
    .replace(/\n\s*\n\s*\n/g, "\n\n")
    .trim();

  return cleaned;
}

/*
|--------------------------------------------------------------------------
| YouTube Video Card
|--------------------------------------------------------------------------
*/

function YouTubeCard({ video }: { video: Video }) {
  const [loaded, setLoaded] = useState(false);

  const embedUrl = `https://www.youtube.com/embed/${video.id}?rel=0&modestbranding=1`;

  return (
    <div className="youtube-card">
      <div className="youtube-card-header">
        <div className="youtube-platform">
          <div className="youtube-logo">
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="white"
            >
              <path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.6 12 3.6 12 3.6s-7.5 0-9.4.5A3 3 0 0 0 .5 6.2 31 31 0 0 0 0 12a31 31 0 0 0 .5 5.8 3 3 0 0 0 2.1 2.1c1.9.5 9.4.5 9.4.5s7.5 0 9.4-.5a3 3 0 0 0 2.1-2.1A31 31 0 0 0 24 12a31 31 0 0 0-.5-5.8ZM9.6 15.8V8.2l6.4 3.8-6.4 3.8Z" />
            </svg>
          </div>

          <div>
            <strong>YouTube</strong>
            <span>Recommended track</span>
          </div>
        </div>

        <span className="youtube-ai-badge">
          AI PICK
        </span>
      </div>

      <div className="youtube-player">
        {!loaded && (
          <div className="youtube-loading">
            <div className="youtube-loading-icon">
              <Icon name="play" />
            </div>

            <span>Loading YouTube player...</span>
          </div>
        )}

        <iframe
          src={embedUrl}
          title={video.title}
          className={loaded ? "youtube-iframe visible" : "youtube-iframe"}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
          onLoad={() => setLoaded(true)}
        />
      </div>

      <div className="youtube-card-info">
        <div className="youtube-song-title">
          {video.title}
        </div>

        <div className="youtube-video-id">
          YouTube video · {video.id}
        </div>

        <div className="youtube-actions">
          <a
            href={`https://www.youtube.com/watch?v=${video.id}`}
            target="_blank"
            rel="noreferrer"
            className="youtube-watch"
          >
            <Icon name="play" />
            Watch on YouTube
          </a>

          <a
            href={`https://www.youtube.com/watch?v=${video.id}`}
            target="_blank"
            rel="noreferrer"
            className="youtube-external"
            aria-label="Open YouTube"
          >
            <Icon name="external" />
          </a>
        </div>
      </div>
    </div>
  );
}

/*
|--------------------------------------------------------------------------
| Assistant Response
|--------------------------------------------------------------------------
*/

function AssistantResponse({
  content,
}: {
  content: string;
}) {
  const videos = useMemo(
    () => extractYouTubeVideos(content),
    [content]
  );

  const explanation = useMemo(
    () => cleanAssistantText(content),
    [content]
  );

  return (
    <div className="assistant-response">
      {explanation && (
        <div className="assistant-text">
          {explanation}
        </div>
      )}

      {videos.length > 0 && (
        <div className="youtube-results">
          <div className="youtube-results-heading">
            <div>
              <div className="youtube-results-kicker">
                YOUR AI RECOMMENDATION
              </div>

              <h3>
                Listen to your recommended track
                {videos.length > 1 ? "s" : ""}
              </h3>
            </div>

            <div className="youtube-results-count">
              {videos.length} video{videos.length > 1 ? "s" : ""}
            </div>
          </div>

          <div className="youtube-video-grid">
            {videos.map((video) => (
              <YouTubeCard
                key={video.id}
                video={video}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({
      behavior: "smooth",
    });
  }, [messages, busy]);

  async function submit(text = input) {
    const prompt = text.trim();

    if (!prompt || busy) return;

    const now = new Intl.DateTimeFormat("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date());

    setInput("");

    setMessages((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        role: "user",
        content: prompt,
        time: now,
      },
    ]);

    setBusy(true);

    try {
      /*
       * THIS IS YOUR EXISTING AGENT CONNECTION.
       *
       * Browser:
       *      POST /api/chat
       *
       * Server:
       *      Zaby executable agent
       *
       * We are NOT changing the agent integration here.
       */
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: prompt,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Your Zaby agent could not complete the request."
        );
      }

      const answer =
        typeof data.answer === "string"
          ? data.answer
          : JSON.stringify(data.answer, null, 2);

      setMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: answer,
          time: new Intl.DateTimeFormat("en-IN", {
            hour: "2-digit",
            minute: "2-digit",
          }).format(new Date()),
        },
      ]);
    } catch (error) {
      setMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content:
            error instanceof Error
              ? error.message
              : "Unable to reach your Zaby agent.",
          time: now,
        },
      ]);
    } finally {
      setBusy(false);
    }
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    void submit();
  }

  return (
    <main className="music-shell">
      {/* SIDEBAR */}

      <aside
        className={`music-sidebar ${
          mobileOpen ? "open" : ""
        }`}
      >
        <div className="music-brand">
          <div className="music-logo">
            <Icon name="music" />
          </div>

          <div>
            <strong>TuneAI</strong>
            <span>Zaby Music Agent</span>
          </div>
        </div>

        <button
          className="music-new"
          onClick={() => setMessages([])}
        >
          <Icon name="plus" />
          New request
          <kbd>⌘ K</kbd>
        </button>

        <div className="music-label">
          DISCOVERY
        </div>

        <nav>
          <button className="music-nav active">
            <span>
              <Icon name="spark" />
              AI Recommender
            </span>

            <b>LIVE</b>
          </button>

          <button className="music-nav">
            <span>
              <Icon name="music" />
              YouTube Music
            </span>
          </button>
        </nav>

        <div className="music-side-bottom">
          <div className="zaby-status">
            <span />
            Zaby agent connected
          </div>

          <div className="agent-card">
            <div className="agent-avatar">
              <Icon name="spark" />
            </div>

            <div>
              <strong>Music Agent</strong>
              <span>Executable Agent</span>
            </div>
          </div>
        </div>
      </aside>

      {/* MAIN */}

      <section className="music-workspace">
        <header className="music-topbar">
          <div className="music-top-left">
            <button
              className="music-mobile-menu"
              onClick={() =>
                setMobileOpen((value) => !value)
              }
            >
              <Icon name="menu" />
            </button>

            <div>
              <div className="music-eyebrow">
                AI MUSIC DISCOVERY
              </div>

              <h1>
                YouTube Song Recommender
              </h1>
            </div>
          </div>

          <div className="music-top-right">
            <Clock />

            <span className="online">
              <span />
              Agent online
            </span>
          </div>
        </header>

        <div className="music-chat">
          {messages.length === 0 ? (
            <div className="music-hero">
              <div className="hero-music-icon">
                <Icon name="music" />
              </div>

              <div className="hero-kicker">
                POWERED BY YOUR ZABY AGENT
              </div>

              <h2>
                What do you want
                <br />
                <em>to listen to?</em>
              </h2>

              <p>
                Describe a mood, language, artist,
                activity, era, or vibe. Your Zaby
                agent will turn the request into a
                music recommendation.
              </p>

              <div className="music-prompts">
                {prompts.map(
                  ([title, prompt]) => (
                    <button
                      key={title}
                      onClick={() =>
                        void submit(prompt)
                      }
                    >
                      <strong>{title}</strong>

                      <small>
                        {prompt}
                      </small>

                      <span>↗</span>
                    </button>
                  )
                )}
              </div>
            </div>
          ) : (
            <div className="music-messages">
              {messages.map((message) => (
                <article
                  key={message.id}
                  className={`music-message ${message.role}`}
                >
                  <div className="music-message-avatar">
                    {message.role ===
                    "assistant" ? (
                      <Icon name="spark" />
                    ) : (
                      "V"
                    )}
                  </div>

                  <div className="music-message-body">
                    <div className="music-message-meta">
                      <strong>
                        {message.role ===
                        "assistant"
                          ? "TuneAI"
                          : "You"}
                      </strong>

                      <span>
                        {message.time}
                      </span>
                    </div>

                    {message.role ===
                    "assistant" ? (
                      <AssistantResponse
                        content={message.content}
                      />
                    ) : (
                      <div className="assistant-text">
                        {message.content}
                      </div>
                    )}

                    {message.role ===
                      "assistant" && (
                      <div className="assistant-actions">
                        <button
                          onClick={() =>
                            navigator.clipboard.writeText(
                              message.content
                            )
                          }
                        >
                          <Icon name="copy" />
                          Copy
                        </button>
                      </div>
                    )}
                  </div>
                </article>
              ))}

              {busy && (
                <article className="music-message assistant">
                  <div className="music-message-avatar">
                    <Icon name="spark" />
                  </div>

                  <div className="music-message-body">
                    <div className="music-message-meta">
                      <strong>
                        TuneAI
                      </strong>

                      <span>
                        thinking
                      </span>
                    </div>

                    <div className="music-typing">
                      <i />
                      <i />
                      <i />
                    </div>
                  </div>
                </article>
              )}

              <div ref={bottomRef} />
            </div>
          )}
        </div>

        {/* COMPOSER */}

        <div className="music-composer-wrap">
          <form
            className="music-composer"
            onSubmit={onSubmit}
          >
            <textarea
              value={input}
              onChange={(event) =>
                setInput(event.target.value)
              }
              onKeyDown={(event) => {
                if (
                  event.key === "Enter" &&
                  !event.shiftKey
                ) {
                  event.preventDefault();
                  void submit();
                }
              }}
              placeholder="Ask your Zaby music agent for a recommendation..."
              rows={1}
            />

            <div className="music-composer-footer">
              <div className="music-hint">
                <span />
                Connected to executable agent
              </div>

              <button
                className="music-send"
                disabled={
                  busy || !input.trim()
                }
                aria-label="Send"
              >
                <Icon name="send" />
              </button>
            </div>
          </form>

          <p className="music-disclaimer">
            Your prompt is sent to your configured
            Zaby executable agent. Results depend on
            the agent instructions and tools you
            configured.
          </p>
        </div>
      </section>
    </main>
  );
}