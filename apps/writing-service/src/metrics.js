function ranks(values) {
  const order = values.map((value, index) => [value, index]).sort((a, b) => a[0] - b[0]);
  const out = new Array(values.length);
  for (let start = 0; start < order.length; ) {
    let end = start;
    while (end + 1 < order.length && order[end + 1][0] === order[start][0]) end++;
    const rank = (start + end) / 2 + 1;
    for (let at = start; at <= end; at++) out[order[at][1]] = rank;
    start = end + 1;
  }
  return out;
}

export function pearson(xs, ys) {
  const n = xs.length;
  if (n < 2) return null;
  const mx = xs.reduce((sum, value) => sum + value, 0) / n;
  const my = ys.reduce((sum, value) => sum + value, 0) / n;
  let cov = 0;
  let vx = 0;
  let vy = 0;
  for (let i = 0; i < n; i++) {
    cov += (xs[i] - mx) * (ys[i] - my);
    vx += (xs[i] - mx) ** 2;
    vy += (ys[i] - my) ** 2;
  }
  return vx && vy ? cov / Math.sqrt(vx * vy) : null;
}

export const spearman = (xs, ys) => pearson(ranks(xs), ranks(ys));

export const mae = (xs, ys) => (xs.length ? xs.reduce((sum, value, index) => sum + Math.abs(value - ys[index]), 0) / xs.length : null);

export function qwk(xs, ys, { min = 1, max = 5, step = 0.5 } = {}) {
  const classes = Math.round((max - min) / step) + 1;
  const index = (value) => Math.min(classes - 1, Math.max(0, Math.round((value - min) / step)));
  const observed = Array.from({ length: classes }, () => new Array(classes).fill(0));
  const rowTotals = new Array(classes).fill(0);
  const colTotals = new Array(classes).fill(0);
  for (let i = 0; i < xs.length; i++) {
    const a = index(xs[i]);
    const b = index(ys[i]);
    observed[a][b]++;
    rowTotals[a]++;
    colTotals[b]++;
  }
  const n = xs.length;
  if (!n) return null;
  let numerator = 0;
  let denominator = 0;
  for (let a = 0; a < classes; a++)
    for (let b = 0; b < classes; b++) {
      const weight = (a - b) ** 2 / (classes - 1) ** 2;
      numerator += weight * observed[a][b];
      denominator += weight * ((rowTotals[a] * colTotals[b]) / n);
    }
  return denominator ? 1 - numerator / denominator : null;
}

const round = (value) => (value === null ? null : Math.round(value * 1000) / 1000);

export function compareScores(rows, fields, { withQwk = true } = {}) {
  return Object.fromEntries(
    fields.map((field) => {
      const pairs = rows.filter((row) => Number.isFinite(row.system?.[field]) && Number.isFinite(row.expert?.[field])).map((row) => [row.system[field], row.expert[field]]);
      const ours = pairs.map((pair) => pair[0]);
      const theirs = pairs.map((pair) => pair[1]);
      return [field, { n: pairs.length, pearson: round(pearson(ours, theirs)), spearman: round(spearman(ours, theirs)), mae: round(mae(ours, theirs)), ...(withQwk ? { qwk: round(qwk(ours, theirs)) } : {}) }];
    }),
  );
}
