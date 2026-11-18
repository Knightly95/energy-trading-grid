import { vi } from 'vitest';
import type { Mock } from 'vitest';

import {
  mockSetOffers,
  mockAddOffer,
  mockUpdateOffer,
  mockRemoveOffer,
  mockApplyOfferChanges,
  mockSetConnectionStatus,
  mockSetMetrics,
  mockClearOffers,
  mockUseOffersStore,
  resetOfferStoreMocks,
  mockSocketService,
  resetSocketServiceMocks,
} from './test-helpers';

vi.mock('@/store/offersStore', () => ({
  useOffersStore: <T = unknown>(...args: Parameters<typeof mockUseOffersStore<T>>) =>
    mockUseOffersStore<T>(...args),
  __mocks: {
    mockSetOffers,
    mockAddOffer,
    mockUpdateOffer,
    mockRemoveOffer,
    mockApplyOfferChanges,
    mockSetConnectionStatus,
    mockSetMetrics,
    mockClearOffers,
  },
}));

vi.mock('@/shared/services/socket/socketService', () => ({
  socketService: mockSocketService,
  __mocks: mockSocketService,
}));

import * as OffersStoreImport from '@/store/offersStore';
import * as SocketServiceImport from '@/shared/services/socket/socketService';
import { renderHook } from '@testing-library/react';
import { LIVE_UPDATE_INTERVAL_MS, useSocket } from '../useSocket';

const OffersStore = OffersStoreImport as typeof OffersStoreImport & {
  __mocks: Record<string, Mock>;
};
const SocketService = SocketServiceImport as typeof SocketServiceImport & {
  __mocks: Record<string, Mock>;
};

