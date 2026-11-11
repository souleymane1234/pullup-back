import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { NOTIFY, type NotifyPort } from '../../../common/notify.js';
import { MAIL, type MailPort } from '../../../infrastructure/mail/mail.port.js';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service.js';
import { isImportantEvent } from '../domain/notification.js';
import { NotificationsRepository } from '../repository/notifications.repository.js';

const DAY_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class NotifyService
  implements NotifyPort, OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(NotifyService.name);
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly notifications: NotificationsRepository,
    @Inject(MAIL) private readonly mail: MailPort,
  ) {}

  onModuleInit(): void {
    void this.purgeRead();
    this.timer = setInterval(() => {
      void this.purgeRead();
    }, DAY_MS);
  }

  onModuleDestroy(): void {
    if (this.timer) {
      clearInterval(this.timer);
    }
  }

  async notify(
    recipientKey: string,
    text: string,
    link: string,
    tx?: Prisma.TransactionClient | PrismaService,
  ): Promise<void> {
    await this.notifications.create({ recipientKey, text, link }, tx);
    if (isImportantEvent(text, link)) {
      await this.mail.send(
        recipientKey === 'admin'
          ? 'admin@pullup.net'
          : `${recipientKey}@notify.pullup`,
        'Notification PULLUP',
        `${text}\n${link}`,
      );
    }
  }

  async purgeRead(): Promise<void> {
    try {
      const result = await this.notifications.purgeReadOlderThan(90);
      if (result.count > 0) {
        this.logger.log(
          `Purge ${result.count} notification(s) lues de plus de 90 jours`,
        );
      }
    } catch (error) {
      this.logger.error(
        `Purge des notifications impossible : ${String(error)}`,
      );
    }
  }
}

export const NotifyProvider = { provide: NOTIFY, useExisting: NotifyService };
