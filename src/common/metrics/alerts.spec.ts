import {
  noteHttpStatus,
  noteQueueDepth,
  noteReconcileGap,
  noteWebhookFailure,
  snapshotAlerts,
} from './alerts.js';

describe('alertes d’observabilité', () => {
  it('signale un webhook en échec et un écart de rapprochement', () => {
    noteWebhookFailure();
    noteReconcileGap(2);
    const snap = snapshotAlerts();
    expect(snap.webhookFailures).toBeGreaterThan(0);
    expect(snap.reconcileGaps).toBe(2);
  });

  it('détecte un taux d’erreurs 5xx supérieur à 1 %', () => {
    for (let i = 0; i < 19; i += 1) {
      noteHttpStatus(200);
    }
    noteHttpStatus(500);
    expect(snapshotAlerts().http5xx).toBeGreaterThan(0);
  });

  it('signale une file bloquée', () => {
    noteQueueDepth(21);
    expect(snapshotAlerts().queueDepth).toBe(21);
  });
});
