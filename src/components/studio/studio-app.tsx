import { Clapperboard, LoaderCircle, PenLine } from "lucide-react";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { PhoneStage } from "@/components/studio/phone-stage";
import { SceneBoard } from "@/components/studio/scene-board";
import { ensureAi, runDraft, runProduce } from "@/lib/pipeline";
import {
  CAPTION_OPTIONS,
  DURATION_OPTIONS,
  EXAMPLE_TOPICS,
  FORMATS,
  MUSIC_OPTIONS,
  STYLES,
  VOICES,
  APP_NAME,
  APP_TAGLINE,
} from "@/lib/presets";
import { useStudio } from "@/lib/store";

export function StudioApp() {
  const topic = useStudio((s) => s.topic);
  const style = useStudio((s) => s.style);
  const duration = useStudio((s) => s.duration);
  const format = useStudio((s) => s.format);
  const voiceId = useStudio((s) => s.voiceId);
  const captionStyle = useStudio((s) => s.captionStyle);
  const musicId = useStudio((s) => s.musicId);
  const writeMode = useStudio((s) => s.writeMode);
  const customScript = useStudio((s) => s.customScript);
  const recents = useStudio((s) => s.recents);
  const stage = useStudio((s) => s.stage);
  const error = useStudio((s) => s.error);
  const aiAvailable = useStudio((s) => s.aiAvailable);
  const hydrate = useStudio((s) => s.hydrate);
  const setTopic = useStudio((s) => s.setTopic);
  const setStyle = useStudio((s) => s.setStyle);
  const setDuration = useStudio((s) => s.setDuration);
  const setFormat = useStudio((s) => s.setFormat);
  const setVoiceId = useStudio((s) => s.setVoiceId);
  const setCaptionStyle = useStudio((s) => s.setCaptionStyle);
  const setMusicId = useStudio((s) => s.setMusicId);
  const setWriteMode = useStudio((s) => s.setWriteMode);
  const setCustomScript = useStudio((s) => s.setCustomScript);

  const busy =
    stage === "drafting" || stage === "voicing" || stage === "shooting" || stage === "exporting";

  useEffect(() => {
    hydrate();
    void ensureAi();
  }, [hydrate]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== "Space") return;
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      e.preventDefault();
      const play = document.querySelector<HTMLButtonElement>(
        '[aria-label="Play"], [aria-label="Pause"]',
      );
      play?.click();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const suggestions = recents.length
    ? recents.map((r) => r.topic)
    : EXAMPLE_TOPICS;

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-3 sm:px-6 sm:py-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-baseline gap-3">
              <h1 className="font-display text-3xl tracking-tight">{APP_NAME}</h1>
              <p className="hidden text-sm text-muted-foreground md:block">{APP_TAGLINE}</p>
            </div>
            <div className="flex gap-1.5 overflow-x-auto">
              {DURATION_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  className="chip shrink-0"
                  data-on={duration === opt.id}
                  onClick={() => setDuration(opt.id)}
                >
                  {opt.label}
                </button>
              ))}
              <span className="mx-1 h-9 w-px shrink-0 bg-border" />
              {FORMATS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  className="chip shrink-0"
                  data-on={format === opt.id}
                  onClick={() => setFormat(opt.id)}
                  title={opt.platform}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <form
            className="flex flex-col gap-2 sm:flex-row"
            onSubmit={(e) => {
              e.preventDefault();
              void runProduce();
            }}
          >
            <Input
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="A topic. One claim. Something worth stopping for."
              aria-label="Video topic"
              maxLength={280}
              className="sm:flex-1"
            />
            <div className="flex gap-2">
              <Button
                type="button"
                variant="secondary"
                disabled={busy || (!writeMode && aiAvailable === false)}
                onClick={() => void runDraft()}
                className="flex-1 sm:flex-none"
              >
                {stage === "drafting" ? (
                  <LoaderCircle className="size-4 animate-spin" />
                ) : (
                  <Clapperboard className="size-4" />
                )}
                Draft
              </Button>
              <Button
                type="submit"
                disabled={busy || aiAvailable === false}
                className="flex-1 sm:flex-none"
              >
                {busy && stage !== "drafting" ? (
                  <LoaderCircle className="size-4 animate-spin" />
                ) : null}
                Produce
              </Button>
            </div>
          </form>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <button
              type="button"
              className="inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors duration-150 hover:text-foreground"
              onClick={() => setWriteMode(!writeMode)}
            >
              <PenLine className="size-3.5" />
              {writeMode ? "Use the writer" : "Write the script"}
            </button>
            <span className="hidden text-[11px] uppercase tracking-[0.16em] text-subtle sm:inline">
              Scene-bound pipeline
            </span>
          </div>

          {writeMode ? (
            <Textarea
              value={customScript}
              onChange={(e) => setCustomScript(e.target.value)}
              aria-label="Custom script, one scene per line"
              placeholder={"Hook on line one.\nThe point on line two.\nProof.\nClose with a question."}
              rows={4}
            />
          ) : null}

          <div className="flex gap-2 overflow-x-auto pb-0.5">
            {suggestions.map((example) => (
              <button
                key={example}
                type="button"
                className="shrink-0 rounded-full px-2.5 py-1 text-left text-xs text-muted-foreground transition-colors duration-150 hover:text-foreground"
                onClick={() => setTopic(example)}
              >
                {example}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-7xl items-start gap-8 px-4 py-5 sm:px-6 md:grid-cols-2 lg:grid-cols-[0.9fr_1.1fr] lg:py-8">
        <PhoneStage />
        <div className="flex min-h-0 flex-col gap-5">
          <SceneBoard />
          <div className="grid gap-4 rounded-[var(--radius-xl)] border border-border bg-surface p-4 sm:grid-cols-2">
            <fieldset>
              <legend className="mb-2 text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                Style
              </legend>
              <div className="flex flex-wrap gap-1.5">
                {STYLES.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    className="chip"
                    data-on={style === opt.id}
                    onClick={() => setStyle(opt.id)}
                    title={opt.hint}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </fieldset>
            <fieldset>
              <legend className="mb-2 text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                Voice
              </legend>
              <div className="flex flex-wrap gap-1.5">
                {VOICES.map((v) => (
                  <button
                    key={v.id}
                    type="button"
                    className="chip"
                    data-on={voiceId === v.id}
                    onClick={() => setVoiceId(v.id)}
                    title={v.tone}
                  >
                    {v.label}
                  </button>
                ))}
              </div>
            </fieldset>
            <fieldset>
              <legend className="mb-2 text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                Captions
              </legend>
              <div className="flex flex-wrap gap-1.5">
                {CAPTION_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    className="chip"
                    data-on={captionStyle === opt.id}
                    onClick={() => setCaptionStyle(opt.id)}
                    title={opt.hint}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </fieldset>
            <fieldset>
              <legend className="mb-2 text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                Music
              </legend>
              <div className="flex flex-wrap gap-1.5">
                {MUSIC_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    className="chip"
                    data-on={musicId === opt.id}
                    onClick={() => setMusicId(opt.id)}
                    title={opt.hint}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </fieldset>
          </div>
          {error ? (
            <p className="text-sm text-rec" role="alert">
              {error}
            </p>
          ) : null}
          {aiAvailable === false ? (
            <p className="text-sm text-muted-foreground">
              AI features are unavailable in this environment.
            </p>
          ) : null}
        </div>
      </main>
    </div>
  );
}
