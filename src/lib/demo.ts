import { estimateWords } from "./captions";
import type { Script, VoiceTrack } from "./types";

export const DEMO_SCRIPT: Script = {
  title: "Three hearts, blue blood",
  hook: "An octopus should not exist.",
  onScreenTitle: "Should not exist",
  hashtags: ["octopus", "deepsea", "sciencefacts"],
  scenes: [
    {
      id: "s1",
      purpose: "hook",
      narration: "An octopus should not exist.",
      caption: "Should not exist",
      punchWords: ["exist"],
      visualPrompt: "Extreme close-up of a giant Pacific octopus eye",
      mood: "ominous",
      camera: "zoom-in",
      overlay: "title",
      overlayText: "Should not exist",
      gradeFrom: "#0b1220",
      gradeTo: "#1a2a38",
    },
    {
      id: "s2",
      purpose: "point",
      narration: "Three separate hearts. Two push blood to the gills. One drives the body.",
      caption: "Three hearts",
      punchWords: ["Three", "hearts"],
      visualPrompt: "Octopus in midwater with three faint hearts",
      mood: "awe",
      camera: "zoom-out",
      overlay: "stat",
      overlayText: "03",
      gradeFrom: "#071018",
      gradeTo: "#163044",
    },
    {
      id: "s3",
      purpose: "proof",
      narration: "And the blood itself is blue — copper, not iron, in every vein.",
      caption: "Blue blood",
      punchWords: ["Blue"],
      visualPrompt: "Macro tentacle with a blue-copper sheen",
      mood: "clinical",
      camera: "pan-right",
      overlay: "none",
      overlayText: "",
      gradeFrom: "#101820",
      gradeTo: "#2a3a48",
    },
    {
      id: "s4",
      purpose: "cta",
      narration: "Still convinced that we are the strange ones?",
      caption: "The strange ones",
      punchWords: ["strange"],
      visualPrompt: "Octopus vanishing into ink",
      mood: "dark",
      camera: "hold",
      overlay: "none",
      overlayText: "",
      gradeFrom: "#08080c",
      gradeTo: "#1c1c22",
    },
  ],
};

export const DEMO_IMAGES: Record<string, string> = {
  s1: "/demo/s1.jpg",
  s2: "/demo/s2.jpg",
  s3: "/demo/s3.jpg",
  s4: "/demo/s4.jpg",
};

export const DEMO_VOICE_URL = "/demo/voice.mp3";
export const DEMO_DURATION = 14.45;

export const DEMO_WORDS = estimateWords(DEMO_SCRIPT.scenes, DEMO_DURATION);

export const DEMO_VOICE: VoiceTrack = {
  dataUrl: DEMO_VOICE_URL,
  duration: DEMO_DURATION,
  spokenText: DEMO_SCRIPT.scenes.map((s) => s.narration).join(" "),
  words: DEMO_WORDS,
};
