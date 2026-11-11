import {
  presentAdminSession,
  presentBrandSession,
  presentInfluencerSession,
} from './session.js';

describe('session view', () => {
  it('expose l’id de profil, pas l’id user', () => {
    const brand = presentBrandSession({
      id: 'b1',
      name: 'Savane Cosmetics',
      email: 'marketing@savane.ci',
      contactName: 'Aïcha Diomandé',
      plan: 'pro',
    });
    expect(brand.id).toBe('b1');
    expect(brand.avatar).toEqual({ name: 'Savane Cosmetics', hue: 20 });

    const admin = presentAdminSession('admin@pullup.net');
    expect(admin.id).toBe('admin');
    expect(admin.avatar.hue).toBe(280);

    const inf = presentInfluencerSession({
      id: 'i1',
      name: 'Ama Kouassi',
      email: 'ama@pullup.net',
      handle: 'amakouassi',
      hue: 47,
      photoUrl: null,
      verified: true,
    });
    expect(inf.avatar).toEqual({
      name: 'Ama Kouassi',
      hue: 47,
      photo: null,
      verified: true,
    });
  });
});
