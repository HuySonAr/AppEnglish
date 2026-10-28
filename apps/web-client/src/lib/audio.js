let detached = null;

export function stopOtherAudio(except, root = globalThis.document) {
  root?.querySelectorAll?.('audio, video').forEach((element) => {
    if (element !== except && !element.paused) element.pause();
  });
  if (detached && detached !== except && !detached.paused) detached.pause();
}

export function playSound(url, { root = globalThis.document, create = (src) => new Audio(src), onEnd } = {}) {
  const audio = create(url);
  if (onEnd) for (const name of ['ended', 'pause', 'error']) audio.addEventListener(name, onEnd, { once: true });
  stopOtherAudio(audio, root);
  detached = audio;
  return audio.play();
}

export function installSingleAudio(root = globalThis.document) {
  const onPlay = (event) => {
    if (event.target && typeof event.target.pause === 'function') stopOtherAudio(event.target, root);
  };
  root.addEventListener('play', onPlay, true);
  return () => root.removeEventListener('play', onPlay, true);
}
