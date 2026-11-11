import { AppError } from '../../../common/http/app.error.js';
import { formatCampaignRef } from '../../references/domain/reference.js';
import { ReferencesService } from '../../references/service/references.service.js';
import { assertBrief, assertPhone } from './brief.js';
import { assertQuota, paymentSplit, splitOffer } from './booking.js';
import { buildUtm } from './utm.js';

describe('réservation', () => {
  it('calcule 90 000 → 13 500 de frais → 76 500 nets', () => {
    expect(splitOffer(90_000)).toEqual({
      amount: 90_000,
      fee: 13_500,
      payout: 76_500,
    });
  });

  it('utilise le solde en priorité', () => {
    expect(paymentSplit(35_000, 90_000)).toEqual({
      fromBalance: 35_000,
      toCollect: 55_000,
    });
    expect(paymentSplit(120_000, 90_000)).toEqual({
      fromBalance: 90_000,
      toCollect: 0,
    });
  });

  it('refuse un quota free dépassé', () => {
    expect(() => assertQuota('free', 3)).toThrow(AppError);
    expect(() => assertQuota('pro', 4)).not.toThrow();
    expect(() => assertQuota('business', 99)).not.toThrow();
  });

  it('valide le brief', () => {
    expect(() =>
      assertBrief({
        title: '',
        objective: 'notoriete',
        theme: 'beaute',
        text: 'un deux trois quatre cinq',
      }),
    ).toThrow(/nom/);
    expect(() =>
      assertBrief({
        title: 'X',
        objective: 'notoriete',
        theme: 'beaute',
        text: 'trop court',
      }),
    ).toThrow(/consignes/);
    expect(() =>
      assertBrief({
        title: 'X',
        objective: 'notoriete',
        theme: 'beaute',
        text: 'un deux trois quatre cinq',
        link: 'savane.ci',
      }),
    ).toThrow(/https:\/\//);
    expect(() => assertPhone('om', '07')).toThrow(/téléphone/);
    const ok = assertBrief({
      title: 'Lancement',
      objective: 'notoriete',
      theme: 'beaute',
      text: 'Présenter le sérum dans une routine du matin.',
      link: 'https://savane.ci/glow',
    });
    expect(ok.link).toBe('https://savane.ci/glow');
  });

  it('construit le lien UTM exact', () => {
    expect(
      buildUtm(
        { ref: 'PU-2410-1', offerNet: 'ig', briefLink: 'https://savane.ci' },
        'amakouassi',
      ),
    ).toBe(
      'https://savane.ci?utm_source=pullup&utm_medium=instagram&utm_campaign=pu-2410-1&utm_content=amakouassi',
    );
  });

  it('formate une référence unique PU-AAMM-NNN', () => {
    const a = formatCampaignRef(new Date('2026-10-04T10:00:00Z'), 1);
    const b = formatCampaignRef(new Date('2026-10-04T10:00:00Z'), 2);
    expect(a).toBe('PU-2610-001');
    expect(b).toBe('PU-2610-002');
    expect(a).not.toBe(b);
  });

  it('reste unique sous concurrence', async () => {
    let value = 0;
    const service = new ReferencesService({
      nextValue: async () => ++value,
    } as never);
    const at = new Date('2026-10-04T10:00:00Z');
    const refs = await Promise.all(
      Array.from({ length: 20 }, () => service.nextCampaignRef(at)),
    );
    expect(new Set(refs).size).toBe(20);
    expect(refs).toContain('PU-2610-001');
    expect(refs).toContain('PU-2610-020');
  });
});
