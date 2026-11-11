export type FinanceEventName =
  'payment.succeeded' | 'payment.failed' | 'payout.sent' | 'payout.failed';

export interface FinanceEvent {
  type: FinanceEventName;
  id: string;
  targetId: string;
  amount: number;
  purpose?: string;
}

type Handler = (event: FinanceEvent) => void | Promise<void>;

export class FinanceEvents {
  private readonly handlers = new Map<FinanceEventName, Set<Handler>>();

  on(type: FinanceEventName, handler: Handler) {
    const set = this.handlers.get(type) ?? new Set();
    set.add(handler);
    this.handlers.set(type, set);
    return () => set.delete(handler);
  }

  async emit(event: FinanceEvent): Promise<void> {
    const set = this.handlers.get(event.type);
    if (!set) {
      return;
    }
    await Promise.all([...set].map((handler) => handler(event)));
  }
}
