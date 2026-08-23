import { create } from "zustand";
import type {
  Brief,
  CaptionStyle,
  FormatId,
  MusicId,
  ProduceStage,
  RecentCut,
  Scene,
  Script,
  StyleId,
  VoiceTrack,
} from "./types";

const BRIEF_KEY = "reelwright.brief.v2";
const RECENTS_KEY = "reelwright.recents.v1";

export type StudioState = {
  topic: string;
  style: StyleId;
  duration: 15 | 30;
  format: FormatId;
  voiceId: string;
  language: string;
  captionStyle: CaptionStyle;
  musicId: MusicId;
  writeMode: boolean;
  customScript: string;
  script: Script | null;
  lockedKey: string;
  lockedFormat: FormatId | "";
  images: Record<string, string>;
  voice: VoiceTrack | null;
  voiceStale: boolean;
  recents: RecentCut[];
  stage: ProduceStage;
  stageLabel: string;
  error: string | null;
  aiAvailable: boolean | null;
  currentTime: number;
  playing: boolean;
  exporting: boolean;
};

type StudioActions = {
  hydrate: () => void;
  setTopic: (topic: string) => void;
  setStyle: (style: StyleId) => void;
  setDuration: (duration: 15 | 30) => void;
  setFormat: (format: FormatId) => void;
  setVoiceId: (voiceId: string) => void;
  setCaptionStyle: (captionStyle: CaptionStyle) => void;
  setMusicId: (musicId: MusicId) => void;
  setWriteMode: (writeMode: boolean) => void;
  setCustomScript: (customScript: string) => void;
  setAiAvailable: (aiAvailable: boolean) => void;
  setStage: (stage: ProduceStage, stageLabel?: string) => void;
  setError: (error: string | null) => void;
  setScript: (script: Script | null) => void;
  updateScene: (id: string, patch: Partial<Scene>) => void;
  setImage: (sceneId: string, dataUrl: string) => void;
  lockFormat: (format: FormatId) => void;
  setVoice: (voice: VoiceTrack | null) => void;
  setCurrentTime: (currentTime: number) => void;
  setPlaying: (playing: boolean) => void;
  setExporting: (exporting: boolean) => void;
  pushRecent: (item: RecentCut) => void;
  resetProduction: () => void;
  brief: () => Brief;
  briefKey: () => string;
  needsRedraft: () => boolean;
  needsReshoot: () => boolean;
};

const defaults: StudioState = {
  topic: "",
  style: "explainer",
  duration: 15,
  format: "9:16",
  voiceId: "orion",
  language: "en",
  captionStyle: "karaoke",
  musicId: "pulse",
  writeMode: false,
  customScript: "",
  script: null,
  lockedKey: "",
  lockedFormat: "",
  images: {},
  voice: null,
  voiceStale: false,
  recents: [],
  stage: "idle",
  stageLabel: "",
  error: null,
  aiAvailable: null,
  currentTime: 0,
  playing: false,
  exporting: false,
};

function persistBrief(state: StudioState) {
  try {
    localStorage.setItem(
      BRIEF_KEY,
      JSON.stringify({
        topic: state.topic,
        style: state.style,
        duration: state.duration,
        format: state.format,
        voiceId: state.voiceId,
        captionStyle: state.captionStyle,
        musicId: state.musicId,
        writeMode: state.writeMode,
        customScript: state.customScript,
      }),
    );
  } catch {
    /* ignore quota */
  }
}

function persistRecents(recents: RecentCut[]) {
  try {
    localStorage.setItem(RECENTS_KEY, JSON.stringify(recents.slice(0, 8)));
  } catch {
    /* ignore */
  }
}