describe('useSocket', () => {
  beforeEach(() => {
    resetOfferStoreMocks();
    resetSocketServiceMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('connects and sets status on mount', () => {
    renderHook(() => useSocket());
    expect(SocketService.__mocks.connect).toHaveBeenCalled();
    expect(OffersStore.__mocks.mockSetConnectionStatus).toHaveBeenCalledWith('connecting');
  });

  it('registers all socket event handlers', () => {
    renderHook(() => useSocket());
    expect(SocketService.__mocks.onOffersInit).toHaveBeenCalled();
    expect(SocketService.__mocks.onOfferCreated).toHaveBeenCalled();
    expect(SocketService.__mocks.onOfferUpdated).toHaveBeenCalled();
    expect(SocketService.__mocks.onOfferRemoved).toHaveBeenCalled();
    expect(SocketService.__mocks.onOpsMetric).toHaveBeenCalled();
  });

  it('handles offers init event', () => {
    let offersHandler: (offers: Array<{ id: string }>) => void = () => {};
    SocketService.__mocks.onOffersInit.mockImplementationOnce((cb: typeof offersHandler) => {
      offersHandler = cb;
    });
    renderHook(() => useSocket());
    const offers = [{ id: '1' }];
    offersHandler(offers);
    expect(OffersStore.__mocks.mockSetOffers).toHaveBeenCalledWith(offers);
    expect(OffersStore.__mocks.mockSetConnectionStatus).toHaveBeenCalledWith('connected');
  });

  it('handles offer created event', () => {
    let handler: (offer: { id: string }) => void = () => {};
    SocketService.__mocks.onOfferCreated.mockImplementationOnce((cb: typeof handler) => {
      handler = cb;
    });
    vi.useFakeTimers();
    renderHook(() => useSocket());
    const offer = { id: '2' };
    handler(offer);
    vi.advanceTimersByTime(LIVE_UPDATE_INTERVAL_MS);
    expect(OffersStore.__mocks.mockApplyOfferChanges).toHaveBeenCalledWith([
      { type: 'created', offer },
    ]);
  });

  it('handles offer updated event', () => {
    let handler: (offer: { id: string; status: string }) => void = () => {};
    SocketService.__mocks.onOfferUpdated.mockImplementationOnce((cb: typeof handler) => {
      handler = cb;
    });
    vi.useFakeTimers();
    renderHook(() => useSocket());
    const offer = { id: '3', status: 'active' };
    handler(offer);
    vi.advanceTimersByTime(LIVE_UPDATE_INTERVAL_MS);
    expect(OffersStore.__mocks.mockApplyOfferChanges).toHaveBeenCalledWith([
      { type: 'updated', offer },
    ]);
  });

  it('handles offer removed event', () => {
    let handler: (payload: { id: string }) => void = () => {};
    SocketService.__mocks.onOfferRemoved.mockImplementationOnce((cb: typeof handler) => {
      handler = cb;
    });
    vi.useFakeTimers();
    renderHook(() => useSocket());
    handler({ id: '4' });
    vi.advanceTimersByTime(LIVE_UPDATE_INTERVAL_MS);
    expect(OffersStore.__mocks.mockApplyOfferChanges).toHaveBeenCalledWith([
      { type: 'removed', id: '4' },
    ]);
  });

  it('applies the changes of one interval together, in order', () => {
    let created: (offer: { id: string }) => void = () => {};
    let removed: (payload: { id: string }) => void = () => {};
    SocketService.__mocks.onOfferCreated.mockImplementationOnce((cb: typeof created) => {
      created = cb;
    });
    SocketService.__mocks.onOfferRemoved.mockImplementationOnce((cb: typeof removed) => {
      removed = cb;
    });
    vi.useFakeTimers();
    renderHook(() => useSocket());

    created({ id: '5' });
    removed({ id: '1' });
    expect(OffersStore.__mocks.mockApplyOfferChanges).not.toHaveBeenCalled();
    vi.advanceTimersByTime(LIVE_UPDATE_INTERVAL_MS);

    expect(OffersStore.__mocks.mockApplyOfferChanges).toHaveBeenCalledTimes(1);
    expect(OffersStore.__mocks.mockApplyOfferChanges).toHaveBeenCalledWith([
      { type: 'created', offer: { id: '5' } },
      { type: 'removed', id: '1' },
    ]);
  });

  it('drops changes not applied yet when the full list arrives', () => {
    let init: (offers: Array<{ id: string }>) => void = () => {};
    let created: (offer: { id: string }) => void = () => {};
    SocketService.__mocks.onOffersInit.mockImplementationOnce((cb: typeof init) => {
      init = cb;
    });
    SocketService.__mocks.onOfferCreated.mockImplementationOnce((cb: typeof created) => {
      created = cb;
    });
    vi.useFakeTimers();
    renderHook(() => useSocket());

    created({ id: '6' });
    init([{ id: '6' }]);
    vi.advanceTimersByTime(LIVE_UPDATE_INTERVAL_MS);

    expect(OffersStore.__mocks.mockApplyOfferChanges).not.toHaveBeenCalled();
  });

  it('handles metrics event', () => {
    let handler: (metrics: Record<string, unknown>) => void = () => {};
    SocketService.__mocks.onOpsMetric.mockImplementationOnce((cb: typeof handler) => {
      handler = cb;
    });
    renderHook(() => useSocket());
    const metrics = { count: 1 };
    handler(metrics);
    expect(OffersStore.__mocks.mockSetMetrics).toHaveBeenCalledWith(metrics);
  });

  it('cleans up on unmount', () => {
    const { unmount } = renderHook(() => useSocket());
    unmount();
    expect(SocketService.__mocks.removeAllListeners).toHaveBeenCalled();
    expect(SocketService.__mocks.disconnect).toHaveBeenCalled();
    expect(OffersStore.__mocks.mockClearOffers).toHaveBeenCalled();
    expect(OffersStore.__mocks.mockSetConnectionStatus).toHaveBeenCalledWith('disconnected');
  });

  it('exposes imperative methods', () => {
    const { result } = renderHook(() => useSocket());
    result.current.requestOffersList();
    expect(SocketService.__mocks.requestOffersList).toHaveBeenCalled();
    result.current.setOfferPending('id1');
    expect(SocketService.__mocks.setOfferPending).toHaveBeenCalledWith('id1');
    result.current.setOfferProcessing('id2');
    expect(SocketService.__mocks.setOfferProcessing).toHaveBeenCalledWith('id2');
    result.current.setOfferCompleted('id3');
    expect(SocketService.__mocks.setOfferCompleted).toHaveBeenCalledWith('id3');
    result.current.isConnected();
    expect(SocketService.__mocks.isConnected).toHaveBeenCalled();
  });
});
