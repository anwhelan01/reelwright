import { z } from "zod";

export const FORMAT_IDS = ["9:16", "1:1", "16:9"] as const;
export type FormatId = (typeof FORMAT_IDS)[number];

export const STYLE_IDS = [
  "explainer",
  "listicle",
  "story",
  "fact",
  "howto",
  "hottake",
] as const;
export type StyleId = (typeof STYLE_IDS)[number];

export const CAPTION_STYLES = ["karaoke", "punch", "lower"] as const;
export type CaptionStyle = (typeof CAPTION_STYLES)[number];

export const MUSIC_IDS = ["off", "pulse", "air"] as const;
export type MusicId = (typeof MUSIC_IDS)[number];

export const DURATIONS = [15, 30] as const;
export type DurationSec = (typeof DURATIONS)[number];

export const CAMERA_MOVES = [
  "zoom-in",
  "zoom-out",
  "pan-left",
  "pan-right",
  "hold",
] as const;
export type CameraMove = (typeof CAMERA_MOVES)[number];

export const SCENE_PURPOSES = ["hook", "point", "proof", "cta"] as const;
export type ScenePurpose = (typeof SCENE_PURPOSES)[number];

export const sceneSchema = z.object({
  id: z.string(),
  purpose: z.enum(SCENE_PURPOSES),
  narration: z.string().min(1),
  caption: z.string().min(1),
  punchWords: z.array(z.string()).default([]),
  visualPrompt: z.string().min(1),
  mood: z.string().default("cinematic"),
  camera: z.enum(CAMERA_MOVES).default("zoom-in"),
  overlay: z.enum(["none", "title", "stat", "list-item"]).default("none"),
  overlayText: z.string().optional().default(""),
  gradeFrom: z.string().optional().default("#101014"),
  gradeTo: z.string().optional().default("#2a2420"),
});

export type Scene = z.infer<typeof sceneSchema>;

export const scriptSchema = z.object({
  title: z.string(),
  hook: z.string(),
  onScreenTitle: z.string(),
  hashtags: z.array(z.string()).default([]),
  scenes: z.array(sceneSchema).min(3).max(6),
});

export type Script = z.infer<typeof scriptSchema>;

export const briefSchema = z.object({
  topic: z.string().trim().min(3).max(280),
  style: z.enum(STYLE_IDS),
  duration: z.union([z.literal(15), z.literal(30)]),
  format: z.enum(FORMAT_IDS),
  voiceId: z.string().min(1).max(40),
  language: z.string().min(2).max(12).default("en"),
});

export type Brief = z.infer<typeof briefSchema>;

export type CaptionWord = {
  text: string;
  start: number;
  end: number;
  sceneId: string;
};

export type VoiceTrack = {
  dataUrl: string;
  duration: number;
  spokenText: string;
  words: CaptionWord[];
};

export type ProduceStage =
  | "idle"
  | "drafting"
  | "drafted"
  | "voicing"
  | "shooting"
  | "ready"
  | "exporting"
  | "error";

export type RecentCut = {
  topic: string;
  title: string;
  at: number;
};
