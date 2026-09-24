const { webkit } = require('playwright');
const { pathToFileURL } = require('node:url');
const path = require('node:path');
const fs = require('node:fs/promises');
const assert = require('node:assert/strict');

const root = path.resolve(__dirname, '..');
const url = pathToFileURL(path.join(root, 'index.html')).href;
const output = path.join(root, 'test-results');

(async () => {
  await fs.mkdir(output, { recursive: true });
  const browser = await webkit.launch({ headless: true });
  try {
    for (const width of [320, 375, 390, 430]) {
      const context = await browser.newContext({ viewport: { width, height: 720 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(url);
      await page.waitForFunction(() => !!window.PFA_APP);
      const start = await page.evaluate(() => ({
        overflow: document.documentElement.scrollWidth - innerWidth,
        navHeights: [...document.querySelectorAll('.nav button')].map(button => button.getBoundingClientRect().height),
        progressHeight: document.querySelector('.step-progress').getBoundingClientRect().height,
        editorSize: parseFloat(getComputedStyle(document.querySelector('#prompt-editor')).fontSize),
        label: document.querySelector('.nav [data-view="prompt"]').innerText.trim(),
        viewport: document.querySelector('meta[name="viewport"]').content
      }));
      assert.ok(start.overflow <= 0, `Desbordamiento inicial a ${width}px: ${start.overflow}`);
      assert.ok(start.navHeights.every(height => height >= 44));
      assert.ok(start.progressHeight < 65);
      assert.equal(start.editorSize, 16);
      assert.equal(start.label, 'Editor');
      assert.match(start.viewport, /viewport-fit=cover/);
      if (width === 320 || width === 390) await page.screenshot({ path: path.join(output, `iphone-${width}-initial.png`) });
      await page.locator('[data-action="new-project"]:visible').first().click();
      await page.waitForFunction(() => document.querySelector('#app').getAttribute('aria-busy') === 'false');
      assert.ok(await page.locator('#dialog').evaluate(dialog => dialog.getBoundingClientRect().right <= innerWidth));
      await page.locator('[data-action="close-dialog"]').click();
      await page.locator('#dialog').waitFor({ state: 'hidden' });
      await page.locator('#prompt-editor').fill('Resume esta pregunta con claridad.');
      await page.locator('[data-action="primary"]').click();
      await page.locator('#response-input').waitFor();
      await page.waitForFunction(() => document.querySelector('#app').getAttribute('aria-busy') === 'false');
      const transfer = await page.evaluate(() => ({
        dialogWidth: document.querySelector('#dialog').scrollWidth - document.querySelector('#dialog').clientWidth,
        pageWidth: document.documentElement.scrollWidth - innerWidth,
        dockVisible: !!document.querySelector('.dialog-dock'),
        dockHeight: document.querySelector('.dialog-dock')?.getBoundingClientRect().height
      }));
      assert.ok(transfer.dialogWidth <= 0 && transfer.pageWidth <= 0, `Desbordamiento en importación a ${width}px`);
      assert.ok(transfer.dockVisible && transfer.dockHeight < 130);
      if (width === 320 || width === 390) {
        await page.locator('[data-action="close-dialog"]').click();
        await page.locator('#dialog').waitFor({ state: 'hidden' });
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.screenshot({ path: path.join(output, `iphone-${width}-workspace.png`) });
        await page.locator('[data-action="primary"]').click();
        await page.locator('#response-input').waitFor();
        await page.waitForFunction(() => document.querySelector('#app').getAttribute('aria-busy') === 'false');
        await page.screenshot({ path: path.join(output, `iphone-${width}-transfer.png`) });
      }
      assert.deepEqual(errors, []);
      await context.close();
    }
    console.log('PASS WebKit móvil 320/375/390/430: editor, navegación táctil, progreso y diálogo de importación sin desbordamiento');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
