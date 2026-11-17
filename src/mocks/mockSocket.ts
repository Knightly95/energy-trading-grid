import type { Offer, OfferStatus } from '@/shared/types/offer';
import { SOCKET_EVENTS } from '@/shared/services/socket/socketEvents';

/**
 * In-browser stand-in for the Socket.io server in `api/socket-server.ts`.
 *
 * It implements the small part of the socket.io-client `Socket` API that the
 * app uses and emits the same events on the same kind of random schedule:
 * offers are created, updated and removed, and metrics are published. This is
 * what powers the live demo, where no server is available.
 */

type Listener = (payload?: unknown) => void;

export interface MockSocketOptions {
  /** Delay before the simulated connection is established. */
  connectDelayMs?: number;
  /** Bounds of the random interval between two server-side operations. */
  tickMinMs?: number;
  tickMaxMs?: number;
  /** Injectable for deterministic tests. */
  random?: () => number;
}

const VENDORS = [
  'Solaria West',
  'GasCorp Iberia',
  'EcoEnergy Ltd',
  'GreenGrid Spain',
  'PowerFlow Systems',
  'SolarTech Spain',
  'LNG Direct',
  'EuroGas Pipeline',
];

const LOCATIONS = [
  'Seville, ES',
  'Valencia, ES',
  'Madrid, ES',
  'Barcelona, ES',
  'Bilbao, ES',
  'Zaragoza, ES',
  'Málaga, ES',
];

const STATUS_CYCLE: OfferStatus[] = ['pending', 'processing', 'active', 'completed'];
const NEW_OFFER_STATUSES: OfferStatus[] = ['pending', 'processing', 'active'];
const MIN_OFFERS_BEFORE_REMOVAL = 5;

/** Relative likelihood of each simulated server operation. */
const OPERATION_WEIGHTS = { create: 3, update: 4, remove: 1, metric: 2 } as const;
type Operation = keyof typeof OPERATION_WEIGHTS;

const ACTION_STATUS: Record<string, OfferStatus> = {
  [SOCKET_EVENTS.OFFERS_PENDING]: 'pending',
  [SOCKET_EVENTS.OFFERS_PROCESSING]: 'processing',
  [SOCKET_EVENTS.OFFERS_COMPLETED]: 'completed',
};

export class MockSocket {
  connected = false;

  private offers: Offer[];
  private readonly listeners = new Map<string, Set<Listener>>();
  private readonly options: Required<MockSocketOptions>;
  private connectTimer: ReturnType<typeof setTimeout> | null = null;
  private tickTimer: ReturnType<typeof setTimeout> | null = null;
  private idCounter = 0;

  constructor(seed: Offer[], options: MockSocketOptions = {}) {
    this.offers = seed.map((offer) => ({ ...offer }));
    this.options = {
      connectDelayMs: 300,
      tickMinMs: 2000,
      tickMaxMs: 6000,
      random: Math.random,
      ...options,
    };

    this.connectTimer = setTimeout(() => {
      this.connected = true;
      this.dispatch('connect');
      this.dispatch(SOCKET_EVENTS.OFFERS_INIT, this.snapshot());
      this.scheduleTick();
    }, this.options.connectDelayMs);
  }

  // ── socket.io-client surface used by the app ────────────────────────────

