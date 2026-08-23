import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  briefSchema,
  sceneSchema,
  scriptSchema,
  type Scene,
  type Script,
} from "./types";
import { buildSpokenText, estimateWords, wordsFromGraph } from "./captions";
import { DURATION_OPTIONS } from "./presets";

const CHAT_MODEL = "grok-4.5";
const IMAGE_MODELS = ["grok-imagine-image-2.0", "grok-imagine-image"] as const;

function apiKey(): string | null {
  return process.env.XAI_API_KEY ?? null;
}

export const checkAi = createServerFn({ method: "GET" }).handler(async () => {
  return { available: Boolean(apiKey()) };
});

const STYLE_DIRECTION: Record<string, string> = {
  explainer:
    "Teach one idea. Hook with a sharp question or reversal, then mechanism, then a single takeaway.",
  listicle:
    "Numbered hits. Hook names the count. Each middle scene is one item with overlay list-item and a short number in overlayText (01, 02…). Last scene is the pattern, not a recap.",
  story:
    "Narrative. Hook is an inciting image. Middle is the turn. End is the payoff — no moral-of-the-story lecture.",
  fact: "Open on an unbelievable-but-true claim. Next scenes prove it with concrete detail. Close on the implication.",
  howto:
    "Name the painful mistake first. Two tight steps. End on the result the viewer can feel.",
  hottake:
    "Lead with a polarizing claim. Back it with one vivid proof. Double down, do not hedge, do not say 'maybe'.",
};

function systemPrompt(duration: 15 | 30, format: string, style: string): string {
  const sceneTarget = DURATION_OPTIONS.find((d) => d.id === duration)?.scenes ?? 4;
  const words = duration === 15 ? "40-48" : "78-92";
  return `You are a short-form director-writer. You write scene-bound scripts: every spoken line has a matching visual that illustrates THAT line, never a generic stock vibe.

Hard rules:
- Duration ${duration}s, ${sceneTarget} scenes exactly.
- Total spoken words ${words}. Talking speed ~2.6 words/sec.
- Scene 1 purpose=hook. Under 12 spoken words. Pattern interrupt. Never "hey guys", "in this video", "welcome".
- Last scene purpose=cta. A question or a single next thought — never like/follow/subscribe.
- Captions: 2-6 words, not the full sentence. punchWords are 1-2 words from the caption that carry the surprise.
- visualPrompt: one photoreal cinematic STILL, specific, physical, no text/letters/logos/watermarks/UI in the frame. Must match the narration of that scene (this is the whole point).
- camera: vary across scenes. Hook is usually zoom-in.
- overlay: hook may use "title" with overlayText = onScreenTitle. Listicles use list-item. Otherwise none, unless a hard stat belongs on screen.
- gradeFrom / gradeTo: two hex colors for a cinematic grade fallback.
- Format is ${format}. Compose visuals for that frame.
- Style: ${STYLE_DIRECTION[style] ?? style}
- Language of narration: match the user's topic language; default English (UK spelling if the topic is British).

Return ONLY JSON matching the schema. No markdown.`;
}

export const draftScript = createServerFn({ method: "POST" })
  .validator((input: unknown) => briefSchema.parse(input))
  .handler(async ({ data }) => {
    const key = apiKey();
    if (!key) return { ok: false as const, error: "AI is not available right now." };

    const user = `Topic: ${data.topic}
Style: ${data.style}
Duration: ${data.duration} seconds
Frame: ${data.format}

Write the JSON script now.`;

    try {
      const raw = await chatJson(key, systemPrompt(data.duration, data.format, data.style), user);
      const script = normalizeScript(raw, data.duration);
      return { ok: true as const, script };
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Could not draft the script.";
      return { ok: false as const, error: message };
    }
  });

const voiceInput = z.object({
  scenes: z.array(sceneSchema),
  voiceId: z.string().min(1).max(40),
  language: z.string().min(2).max(12),
});

export const produceVoice = createServerFn({ method: "POST" })
  .validator((input: unknown) => voiceInput.parse(input))
  .handler(async ({ data }) => {
    const key = apiKey();
    if (!key) return { ok: false as const, error: "AI is not available right now." };

    const { text, ranges } = buildSpokenText(data.scenes);
    if (text.length > 14000) {
      return { ok: false as const, error: "Narration is too long to voice in one take." };
    }

    try {
      const spoken = await tts(key, text, data.voiceId, data.language);
      const fallbackId = data.scenes[0]?.id ?? "s1";
      let words =
        spoken.graphChars && spoken.graphTimes
          ? wordsFromGraph({
              graphChars: spoken.graphChars,
              graphTimes: spoken.graphTimes,
              spokenText: text,
              ranges,
              fallbackSceneId: fallbackId,
            })
          : [];
      const duration = spoken.duration || estimateDurationFromWords(words, data.scenes);
      if (words.length === 0) words = estimateWords(data.scenes, duration);

      return {
        ok: true as const,
        dataUrl: `data:${spoken.contentType};base64,${spoken.b64}`,
        duration,
        spokenText: text,
        words,
      };
    } catch (err) {
      return {
        ok: false as const,
        error: err instanceof Error ? err.message : "Voice failed.",
      };
    }
  });

