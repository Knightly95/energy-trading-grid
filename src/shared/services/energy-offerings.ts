import { useQuery } from '@tanstack/react-query';

import type { EnergyOfferingsConfig } from '@/shared/types/form-config';
import { config } from '@/config';

const MOCK_LATENCY_MS = 400;

export async function fetchEnergyOfferingsConfig(): Promise<EnergyOfferingsConfig> {
  if (config.backend === 'mock') {
    const [module] = await Promise.all([
      import('@/mocks/data/energy-offerings.json'),
      new Promise((resolve) => setTimeout(resolve, MOCK_LATENCY_MS)),
    ]);
    return module.default as unknown as EnergyOfferingsConfig;
  }

  const response = await fetch(`${config.api.baseUrl}/api/energy-offerings`);

  if (!response.ok) {
    throw new Error(`Failed to fetch energy offerings config: ${response.statusText}`);
  }

  const data: unknown = await response.json();
  return data as EnergyOfferingsConfig;
}

export function useEnergyOfferings() {
  return useQuery({
    queryKey: ['energy-offerings-config'],
    queryFn: fetchEnergyOfferingsConfig,
    retry: 2,
  });
}
