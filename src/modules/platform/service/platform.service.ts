import { Injectable } from '@nestjs/common';
import type { AuthContext } from '../../auth/domain/session.js';
import { presentNotification, recipientKey } from '../domain/notification.js';
import { NotificationsRepository } from '../repository/notifications.repository.js';
import { PreferencesRepository } from '../repository/preferences.repository.js';
import { FlagsService } from './flags.service.js';

@Injectable()
export class PlatformService {
  constructor(
    private readonly flags: FlagsService,
    private readonly preferences: PreferencesRepository,
    private readonly notifications: NotificationsRepository,
  ) {}

  async snapshot(auth?: AuthContext) {
    const flags = await this.flags.list();
    if (!auth) {
      return { flags, onboarded: false };
    }
    const prefs = await this.preferences.find(auth.userId);
    return { flags, onboarded: Boolean(prefs?.onboarded) };
  }

  async setOnboarded(userId: string) {
    await this.preferences.upsertOnboarded(userId, true);
    return null;
  }

  async listNotifications(auth: AuthContext) {
    const rows = await this.notifications.listFor(recipientKey(auth));
    return rows.map(presentNotification);
  }

  async markRead(auth: AuthContext) {
    await this.notifications.markAllRead(recipientKey(auth));
    return null;
  }
}
