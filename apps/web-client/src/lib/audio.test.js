import test from 'node:test';
import assert from 'node:assert/strict';
import { installSingleAudio, playSound, stopOtherAudio } from './audio.js';

const player = (playing = true) => {
  const element = { paused: !playing, pause() { this.paused = true; }, play() { this.paused = false; return Promise.resolve(); } };
  return element;
};

const rootWith = (elements) => {
  const listeners = {};
  return {
    elements,
    querySelectorAll: () => elements,
    addEventListener: (name, handler) => (listeners[name] = handler),
    removeEventListener: (name) => delete listeners[name],
    fire: (name, target) => listeners[name]?.({ target }),
    listeners,
  };
};

test('starting one player pauses every other one on the page', () => {
  const first = player();
  const second = player();
  const root = rootWith([first, second]);
  const remove = installSingleAudio(root);
  root.fire('play', second);
  assert.deepEqual([first.paused, second.paused], [true, false]);
  remove();
  assert.equal(root.listeners.play, undefined);
});

test('a pronunciation stops the page players and the sound before it', async () => {
  const onPage = player();
  const root = rootWith([onPage]);
  const sounds = [];
  const create = () => {
    const sound = player(false);
    sounds.push(sound);
    return sound;
  };
  await playSound('a.mp3', { root, create });
  assert.equal(onPage.paused, true);
  await playSound('b.mp3', { root, create });
  assert.deepEqual([sounds[0].paused, sounds[1].paused], [true, false]);
  const later = player();
  root.elements.push(later);
  stopOtherAudio(later, root);
  assert.equal(sounds[1].paused, true);
});

test('a pronunciation reports when it stops', async () => {
  const handlers = {};
  const sound = { ...player(false), addEventListener: (name, handler) => (handlers[name] = handler) };
  let ended = 0;
  await playSound('a.mp3', { root: rootWith([]), create: () => sound, onEnd: () => ended++ });
  assert.deepEqual(Object.keys(handlers).sort(), ['ended', 'error', 'pause']);
  handlers.ended();
  assert.equal(ended, 1);
});
