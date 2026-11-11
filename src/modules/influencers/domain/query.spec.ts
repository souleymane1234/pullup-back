import { pageOf, type InfluencerRecord } from './present.js';
import { canSeeProfile, carouselOf, filterListed } from './query.js';

function fake(
  id: number,
  extra: Partial<InfluencerRecord> = {},
): InfluencerRecord {
  return {
    id: `i${id}`,
    handle: `h${id}`,
    name: `Nom ${id}`,
    city: 'Abidjan',
    cats: ['beaute'],
    bio: 'Bio',
    net: { ig: [10_000 + id, 4] },
    aud: { f: 50, ages: [10, 40, 30, 20], cities: [['Abidjan', 100]] },
    auth: 90,
    creat: 4,
    brief: 90,
    onTime: 90,
    rating: 4,
    reviews: 0,
    done: 0,
    rates: [{ id: `r${id}`, net: 'ig', fmt: 'Story', price: 10_000 }],
    days: ['Lun'],
    verified: true,
    certified: false,
    status: 'active',
    accepts: { pub: true, partenariat: true, dedicace: false },
    views: Array.from({ length: 30 }, () => 0),
    qr: 0,
    contacts: 0,
    hue: 1,
    photo: null,
    ...extra,
  };
}

describe('annuaire', () => {
  const listed = Array.from({ length: 28 }, (_, index) => fake(index + 1));

  it('pagine 12 + 12 + reste puis nextCursor=null', () => {
    const first = pageOf(listed, 0, 12);
    expect(first.items).toHaveLength(12);
    expect(first.nextCursor).toBe(12);
    expect(first.total).toBe(28);
    const second = pageOf(listed, 12, 12);
    expect(second.items).toHaveLength(12);
    expect(second.nextCursor).toBe(24);
    const last = pageOf(listed, 24, 12);
    expect(last.items).toHaveLength(4);
    expect(last.nextCursor).toBeNull();
  });

  it('combine recherche accentuée et filtre catégorie', () => {
    const items = [
      fake(1, { cats: ['beaute'], name: 'Ama' }),
      fake(2, { cats: ['humour'], verified: true }),
      fake(3, { cats: ['beaute'], verified: false, status: 'pending' }),
    ];
    const found = filterListed(items, {
      cursor: 0,
      limit: 12,
      s: 'beaute',
      cat: 'beaute',
      net: '',
      badge: '',
      budget: '',
      sort: 'score',
    });
    expect(found.map((item) => item.id)).toEqual(['i1']);
  });

  it('masque une vitrine non listée aux visiteurs', () => {
    const pending = fake(9, { verified: false, status: 'pending' });
    expect(canSeeProfile(pending, undefined)).toBe(false);
    expect(
      canSeeProfile(pending, { role: 'influencer', profileId: 'i9' }),
    ).toBe(true);
    expect(canSeeProfile(pending, { role: 'admin', profileId: 'admin' })).toBe(
      true,
    );
  });

  it('met en avant featured puis certifié au tri score', () => {
    const certified = fake(1, { certified: true });
    const featured = fake(2, { featured: true });
    const plain = fake(3);
    const found = filterListed([certified, featured, plain], {
      cursor: 0,
      limit: 12,
      s: '',
      cat: '',
      net: '',
      badge: '',
      budget: '',
      sort: 'score',
    });
    expect(found.map((item) => item.id)).toEqual(['i2', 'i1', 'i3']);
  });
});
