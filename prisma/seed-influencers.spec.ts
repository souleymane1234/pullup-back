import { emailOf, seedInfluencerRecords } from './seed-influencers.js';

describe('seed influenceurs', () => {
  it('utilise <handle>@mail.ci et les 16 profils du front', () => {
    const rows = seedInfluencerRecords();
    expect(rows.map((row) => row.id).sort()).toEqual([
      'i1',
      'i10',
      'i11',
      'i12',
      'i13',
      'i14',
      'i15',
      'i16',
      'i2',
      'i3',
      'i4',
      'i5',
      'i6',
      'i7',
      'i8',
      'i9',
    ]);
    expect(emailOf('i1', 'amakouassi')).toBe('amakouassi@mail.ci');
    expect(rows.find((row) => row.id === 'i1')!.accepts.dedicace).toBe(true);
    expect(rows.find((row) => row.id === 'i2')!.accepts.dedicace).toBe(false);
    expect(rows.find((row) => row.id === 'i1')!.qr).toBe(Math.round(342 * 2.4));
    expect(rows.find((row) => row.id === 'i1')!.contacts).toBe(
      Math.round(342 * 0.31),
    );
    expect(rows.find((row) => row.id === 'i1')!.hue).toBe((1 * 47) % 360);
    expect(rows.find((row) => row.id === 'i16')!.hue).toBe((16 * 47) % 360);
  });
});
