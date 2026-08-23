import { Download, Pause, Play } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DEMO_IMAGES, DEMO_SCRIPT, DEMO_VOICE } from "@/lib/demo";
import { startBed } from "@/lib/music";
import { canvasSize, drawFrame, loadShot, pickRecorderMime, type LoadedShot } from "@/lib/player";
import { APP_NAME } from "@/lib/presets";
import { useStudio } from "@/lib/store";
import { cn } from "@/lib/utils";

export function PhoneStage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const shotsRef = useRef<LoadedShot[]>([]);
  const audioGraph = useRef<{
    ctx: AudioContext;
    dest: MediaStreamAudioDestinationNode;
  } | null>(null);
  const bedStop = useRef<(() => void) | null>(null);
  const rafRef = useRef(0);
  const [duration, setDuration] = useState(0);

  const script = useStudio((s) => s.script);
  const images = useStudio((s) => s.images);
  const voice = useStudio((s) => s.voice);
  const format = useStudio((s) => s.format);
  const captionStyle = useStudio((s) => s.captionStyle);
  const musicId = useStudio((s) => s.musicId);
  const playing = useStudio((s) => s.playing);
  const currentTime = useStudio((s) => s.currentTime);
  const stage = useStudio((s) => s.stage);
  const stageLabel = useStudio((s) => s.stageLabel);
  const exporting = useStudio((s) => s.exporting);
  const setPlaying = useStudio((s) => s.setPlaying);
  const setCurrentTime = useStudio((s) => s.setCurrentTime);
  const setExporting = useStudio((s) => s.setExporting);

  const isSample = !script;
  const cut = script ?? DEMO_SCRIPT;
  const imageMap = script ? images : DEMO_IMAGES;
  const track = script ? voice : DEMO_VOICE;
  const size = canvasSize(format);
  const isPortrait = format === "9:16";
  const isSquare = format === "1:1";

  useEffect(() => {
    let cancelled = false;
    const entries = Object.entries(imageMap);
    Promise.all(
      entries.map(async ([sceneId, src]) => {
        try {
          return { sceneId, image: await loadShot(src) };
        } catch {
          return { sceneId, image: null };
        }
      }),
    ).then((loaded) => {
      if (!cancelled) {
        shotsRef.current = loaded;
        paint(useStudio.getState().currentTime);
      }
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imageMap, isSample, script]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const src = track?.dataUrl ?? "";
    if (src) {
      if (audio.getAttribute("src") !== src) {
        audio.src = src;
        audio.load();
      }
    } else {
      audio.removeAttribute("src");
    }
  }, [track?.dataUrl]);

  const paint = (time: number) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const total = Math.max(duration, track?.duration ?? 0, 0.01);
    drawFrame({
      ctx,
      w: canvas.width,
      h: canvas.height,
      script: cut,
      scenes: cut.scenes,
      words: track?.words ?? [],
      shots: shotsRef.current,
      time,
      captionStyle,
      reducedMotion: reduced,
      total,
    });
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      canvas.width = size.w;
      canvas.height = size.h;
    }
    void document.fonts.ready.then(() => paint(useStudio.getState().currentTime));
    paint(currentTime);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cut, captionStyle, format, imageMap, track, size.w, size.h]);

  useEffect(() => {
    if (!playing) {
      paint(currentTime);
      return;
    }
    const audio = audioRef.current;
    const loop = () => {
      const t = audio && track?.dataUrl ? audio.currentTime : useStudio.getState().currentTime;
      paint(t);
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    const tick = window.setInterval(() => {
      const t = audio && track?.dataUrl ? audio.currentTime : useStudio.getState().currentTime;
      setCurrentTime(t);
    }, 120);
    return () => {
      cancelAnimationFrame(rafRef.current);
      window.clearInterval(tick);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, track?.dataUrl]);

  useEffect(() => {
    if (!playing || track?.dataUrl) return;
    const total = track?.duration ?? 15;
    let last = performance.now();
    let t = useStudio.getState().currentTime;
    const id = window.setInterval(() => {
      const now = performance.now();
      t += (now - last) / 1000;
      last = now;
      if (t >= total) {
        t = total;
        setPlaying(false);
        setCurrentTime(total);
        window.clearInterval(id);
        return;
      }
      setCurrentTime(t);
    }, 50);
    return () => window.clearInterval(id);
  }, [playing, track, setPlaying, setCurrentTime]);

  function ensureGraph() {
    const audio = audioRef.current;
    if (audioGraph.current) return audioGraph.current;
    const ctx = new AudioContext();
    const dest = ctx.createMediaStreamDestination();
    if (audio) {
      const src = ctx.createMediaElementSource(audio);
      src.connect(ctx.destination);
      src.connect(dest);
    }
    audioGraph.current = { ctx, dest };
    return audioGraph.current;
  }

  function stopBed() {
    bedStop.current?.();
    bedStop.current = null;
  }

  function startMusic() {
    const graph = ensureGraph();
    stopBed();
    bedStop.current = startBed(graph.ctx, [graph.ctx.destination, graph.dest], musicId);
  }

  useEffect(() => {
    if (!playing) {
      stopBed();
      return;
    }
    startMusic();
    return () => stopBed();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, musicId]);

  async function togglePlay() {
    const audio = audioRef.current;
    if (playing) {
      audio?.pause();
      setPlaying(false);
      return;
    }
    if (audio && track?.dataUrl) {
      ensureGraph();
      await audioGraph.current?.ctx.resume();
      try {
        await audio.play();
      } catch {
        toast.error("Press play again to unlock audio.");
        return;
      }
    }
    setPlaying(true);
  }

  function onScrub(value: number) {
    const audio = audioRef.current;
    if (audio && track?.dataUrl) audio.currentTime = value;
    setCurrentTime(value);
    paint(value);
  }

  async function exportReel() {
    const canvas = canvasRef.current;
    const audio = audioRef.current;
    if (!canvas) return;
    const mime = pickRecorderMime();
    if (!mime || typeof MediaRecorder === "undefined") {
      toast.error("This browser cannot record video.");
      return;
    }
    setExporting(true);
    setPlaying(false);
    audio?.pause();

    const graph = ensureGraph();
    await graph.ctx.resume();
    startMusic();

    const canvasStream = canvas.captureStream(30);
    const tracks = [...canvasStream.getVideoTracks()];
    tracks.push(...graph.dest.stream.getAudioTracks());
    const mixed = new MediaStream(tracks);
    const rec = new MediaRecorder(mixed, {
      mimeType: mime,
      videoBitsPerSecond: 5_000_000,
    });
    const chunks: BlobPart[] = [];
    rec.ondataavailable = (e) => {
      if (e.data.size) chunks.push(e.data);
    };

    const stop = () =>
      new Promise<Blob>((resolve) => {
        rec.onstop = () => resolve(new Blob(chunks, { type: mime }));
        rec.stop();
      });

    rec.start(200);
    onScrub(0);
    setPlaying(true);
    if (audio && track?.dataUrl) {
      audio.currentTime = 0;
      await audio.play().catch(() => undefined);
    }

    const total = Math.max(track?.duration ?? 0, audio?.duration || 0, 8);
    await new Promise<void>((resolve) => {
      const done = () => resolve();
      if (audio && track?.dataUrl) {
        audio.addEventListener("ended", done, { once: true });
        window.setTimeout(done, (total + 0.4) * 1000);
      } else {
        window.setTimeout(done, total * 1000);
      }
    });

    audio?.pause();
    setPlaying(false);
    stopBed();
    const blob = await stop();
    canvasStream.getTracks().forEach((t) => t.stop());
    const ext = mime.includes("mp4") ? "mp4" : "webm";
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${(cut.title || APP_NAME).replace(/\s+/g, "-").toLowerCase()}.${ext}`;
    a.click();
    URL.revokeObjectURL(a.href);
    setExporting(false);
    toast.success("Downloaded.");
  }

  const total = Math.max(duration, track?.duration ?? 0, 0.01);
  const ready = Boolean(cut);
  const busy = stage === "drafting" || stage === "voicing" || stage === "shooting";

  return (
    <div className="flex flex-col items-center gap-4">
      <audio
        ref={audioRef}
        preload="auto"
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration || 0)}
        onEnded={() => {
          setPlaying(false);
          const t = audioRef.current?.duration ?? track?.duration ?? 0;
          setCurrentTime(t);
        }}
      />

      <div
        className={cn(
          "phone-bezel relative mx-auto overflow-hidden p-2.5",
          isPortrait && "w-64 sm:w-72 rounded-3xl",
          isSquare && "w-64 sm:w-80 rounded-3xl",
          !isPortrait && !isSquare && "w-full max-w-lg rounded-2xl",
        )}
      >
        {isPortrait ? (
          <div className="absolute top-3 left-1/2 z-20 h-5 w-24 -translate-x-1/2 rounded-full bg-background/90" />
        ) : null}
        <div
          className={cn(
            "relative overflow-hidden bg-background",
            isPortrait && "aspect-portrait rounded-2xl",
            isSquare && "aspect-square rounded-xl",
            !isPortrait && !isSquare && "aspect-video rounded-lg",
          )}
        >
          <canvas ref={canvasRef} className="h-full w-full" aria-label="Reel preview" />
          <button
            type="button"
            className="absolute inset-0 z-10 flex items-center justify-center bg-transparent"
            onClick={() => void togglePlay()}
            disabled={exporting}
            aria-label={playing ? "Pause" : "Play"}
          >
            <span
              className={cn(
                "flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-opacity duration-150",
                playing ? "opacity-0 hover:opacity-100" : "opacity-100",
              )}
            >
              {playing ? <Pause className="size-5" /> : <Play className="size-5 translate-x-0.5" />}
            </span>
          </button>
          {busy ? (
            <div className="absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-background/80 to-transparent px-5 py-6">
              <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                {stageLabel || "Working"}
              </p>
              <div className="mt-2 h-px overflow-hidden bg-border">
                <div className="shimmer h-full w-full" />
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <div className="flex w-full max-w-xs flex-col gap-2">
        {isSample ? (
          <p className="text-center text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
            Sample cut · tap play
          </p>
        ) : null}
        <input
          type="range"
          min={0}
          max={total}
          step={0.05}
          value={Math.min(currentTime, total)}
          onChange={(e) => onScrub(Number(e.target.value))}
          disabled={!ready}
          aria-label="Scrub reel"
          className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-elevated accent-primary disabled:opacity-30"
        />
        <div className="flex items-center gap-2">
          <span className="text-[11px] tabular-nums text-muted-foreground">
            {formatTime(currentTime)}
          </span>
          <span className="flex-1 text-center text-[11px] tabular-nums text-subtle">
            {formatTime(total === 0.01 ? 0 : total)}
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => void exportReel()}
            disabled={!cut || (stage !== "ready" && !isSample) || exporting}
          >
            <Download className="size-3.5" />
            {exporting ? "Recording" : "Download"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function formatTime(sec: number) {
  if (!Number.isFinite(sec) || sec < 0) sec = 0;
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}
