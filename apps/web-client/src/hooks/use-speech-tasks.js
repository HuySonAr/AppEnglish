import { useRef, useState } from 'react';
import { SPEECH_TASK_LIMIT, createTaskQueue } from '../lib/task-queue.js';

export function useSpeechTasks(limit = SPEECH_TASK_LIMIT) {
  const [state, setState] = useState({ running: [], waiting: [] });
  const queue = useRef(null);
  if (!queue.current) queue.current = createTaskQueue({ limit, onChange: setState });

  return {
    start: (key, run) => queue.current.start(key, run),
    isRunning: (key) => state.running.includes(key),
    isWaiting: (key) => state.waiting.includes(key),
    has: (key) => state.running.includes(key) || state.waiting.includes(key),
    busy: state.running.length + state.waiting.length > 0,
  };
}
