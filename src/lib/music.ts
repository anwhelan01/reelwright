import type { MusicId } from "./types";

export function startBed(
  ctx: AudioContext,
  targets: AudioNode[],
  id: MusicId,
): () => void {
  if (id === "off") return () => undefined;

  const master = ctx.createGain();
  master.gain.value = 0;
  for (const node of targets) master.connect(node);
  master.gain.linearRampToValueAtTime(id === "pulse" ? 0.07 : 0.05, ctx.currentTime + 0.4);

  const nodes: AudioScheduledSourceNode[] = [];

  if (id === "pulse") {
    const drone = ctx.createOscillator();
    drone.type = "sine";
    drone.frequency.value = 55;
    const droneGain = ctx.createGain();
    droneGain.gain.value = 0.55;
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 240;
    drone.connect(droneGain).connect(filter).connect(master);
    drone.start();
    nodes.push(drone);

    const fifth = ctx.createOscillator();
    fifth.type = "sine";
    fifth.frequency.value = 82.4;
    const fifthGain = ctx.createGain();
    fifthGain.gain.value = 0.22;
    fifth.connect(fifthGain).connect(filter);
    fifth.start();
    nodes.push(fifth);

    const lfo = ctx.createOscillator();
    lfo.frequency.value = 1.33;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.18;
    lfo.connect(lfoGain).connect(droneGain.gain);
    lfo.start();
    nodes.push(lfo);

    const tick = ctx.createOscillator();
    tick.type = "triangle";
    tick.frequency.value = 220;
    const tickGain = ctx.createGain();
    tickGain.gain.value = 0;
    const tickFilter = ctx.createBiquadFilter();
    tickFilter.type = "highpass";
    tickFilter.frequency.value = 800;
    tick.connect(tickGain).connect(tickFilter).connect(master);
    tick.start();
    nodes.push(tick);

    const pulse = ctx.createOscillator();
    pulse.frequency.value = 1.6;
    const pulseGain = ctx.createGain();
    pulseGain.gain.value = 0.04;
    pulse.connect(pulseGain).connect(tickGain.gain);
    pulse.start();
    nodes.push(pulse);
  } else {
    const a = ctx.createOscillator();
    a.type = "sine";
    a.frequency.value = 392;
    const b = ctx.createOscillator();
    b.type = "sine";
    b.frequency.value = 587.3;
    const g = ctx.createGain();
    g.gain.value = 0.18;
    const filter = ctx.createBiquadFilter();
    filter.type = "highpass";
    filter.frequency.value = 280;
    const delay = ctx.createDelay();
    delay.delayTime.value = 0.22;
    const fb = ctx.createGain();
    fb.gain.value = 0.28;
    a.connect(g);
    b.connect(g);
    g.connect(filter).connect(master);
    filter.connect(delay).connect(fb).connect(delay);
    delay.connect(master);
    a.start();
    b.start();
    nodes.push(a, b);

    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.07;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 18;
    lfo.connect(lfoGain).connect(a.frequency);
    lfo.start();
    nodes.push(lfo);
  }

  return () => {
    const now = ctx.currentTime;
    master.gain.cancelScheduledValues(now);
    master.gain.setValueAtTime(master.gain.value, now);
    master.gain.linearRampToValueAtTime(0, now + 0.25);
    window.setTimeout(() => {
      for (const node of nodes) {
        try {
          node.stop();
        } catch {
          /* already stopped */
        }
        node.disconnect();
      }
      master.disconnect();
    }, 320);
  };
}
