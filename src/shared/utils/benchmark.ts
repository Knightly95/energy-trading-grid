/**
 * Opt-in stress settings for the performance benchmark
 * (`scripts/benchmark-grid.mjs`), read from the URL. Without these parameters
 * the app behaves exactly as normal.
 *
 * - `bench-rows=1000`: seed the in-browser backend with this many offers.
 * - `bench-tick-ms=20`: one server-side change every 20 ms (50 per second).
 * - `bench-page-size=100`: rows per page in the grids.
 * - `bench-virtualization=off`: render every row instead of only the visible ones.
 */
export interface BenchmarkOptions {
  rows?: number;
  tickMs?: number;
  pageSize?: number;
  virtualization: boolean;
}

const positive = (value: string | null) => {
  const number = Number(value);
  return value && Number.isFinite(number) && number > 0 ? Math.floor(number) : undefined;
};

export function readBenchmarkOptions(
  search: string = globalThis.location?.search ?? '',
): BenchmarkOptions {
  const params = new URLSearchParams(search);
  return {
    rows: positive(params.get('bench-rows')),
    tickMs: positive(params.get('bench-tick-ms')),
    pageSize: positive(params.get('bench-page-size')),
    virtualization: params.get('bench-virtualization') !== 'off',
  };
}

/** Repeats the seed offers with fresh ids until there are `count` of them. */
export function growSeed<T extends { id: string }>(seed: T[], count: number): T[] {
  return Array.from({ length: count }, (_, index) => ({
    ...seed[index % seed.length],
    id: `${seed[index % seed.length].id}-${index}`,
  }));
}
