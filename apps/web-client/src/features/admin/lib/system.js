export function formatSeconds(value) {
  if (value === null || value === undefined) return '—';
  if (value < 1) return `${Math.round(value * 1000)} ms`;
  if (value < 60) return `${Number(value.toFixed(1))} s`;
  return `${Math.round(value / 60)} min`;
}

export function formatDuration(seconds) {
  if (seconds === null || seconds === undefined) return '—';
  if (seconds < 60) return `${seconds} s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} h ${Math.floor((seconds % 3600) / 60)} min`;
  return `${Math.floor(seconds / 86400)} d ${Math.floor((seconds % 86400) / 3600)} h`;
}

export function queueHealth(queues) {
  return {
    retrying: queues.filter((queue) => queue.kind === 'retry').reduce((sum, queue) => sum + queue.ready, 0),
    dead: queues.filter((queue) => queue.kind === 'dead').reduce((sum, queue) => sum + queue.ready, 0),
  };
}
