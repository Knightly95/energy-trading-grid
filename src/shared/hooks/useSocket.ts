import { useEffect } from 'react';

import { socketService } from '@/shared/services/socket/socketService';
import { useOffersStore, type OfferChange } from '@/store/offersStore';

/**
 * Live changes are collected and applied at most this often. Rendering the
 * grid once per change could not keep up with a busy feed (see the
 * Performance section of the README); a quarter of a second is too short to
 * notice.
 */
export const LIVE_UPDATE_INTERVAL_MS = 250;

export function useSocket() {
  const setOffers = useOffersStore((s) => s.setOffers);
  const applyOfferChanges = useOffersStore((s) => s.applyOfferChanges);
  const setConnectionStatus = useOffersStore((s) => s.setConnectionStatus);
  const setMetrics = useOffersStore((s) => s.setMetrics);
  const clearOffers = useOffersStore((s) => s.clearOffers);

  useEffect(() => {
    let pending: OfferChange[] = [];
    let flushTimer: ReturnType<typeof setTimeout> | undefined;

    const flush = () => {
      flushTimer = undefined;
      const changes = pending;
      pending = [];
      if (changes.length > 0) applyOfferChanges(changes);
    };

    const queue = (change: OfferChange) => {
      pending.push(change);
      flushTimer ??= setTimeout(flush, LIVE_UPDATE_INTERVAL_MS);
    };

    const dropPending = () => {
      clearTimeout(flushTimer);
      flushTimer = undefined;
      pending = [];
    };

    socketService.connect();
    setConnectionStatus('connecting');

    // Connection status event listeners
    const handleConnect = () => setConnectionStatus('connected');
    const handleDisconnect = () => setConnectionStatus('disconnected');
    const handleError = () => setConnectionStatus('error');

    // Attach event listeners directly to the socket instance
    const socket = socketService.getSocket();
    if (socket) {
      socket.on('connect', handleConnect);
      socket.on('disconnect', handleDisconnect);
      socket.on('connect_error', handleError);
    }

    socketService.onOffersInit((offers) => {
      // The full list replaces everything, including changes not applied yet.
      dropPending();
      setOffers(offers);
      setConnectionStatus(socketService.getConnectionStatus());
    });

    socketService.onOfferCreated((offer) => queue({ type: 'created', offer }));
    socketService.onOfferUpdated((offer) => queue({ type: 'updated', offer }));
    socketService.onOfferRemoved(({ id }) => queue({ type: 'removed', id }));

    socketService.onOpsMetric((metrics) => {
      setMetrics(metrics);
    });

    return () => {
      dropPending();
      if (socket) {
        socket.off('connect', handleConnect);
        socket.off('disconnect', handleDisconnect);
        socket.off('connect_error', handleError);
      }
      socketService.removeAllListeners();
      socketService.disconnect();
      clearOffers();
      setConnectionStatus('disconnected');
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    requestOffersList: () => socketService.requestOffersList(),
    setOfferPending: (id: string) => socketService.setOfferPending(id),
    setOfferProcessing: (id: string) => socketService.setOfferProcessing(id),
    setOfferCompleted: (id: string) => socketService.setOfferCompleted(id),
    isConnected: () => socketService.isConnected(),
  };
}
