export interface MailPort {
  send(to: string, subject: string, text: string): Promise<void>;
}

export const MAIL = Symbol('MAIL');

export class LogMail implements MailPort {
  async send(to: string, subject: string, text: string): Promise<void> {
    console.info(`[mail] to=${to} subject=${subject} ${text}`);
  }
}
