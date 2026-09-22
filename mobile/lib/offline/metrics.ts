/**
 * Local latency / event log for offline AI (Sprint 5 debug).
 * Not sent to any server — stays on device.
 */
export type MetricEvent = {
  at: number;
  name: string;
  ms?: number;
  detail?: string;
};

const MAX = 200;
const events: MetricEvent[] = [];
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((l) => l());
}

export function logMetric(name: string, ms?: number, detail?: string) {
  events.unshift({ at: Date.now(), name, ms, detail });
  if (events.length > MAX) events.length = MAX;
  notify();
}

export function markStart(name: string): () => void {
  const t0 = Date.now();
  return (detail?: string) => logMetric(name, Date.now() - t0, detail);
}

export function getMetrics(): MetricEvent[] {
  return [...events];
}

export function clearMetrics() {
  events.length = 0;
  notify();
}

export function subscribeMetrics(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