const imageInput = z.object({
  prompt: z.string().min(8).max(800),
  format: z.enum(["9:16", "1:1", "16:9"]),
  mood: z.string().optional(),
});

export const produceSceneImage = createServerFn({ method: "POST" })
  .validator((input: unknown) => imageInput.parse(input))
  .handler(async ({ data }) => {
    const key = apiKey();
    if (!key) return { ok: false as const, error: "AI is not available right now." };

    const prompt = [
      "Photoreal cinematic still photograph, 35mm, natural filmic lighting.",
      "No text, no letters, no numbers, no captions, no logo, no watermark, no UI.",
      "Single subject, composed for a",
      data.format,
      "frame.",
      data.prompt.trim(),
      data.mood ? `Mood: ${data.mood}.` : "",
    ]
      .filter(Boolean)
      .join(" ");

    try {
      const dataUrl = await generateImage(key, prompt, data.format);
      return { ok: true as const, dataUrl };
    } catch (err) {
      return {
        ok: false as const,
        error: err instanceof Error ? err.message : "Shot failed.",
      };
    }
  });

function estimateDurationFromWords(
  words: { end: number }[],
  scenes: Scene[],
): number {
  const last = words.at(-1)?.end ?? 0;
  if (last > 1) return last;
  const count = scenes.reduce(
    (n, s) => n + s.narration.trim().split(/\s+/).filter(Boolean).length,
    0,
  );
  return Math.max(8, count * 0.38);
}

function normalizeScript(raw: unknown, duration: 15 | 30): Script {
  const parsed = scriptSchema.parse(coerceScript(raw));
  const target = DURATION_OPTIONS.find((d) => d.id === duration)?.scenes ?? 4;
  let scenes = parsed.scenes.slice(0, target);
  if (scenes.length < 3) {
    throw new Error("Script returned too few scenes.");
  }
  scenes = scenes.map((scene, i) => ({
    ...scene,
    id: `s${i + 1}`,
    purpose: i === 0 ? "hook" : i === scenes.length - 1 ? "cta" : scene.purpose,
    punchWords: (scene.punchWords ?? []).slice(0, 3),
    camera: scene.camera ?? (i % 2 === 0 ? "zoom-in" : "zoom-out"),
    overlay: scene.overlay ?? "none",
    overlayText: scene.overlayText ?? "",
    gradeFrom: scene.gradeFrom || "#101014",
    gradeTo: scene.gradeTo || "#2a2420",
  }));
  return { ...parsed, scenes, hashtags: (parsed.hashtags ?? []).slice(0, 8) };
}

function oneOf<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === "string" && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : fallback;
}

function coerceScript(raw: unknown): unknown {
  if (!raw || typeof raw !== "object") return raw;
  const obj = raw as Record<string, unknown>;
  const scenes = Array.isArray(obj.scenes) ? obj.scenes : [];
  const cameras = ["zoom-in", "zoom-out", "pan-left", "pan-right", "hold"] as const;
  const purposes = ["hook", "point", "proof", "cta"] as const;
  const overlays = ["none", "title", "stat", "list-item"] as const;
  return {
    title: String(obj.title ?? "Untitled"),
    hook: String(obj.hook ?? ""),
    onScreenTitle: String(obj.onScreenTitle ?? obj.hook ?? obj.title ?? ""),
    hashtags: Array.isArray(obj.hashtags) ? obj.hashtags.map(String) : [],
    scenes: scenes.map((s, i) => {
      const scene = (s ?? {}) as Record<string, unknown>;
      const narration = String(scene.narration ?? scene.voiceover ?? "").trim();
      const caption = String(scene.caption ?? scene.onScreen ?? narration)
        .trim()
        .split(/\s+/)
        .slice(0, 8)
        .join(" ");
      let overlay = String(scene.overlay ?? "none");
      if (overlay === "text" || overlay === "headline") overlay = "title";
      if (overlay === "number" || overlay === "count") overlay = "list-item";
      const cameraRaw = String(scene.camera ?? "zoom-in").toLowerCase();
      const camera = cameras.find((c) => cameraRaw.includes(c)) ?? (i % 2 === 0 ? "zoom-in" : "zoom-out");
      return {
        id: String(scene.id ?? `s${i + 1}`),
        purpose: oneOf(scene.purpose, purposes, i === 0 ? "hook" : "point"),
        narration: narration || caption || "Hold this thought.",
        caption: caption || narration.split(/\s+/).slice(0, 4).join(" ") || "Watch this",
        punchWords: Array.isArray(scene.punchWords)
          ? scene.punchWords.map(String)
          : [],
        visualPrompt: String(scene.visualPrompt ?? scene.visual ?? caption),
        mood: String(scene.mood ?? "cinematic"),
        camera,
        overlay: oneOf(overlay, overlays, "none"),
        overlayText: String(scene.overlayText ?? ""),
        gradeFrom: String(scene.gradeFrom ?? "#101014"),
        gradeTo: String(scene.gradeTo ?? "#2a2420"),
      };
    }),
  };
}

