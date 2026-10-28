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

async function decode(url) {
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
