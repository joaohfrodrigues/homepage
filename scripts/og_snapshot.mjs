/**
 * Snapshot the house as the site's share image (WhatsApp, iMessage, X, ...).
 *
 * Usage:
 *     bun run og                       # against a dev server on localhost:3000
 *     bun run og http://localhost:3005 # or any other running copy of the site
 *
 * Opens the house at 1200x630, walks into the living room, hides the HUD and
 * puts the name card on top, then writes src/assets/og-image.png. The site
 * imports it, so Next fingerprints its URL: a new snapshot gets a new URL and
 * link previews pick it up instead of a cached copy.
 *
 * Re-run it and commit the PNG whenever the house art changes.
 */
import { statSync } from 'node:fs';
import { chromium } from '@playwright/test';

const BASE = process.argv[2] ?? 'http://localhost:3000';
const OUT = 'src/assets/og-image.png';
// WhatsApp drops preview images much past this.
const MAX_BYTES = 300 * 1024;

const browser = await chromium.launch();
// Reduced motion keeps the NPCs from mid-step blur and skips long fades.
const page = await browser.newPage({
    viewport: { width: 1200, height: 630 },
    reducedMotion: 'reduce',
});
await page.goto(BASE);
await page.locator('canvas').waitFor({ timeout: 30_000 });
await page.getByText('João’s house').waitFor();

await page.keyboard.press('m');
await page.getByRole('button', { name: 'Go to the living room' }).click();
await page.getByText('Living room', { exact: true }).waitFor();
// Let the teleport fade in and the camera settle on the player.
await page.waitForTimeout(1500);

await page.evaluate(() => {
    const shell = document.querySelector('canvas').closest('.fixed');
    for (const child of shell.children) {
        if (!child.querySelector('canvas')) child.style.display = 'none';
    }
    document.querySelectorAll('nextjs-portal').forEach(el => el.remove());

    // Same look as the HUD's room label, at share-card size.
    const card = document.createElement('div');
    card.className = 'font-pixel';
    card.style.cssText =
        'position:fixed;left:40px;bottom:40px;z-index:100;padding:16px 28px;' +
        'background:rgb(42 34 51 / 0.92);box-shadow:0 6px 0 #120e18;color:#f4ecd8';
    card.innerHTML =
        '<div style="font-size:52px;line-height:1.05">João Rodrigues</div>' +
        '<div style="font-size:24px;margin-top:6px;color:#e8c95a">Photography · Writing · Hobbies</div>';
    document.body.append(card);
});
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(200);

await page.screenshot({ path: OUT });
await browser.close();

const bytes = statSync(OUT).size;
console.log(`wrote ${OUT} (${Math.round(bytes / 1024)} KB)`);
if (bytes > MAX_BYTES) {
    console.warn(`warning: over ${MAX_BYTES / 1024} KB, WhatsApp may show no image`);
}
