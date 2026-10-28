import { useEffect, useState } from 'react';

const cache = new Map();

function seeded(text, count) {
  let seed = 0;
  for (const char of String(text)) seed = (seed * 31 + char.charCodeAt(0)) >>> 0;
  return Array.from({ length: count }, (_, at) => {
    seed = (seed * 1103515245 + 12345) >>> 0;
    const wave = 0.55 + 0.35 * Math.sin((at / Math.max(1, count - 1)) * Math.PI);
    return Math.min(1, Math.max(0.18, wave * (0.55 + (seed % 1000) / 1000)));
  });
}

export async function decode(url) {
  if (!cache.has(url))
    cache.set(
      url,
      fetch(url)
        .then((response) => (response.ok ? response.arrayBuffer() : Promise.reject(new Error('fetch'))))
        .then((buffer) => {
          const Context = globalThis.AudioContext || globalThis.webkitAudioContext;
          const context = new Context();
          return context.decodeAudioData(buffer).finally(() => context.close?.());
        }),
    );
  return cache.get(url);
}

function peaksOf(audio, from, to, count) {
  const data = audio.getChannelData(0);
  const start = Math.floor(from * audio.sampleRate);
  const end = Math.max(start + count, Math.floor(to * audio.sampleRate));
  const step = Math.max(1, Math.floor((end - start) / count));
  const peaks = Array.from({ length: count }, (_, bar) => {
    let max = 0;
    for (let at = start + bar * step; at < Math.min(data.length, start + (bar + 1) * step); at += 8) max = Math.max(max, Math.abs(data[at]));
    return max;
  });
  const top = Math.max(...peaks, 0.0001);
  return peaks.map((value) => Math.max(0.12, value / top));
}

export function barCount(segment, duration, segments) {
  const timed = segment.start !== null && segment.end !== null;
  const share = timed && duration ? (segment.end - segment.start) / duration : 1 / segments.length;
  return Math.max(5, Math.round(share * 90));
}

export function useWavePeaks(url, segments, duration) {
  const [peaks, setPeaks] = useState({});
  const key = segments.map((segment) => segment.id).join();

  useEffect(() => {
    const fallback = Object.fromEntries(segments.map((segment) => [segment.id, seeded(segment.id, barCount(segment, duration, segments))]));
    setPeaks(fallback);
    if (!url || !duration) return undefined;
    let cancelled = false;
    decode(url)
      .then((audio) => {
        if (cancelled) return;
        const even = audio.duration / segments.length;
        setPeaks(
          Object.fromEntries(
            segments.map((segment, at) => {
              const timed = segment.start !== null && segment.end !== null;
              return [segment.id, peaksOf(audio, timed ? segment.start : at * even, timed ? segment.end : (at + 1) * even, barCount(segment, duration, segments))];
            }),
          ),
        );
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [url, key, duration]);

  return peaks;
}

const FRAME_SECONDS = 0.02;
const MIN_GAP_SECONDS = 0.18;

export function sentenceBounds(samples, sampleRate, count) {
  if (count < 1) return null;
  const size = Math.max(1, Math.round(sampleRate * FRAME_SECONDS));
  const levels = [];
  for (let start = 0; start < samples.length; start += size) {
    let sum = 0;
    const end = Math.min(samples.length, start + size);
    for (let at = start; at < end; at += 2) sum += samples[at] * samples[at];
    levels.push(Math.sqrt(sum / Math.max(1, Math.ceil((end - start) / 2))));
  }
  const sorted = [...levels].sort((a, b) => a - b);
  const loud = sorted[Math.floor(sorted.length * 0.95)] || 0;
  const quiet = Math.max(0.004, loud * 0.06);
  const voiced = levels.map((level) => level > quiet);
  const first = voiced.indexOf(true);
  const last = voiced.lastIndexOf(true);
  if (first < 0) return null;
  const gaps = [];
  let runStart = null;
  for (let at = first; at <= last; at += 1) {
    if (!voiced[at] && runStart === null) runStart = at;
    if (voiced[at] && runStart !== null) {
      if ((at - runStart) * FRAME_SECONDS >= MIN_GAP_SECONDS) gaps.push({ start: runStart, end: at });
      runStart = null;
    }
  }
  if (gaps.length < count - 1) return null;
  const chosen = [...gaps].sort((a, b) => b.end - b.start - (a.end - a.start)).slice(0, count - 1).sort((a, b) => a.start - b.start);
  const ends = chosen.map((gap) => ((gap.start + gap.end) / 2) * FRAME_SECONDS);
  return [...ends, Infinity];
}

export function useSentenceBounds(url, count) {
  const [bounds, setBounds] = useState(null);
  useEffect(() => {
    setBounds(null);
    if (!url || count < 2) return undefined;
    let cancelled = false;
    decode(url)
      .then((audio) => {
        if (!cancelled) setBounds(sentenceBounds(audio.getChannelData(0), audio.sampleRate, count));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [url, count]);
  return bounds;
}
