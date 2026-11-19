// Original background music for the brand videos, made here at $0 (no download, no
// third-party audio, so no licence terms, no attribution and nothing for Content ID to
// claim). A small synth: plucked strings (Karplus-Strong), a soft pad and a bass root,
// through a light room reverb. Deterministic: the same brand and week always give the
// same track. data/brand-social/music.json records the source and licence.
//
//   writeTrack(file, { preset: 'dream-wedding' | 'approvalprep', seconds, week })
// writes a 44.1 kHz 16-bit stereo WAV; render_posts.mjs then sets it to -19 LUFS
// integrated (true peak -2 dB) with ffmpeg loudnorm, fades it and lays it under the video.
import fs from 'node:fs';

const RATE = 44100;
const NOTE = (n) => 440 * 2 ** ((n - 69) / 12); // MIDI note -> Hz

export const PRESETS = {
  // Light, romantic, acoustic: I-V-vi-IV in D, fingerpicked eighths.
  'dream-wedding': { bpm: 72, chords: [[50, 57, 62, 66], [45, 57, 61, 64], [47, 54, 59, 62], [43, 55, 59, 62]], pattern: [0, 2, 3, 2, 1, 3, 2, 3], pluck: 0.55, pad: 0.10, bass: 0.22, bright: 0.996 },
  // Calm and steady, not hype: Fmaj7-Dm7-Bbmaj7-Csus in quarter notes, softer attack.
  approvalprep: { bpm: 84, chords: [[41, 57, 60, 64], [38, 57, 60, 65], [46, 57, 62, 65], [48, 55, 60, 65]], pattern: [1, 2, 3, 2], pluck: 0.42, pad: 0.16, bass: 0.20, bright: 0.993 }
};

function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
}

function pluck(out, start, freq, amp, seconds, bright, rand) {
  const period = Math.max(2, Math.round(RATE / freq));
  const buf = new Float32Array(period);
  for (let i = 0; i < period; i++) buf[i] = rand() * 2 - 1;
  // Soften the pick: smooth the noise burst so the attack is a pluck, not a click.
  for (let pass = 0; pass < 3; pass++) for (let i = 1; i < period; i++) buf[i] = 0.5 * (buf[i] + buf[i - 1]);
  const n = Math.min(out.length - start, Math.round(seconds * RATE));
  let idx = 0;
  for (let i = 0; i < n; i++) {
    const next = (idx + 1) % period;
    const v = buf[idx];
    buf[idx] = bright * 0.5 * (buf[idx] + buf[next]);
    idx = next;
    const attack = Math.min(1, i / 60);
    out[start + i] += v * amp * attack;
  }
}

function tone(out, start, freq, amp, seconds, attack, release) {
  const n = Math.min(out.length - start, Math.round(seconds * RATE));
  for (let i = 0; i < n; i++) {
    const t = i / RATE;
    const env = Math.min(1, t / attack) * Math.min(1, (seconds - t) / release);
    out[start + i] += amp * env * (Math.sin(2 * Math.PI * freq * t) + 0.25 * Math.sin(4 * Math.PI * freq * t));
  }
}

function reverb(x, mix = 0.22) {
  const combs = [1557, 1617, 1491, 1422].map((d) => ({ d, buf: new Float32Array(d), i: 0 }));
  const out = new Float32Array(x.length);
  for (let n = 0; n < x.length; n++) {
    let wet = 0;
    for (const c of combs) { const y = c.buf[c.i]; c.buf[c.i] = x[n] + y * 0.78; c.i = (c.i + 1) % c.d; wet += y; }
    out[n] = x[n] * (1 - mix) + (wet / combs.length) * mix;
  }
  return out;
}

/** The track as two Float32 channels. */
export function synth({ preset, seconds, week = 0 }) {
  const p = PRESETS[preset];
  if (!p) throw new Error(`unknown music preset ${preset}`);
  const rand = rng(week * 7919 + preset.length * 104729);
  const total = Math.ceil(seconds * RATE);
  const mono = new Float32Array(total + RATE * 3);
  const beat = 60 / p.bpm;
  const step = beat * (8 / p.pattern.length) / 2; // eighths for 8-step patterns, quarters for 4
  const bar = beat * 4;
  const shift = week % p.chords.length; // each week starts on another chord
  for (let b = 0; b * bar < seconds + bar; b++) {
    const chord = p.chords[(b + shift) % p.chords.length];
    const t0 = Math.round(b * bar * RATE);
    tone(mono, t0, NOTE(chord[0]), p.bass * 0.6, bar, 0.02, 0.4);
    for (const n of chord.slice(1)) tone(mono, t0, NOTE(n), p.pad / 3, bar + 0.3, 0.6, 0.6);
    p.pattern.forEach((k, i) => {
      const ti = Math.round((b * bar + i * step + (rand() - 0.5) * 0.012) * RATE);
      if (ti < mono.length) pluck(mono, ti, NOTE(chord[k] + 12), p.pluck * (0.85 + rand() * 0.15), 2.5, p.bright, rand);
    });
  }
  const wet = reverb(mono.subarray(0, total));
  const L = new Float32Array(total), R = new Float32Array(total);
  const d = 220; // a little width
  for (let i = 0; i < total; i++) { L[i] = wet[i]; R[i] = 0.9 * wet[i] + 0.1 * (wet[i - d] ?? 0); }
  return [L, R];
}

export function writeTrack(file, opts) {
  const [L, R] = synth(opts);
  let peak = 1e-9;
  for (let i = 0; i < L.length; i++) peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
  const g = 0.8 / peak;
  const data = Buffer.alloc(L.length * 4);
  for (let i = 0; i < L.length; i++) {
    data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, L[i] * g)) * 32767), i * 4);
    data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, R[i] * g)) * 32767), i * 4 + 2);
  }
  const head = Buffer.alloc(44);
  head.write('RIFF', 0); head.writeUInt32LE(36 + data.length, 4); head.write('WAVE', 8); head.write('fmt ', 12);
  head.writeUInt32LE(16, 16); head.writeUInt16LE(1, 20); head.writeUInt16LE(2, 22); head.writeUInt32LE(RATE, 24);
  head.writeUInt32LE(RATE * 4, 28); head.writeUInt16LE(4, 32); head.writeUInt16LE(16, 34); head.write('data', 36); head.writeUInt32LE(data.length, 40);
  fs.writeFileSync(file, Buffer.concat([head, data]));
  return file;
}

/** ffmpeg arguments that lay the track under a silent video: -19 LUFS, 1 s fade in, 2 s fade out. */
export function muxArgs(video, wav, seconds, out) {
  const fadeOut = Math.max(0, seconds - 2).toFixed(2);
  return ['-loglevel', 'error', '-y', '-i', video, '-i', wav, '-filter_complex',
    `[1:a]atrim=0:${seconds.toFixed(2)},highpass=f=60,lowpass=f=6500,loudnorm=I=-19:TP=-2:LRA=7,afade=t=in:d=1,afade=t=out:st=${fadeOut}:d=2,aresample=44100[a]`,
    '-map', '0:v', '-map', '[a]', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '160k', '-shortest', '-movflags', '+faststart', out];
}

/** Length in seconds of an ffmpeg concat list (the sum of its `duration` lines). */
export function concatSeconds(listText) {
  const total = [...String(listText).matchAll(/^duration\s+([\d.]+)\s*$/gm)].reduce((sum, m) => sum + Number(m[1]), 0);
  if (!(total > 0)) throw new Error('concat list has no durations');
  return total;
}
