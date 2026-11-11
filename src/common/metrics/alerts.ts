import { logger } from '../logging/logger.js';

export type AlertName =
  'webhook_failed' | 'reconcile_gap' | 'queue_blocked' | 'http_5xx';

const state = {
  webhookFailures: 0,
  reconcileGaps: 0,
  queueDepth: 0,
  httpTotal: 0,
  http5xx: 0,
};

export function noteWebhookFailure() {
  state.webhookFailures += 1;
  emit('webhook_failed', { count: state.webhookFailures });
}

export function noteReconcileGap(count: number) {
  state.reconcileGaps = count;
  if (count > 0) {
    emit('reconcile_gap', { count });
  }
}

export function noteQueueDepth(depth: number) {
  state.queueDepth = depth;
  if (depth > 0) {
    emit('queue_blocked', { depth });
  }
}

export function noteHttpStatus(status: number) {
  state.httpTotal += 1;
  if (status >= 500) {
    state.http5xx += 1;
  }
  if (state.httpTotal >= 20 && state.http5xx / state.httpTotal > 0.01) {
    emit('http_5xx', { rate: state.http5xx / state.httpTotal });
  }
}

export function snapshotAlerts() {
  return { ...state };
}

function emit(alert: AlertName, extra: Record<string, number>) {
  logger.warn({ msg: 'alert', alert, ...extra });
}
