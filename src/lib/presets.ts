import type { CaptionStyle, DurationSec, FormatId, MusicId, StyleId } from "./types";

export const APP_NAME = "Reelwright";
export const APP_TAGLINE = "From a line to a short";

export const STYLES: {
  id: StyleId;
  label: string;
  hint: string;
}[] = [
  { id: "explainer", label: "Explainer", hint: "One idea, cleanly taught" },
  { id: "listicle", label: "List", hint: "Numbered hits, fast cuts" },
  { id: "story", label: "Story", hint: "Setup, turn, payoff" },
  { id: "fact", label: "Fact drop", hint: "A surprise, then why" },
  { id: "howto", label: "How-to", hint: "Problem, steps, result" },
  { id: "hottake", label: "Hot take", hint: "Claim, proof, double-down" },
];

export const FORMATS: {
  id: FormatId;
  label: string;
  platform: string;
  w: number;
  h: number;
}[] = [
  { id: "9:16", label: "9:16", platform: "TikTok · Reels · Shorts", w: 720, h: 1280 },
  { id: "1:1", label: "1:1", platform: "Feed square", w: 1080, h: 1080 },
  { id: "16:9", label: "16:9", platform: "YouTube · X", w: 1280, h: 720 },
];

export const DURATION_OPTIONS: { id: DurationSec; label: string; scenes: number }[] =
  [
    { id: 15, label: "15s", scenes: 4 },
    { id: 30, label: "30s", scenes: 6 },
  ];

export const VOICES: { id: string; label: string; tone: string }[] = [
  { id: "orion", label: "Orion", tone: "Cinematic" },
  { id: "eve", label: "Eve", tone: "Energetic" },
  { id: "helix", label: "Helix", tone: "Bold" },
  { id: "luna", label: "Luna", tone: "Patient" },
  { id: "perseus", label: "Perseus", tone: "Confident" },
  { id: "sirius", label: "Sirius", tone: "Playful" },
  { id: "altair", label: "Altair", tone: "Premium" },
  { id: "rex", label: "Rex", tone: "Clear" },
];

export const CAPTION_OPTIONS: {
  id: CaptionStyle;
  label: string;
  hint: string;
}[] = [
  { id: "karaoke", label: "Karaoke", hint: "Word by word" },
  { id: "punch", label: "Punch", hint: "Short line, hit words" },
  { id: "lower", label: "Lower third", hint: "Broadcast clean" },
];

export const MUSIC_OPTIONS: { id: MusicId; label: string; hint: string }[] = [
  { id: "off", label: "Silent", hint: "Voice only" },
  { id: "pulse", label: "Pulse", hint: "Low cinematic bed" },
  { id: "air", label: "Air", hint: "High, thin shimmer" },
];

export const EXAMPLE_TOPICS = [
  "Why espresso goes bitter after 30 seconds",
  "The Colosseum was finished in eight years",
  "Octopuses have three hearts and blue blood",
  "Airports hide the real walking time on purpose",
  "The two-minute rule that kills procrastination",
];

export function formatMeta(id: FormatId) {
  return FORMATS.find((f) => f.id === id) ?? FORMATS[0];
}

export function styleMeta(id: StyleId) {
  return STYLES.find((s) => s.id === id) ?? STYLES[0];
}
