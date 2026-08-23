import type { CaptionWord, Scene } from "./types";

const PAUSE_TOKEN = "[pause]";

export function buildSpokenText(scenes: Scene[]): {
  text: string;
  ranges: { id: string; start: number; end: number }[];
} {
  const parts: string[] = [];
  for (const scene of scenes) {
    if (parts.length) parts.push(PAUSE_TOKEN);
    parts.push(scene.narration.trim());
  }
  const text = parts.join(" ");
  const ranges: { id: string; start: number; end: number }[] = [];
  let cursor = 0;
  for (const scene of scenes) {
    const narration = scene.narration.trim();
    const start = text.indexOf(narration, cursor);
    const from = start >= 0 ? start : cursor;
    ranges.push({ id: scene.id, start: from, end: from + narration.length });
    cursor = from + narration.length;
  }
  return { text, ranges };
}

export function sceneIdAtChar(
  index: number,
  ranges: { id: string; start: number; end: number }[],
  fallback: string,
): string {
  for (const range of ranges) {
    if (index >= range.start && index < range.end) return range.id;
  }
  let nearest = fallback;
  let best = Infinity;
  for (const range of ranges) {
    const dist = Math.min(
      Math.abs(index - range.start),
      Math.abs(index - range.end),
    );
    if (dist < best) {
      best = dist;
      nearest = range.id;
    }
  }
  return nearest;
}

export function wordsFromGraph(opts: {
  graphChars: string[];
  graphTimes: [number, number][];
  spokenText: string;
  ranges: { id: string; start: number; end: number }[];
  fallbackSceneId: string;
}): CaptionWord[] {
  const { graphChars, graphTimes, spokenText, ranges, fallbackSceneId } = opts;
  const n = Math.min(graphChars.length, graphTimes.length);
  if (n === 0) return [];

  const joined = graphChars.slice(0, n).join("");
  const aligned = joined === spokenText;

  const words: CaptionWord[] = [];
  let buf = "";
  let bufStart = 0;
  let bufStartTime = 0;
  let lastEnd = 0;

  const flush = (endTime: number, endIndex: number) => {
    const text = buf.trim();
    buf = "";
    if (!text || text === PAUSE_TOKEN) return;
    const charIndex = aligned
      ? bufStart
      : Math.min(Math.max(0, endIndex), Math.max(0, spokenText.length - 1));
    words.push({
      text,
      start: bufStartTime,
      end: Math.max(endTime, bufStartTime + 0.08),
      sceneId: sceneIdAtChar(charIndex, ranges, fallbackSceneId),
    });
  };

  for (let i = 0; i < n; i++) {
    const ch = graphChars[i] ?? "";
    const [start, end] = graphTimes[i] ?? [lastEnd, lastEnd];
    lastEnd = end;
    if (/\s/.test(ch)) {
      if (buf) flush(start, i);
      continue;
    }
    if (!buf) {
      bufStart = i;
      bufStartTime = start;
    }
    buf += ch;
  }
  if (buf) flush(lastEnd, n);

  return words;
}

export function estimateWords(
  scenes: Scene[],
  totalDuration: number,
): CaptionWord[] {
  const tokens = scenes.flatMap((scene) =>
    scene.narration
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .map((text) => ({ text, sceneId: scene.id })),
  );
  if (tokens.length === 0) return [];
  const per = totalDuration / tokens.length;
  return tokens.map((token, i) => ({
    ...token,
    start: i * per,
    end: (i + 1) * per,
  }));
}

export function activeWordIndex(words: CaptionWord[], time: number): number {
  if (words.length === 0) return -1;
  for (let i = 0; i < words.length; i++) {
    if (time >= words[i].start && time < words[i].end) return i;
  }
  if (time >= (words[words.length - 1]?.end ?? 0)) return words.length - 1;
  return 0;
}

export function windowAround(
  words: CaptionWord[],
  index: number,
  size = 4,
): CaptionWord[] {
  if (index < 0 || words.length === 0) return [];
  const start = Math.max(0, index - Math.floor((size - 1) / 2));
  const end = Math.min(words.length, start + size);
  const adj = Math.max(0, end - size);
  return words.slice(adj, end);
}

export function sceneAtTime(
  scenes: Scene[],
  words: CaptionWord[],
  time: number,
): Scene {
  const idx = activeWordIndex(words, time);
  if (idx >= 0) {
    const id = words[idx]?.sceneId;
    const found = scenes.find((s) => s.id === id);
    if (found) return found;
  }
  const total = Math.max(words.at(-1)?.end ?? 1, 0.01);
  const i = Math.min(
    scenes.length - 1,
    Math.max(0, Math.floor((time / total) * scenes.length)),
  );
  return scenes[i] ?? scenes[0];
}
