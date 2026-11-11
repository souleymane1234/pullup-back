import { presentNotification, recipientKey } from './notification.js';

describe('notifications', () => {
  it('mappe le destinataire admin / profil', () => {
    expect(
      recipientKey({ userId: 'u', role: 'admin', profileId: 'admin' }),
    ).toBe('admin');
    expect(recipientKey({ userId: 'u', role: 'brand', profileId: 'b1' })).toBe(
      'b1',
    );
  });

  it('sérialise r à partir de read_at', () => {
    const unread = presentNotification({
      recipientKey: 'b1',
      text: 'Publiée.',
      link: '/c/c2',
      readAt: null,
      createdAt: new Date('2026-10-01T10:00:00.000Z'),
    });
    expect(unread).toMatchObject({ to: 'b1', r: false, link: '/c/c2' });
    expect(
      presentNotification({
        ...unread,
        recipientKey: 'b1',
        text: unread.t,
        link: unread.link,
        createdAt: new Date(),
        readAt: new Date(),
      }).r,
    ).toBe(true);
  });
});
