// pw.js —— Playwright 共用：開瀏覽器、載入頁面、等 window.__game、截圖、讀紀錄。
import { chromium } from '@playwright/test';
import { mkdirSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';

// 本機已有的 Playwright chromium 快取（版本不一定和套件相符時，用 executablePath 指過去；可用 PW_CHROME 覆寫）
function findChrome() {
  if (process.env.PW_CHROME) return process.env.PW_CHROME;
  const base = `${homedir()}/Library/Caches/ms-playwright`;
  for (const v of ['1248', '1223', '1217']) {
    const p = `${base}/chromium_headless_shell-${v}/chrome-headless-shell-mac-arm64/chrome-headless-shell`;
    if (existsSync(p)) return p;
  }
  return undefined;
}

export async function open({ url = 'http://localhost:5173/', width = 1280, height = 800, headless = true } = {}) {
  const browser = await chromium.launch({ headless, executablePath: findChrome(), args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width, height } });
  const console_ = [];
  page.on('console', m => console_.push(`[${m.type()}] ${m.text()}`));
  page.on('pageerror', e => console_.push(`[pageerror] ${e.message}`));
  await page.goto(url);
  await page.waitForFunction(() => window.__game && window.__game.frames() > 5, null, { timeout: 30000 });
  const api = {
    browser, page, console: console_,
    async shot(dir, name) { mkdirSync(dir, { recursive: true }); await page.screenshot({ path: `${dir}/${name}.png` }); return `${dir}/${name}.png`; },
    eval: (fn, arg) => page.evaluate(fn, arg),
    status: () => page.evaluate(() => window.__game.status()),
    options: () => page.evaluate(() => window.__game.options()),
    act: i => page.evaluate(i => window.__game.act(i), i),
    log: () => page.evaluate(() => window.__game.log()),
    notes: () => page.evaluate(() => window.__game.notes()),
    objects: () => page.evaluate(() => window.__game.objects()),
    /** 等 n 秒（遊戲時間以 rAF 推進，無頭模式 rAF 正常跑）。 */
    wait: sec => page.waitForTimeout(sec * 1000),
    /** 走到某格：一次一格，等移動結束。dirs 是 [dx,dy] 陣列。 */
    async walk(dirs) {
      for (const d of dirs) {
        const r = await page.evaluate(d => window.__game.step(d), d);
        if (r !== 'ok') return r;
        await page.waitForFunction(() => !window.__game.game.moving, null, { timeout: 5000 });
      }
      return 'ok';
    },
    /** 沿 BFS 路徑走到目標格（只避開靜態阻擋）。 */
    async goto(cell) {
      const path = await page.evaluate(cell => { const g = window.__game.game; return g.grid.path(g.player.cell, cell); }, cell);
      if (!path) return 'nopath';
      let cur = (await api.status()).cell;
      for (const c of path) { const r = await api.walk([[c[0] - cur[0], c[1] - cur[1]]]); if (r !== 'ok') return r; cur = c; }
      return 'ok';
    },
    face: d => page.evaluate(d => window.__game.face(d), d),
    protectedIds: a => page.evaluate(a => window.__game.protectedIds(a), a),
    place: c => page.evaluate(c => window.__game.place(c), c),
    close: () => browser.close(),
  };
  return api;
}
