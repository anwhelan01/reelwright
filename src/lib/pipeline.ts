import { toast } from "sonner";
import { checkAi, draftScript, produceSceneImage, produceVoice } from "./generate";
import { estimateWords } from "./captions";
import { linesFromText, scriptFromLines } from "./script";
import { useStudio } from "./store";
import type { Scene, Script } from "./types";

async function pool<T>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<void>,
) {
  let i = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++;
      await fn(items[idx], idx);
    }
  });
  await Promise.all(workers);
}

export async function ensureAi(): Promise<boolean> {
  const available = useStudio.getState().aiAvailable;
  if (available != null) return available;
  const res = await checkAi();
  useStudio.getState().setAiAvailable(res.available);
  return res.available;
}

export async function runDraft(): Promise<Script | null> {
  const store = useStudio.getState();
  store.setPlaying(false);
  store.setError(null);

  if (store.writeMode) {
    const lines = linesFromText(store.customScript);
    try {
      const script = scriptFromLines(store.topic || lines[0] || "Untitled", lines, store.duration);
      store.setScript(script);
      store.setStage("drafted", "Script locked");
      toast.success("Script locked from your lines.");
      return script;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not read that script.";
      store.setError(message);
      toast.error(message);
      return null;
    }
  }

  const topic = store.topic.trim();
  if (topic.length < 3) {
    toast.error("Give it a topic — a sentence is enough.");
    return null;
  }
  if (!(await ensureAi())) {
    store.setError("AI is not available in this environment.");
    toast.error("AI is not available right now.");
    return null;
  }

  store.setStage("drafting", "Writing the hook");

  const res = await draftScript({ data: store.brief() });
  if (!res.ok) {
    store.setError(res.error);
    toast.error(res.error);
    return null;
  }
  store.setScript(res.script);
  store.setStage("drafted", "Script locked");
  return res.script;
}

export async function runVoice(opts?: { quiet?: boolean }): Promise<boolean> {
  const store = useStudio.getState();
  const script = store.script;
  if (!script) return false;
  if (!(await ensureAi())) {
    toast.error("AI is not available right now.");
    return false;
  }

  store.setPlaying(false);
  store.setStage("voicing", "Casting the voice");
  const voiceRes = await produceVoice({
    data: {
      scenes: script.scenes,
      voiceId: store.voiceId,
      language: store.language,
    },
  });

  if (voiceRes.ok) {
    useStudio.getState().setVoice({
      dataUrl: voiceRes.dataUrl,
      duration: voiceRes.duration,
      spokenText: voiceRes.spokenText,
      words: voiceRes.words,
    });
    if (!opts?.quiet) {
      const after = useStudio.getState();
      after.setStage(after.needsReshoot() ? "drafted" : "ready", "Voice locked");
    }
    return true;
  }

  const duration = store.duration;
  useStudio.getState().setVoice({
    dataUrl: "",
    duration,
    spokenText: script.scenes.map((s) => s.narration).join(" "),
    words: estimateWords(script.scenes, duration),
  });
  toast.message("Voice skipped — playing on estimated timing.");
  return false;
}

export async function runProduce(forceDraft = false): Promise<boolean> {
  const store = useStudio.getState();
  let script = store.script;
  if (forceDraft || store.needsRedraft()) {
    script = await runDraft();
    if (!script) return false;
  }
  if (!script) return false;

  if (!(await ensureAi())) {
    store.setError("AI is not available in this environment.");
    return false;
  }

  store.setPlaying(false);
  store.setCurrentTime(0);
  store.setError(null);

  await runVoice({ quiet: true });

  let next = useStudio.getState();
  if (next.needsReshoot()) {
    const scenes = script.scenes;
    let done = 0;
    next.setStage("shooting", `Shooting 0 / ${scenes.length}`);

    await pool(scenes, 2, async (scene: Scene) => {
      const shot = await produceSceneImage({
        data: {
          prompt: scene.visualPrompt,
          format: useStudio.getState().format,
          mood: scene.mood,
        },
      });
      if (shot.ok) {
        useStudio.getState().setImage(scene.id, shot.dataUrl);
      }
      done += 1;
      useStudio.getState().setStage("shooting", `Shooting ${done} / ${scenes.length}`);
    });

    next = useStudio.getState();
    const landed = Object.keys(next.images).length;
    if (landed === 0) {
      toast.message("Playing on colour fields — stills did not land.");
    }
    next.lockFormat(next.format);
  }

  next = useStudio.getState();
  next.setStage("ready", "Cut");
  next.pushRecent({
    topic: next.topic.trim() || next.script?.title || "Untitled",
    title: next.script?.title || "Untitled",
    at: Date.now(),
  });
  next.setCurrentTime(0);
  toast.success("Reel is ready — hit play.");
  return true;
}

export async function reshootScene(scene: Scene): Promise<void> {
  const store = useStudio.getState();
  if (!(await ensureAi())) {
    toast.error("AI is not available right now.");
    return;
  }
  const shot = await produceSceneImage({
    data: {
      prompt: scene.visualPrompt,
      format: store.format,
      mood: scene.mood,
    },
  });
  if (!shot.ok) {
    toast.error(shot.error);
    return;
  }
  store.setImage(scene.id, shot.dataUrl);
  toast.success("Shot replaced.");
}
