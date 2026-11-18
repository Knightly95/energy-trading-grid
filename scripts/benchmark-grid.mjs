#!/usr/bin/env node
// Measures the offers grid under load, with MUI's row virtualization on and
// off. Builds nothing itself: run `npm run build` first.
//
//   node scripts/benchmark-grid.mjs [--rows 1000] [--tick-ms 20] [--runs 3] [--dir dist]
//
// `--dir` serves another build folder, to compare two versions of the app.
//
// Load: the in-browser backend is seeded with `rows` offers and makes one
// change (create, update, remove or metric) every `tick-ms`; the grid shows
// 100 rows per page. The CPU is slowed down 4x, like a mid-range laptop.
import { spawn } from 'node:child_process';
import { chromium } from '@playwright/test';

const arg = (name, fallback) => {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? fallback : Number(process.argv[index + 1]);
};
const textArg = (name, fallback) => {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? fallback : process.argv[index + 1];
};
const rows = arg('rows', 1000);
const tickMs = arg('tick-ms', 20);
const runs = arg('runs', 3);
const dir = textArg('dir', 'dist');
const port = 4180;
const measureMs = 5000;

// Started with node directly (no shell), so killing it at the end also works on Windows.
const server = spawn(
  process.execPath,
  ['node_modules/vite/bin/vite.js', 'preview', '--outDir', dir, '--port', String(port), '--strictPort'],
  { stdio: 'ignore' },
);
const base = `http://localhost:${port}`;
for (let i = 0; i < 60; i++) {
  try {
    if ((await fetch(base)).ok) break;
  } catch {
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
}

const median = (values) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];

async function measure(virtualization) {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });

  const query = new URLSearchParams({
    'bench-rows': String(rows),
    'bench-tick-ms': String(tickMs),
    'bench-page-size': '100',
    ...(virtualization ? {} : { 'bench-virtualization': 'off' }),
  });
  await page.goto(`${base}/offers?${query}`);
  await page.waitForSelector('.MuiDataGrid-row');
  const firstRowsMs = await page.evaluate(() => performance.now());
  await page.waitForTimeout(1500); // let the first burst of updates settle

  const result = await page.evaluate(async (ms) => {
    let longTaskMs = 0;
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) longTaskMs += entry.duration;
    });
    observer.observe({ type: 'longtask' });
    const gaps = [];
    await new Promise((resolve) => {
      const start = performance.now();
      let last = start;
      const frame = (time) => {
        gaps.push(time - last);
        last = time;
        if (time - start < ms) requestAnimationFrame(frame);
        else resolve();
      };
      requestAnimationFrame(frame);
    });
    observer.disconnect();
    return {
      fps: gaps.length / (ms / 1000),
      worstFrameMs: Math.max(...gaps),
      longTaskMs,
      renderedRows: document.querySelectorAll('.MuiDataGrid-row').length,
      domNodes: document.querySelectorAll('.MuiDataGrid-root *').length,
    };
  }, measureMs);

  await browser.close();
  return { ...result, firstRowsMs };
}

const results = {};
try {
  for (const virtualization of [true, false]) {
    const samples = [];
    for (let run = 0; run < runs; run++) samples.push(await measure(virtualization));
    results[virtualization ? 'on' : 'off'] = Object.fromEntries(
      Object.keys(samples[0]).map((key) => [key, median(samples.map((s) => s[key]))]),
    );
  }
} finally {
  server.kill();
}

const round = (value) => Math.round(value);
console.log(`\n${dir}: ${rows} offers, one change every ${tickMs} ms, 100 rows per page, CPU 4x slower, median of ${runs} runs\n`);
console.log('| Virtualization | Frames per second | Worst frame | Main thread blocked (5 s) | Rows in the DOM | Grid DOM nodes | First rows shown |');
console.log('|---|---|---|---|---|---|---|');
for (const [mode, r] of Object.entries(results)) {
  console.log(
    `| ${mode} | ${round(r.fps)} | ${round(r.worstFrameMs)} ms | ${round(r.longTaskMs)} ms | ${r.renderedRows} | ${r.domNodes} | ${round(r.firstRowsMs)} ms |`,
  );
}