export const useStudio = create<StudioState & StudioActions>((set, get) => ({
  ...defaults,
  hydrate: () => {
    try {
      const raw = localStorage.getItem(BRIEF_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<StudioState>;
        set({
          topic: parsed.topic ?? "",
          style: parsed.style ?? "explainer",
          duration: parsed.duration === 30 ? 30 : 15,
          format: parsed.format ?? "9:16",
          voiceId: parsed.voiceId ?? "orion",
          captionStyle: parsed.captionStyle ?? "karaoke",
          musicId: parsed.musicId === "air" || parsed.musicId === "off" ? parsed.musicId : "pulse",
          writeMode: Boolean(parsed.writeMode),
          customScript: parsed.customScript ?? "",
        });
      }
      const rec = localStorage.getItem(RECENTS_KEY);
      if (rec) {
        const parsed = JSON.parse(rec) as RecentCut[];
        if (Array.isArray(parsed)) set({ recents: parsed.slice(0, 8) });
      }
    } catch {
      /* ignore */
    }
  },
  setTopic: (topic) => {
    set({ topic });
    persistBrief(get());
  },
  setStyle: (style) => {
    set({ style });
    persistBrief(get());
  },
  setDuration: (duration) => {
    set({ duration });
    persistBrief(get());
  },
  setFormat: (format) => {
    set({ format });
    persistBrief(get());
  },
  setVoiceId: (voiceId) => {
    set({ voiceId });
    persistBrief(get());
  },
  setCaptionStyle: (captionStyle) => {
    set({ captionStyle });
    persistBrief(get());
  },
  setMusicId: (musicId) => {
    set({ musicId });
    persistBrief(get());
  },
  setWriteMode: (writeMode) => {
    set({ writeMode });
    persistBrief(get());
  },
  setCustomScript: (customScript) => {
    set({ customScript });
    persistBrief(get());
  },
  setAiAvailable: (aiAvailable) => set({ aiAvailable }),
  setStage: (stage, stageLabel = "") =>
    set({ stage, stageLabel, error: stage === "error" ? get().error : null }),
  setError: (error) => set({ error, stage: error ? "error" : get().stage }),
  setScript: (script) =>
    set({
      script,
      lockedKey: script ? get().briefKey() : "",
      lockedFormat: "",
      images: {},
      voice: null,
      voiceStale: false,
      currentTime: 0,
      playing: false,
    }),
  updateScene: (id, patch) => {
    const script = get().script;
    if (!script) return;
    const touchesVoice = patch.narration != null;
    set({
      script: {
        ...script,
        scenes: script.scenes.map((s) => (s.id === id ? { ...s, ...patch } : s)),
      },
      voiceStale: touchesVoice ? true : get().voiceStale,
    });
  },
  setImage: (sceneId, dataUrl) =>
    set({ images: { ...get().images, [sceneId]: dataUrl } }),
  lockFormat: (format) => set({ lockedFormat: format }),
  setVoice: (voice) => set({ voice, voiceStale: false, currentTime: 0 }),
  setCurrentTime: (currentTime) => set({ currentTime }),
  setPlaying: (playing) => set({ playing }),
  setExporting: (exporting) => set({ exporting }),
  pushRecent: (item) => {
    const recents = [
      item,
      ...get().recents.filter((r) => r.topic !== item.topic),
    ].slice(0, 8);
    set({ recents });
    persistRecents(recents);
  },
  resetProduction: () =>
    set({
      script: null,
      lockedKey: "",
      lockedFormat: "",
      images: {},
      voice: null,
      voiceStale: false,
      stage: "idle",
      stageLabel: "",
      error: null,
      currentTime: 0,
      playing: false,
    }),
  brief: () => {
    const s = get();
    return {
      topic: s.topic.trim(),
      style: s.style,
      duration: s.duration,
      format: s.format,
      voiceId: s.voiceId,
      language: s.language,
    };
  },
  briefKey: () => {
    const s = get();
    return [
      s.topic.trim(),
      s.style,
      s.duration,
      s.writeMode ? s.customScript.trim() : "",
    ].join("|");
  },
  needsRedraft: () => {
    const s = get();
    if (!s.script) return true;
    return s.briefKey() !== s.lockedKey;
  },
  needsReshoot: () => {
    const s = get();
    if (!s.script) return true;
    if (s.format !== s.lockedFormat) return true;
    return s.script.scenes.some((scene) => !s.images[scene.id]);
  },
}));

export function productionReady(state: StudioState) {
  return Boolean(state.script && state.voice && state.stage === "ready");
}

export function shotCount(state: StudioState) {
  if (!state.script) return 0;
  return state.script.scenes.filter((s) => state.images[s.id]).length;
}
