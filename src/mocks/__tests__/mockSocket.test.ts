import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import type { Offer } from '@/shared/types/offer';
import { SOCKET_EVENTS } from '@/shared/services/socket/socketEvents';

import { MockSocket } from '../mockSocket';

const makeOffer = (id: string, overrides: Partial<Offer> = {}): Offer => ({
  id,
  sourceType: 'solar',
  price: 80,
  quantity: 50,
  unit: 'MWh',
  status: 'active',
  vendor: 'SolarTech Spain',
  location: 'Seville, ES',
  createdAt: 1,
  updatedAt: 1,
  ...overrides,
});

const seed = () => ['1', '2', '3', '4', '5', '6'].map((id) => makeOffer(id));

/** Returns a `random` function that yields the given values in order, then 0. */
const sequence = (...values: number[]) => {
  let i = 0;
  return () => values[i++] ?? 0;
};

describe('MockSocket', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('connects and sends the initial offers', () => {
    const socket = new MockSocket(seed(), { connectDelayMs: 100 });
    const onConnect = vi.fn();
    const onInit = vi.fn();
    socket.on('connect', onConnect).on(SOCKET_EVENTS.OFFERS_INIT, onInit);

    expect(socket.connected).toBe(false);
    vi.advanceTimersByTime(100);

    expect(socket.connected).toBe(true);
    expect(onConnect).toHaveBeenCalledOnce();
    expect(onInit).toHaveBeenCalledWith(seed());
  });

  it('changes an offer status when the client asks for it', () => {
    const socket = new MockSocket(seed(), { connectDelayMs: 0 });
    const onUpdated = vi.fn();
    socket.on(SOCKET_EVENTS.OFFERS_UPDATED, onUpdated);
    vi.advanceTimersByTime(0);

    socket.emit(SOCKET_EVENTS.OFFERS_COMPLETED, { id: '2' });

    expect(onUpdated).toHaveBeenCalledWith(
      expect.objectContaining({ id: '2', status: 'completed' }),
    );
  });

  it('reports an error for an unknown offer', () => {
    const socket = new MockSocket(seed(), { connectDelayMs: 0 });
    const onError = vi.fn();
    socket.on('error', onError);
    vi.advanceTimersByTime(0);

    socket.emit(SOCKET_EVENTS.OFFERS_PENDING, { id: 'missing' });

    expect(onError).toHaveBeenCalledWith({ message: 'Offer not found', id: 'missing' });
  });

  it('creates an offer on a "create" tick', () => {
    // First random value 0 selects the "create" operation.
    const socket = new MockSocket(seed(), { connectDelayMs: 0, random: sequence(0) });
    const onCreated = vi.fn();
    socket.on(SOCKET_EVENTS.OFFERS_CREATED, onCreated);
    vi.advanceTimersByTime(0);

    socket.tick();

    expect(onCreated).toHaveBeenCalledWith(
      expect.objectContaining({ sourceType: 'solar', unit: 'MWh' }),
    );
  });

  it('removes an offer on a "remove" tick', () => {
    // The first value is used to schedule the next tick. Then 0.75 of the total
    // weight (10) lands in the "remove" band (7 to 8).
    const socket = new MockSocket(seed(), { connectDelayMs: 0, random: sequence(0, 0.75) });
    const onRemoved = vi.fn();
    socket.on(SOCKET_EVENTS.OFFERS_REMOVED, onRemoved);
    vi.advanceTimersByTime(0);

    socket.tick();

    expect(onRemoved).toHaveBeenCalledWith({ id: '1' });
  });

  it('keeps emitting on its own and stops after disconnect', () => {
    const socket = new MockSocket(seed(), {
      connectDelayMs: 0,
      tickMinMs: 1000,
      tickMaxMs: 1000,
      // 0.95 selects "metric" every time.
      random: () => 0.95,
    });
    const onMetric = vi.fn();
    const onDisconnect = vi.fn();
    socket.on(SOCKET_EVENTS.OPS_METRIC, onMetric).on('disconnect', onDisconnect);
    vi.advanceTimersByTime(0);

    vi.advanceTimersByTime(3000);
    expect(onMetric).toHaveBeenCalledTimes(3);
    expect(onMetric).toHaveBeenLastCalledWith(
      expect.objectContaining({ totalOffers: 6, avgPrice: 80 }),
    );

    socket.disconnect();
    vi.advanceTimersByTime(5000);

    expect(onDisconnect).toHaveBeenCalledOnce();
    expect(onMetric).toHaveBeenCalledTimes(3);
    expect(socket.connected).toBe(false);
  });
});
