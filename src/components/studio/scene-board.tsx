import { Copy, Mic, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { DEMO_IMAGES, DEMO_SCRIPT } from "@/lib/demo";
import { reshootScene, runVoice } from "@/lib/pipeline";
import { useStudio } from "@/lib/store";
import { cn } from "@/lib/utils";

export function SceneBoard() {
  const script = useStudio((s) => s.script);
  const images = useStudio((s) => s.images);
  const stage = useStudio((s) => s.stage);
  const updateScene = useStudio((s) => s.updateScene);
  const currentTime = useStudio((s) => s.currentTime);
  const voice = useStudio((s) => s.voice);
  const voiceStale = useStudio((s) => s.voiceStale);
  const sample = !script;
  const cut = script ?? DEMO_SCRIPT;
  const thumbs = script ? images : DEMO_IMAGES;

  const activeId = voice
    ? voice.words.find((w) => currentTime >= w.start && currentTime < w.end)?.sceneId
    : cut.scenes[0]?.id;

  function copyAll() {
    const text = [
      cut.title,
      "",
      ...cut.scenes.map((s, i) => `${i + 1}. ${s.narration}`),
      "",
      cut.hashtags.map((h) => (h.startsWith("#") ? h : `#${h}`)).join(" "),
    ].join("\n");
    void navigator.clipboard.writeText(text);
    toast.success("Script copied.");
  }

  const busy = stage === "shooting" || stage === "voicing";

  return (
    <div className="flex min-h-0 flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
            {sample ? "Sample cut" : "Cut list"}
          </p>
          <h2 className="font-display text-2xl text-balance text-foreground">{cut.title}</h2>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {!sample && (voiceStale || voice) ? (
            <Button
              variant="ghost"
              size="sm"
              disabled={busy}
              onClick={() => void runVoice()}
            >
              <Mic className="size-3.5" />
              Revoice
            </Button>
          ) : null}
          <Button variant="ghost" size="sm" onClick={copyAll}>
            <Copy className="size-3.5" />
            Copy
          </Button>
        </div>
      </div>

      {sample ? (
        <p className="text-sm leading-relaxed text-muted-foreground text-pretty">
          Stock footage is a tell. Each line here has a still shot for that line —
          then a voice, captions, and a file you can post. Play the sample, then
          produce your own.
        </p>
      ) : null}

      {voiceStale && !sample ? (
        <p className="text-xs text-muted-foreground" role="status">
          Narration changed. Revoice to retimed captions — shots stay.
        </p>
      ) : null}

      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto pr-1">
        {cut.scenes.map((scene, i) => {
          const on = scene.id === activeId;
          return (
            <article
              key={scene.id}
              className={cn(
                "rounded-[var(--radius-lg)] border bg-elevated p-3 transition-[border-color] duration-150",
                on ? "border-primary/50" : "border-border",
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                  {String(i + 1).padStart(2, "0")} · {scene.purpose}
                </p>
                {sample ? null : (
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={busy}
                    onClick={() => void reshootScene(scene)}
                  >
                    <RefreshCw className="size-3.5" />
                    Reshoot
                  </Button>
                )}
              </div>
              <div className="mt-2 flex gap-3">
                <div className="size-16 shrink-0 overflow-hidden rounded-[var(--radius-sm)] bg-background">
                  {thumbs[scene.id] ? (
                    <img
                      src={thumbs[scene.id]}
                      alt=""
                      className="size-full object-cover"
                    />
                  ) : (
                    <div className="size-full bg-background" />
                  )}
                </div>
                <div className="min-w-0 flex-1 space-y-2">
                  {sample ? (
                    <p className="text-sm leading-snug text-foreground">{scene.narration}</p>
                  ) : (
                    <>
                      <Textarea
                        value={scene.narration}
                        aria-label={`Narration for scene ${i + 1}`}
                        rows={2}
                        onChange={(e) =>
                          updateScene(scene.id, { narration: e.target.value })
                        }
                      />
                      <input
                        value={scene.caption}
                        aria-label={`Caption for scene ${i + 1}`}
                        onChange={(e) =>
                          updateScene(scene.id, { caption: e.target.value })
                        }
                        className="h-9 w-full rounded-[var(--radius-sm)] border border-border bg-background px-2.5 text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      />
                    </>
                  )}
                </div>
              </div>
            </article>
          );
        })}
      </div>

      {cut.hashtags.length ? (
        <p className="text-xs text-muted-foreground">
          {cut.hashtags.map((h) => (h.startsWith("#") ? h : `#${h}`)).join("  ")}
        </p>
      ) : null}
    </div>
  );
}
