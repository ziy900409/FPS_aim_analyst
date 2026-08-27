import { test, expect } from '@playwright/test';

// WP-48 T3 — dev and preview must each mount the History API on their own FPS_HISTORY_ROOT temp
// root (playwright.config.ts webServer env, NFR-48.6) without breaking COOP/COEP (isolation.spec.ts).
const targets = [
  { name: 'dev', url: 'http://localhost:5173/api/history/health' },
  { name: 'preview', url: 'http://localhost:4173/api/history/health' },
] as const;

for (const { name, url } of targets) {
  test(`${name} server exposes a healthy /api/history/health`, async ({ request }) => {
    const response = await request.get(url);
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.ok).toBe(true);
    expect(typeof body.data.validRunCount).toBe('number');
  });
}
