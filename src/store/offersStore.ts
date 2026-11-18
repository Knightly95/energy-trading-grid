import { create } from 'zustand';

import type { Offer } from '@/shared/types/offer';
import type { ConnectionStatus } from '@/shared/services/socket/socketEvents';

interface OfferMetrics {
  totalOffers: number;
  avgPrice: number;
}

/** One change pushed by the server, applied with others in a batch. */
export type OfferChange =
  | { type: 'created'; offer: Offer }
  | { type: 'updated'; offer: Offer }
  | { type: 'removed'; id: string };

export interface OffersState {
  offers: Offer[];
  connectionStatus: ConnectionStatus;
  metrics: OfferMetrics | null;

  setOffers: (offers: Offer[]) => void;
  addOffer: (offer: Offer) => void;
  updateOffer: (offer: Offer) => void;
  removeOffer: (offerId: string) => void;
  /** Applies several server changes in one store update, so the grid renders once. */
  applyOfferChanges: (changes: OfferChange[]) => void;
  setConnectionStatus: (status: ConnectionStatus) => void;
  setMetrics: (metrics: OfferMetrics) => void;
  clearOffers: () => void;
  getOfferById: (id: string) => Offer | undefined;
}

export const useOffersStore = create<OffersState>((set, get) => ({
  offers: [],
  connectionStatus: 'disconnected',
  metrics: null,
  setOffers: (offers) => set({ offers }),

  addOffer: (offer) =>
    set((state) => ({
      offers: [...state.offers, offer],
    })),

  updateOffer: (updatedOffer) =>
    set((state) => ({
      offers: state.offers.map((offer) => (offer.id === updatedOffer.id ? updatedOffer : offer)),
    })),

  removeOffer: (offerId) =>
    set((state) => ({
      offers: state.offers.filter((offer) => offer.id !== offerId),
    })),

  applyOfferChanges: (changes) =>
    set((state) => {
      // A Map keeps the list order, and updates and removals by id cost O(1).
      const byId = new Map(state.offers.map((offer) => [offer.id, offer]));
      for (const change of changes) {
        if (change.type === 'removed') byId.delete(change.id);
        else if (change.type === 'created' || byId.has(change.offer.id)) {
          byId.set(change.offer.id, change.offer);
        }
      }
      return { offers: [...byId.values()] };
    }),

  setConnectionStatus: (status) => set({ connectionStatus: status }),

  setMetrics: (metrics) => set({ metrics }),

  clearOffers: () => set({ offers: [], metrics: null }),

  getOfferById: (id: string) => get().offers.find((offer) => offer.id === id),
}));
