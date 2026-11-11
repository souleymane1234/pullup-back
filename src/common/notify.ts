/** Branché sur la table notifications du module 02. */
export interface NotifyPort {
  notify(recipientKey: string, text: string, link: string): Promise<void>;
}

export const NOTIFY = Symbol('NOTIFY');

export class NoopNotify implements NotifyPort {
  async notify(
    _recipientKey: string,
    _text: string,
    _link: string,
  ): Promise<void> {}
}