async function chatJson(key: string, system: string, user: string): Promise<unknown> {
  const body = {
    model: CHAT_MODEL,
    max_tokens: 2200,
    temperature: 0.7,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
  };

  let lastErr = "Draft failed.";
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(60_000),
    });
    if (!res.ok) {
      lastErr = `Writer error ${res.status}`;
      if (res.status >= 500 || res.status === 429) continue;
      throw new Error(lastErr);
    }
    const json = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const content = json.choices?.[0]?.message?.content ?? "";
    return extractJson(content);
  }
  throw new Error(lastErr);
}

function extractJson(text: string): unknown {
  const fenced = text.match(/```json\s*([\s\S]*?)```/i);
  const raw = fenced?.[1] ?? text;
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("The writer did not return a script.");
  return JSON.parse(raw.slice(start, end + 1));
}

type TtsResult = {
  b64: string;
  contentType: string;
  duration: number;
  graphChars?: string[];
  graphTimes?: [number, number][];
};

async function tts(
  key: string,
  text: string,
  voiceId: string,
  language: string,
): Promise<TtsResult> {
  const payload = {
    text,
    voice_id: voiceId,
    language,
    speed: 1.05,
    with_timestamps: true,
    output_format: { codec: "mp3", sample_rate: 24000, bit_rate: 128000 },
  };

  let res = await fetch("https://api.x.ai/v1/tts", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(45_000),
  });

  if (!res.ok && res.status >= 400) {
    res = await fetch("https://api.x.ai/v1/tts", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({ text, voice_id: voiceId, language }),
      signal: AbortSignal.timeout(60_000),
    });
  }

  if (!res.ok) throw new Error(`Voice error ${res.status}`);

  const ctype = res.headers.get("content-type") ?? "";
  if (ctype.includes("json")) {
    const json = (await res.json()) as {
      audio?: string;
      content_type?: string;
      duration?: number;
      audio_timestamps?: {
        graph_chars?: string[];
        graph_times?: [number, number][];
      };
    };
    if (!json.audio) throw new Error("Voice returned empty audio.");
    return {
      b64: json.audio,
      contentType: json.content_type ?? "audio/mpeg",
      duration: Number(json.duration) || 0,
      graphChars: json.audio_timestamps?.graph_chars,
      graphTimes: json.audio_timestamps?.graph_times,
    };
  }

  const buf = Buffer.from(await res.arrayBuffer());
  return {
    b64: buf.toString("base64"),
    contentType: ctype || "audio/mpeg",
    duration: 0,
  };
}

async function generateImage(
  key: string,
  prompt: string,
  format: "9:16" | "1:1" | "16:9",
): Promise<string> {
  let lastErr = "Shot failed.";
  for (const model of IMAGE_MODELS) {
    const bodies = [
      {
        model,
        prompt,
        n: 1,
        resolution: "1k",
        aspect_ratio: format,
        response_format: "b64_json",
      },
      {
        model,
        prompt,
        n: 1,
        aspect_ratio: format,
        response_format: "b64_json",
      },
      { model, prompt, n: 1, response_format: "b64_json" },
    ];
    for (const body of bodies) {
      const res = await fetch("https://api.x.ai/v1/images/generations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${key}`,
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(55_000),
      });
      if (!res.ok) {
        lastErr = `Shot error ${res.status}`;
        if (res.status === 400 || res.status === 404 || res.status === 422) continue;
        if (res.status >= 500 || res.status === 429) continue;
        throw new Error(lastErr);
      }
      const json = (await res.json()) as {
        data?: { b64_json?: string; url?: string }[];
      };
      const item = json.data?.[0];
      if (item?.b64_json) return `data:image/jpeg;base64,${item.b64_json}`;
      if (item?.url) {
        const img = await fetch(item.url, { signal: AbortSignal.timeout(20_000) });
        if (!img.ok) throw new Error("Could not fetch the still.");
        const buf = Buffer.from(await img.arrayBuffer());
        const mime = img.headers.get("content-type") || "image/jpeg";
        return `data:${mime};base64,${buf.toString("base64")}`;
      }
    }
  }
  throw new Error(lastErr);
}
