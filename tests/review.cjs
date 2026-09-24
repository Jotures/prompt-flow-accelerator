const { chromium } = require('playwright');
const { pathToFileURL } = require('node:url');
const path = require('node:path');
const fs = require('node:fs/promises');
const assert = require('node:assert/strict');
const { fixture, pack } = require('./fixtures.cjs');
const root = path.resolve(__dirname, '..');
let browser, page;
const errors = [];
const settle = () => page.waitForFunction(() => document.querySelector('#app').getAttribute('aria-busy') !== 'true');
const click = async action => { await page.locator('[data-action="' + action + '"]').first().click(); await settle(); };
const bundle = () => page.evaluate(() => PFA_APP.getBundle());
const pending = async () => (await bundle()).requests.find(r => ['CREATED', 'COPIED', 'WAITING_RESPONSE', 'INVALID_RESPONSE'].includes(r.status));
async function importFixture(options = {}) {
  const req = await pending(), f = fixture(req, options);
  if (options.proposals) f.data.changes = [
    { ...f.data.changes[0], id: 'C1', description: 'Priorizar conectividad sobre costo.', intentReview: { kind: 'PROPOSAL', reason: 'El usuario no fijó este orden.', sourceExcerpt: '', refinedExcerpt: 'Prioriza conectividad sobre costo.' } },
    { ...f.data.changes[0], id: 'C2', description: 'Usar un piloto de dos semanas.', intentReview: { kind: 'PROPOSAL', reason: 'El plazo es una propuesta del refinador.', sourceExcerpt: '', refinedExcerpt: 'Valida con un piloto de dos semanas.' } }
  ];
  await page.locator('#response-input').fill(pack(req, f.data, f.prompt)); await click('import-response');
  const failed = page.locator('#import-errors');
  if (await failed.count() && (await failed.innerText()).trim()) throw new Error(await failed.innerText());
  await page.waitForFunction(id => PFA_APP.getBundle().requests.find(r => r.id === id).status === 'COMPLETED', req.id, { timeout: 15000 });
}
(async () => {
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  page = await browser.newPage({ viewport: { width: 1366, height: 900 } });
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(pathToFileURL(path.join(root, 'index.html')).href); await page.waitForFunction(() => !!window.PFA_APP, null, { timeout: 15000 });
  await page.locator('#prompt-editor').fill('Diseña una plataforma offline para mercados agrícolas. Compara sus alternativas.');
  await click('primary'); await importFixture(); await click('primary');
  const candidate = 'Diseña una plataforma offline para mercados agrícolas.\nPrioriza conectividad sobre costo.\nValida con un piloto de dos semanas.';
  await importFixture({ prompt: candidate, proposals: true });
  const initial = await bundle();
  assert.equal(await page.locator('.refinement-review .review-change').count(), 2);
  await page.locator('[data-action="review-proposal"][data-change="C2"]').click(); await settle();
  assert.match(await page.locator('.refinement-review').innerText(), /Aceptada por ti/);
  assert.equal((await bundle()).project.activeVersionId, initial.project.activeVersionId);
  await page.reload(); await page.waitForFunction(() => !!window.PFA_APP);
  await page.locator('[data-view="versions"]').click(); await settle();
  assert.match(await page.locator('.refinement-review').innerText(), /Aceptada por ti/);
  await fs.mkdir(path.join(root, 'test-results'), { recursive: true });
  await page.locator('.refinement-review').screenshot({ path: path.join(root, 'test-results', 'intent-review-desktop.png') });
  await page.setViewportSize({ width: 390, height: 844 });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await page.locator('.refinement-review').screenshot({ path: path.join(root, 'test-results', 'intent-review-mobile.png') });
  await page.locator('[data-action="adjust-change"][data-change="C1"]').click(); await settle();
  await page.locator('#adjustment-instruction').fill('Pregunta las prioridades; no impongas conectividad sobre costo.');
  await click('prepare-adjustment');
  const req = await pending();
  assert.deepEqual(req.adjustment.acceptedChanges, ['C2']);
  assert.match(req.packageText, /Pregunta las prioridades/);
  assert.equal(req.adjustment.candidateVersionId, initial.versions[1].id);
  assert.equal((await bundle()).versions.length, 2);
  await click('close-dialog'); await page.getByRole('button', { name: 'Continuar ajuste', exact: true }).click(); await settle();
  const result = 'Diseña una plataforma offline para mercados agrícolas.\nPregunta las prioridades.\nValida con un piloto de dos semanas.';
  await importFixture({ prompt: result });
  const adjusted = await bundle();
  assert.equal(adjusted.versions.length, 3);
  assert.equal(adjusted.versions[1].content, candidate);
  assert.equal(adjusted.versions[2].content, result);
  assert.equal(adjusted.versions[2].parentVersionId, initial.versions[0].id);
  assert.equal(await page.locator('.refinement-review [data-action="review-proposal"]').count(), 0);
  await click('primary'); assert.equal((await pending()).operation, 'EVALUATE');
  assert.deepEqual(errors, []);
  console.log('PASS propuestas visibles, aceptación persistente, ajuste dirigido con preferencias, versión inmutable y reevaluación propia; escritorio y móvil');
  await browser.close();
})().catch(async error => { console.error(error); if (browser) await browser.close(); process.exitCode = 1; });
