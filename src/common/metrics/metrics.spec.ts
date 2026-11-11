import {
  observePayment,
  observeQueue,
  observeRequest,
  renderMetrics,
} from './metrics.js';

describe('métriques Prometheus', () => {
  it('expose latence, paiements et file', () => {
    observeRequest('/api/campaigns', 200, 12);
    observePayment('paid');
    observeQueue(2);
    const body = renderMetrics();
    expect(body).toContain('pullup_http_request_duration_ms');
    expect(body).toContain(
      'http_requests_total{path="/api/campaigns",status="200"}',
    );
    expect(body).toContain('pullup_payments_total{status="paid"}');
    expect(body).toContain('pullup_queue_jobs');
  });
});
