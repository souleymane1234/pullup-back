import { matchesSearch } from './search.js';

describe('recherche', () => {
  it('trouve « Mode & beauté » avec beaute sans accent', () => {
    const influencer = {
      name: 'Ama',
      handle: 'ama',
      city: 'Abidjan',
      cats: ['beaute'],
      bio: 'Routines',
    };
    expect(matchesSearch(influencer, 'beaute')).toBe(true);
    expect(matchesSearch(influencer, 'BEAUTÉ')).toBe(true);
    expect(matchesSearch(influencer, 'humour')).toBe(false);
  });
});
