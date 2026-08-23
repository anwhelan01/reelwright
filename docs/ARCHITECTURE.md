# Architecture

Reelwright is a single-page TanStack Start app. The browser is the cutting room. The server is only the xAI boundary.

## Layers

```text
┌─────────────────────────────────────────────────────────┐
│  StudioApp          brief, chips, produce                │
│  PhoneStage         canvas + audio + export              │
│  SceneBoard         cut list, reshoot, revoice           │
└───────────────┬─────────────────────────┬───────────────┘
                │                         │
         Zustand store              pipeline.ts
         (brief, script,            (draft / voice / shoot)
          images, voice,                  │
          stage)                    generate.ts
                                          │
                                   xAI chat / TTS / images
```

## Client

| Module | Role |
| --- | --- |
| [`src/lib/store.ts`](../src/lib/store.ts) | Source of truth. Brief persists to `localStorage`. Script, stills, and voice live in memory (stills are data URLs). |
| [`src/lib/pipeline.ts`](../src/lib/pipeline.ts) | User-initiated orchestration. `needsRedraft` / `needsReshoot` avoid wasting image calls. |
| [`src/lib/player.ts`](../src/lib/player.ts) | `drawFrame`: cover-crop still, Ken Burns, 80ms dip-to-black on cuts, grain, vignette, overlay type, karaoke/punch/lower captions, progress bar. |
| [`src/lib/captions.ts`](../src/lib/captions.ts) | Builds spoken text with pause tokens; maps TTS graph timestamps onto words and scenes; falls back to even spacing. |
| [`src/lib/music.ts`](../src/lib/music.ts) | Oscillator beds into the same `AudioContext` as the voice, so export captures both. |
| [`src/lib/demo.ts`](../src/lib/demo.ts) | Hard-coded sample script + `/demo/*` assets. Shown when `script` is null. |
| [`src/lib/script.ts`](../src/lib/script.ts) | Turns pasted lines into a `Script` without calling the writer. |

Auth and Postgres helpers exist in `src/lib` because the App Builder template ships them. **This app does not use them.** No sign-in, no `user_id`, no migrations of its own.

## Server

[`src/lib/generate.ts`](../src/lib/generate.ts) is the only network I/O to xAI. All three calls are `createServerFn` handlers. The key is `process.env.XAI_API_KEY` — never a `VITE_` variable, never returned to the client.

| Function | Model / endpoint | Output |
| --- | --- | --- |
| `draftScript` | `grok-4.5` chat, JSON object | `Script` |
| `produceVoice` | `POST /v1/tts` | MP3 data URL + word timings |
| `produceSceneImage` | `grok-imagine-image-2.0` then `grok-imagine-image` | JPEG data URL |

`checkAi` is a GET used once on hydrate so the UI can disable Produce when the key is missing.

## State machine

```text
idle ──draft──► drafted ──produce──► voicing ──► shooting ──► ready
  ▲                │                                  │
  └──── reset ─────┴──────── reshoot / revoice ───────┘
```

`error` is a stage overlay, not a dead end. Sample cut is not a stage — it is the idle preview.

`briefKey` is `topic|style|duration|customScript`. Format is **not** in the key: changing 9:16 → 16:9 reshoots without rewriting the script.

## Export

`PhoneStage.exportReel` captures the canvas at 30 fps, taps the voice element and the music bed through a `MediaStreamAudioDestinationNode`, and records with `MediaRecorder` (VP9/VP8 WebM, MP4 if the browser supports it). There is no ffmpeg on the server.

## Spend

Produce is the expensive path. Guards:

- User click only. No generation on page load (the sample is static files).
- Draft is optional and cheap (one chat).
- Revoice skips images.
- Parallelism capped at 2 stills.
- Chat `max_tokens` 2200; one retry on 5xx/429.

## Out of scope (on purpose)

- Image-to-video per scene (Imagine video is ~$0.08/sec; four clips would dominate the key).
- Accounts / cloud library (stills as data URLs would blow a row; use `localStorage` recents only).
- Stock footage providers (the whole point is not to).
