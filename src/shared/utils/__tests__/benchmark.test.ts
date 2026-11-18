import { describe, expect, it } from 'vitest';

import { growSeed, readBenchmarkOptions } from '../benchmark';

describe('readBenchmarkOptions', () => {
  it('changes nothing without benchmark parameters', () => {
    expect(readBenchmarkOptions('')).toEqual({
      rows: undefined,
      tickMs: undefined,
      pageSize: undefined,
      virtualization: true,
    });
  });

  it('reads the load and the grid settings from the URL', () => {
    expect(
      readBenchmarkOptions(
        '?bench-rows=1000&bench-tick-ms=20&bench-page-size=100&bench-virtualization=off',
      ),
    ).toEqual({ rows: 1000, tickMs: 20, pageSize: 100, virtualization: false });
  });

  it('ignores values that are not positive numbers', () => {
    expect(readBenchmarkOptions('?bench-rows=-5&bench-tick-ms=abc')).toMatchObject({
      rows: undefined,
      tickMs: undefined,
    });
  });
});

describe('growSeed', () => {
  it('repeats the seed with unique ids', () => {
    const rows = growSeed([{ id: 'a' }, { id: 'b' }], 5);
    expect(rows).toHaveLength(5);
    expect(new Set(rows.map((row) => row.id)).size).toBe(5);
  });
});
