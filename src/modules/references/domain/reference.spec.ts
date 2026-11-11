import { campaignSequenceName, formatCampaignRef } from './reference.js';

describe('références PU-AAMM-NNN', () => {
  const october = new Date('2026-10-04T12:00:00.000Z');

  it('formate le compteur atomique', () => {
    expect(formatCampaignRef(october, 1)).toBe('PU-2610-001');
    expect(formatCampaignRef(october, 42)).toBe('PU-2610-042');
  });

  it('isole le compteur par mois UTC', () => {
    expect(campaignSequenceName(october)).toBe('campaign:2026-10');
  });
});
