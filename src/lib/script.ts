import { DURATION_OPTIONS } from "./presets";
import { CAMERA_MOVES, type Script } from "./types";

export function scriptFromLines(
  title: string,
  lines: string[],
  duration: 15 | 30,
): Script {
  const target = DURATION_OPTIONS.find((d) => d.id === duration)?.scenes ?? 4;
  const cleaned = lines.map((l) => l.trim()).filter(Boolean).slice(0, target);
  if (cleaned.length < 3) {
    throw new Error("Need at least three lines — hook, point, close.");
  }
  const hook = cleaned[0];
  const scenes = cleaned.map((narration, i) => {
    const words = narration.split(/\s+/).filter(Boolean);
    const caption = words.slice(0, 5).join(" ");
    const last = cleaned.length - 1;
    const purpose = i === 0 ? "hook" : i === last ? "cta" : i === 1 ? "point" : "proof";
    return {
      id: `s${i + 1}`,
      purpose: purpose as Script["scenes"][number]["purpose"],
      narration,
      caption,
      punchWords: words.slice(-2, -1).concat(words.slice(-1)).slice(0, 2),
      visualPrompt: `Photoreal cinematic still that literally depicts: ${narration}. Single subject, 35mm, natural filmic lighting, no text in the frame.`,
      mood: "cinematic",
      camera: CAMERA_MOVES[i % CAMERA_MOVES.length],
      overlay: (i === 0 ? "title" : "none") as "title" | "none",
      overlayText: i === 0 ? caption : "",
      gradeFrom: "#101014",
      gradeTo: "#2a2420",
    };
  });
  return {
    title: (title.trim() || hook).slice(0, 56),
    hook,
    onScreenTitle: hook.split(/\s+/).slice(0, 5).join(" "),
    hashtags: [],
    scenes,
  };
}

export function linesFromText(text: string): string[] {
  const blocks = text
    .split(/\n+/)
    .map((l) => l.replace(/^\s*\d+[.)]\s*/, "").trim())
    .filter(Boolean);
  return blocks;
}
