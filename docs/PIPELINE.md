# Pipeline

How a topic becomes a file.

## 1. Brief

The composer stores:

- `topic` (or pasted `customScript` in write mode)
- `style` — explainer, listicle, story, fact, howto, hottake
- `duration` — 15s (4 scenes) or 30s (6)
- `format` — 9:16, 1:1, 16:9
- `voiceId`, `captionStyle`, `musicId`

Persisted under `reelwright.brief.v2`. Recents under `reelwright.recents.v1`.

## 2. Draft

**AI path.** `draftScript` asks Grok for JSON that matches `scriptSchema`:

- `title`, `hook`, `onScreenTitle`, `hashtags`
- `scenes[]` with `narration`, `caption`, `punchWords`, `visualPrompt`, `mood`, `camera`, `overlay`, grade colours

Hard rules in the system prompt: no “hey guys”, scene 1 is a hook under 12 words, last scene is a question not a subscribe CTA, `visualPrompt` is a photoreal still that depicts **that line**.

**Write-it path.** `scriptFromLines` splits on newlines, strips numbering, assigns hook / point / proof / cta, and uses the line itself as the visual prompt. Needs at least three lines.

Draft clears stills and voice. That is intentional — a new script is a new cut.

## 3. Voice

`produceVoice` concatenates scene narration with `[pause]` tokens, calls xAI TTS (`with_timestamps` when the API accepts it), and maps `graph_chars` / `graph_times` onto words via `wordsFromGraph`. If timestamps are missing, `estimateWords` spreads the duration evenly.

The client stores a data URL plus `{ text, start, end, sceneId }[]`. Karaoke and scene cuts both read this array. `sceneAtTime` is word-driven, not clock-sliced, so a long proof scene holds its still until its last word ends.

Editing narration sets `voiceStale`. **Revoice** reruns this step only.

## 4. Shoot

`produceSceneImage` for each scene, two at a time:

```text
Photoreal cinematic still, 35mm, no text in the frame.
Composed for {format}.
{visualPrompt}
Mood: {mood}.
```

Failures are skipped. A scene without a still falls back to a two-stop colour grade from `gradeFrom` / `gradeTo` so the cut still plays.

If every scene already has a still and the format has not changed, Produce skips this step.

## 5. Play

Each animation frame:

1. Resolve the active scene from the word list.
2. Cover-draw its still with the scene’s camera (zoom-in, zoom-out, pan, hold).
3. Grain + vignette + bottom fade.
4. 80ms dip-to-black on a scene change.
5. Hook title / list number overlay.
6. Captions (karaoke window is filtered to the current scene).
7. Thin progress bar.

The sample cut uses `/demo/s1.jpg`…`s4.jpg` and `/demo/voice.mp3` so this path works with the key absent.

## 6. Export

Play from 0 with `MediaRecorder` on `canvas.captureStream(30)` plus the mixed audio destination. Filename is the slug of the script title.

## Prompts, if you fork the writer

Keep `visualPrompt` as a **still**. The compositor is not a video editor. Specific, physical, no letters. UK spelling when the topic is British. Captions 2–6 words, not the full sentence.