  on(event: string, listener: Listener): this {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event)!.add(listener);
    return this;
  }

  off(event: string, listener: Listener): this {
    this.listeners.get(event)?.delete(listener);
    return this;
  }

  removeAllListeners(): this {
    this.listeners.clear();
    return this;
  }

  /** Client → server messages. */
  emit(event: string, payload?: { id?: string }): this {
    if (!this.connected) return this;

    if (event === SOCKET_EVENTS.OFFERS_LIST) {
      this.dispatch(SOCKET_EVENTS.OFFERS_INIT, this.snapshot());
      return this;
    }

    const status = ACTION_STATUS[event];
    if (status) this.setStatus(payload?.id, status);
    return this;
  }

  disconnect(): this {
    if (this.connectTimer) clearTimeout(this.connectTimer);
    if (this.tickTimer) clearTimeout(this.tickTimer);
    this.connectTimer = null;
    this.tickTimer = null;
    if (this.connected) {
      this.connected = false;
      this.dispatch('disconnect');
    }
    return this;
  }

  // ── simulated server ────────────────────────────────────────────────────

  /** Runs one random server-side operation. Exposed for tests. */
  tick(): void {
    switch (this.pickOperation()) {
      case 'create': {
        const offer = this.createRandomOffer();
        this.offers.push(offer);
        this.dispatch(SOCKET_EVENTS.OFFERS_CREATED, { ...offer });
        break;
      }
      case 'update': {
        if (this.offers.length === 0) break;
        const index = this.randomIndex(this.offers.length);
        this.offers[index] = this.mutateOffer(this.offers[index]);
        this.dispatch(SOCKET_EVENTS.OFFERS_UPDATED, { ...this.offers[index] });
        break;
      }
      case 'remove': {
        if (this.offers.length <= MIN_OFFERS_BEFORE_REMOVAL) break;
        const [removed] = this.offers.splice(this.randomIndex(this.offers.length), 1);
        this.dispatch(SOCKET_EVENTS.OFFERS_REMOVED, { id: removed.id });
        break;
      }
      case 'metric': {
        const totalOffers = this.offers.length;
        const avgPrice =
          totalOffers > 0
            ? Math.round(this.offers.reduce((sum, o) => sum + o.price, 0) / totalOffers)
            : 0;
        this.dispatch(SOCKET_EVENTS.OPS_METRIC, { totalOffers, avgPrice, timestamp: Date.now() });
        break;
      }
    }
  }

  private scheduleTick(): void {
    const { tickMinMs, tickMaxMs, random } = this.options;
    const delay = tickMinMs + Math.floor(random() * (tickMaxMs - tickMinMs + 1));
    this.tickTimer = setTimeout(() => {
      this.tick();
      this.scheduleTick();
    }, delay);
  }

  private setStatus(id: string | undefined, status: OfferStatus): void {
    const index = this.offers.findIndex((offer) => offer.id === id);
    if (index === -1) {
      this.dispatch('error', { message: 'Offer not found', id });
      return;
    }
    this.offers[index] = { ...this.offers[index], status, updatedAt: Date.now() };
    this.dispatch(SOCKET_EVENTS.OFFERS_UPDATED, { ...this.offers[index] });
  }

  private pickOperation(): Operation {
    const entries = Object.entries(OPERATION_WEIGHTS) as [Operation, number][];
    const total = entries.reduce((sum, [, weight]) => sum + weight, 0);
    let threshold = this.options.random() * total;
    for (const [operation, weight] of entries) {
      threshold -= weight;
      if (threshold < 0) return operation;
    }
    return 'update';
  }

  private createRandomOffer(): Offer {
    const template = this.offers[this.randomIndex(this.offers.length)];
    const now = Date.now();
    return {
      id: `demo-${now}-${++this.idCounter}`,
      // Reuse the source type and unit of an existing offer so the mock always
      // produces values the UI knows how to display.
      sourceType: template?.sourceType ?? 'solar',
      unit: template?.unit ?? 'MWh',
      price: 60 + Math.floor(this.options.random() * 50),
      quantity: 20 + Math.floor(this.options.random() * 80),
      status: this.pick(NEW_OFFER_STATUSES),
      vendor: this.pick(VENDORS),
      location: this.pick(LOCATIONS),
      createdAt: now,
      updatedAt: now,
    };
  }

  private mutateOffer(offer: Offer): Offer {
    const mutated: Offer = { ...offer, updatedAt: Date.now() };
    const up = this.options.random() > 0.5;
    switch (this.pick(['price', 'quantity', 'status'] as const)) {
      case 'price':
        mutated.price = Math.max(50, mutated.price + (up ? 5 : -5));
        break;
      case 'quantity':
        mutated.quantity = Math.max(10, mutated.quantity + (up ? 10 : -10));
        break;
      case 'status':
        mutated.status =
          STATUS_CYCLE[(STATUS_CYCLE.indexOf(mutated.status) + 1) % STATUS_CYCLE.length];
        break;
    }
    return mutated;
  }

  private snapshot(): Offer[] {
    return this.offers.map((offer) => ({ ...offer }));
  }

  private randomIndex(length: number): number {
    return Math.min(length - 1, Math.floor(this.options.random() * length));
  }

  private pick<T>(items: readonly T[]): T {
    return items[this.randomIndex(items.length)];
  }

  private dispatch(event: string, payload?: unknown): void {
    // Copy first: a listener may unsubscribe while we iterate.
    [...(this.listeners.get(event) ?? [])].forEach((listener) => listener(payload));
  }
}
