const DEFAULT_BUCKETS = [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10, 30, 60, 300];

const labelKey = (labels) =>
  Object.keys(labels)
    .sort()
    .map((key) => `${key}="${String(labels[key]).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`)
    .join(',');
const withLabels = (name, key, extra = '') => `${name}${key || extra ? `{${[key, extra].filter(Boolean).join(',')}}` : ''}`;

export class MetricsRegistry {
  constructor({ service } = {}) {
    this.service = service;
    this.metrics = new Map();
    this.collectors = [];
    this.startedAt = Date.now();
  }

  counter(name, help) {
    return this.define(name, help, 'counter');
  }

  gauge(name, help) {
    return this.define(name, help, 'gauge');
  }

  histogram(name, help, buckets = DEFAULT_BUCKETS) {
    return this.define(name, help, 'histogram', buckets);
  }

  define(name, help, type, buckets) {
    if (!this.metrics.has(name)) this.metrics.set(name, { name, help, type, buckets, series: new Map() });
    const metric = this.metrics.get(name);
    return {
      inc: (labels = {}, value = 1) => this.add(metric, labels, value),
      set: (labels = {}, value = 0) => this.put(metric, labels, value),
      observe: (labels = {}, value = 0) => this.observe(metric, labels, value),
    };
  }

  add(metric, labels, value) {
    const key = labelKey(labels);
    metric.series.set(key, (metric.series.get(key) || 0) + value);
  }

  put(metric, labels, value) {
    metric.series.set(labelKey(labels), value);
  }

  observe(metric, labels, value) {
    const key = labelKey(labels);
    const entry = metric.series.get(key) || { counts: metric.buckets.map(() => 0), sum: 0, count: 0 };
    metric.buckets.forEach((bound, index) => {
      if (value <= bound) entry.counts[index]++;
    });
    entry.sum += value;
    entry.count++;
    metric.series.set(key, entry);
  }

  collect(callback) {
    this.collectors.push(callback);
  }

  async render() {
    for (const callback of this.collectors) {
      try {
        await callback(this);
      } catch {
        continue;
      }
    }
    const usage = process.cpuUsage();
    const memory = process.memoryUsage();
    const process_ = [
      ['process_cpu_seconds_total', 'counter', 'CPU time used by the process.', (usage.user + usage.system) / 1e6],
      ['process_resident_memory_bytes', 'gauge', 'Resident memory of the process.', memory.rss],
      ['nodejs_heap_used_bytes', 'gauge', 'V8 heap in use.', memory.heapUsed],
      ['process_uptime_seconds', 'gauge', 'Seconds since the process started.', (Date.now() - this.startedAt) / 1000],
    ];
    const lines = [];
    for (const [name, type, help, value] of process_) lines.push(`# HELP ${name} ${help}`, `# TYPE ${name} ${type}`, `${name} ${value}`);
    for (const metric of this.metrics.values()) {
      lines.push(`# HELP ${metric.name} ${metric.help}`, `# TYPE ${metric.name} ${metric.type}`);
      for (const [key, value] of metric.series) {
        if (metric.type !== 'histogram') {
          lines.push(`${withLabels(metric.name, key)} ${value}`);
          continue;
        }
        metric.buckets.forEach((bound, index) => lines.push(`${withLabels(`${metric.name}_bucket`, key, `le="${bound}"`)} ${value.counts[index]}`));
        lines.push(`${withLabels(`${metric.name}_bucket`, key, 'le="+Inf"')} ${value.count}`);
        lines.push(`${withLabels(`${metric.name}_sum`, key)} ${value.sum}`);
        lines.push(`${withLabels(`${metric.name}_count`, key)} ${value.count}`);
      }
    }
    return `${lines.join('\n')}\n`;
  }
}

export function parsePrometheus(text) {
  const samples = [];
  for (const line of String(text).split('\n')) {
    if (!line || line.startsWith('#')) continue;
    const match = /^([a-zA-Z_:][a-zA-Z0-9_:]*)(?:\{(.*)\})?\s+(\S+)$/.exec(line);
    if (!match) continue;
    const labels = {};
    for (const pair of (match[2] || '').matchAll(/([a-zA-Z_][a-zA-Z0-9_]*)="((?:[^"\\]|\\.)*)"/g)) labels[pair[1]] = pair[2].replace(/\\"/g, '"').replace(/\\\\/g, '\\');
    samples.push({ name: match[1], labels, value: Number(match[3]) });
  }
  return samples;
}

export function quantileFromBuckets(samples, name, quantile, match = () => true) {
  const buckets = new Map();
  for (const sample of samples) {
    if (sample.name !== `${name}_bucket` || !match(sample.labels)) continue;
    const bound = sample.labels.le === '+Inf' ? Infinity : Number(sample.labels.le);
    buckets.set(bound, (buckets.get(bound) || 0) + sample.value);
  }
  const sorted = [...buckets.entries()].sort((a, b) => a[0] - b[0]);
  const total = sorted.at(-1)?.[1] || 0;
  if (!total) return null;
  const target = total * quantile;
  for (const [bound, count] of sorted) if (count >= target) return Number.isFinite(bound) ? bound : sorted.at(-2)?.[0] ?? null;
  return null;
}

export const metrics = new MetricsRegistry();

const grpcTotal = metrics.counter('grpc_requests_total', 'gRPC calls handled, by method and result.');
const grpcDuration = metrics.histogram('grpc_request_duration_seconds', 'Time to handle a gRPC call.');

export function observeGrpc(method, startedAt, result) {
  grpcTotal.inc({ method, result });
  grpcDuration.observe({ method }, (Date.now() - startedAt) / 1000);
}
