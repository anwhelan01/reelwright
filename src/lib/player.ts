import type { CaptionStyle, CaptionWord, FormatId, Scene, Script } from "./types";
import { formatMeta } from "./presets";
import { activeWordIndex, sceneAtTime, windowAround } from "./captions";

export type LoadedShot = {
  sceneId: string;
  image: HTMLImageElement | null;
};

export function canvasSize(format: FormatId) {
  const meta = formatMeta(format);
  return { w: meta.w, h: meta.h };
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function easeInOut(t: number) {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

function parseHex(hex: string, fallback: [number, number, number]): [number, number, number] {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return fallback;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function coverDraw(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  cw: number,
  ch: number,
  zoom: number,
  panX: number,
  panY: number,
) {
  const iw = img.naturalWidth || img.width;
  const ih = img.naturalHeight || img.height;
  if (!iw || !ih) return;
  const scale = Math.max(cw / iw, ch / ih) * zoom;
  const dw = iw * scale;
  const dh = ih * scale;
  const dx = (cw - dw) / 2 + panX * cw * 0.08;
  const dy = (ch - dh) / 2 + panY * ch * 0.06;
  ctx.drawImage(img, dx, dy, dw, dh);
}

function cameraAt(scene: Scene, t: number) {
  const e = easeInOut(Math.min(1, Math.max(0, t)));
  switch (scene.camera) {
    case "zoom-out":
      return { zoom: lerp(1.22, 1.05, e), panX: 0.02, panY: lerp(-0.04, 0.04, e) };
    case "pan-left":
      return { zoom: 1.16, panX: lerp(0.55, -0.55, e), panY: 0 };
    case "pan-right":
      return { zoom: 1.16, panX: lerp(-0.55, 0.55, e), panY: 0 };
    case "hold":
      return { zoom: 1.08, panX: 0, panY: 0 };
    case "zoom-in":
    default:
      return { zoom: lerp(1.05, 1.22, e), panX: lerp(-0.04, 0.04, e), panY: lerp(0.03, -0.03, e) };
  }
}

function sceneWindow(scene: Scene, words: CaptionWord[]) {
  const sceneWords = words.filter((w) => w.sceneId === scene.id);
  const start = sceneWords[0]?.start ?? 0;
  const end = sceneWords.at(-1)?.end ?? start + 3;
  return { start, end, span: Math.max(0.2, end - start) };
}

function sceneProgress(scene: Scene, words: CaptionWord[], time: number) {
  const { start, span } = sceneWindow(scene, words);
  return Math.min(1, Math.max(0, (time - start) / span));
}

function fillGrade(
  ctx: CanvasRenderingContext2D,
  scene: Scene,
  w: number,
  h: number,
) {
  const a = parseHex(scene.gradeFrom || "#121214", [16, 16, 20]);
  const b = parseHex(scene.gradeTo || "#2a2420", [42, 36, 32]);
  const g = ctx.createLinearGradient(0, 0, w, h);
  g.addColorStop(0, `rgb(${a[0]},${a[1]},${a[2]})`);
  g.addColorStop(1, `rgb(${b[0]},${b[1]},${b[2]})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

let grainCanvas: HTMLCanvasElement | null = null;
function getGrain() {
  if (grainCanvas) return grainCanvas;
  const c = document.createElement("canvas");
  c.width = 128;
  c.height = 128;
  const g = c.getContext("2d");
  if (!g) return c;
  const img = g.createImageData(128, 128);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = 80 + Math.random() * 100;
    img.data[i] = v;
    img.data[i + 1] = v;
    img.data[i + 2] = v;
    img.data[i + 3] = 22;
  }
  g.putImageData(img, 0, 0);
  grainCanvas = c;
  return c;
}

function wrapLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines: number,
): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (ctx.measureText(next).width <= maxWidth) {
      current = next;
    } else {
      if (current) lines.push(current);
      current = word;
      if (lines.length === maxLines - 1) break;
    }
  }
  if (current && lines.length < maxLines) lines.push(current);
  return lines;
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function strokeFill(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  fill: string,
  stroke: string,
  width: number,
) {
  ctx.lineJoin = "round";
  ctx.miterLimit = 2;
  ctx.lineWidth = width;
  ctx.strokeStyle = stroke;
  ctx.fillStyle = fill;
  ctx.strokeText(text, x, y);
  ctx.fillText(text, x, y);
}

const CUT_BLACK = 0.08;

export function drawFrame(opts: {
  ctx: CanvasRenderingContext2D;
  w: number;
  h: number;
  script: Script;
  scenes: Scene[];
  words: CaptionWord[];
  shots: LoadedShot[];
  time: number;
  captionStyle: CaptionStyle;
  reducedMotion: boolean;
  total: number;
}) {
  const { ctx, w, h, script, scenes, words, shots, time, captionStyle, reducedMotion, total } =
    opts;
  const scene = sceneAtTime(scenes, words, time);
  const progress = reducedMotion ? 0.4 : sceneProgress(scene, words, time);
  const cam = reducedMotion
    ? { zoom: 1.08, panX: 0, panY: 0 }
    : cameraAt(scene, progress);
  const shot = shots.find((s) => s.sceneId === scene.id);

  ctx.fillStyle = "#09090b";
  ctx.fillRect(0, 0, w, h);

  if (shot?.image) {
    coverDraw(ctx, shot.image, w, h, cam.zoom, cam.panX, cam.panY);
  } else {
    fillGrade(ctx, scene, w, h);
  }

  ctx.save();
  ctx.globalAlpha = 0.14;
  ctx.drawImage(getGrain(), 0, 0, w, h);
  ctx.restore();

  const vignette = ctx.createRadialGradient(
    w / 2,
    h / 2,
    Math.min(w, h) * 0.2,
    w / 2,
    h / 2,
    Math.max(w, h) * 0.72,
  );
  vignette.addColorStop(0, "rgba(0,0,0,0)");
  vignette.addColorStop(1, "rgba(0,0,0,0.52)");
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, w, h);

  const bottom = ctx.createLinearGradient(0, h * 0.48, 0, h);
  bottom.addColorStop(0, "rgba(0,0,0,0)");
  bottom.addColorStop(1, "rgba(0,0,0,0.58)");
  ctx.fillStyle = bottom;
  ctx.fillRect(0, 0, w, h);

  const { start } = sceneWindow(scene, words);
  const into = time - start;
  if (!reducedMotion && scene.id !== scenes[0]?.id && into >= 0 && into < CUT_BLACK) {
    ctx.fillStyle = `rgba(0,0,0,${1 - into / CUT_BLACK})`;
    ctx.fillRect(0, 0, w, h);
  }

  drawOverlay(ctx, w, h, scene, script);
  drawCaptions(ctx, w, h, scene, words, time, captionStyle);
  drawProgress(ctx, w, h, time, total);
}

function drawProgress(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  time: number,
  total: number,
) {
  const barH = Math.max(3, Math.round(h * 0.0045));
  ctx.fillStyle = "rgba(244,244,240,0.18)";
  ctx.fillRect(0, h - barH, w, barH);
  const p = total > 0 ? Math.min(1, Math.max(0, time / total)) : 0;
  ctx.fillStyle = "#ece8dc";
  ctx.fillRect(0, h - barH, w * p, barH);
}

function drawOverlay(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  scene: Scene,
  script: Script,
) {
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  if (scene.overlay === "title" || scene.purpose === "hook") {
    const title = (scene.overlayText || script.onScreenTitle || script.hook).trim();
    if (title && scene.purpose === "hook") {
      ctx.font = `500 ${Math.round(w * 0.09)}px "Instrument Serif", Georgia, serif`;
      ctx.fillStyle = "#f4f4f0";
      const lines = wrapLines(ctx, title, w * 0.84, 3);
      lines.forEach((line, i) => {
        ctx.fillText(line, w * 0.08, h * 0.12 + i * w * 0.11);
      });
    }
  }
  if (scene.overlay === "list-item" || scene.overlay === "stat") {
    const label = (scene.overlayText || "").trim();
    if (label) {
      ctx.textAlign = "left";
      ctx.font = `600 ${Math.round(w * 0.16)}px "Outfit", system-ui, sans-serif`;
      ctx.fillStyle = "rgba(244,244,240,0.92)";
      ctx.fillText(label, w * 0.08, h * 0.12);
    }
  }
}

function drawCaptions(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  scene: Scene,
  words: CaptionWord[],
  time: number,
  style: CaptionStyle,
) {
  const idx = activeWordIndex(words, time);
  const fontSize =
    style === "lower" ? Math.round(w * 0.05) : Math.round(w * 0.078);
  ctx.font = `700 ${fontSize}px "Outfit", system-ui, sans-serif`;
  ctx.textBaseline = "middle";
  const strokeW = Math.max(8, fontSize * 0.22);

  if (style === "karaoke") {
    const winAll = windowAround(words, idx, 4);
    const activeScene = idx >= 0 ? words[idx]?.sceneId : scene.id;
    const win = winAll.filter((w) => w.sceneId === activeScene);
    if (win.length > 0) {
      ctx.font = `700 ${fontSize}px "Outfit", system-ui, sans-serif`;
      const total = win.reduce((n, word) => n + ctx.measureText(word.text.toUpperCase()).width, 0);
      const gaps = Math.max(0, win.length - 1) * fontSize * 0.28;
      let x = (w - total - gaps) / 2;
      const y = h * 0.72;
      const padX = fontSize * 0.55;
      const boxW = total + gaps + padX * 2;
      const boxH = fontSize * 1.7;
      ctx.fillStyle = "rgba(0,0,0,0.42)";
      roundRect(ctx, (w - boxW) / 2, y - boxH / 2, boxW, boxH, fontSize * 0.22);
      ctx.fill();
      ctx.textAlign = "left";
      for (const word of win) {
        const active = idx >= 0 && words[idx] === word;
        const label = word.text.toUpperCase();
        const ww = ctx.measureText(label).width;
        const wordT =
          active && word.end > word.start
            ? Math.min(1, Math.max(0, (time - word.start) / (word.end - word.start)))
            : 0;
        const bounce = active ? Math.sin(wordT * Math.PI) * fontSize * 0.08 : 0;
        ctx.globalAlpha = active ? 1 : 0.78;
        strokeFill(
          ctx,
          label,
          x,
          y - bounce,
          active ? "#ece8dc" : "#f4f4f0",
          "rgba(0,0,0,0.92)",
          strokeW,
        );
        ctx.globalAlpha = 1;
        if (active) {
          ctx.fillStyle = "#ece8dc";
          ctx.fillRect(x, y + fontSize * 0.48, ww, Math.max(3, fontSize * 0.08));
        }
        x += ww + fontSize * 0.28;
      }
      return;
    }
  }

  const punch = new Set(scene.punchWords.map((p) => p.toLowerCase()));
  const caption = scene.caption.trim() || scene.narration.trim();
  ctx.textAlign = "center";
  const lines = wrapLines(ctx, caption.toUpperCase(), w * 0.86, 2);
  const y0 = style === "lower" ? h * 0.84 : h * 0.74;
  lines.forEach((line, i) => {
    const y = y0 + i * (fontSize * 1.18);
    if (style === "punch") {
      const pieces = line.split(/\s+/);
      const widths = pieces.map((p) => ctx.measureText(p).width);
      const gap = fontSize * 0.26;
      const total = widths.reduce((a, b) => a + b, 0) + gap * Math.max(0, pieces.length - 1);
      let x = w / 2 - total / 2;
      ctx.textAlign = "left";
      pieces.forEach((piece, pi) => {
        const raw = piece.replace(/[^\w]/g, "").toLowerCase();
        const hit = punch.has(raw);
        ctx.globalAlpha = hit ? 1 : 0.55;
        strokeFill(
          ctx,
          piece,
          x,
          y,
          hit ? "#ece8dc" : "#f4f4f0",
          "rgba(0,0,0,0.88)",
          strokeW,
        );
        ctx.globalAlpha = 1;
        x += widths[pi] + gap;
      });
      ctx.textAlign = "center";
    } else {
      strokeFill(ctx, line, w / 2, y, "#f4f4f0", "rgba(0,0,0,0.88)", strokeW);
    }
  });
}

export function loadShot(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("still failed"));
    img.src = src;
  });
}

export function pickRecorderMime(): string | undefined {
  const candidates = [
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm",
    "video/mp4",
  ];
  if (typeof MediaRecorder === "undefined") return undefined;
  return candidates.find((c) => MediaRecorder.isTypeSupported(c));
}
