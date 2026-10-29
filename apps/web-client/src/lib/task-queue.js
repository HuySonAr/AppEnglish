export const SPEECH_TASK_LIMIT = 3;

export function createTaskQueue({ limit = SPEECH_TASK_LIMIT, onChange = () => {} } = {}) {
  const waiting = [];
  const running = new Set();

  const snapshot = () => ({ running: [...running], waiting: waiting.map((task) => task.key) });

  function pump() {
    while (running.size < limit && waiting.length) {
      const task = waiting.shift();
      running.add(task.key);
      Promise.resolve()
        .then(task.run)
        .catch(() => {})
        .finally(() => {
          running.delete(task.key);
          onChange(snapshot());
          pump();
        });
    }
    onChange(snapshot());
  }

  return {
    start(key, run) {
      if (running.has(key) || waiting.some((task) => task.key === key)) return false;
      waiting.push({ key, run });
      pump();
      return true;
    },
    snapshot,
  };
}
