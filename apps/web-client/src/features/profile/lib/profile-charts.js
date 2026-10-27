
export function skillBars(progress) {
  const skills = progress?.skills || {};
  return [
    { key: 'listening', label: 'Listening', percent: skills.listening?.percent ?? null, tests: skills.listening?.testCount ?? 0 },
    { key: 'reading', label: 'Reading', percent: skills.reading?.percent ?? null, tests: skills.reading?.testCount ?? 0 },
  ];
}

export function lessonRing(progress) {
  const completion = progress?.completion || {};
  const total = completion.totalLessons || 0;
  const completed = Math.min(completion.completedLessons || 0, total);
  return {
    completed,
    total,
    remaining: total - completed,
    percent: total ? Math.round((completed * 100) / total) : null,
  };
}

export function xpBars(xp, { maxTitle = 18 } = {}) {
  const entries = [...(xp?.entries || [])].sort((a, b) => new Date(a.earnedAt) - new Date(b.earnedAt));
  return entries.map((entry) => {
    const title = entry.mockTestTitle || 'Mock test';
    return {
      id: entry.mockTestId,
      title,
      short: title.length > maxTitle ? `${title.slice(0, maxTitle - 1).trimEnd()}…` : title,
      xp: entry.xp,
      correctCount: entry.correctCount,
      totalCount: entry.totalCount,
      earnedAt: entry.earnedAt,
    };
  });
}

export function memberFor(createdAt, now = new Date()) {
  const start = new Date(createdAt);
  if (Number.isNaN(start.getTime())) return '';
  const days = Math.max(0, Math.floor((now - start) / 86400000));
  if (days < 1) return 'today';
  if (days < 31) return `${days} day${days === 1 ? '' : 's'}`;
  const months = Math.floor(days / 30.44);
  return `${months} month${months === 1 ? '' : 's'}`;
}
