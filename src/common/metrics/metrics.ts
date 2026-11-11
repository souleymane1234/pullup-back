const counts = new Map<string, number>();
const latencies: number[] = [];
let queueJobs = 0;

export function observeRequest(path: string, status: number, ms: number) {
  bump(`http_requests_total{path="${path}",status="${status}"}`);
  latencies.push(ms);
  if (latencies.length > 2000) {
    latencies.splice(0, latencies.length - 1000);
  }
}

export function observePayment(status: string) {
  bump(`pullup_payments_total{status="${status}"}`);
}

export function observeQueue(delta: number) {
  queueJobs = Math.max(0, queueJobs + delta);
  counts.set('pullup_queue_jobs', queueJobs);
}

function bump(key: string) {
  counts.set(key, (counts.get(key) ?? 0) + 1);
}

export function renderMetrics(): string {
  const lines = [
    '# HELP pullup_http_request_duration_ms Latence moyenne par requête',
    '# TYPE pullup_http_request_duration_ms gauge',
  ];
  if (latencies.length) {
    const sum = latencies.reduce((total, value) => total + value, 0);
    lines.push(
      `pullup_http_request_duration_ms ${Math.round(sum / latencies.length)}`,
    );
  }
  lines.push('# HELP http_requests_total Requêtes HTTP par route et statut');
  lines.push('# TYPE http_requests_total counter');
  lines.push('# HELP pullup_payments_total Paiements par statut');
  lines.push('# TYPE pullup_payments_total counter');
  lines.push('# HELP pullup_queue_jobs Jobs en file (BullMQ / file interne)');
  lines.push('# TYPE pullup_queue_jobs gauge');
  for (const [key, value] of counts) {
    lines.push(`${key} ${value}`);
  }
  return `${lines.join('\n')}\n`;
}
