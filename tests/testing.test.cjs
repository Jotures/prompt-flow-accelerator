const test = require('node:test');
const assert = require('node:assert/strict');
require('fake-indexeddb/auto');
require('../src/data.js');
const P = require('../src/core.js');
require('../src/testing.js');
require('../src/store.js');
const { fixture, pack } = require('./fixtures.cjs');
const T = P.Testing;
function setup() {
  const b = P.newProject('Pruebas'); b.project.draft = 'Devuelve la respuesta como JSON.'; P.freezeDraft(b);
  const req = P.startRequest(b, 'EVALUATE'); P.importResponse(b, req.id, fixture(req).response);
  P.createVersion(b, 'Devuelve solo JSON válido y conserva los datos.', 'MANUAL_EDIT', b.versions[0].id);
  const e = P.startRequest(b, 'EVALUATE'); P.importResponse(b, e.id, fixture(e).response);
  return b;
}
const fields = checks => ({ name: 'Salida verificable', type: 'NORMAL', input: 'Devuelve una edad de 20.', context: '', expected: 'JSON con edad.', checks });
const check = (kind, value = '', extra = {}) => ({ id: P.id('check'), kind, value, ...extra });
function prepare(b, checks) { const t = T.saveCase(b, fields(checks)); return T.prepare(b, t.id, b.versions[0].id, b.versions[1].id, 'Modelo de prueba 1', 'Chats nuevos, sin herramientas'); }
async function complete(b, r, a, bb, humanA = {}, humanB = {}) { T.saveDraft(b, r.id, { responseA: a, responseB: bb, humanA, humanB }); T.finish(b, r.id, await T.assess(r)); return r; }

function refinedSetup() {
  const b = P.newProject('Hipótesis'); b.project.draft = 'Investiga con fuentes.'; P.freezeDraft(b);
  for (const op of ['EVALUATE','REFINE','EVALUATE']) { const req = P.startRequest(b, op); P.importResponse(b, req.id, fixture(req).response); }
  return b;
}
const linkFor = b => ({ refinementId: b.refinements[0].id, hypothesisId: 'H1' });

test('hipótesis usan el refinamiento original, criterios concretos y el par exacto', async () => {
  const b = refinedSetup(), linked = check('JSON', '', { hypothesis: linkFor(b) }), r = prepare(b, [linked, check('CONTAINS', 'extra')]);
  await complete(b, r, 'extra', '{}');
  const h = T.evidence(b, [r.id], r.versionAId, r.versionBId).hypotheses[0];
  assert.equal(h.checks.length, 1); assert.equal(h.improvements, 1); assert.ok(h.allowedResults.includes('CONFIRMED'));
  // An unrelated regression does not silently count as a result of this hypothesis.
  assert.equal(h.regressions, 0); assert.equal(T.outcome(r).regressions, 1);
  const t = b.tests[0]; T.saveCase(b, { ...t, checks: [check('JSON')] }, t.id);
  assert.equal(r.testSnapshot.checks[0].hypothesis.refinementId, b.refinements[0].id);
  assert.equal(T.evidence(b, [r.id], r.versionAId, r.versionBId).hypotheses[0].checks.length, 1);
  const reversed = T.prepare(b, t.id, r.versionBId, r.versionAId, r.model, r.conditions); await complete(b, reversed, '{}', 'bad');
  assert.deepEqual(T.evidence(b, [reversed.id], reversed.versionAId, reversed.versionBId).hypotheses, []);
  const reevaluate = P.startRequest(b, 'EVALUATE'); P.importResponse(b, reevaluate.id, fixture(reevaluate, { better: true }).response);
  assert.equal(T.hypotheses(b)[0].sourceEvaluationId, b.refinements[0].sourceEvaluationId);
  assert.throws(() => T.saveCase(b, fields([check('JSON', '', { hypothesis: { ...linkFor(b), hypothesisId: 'H404' } })])), /inexistente/);
});

test('comparador limita confirmaciones por evidencia y conserva el contrato anterior', async () => {
  const b = refinedSetup(), r = prepare(b, [check('JSON', '', { hypothesis: linkFor(b) })]); await complete(b, r, 'bad', '{}');
  const req = P.startRequest(b, 'COMPARE', { testRunIds: [r.id] }), f = fixture(req);
  assert.equal(req.hypothesisEvidenceVersion, 1); assert.match(req.packageText, /allowedResults/);
  f.data.hypotheses[0].behavioralResult = 'CONFIRMED';
  P.importResponse(b, req.id, pack(req, f.data));
  const mixed = T.prepare(b, r.testId, r.versionAId, r.versionBId, r.model, r.conditions); await complete(b, mixed, '{}', 'bad');
  const req2 = P.startRequest(b, 'COMPARE', { testRunIds: [r.id, mixed.id] }), f2 = fixture(req2);
  f2.data.hypotheses[0].behavioralResult = 'CONFIRMED';
  assert.throws(() => P.importResponse(b, req2.id, pack(req2, f2.data)), /sin respaldo/);
  f2.data.hypotheses[0].behavioralResult = 'PARTIAL'; P.importResponse(b, req2.id, pack(req2, f2.data));
  const legacy = P.startRequest(b, 'COMPARE', { testRunIds: [r.id] }); delete legacy.hypothesisEvidenceVersion;
  const old = fixture(legacy); old.data.hypotheses[0].behavioralResult = 'CONFIRMED';
  assert.throws(() => P.importResponse(b, legacy.id, pack(legacy, old.data)), /NOT_TESTED/);
  old.data.hypotheses[0].behavioralResult = 'NOT_TESTED'; P.importResponse(b, legacy.id, pack(legacy, old.data));
  const pending = prepare(b, [check('HUMAN', 'No inventa.', { hypothesis: linkFor(b) })]); await complete(b, pending, 'a', 'b');
  assert.deepEqual(T.evidence(b, [pending.id], pending.versionAId, pending.versionBId).hypotheses[0].allowedResults, ['NOT_TESTED']);
  const tie = T.prepare(b, r.testId, r.versionAId, r.versionBId, r.model, r.conditions); await complete(b, tie, '{}', '{}');
  assert.deepEqual(T.evidence(b, [tie.id], tie.versionAId, tie.versionBId).hypotheses[0].allowedResults, ['NOT_CONFIRMED','NOT_TESTED']);
});

test('copias conservan enlaces históricos y remapean refinamientos con colisiones', async () => {
  const b = refinedSetup(), r = prepare(b, [check('JSON', '', { hypothesis: linkFor(b) })]); await complete(b, r, 'bad', '{}');
  const req = P.startRequest(b, 'COMPARE', { testRunIds: [r.id] }), f = fixture(req); f.data.hypotheses[0].behavioralResult = 'CONFIRMED'; P.importResponse(b, req.id, pack(req, f.data));
  const store = await new P.Store('hypothesis-' + Date.now()).init();
  const payload = { format: 'prompt-flow-accelerator-backup', formatVersion: P.VERSION, testingVersion: 1, projects: [b] };
  await store.import(payload); const imported = await store.import(payload), copy = await store.bundle(imported[0].id);
  assert.notEqual(copy.refinements[0].id, b.refinements[0].id);
  assert.equal(copy.tests[0].checks[0].hypothesis.refinementId, copy.refinements[0].id);
  assert.equal(copy.testRuns[0].testSnapshot.checks[0].hypothesis.refinementId, copy.refinements[0].id);
  store.validateBackup({ ...payload, projects: [copy] });
  const bad = structuredClone(payload); bad.projects[0].testRuns[0].testSnapshot.checks[0].hypothesis.refinementId = 'missing';
  assert.throws(() => store.validateBackup(bad)); store.db.close();
});

test('H1 de otra iteración no recibe evidencia y los pendientes impiden confirmar', async () => {
  const b = refinedSetup(), firstLink = linkFor(b);
  for (const op of ['REFINE','EVALUATE']) { const req = P.startRequest(b, op); P.importResponse(b, req.id, fixture(req).response); }
  const human = check('HUMAN', 'No inventar', { hypothesis: { refinementId: b.refinements[1].id, hypothesisId: 'H1' } });
  const t = T.saveCase(b, fields([check('JSON', '', { hypothesis: firstLink }), human]));
  const r = T.prepare(b, t.id, b.versions[1].id, b.versions[2].id, 'M', 'Mismas condiciones');
  await complete(b, r, 'bad', '{}');
  let h = T.evidence(b, [r.id], r.versionAId, r.versionBId).hypotheses[0];
  assert.equal(h.refinementId, b.refinements[1].id); assert.equal(h.checks.length, 1); assert.equal(h.improvements, 0); assert.deepEqual(h.allowedResults, ['NOT_TESTED']);
  const next = T.saveCase(b, fields([check('JSON', '', { hypothesis: human.hypothesis }), human]));
  const nextRun = T.prepare(b, next.id, r.versionAId, r.versionBId, r.model, r.conditions); await complete(b, nextRun, 'bad', '{}');
  h = T.evidence(b, [nextRun.id], r.versionAId, r.versionBId).hypotheses[0];
  assert.equal(h.improvements, 1); assert.equal(h.unresolved, 1); assert.ok(!h.allowedResults.includes('CONFIRMED')); assert.ok(h.allowedResults.includes('PARTIAL'));
  const req = P.startRequest(b, 'COMPARE', { testRunIds: [nextRun.id] }), f = fixture(req);
  f.data.hypotheses = []; assert.throws(() => P.importResponse(b, req.id, pack(req, f.data)), /cada hipótesis/);
  f.data.hypotheses = [{ id: 'H999', structuralResult: 'CONFIRMED', behavioralResult: 'NOT_TESTED' }]; assert.throws(() => P.importResponse(b, req.id, pack(req, f.data)), /sin respaldo/);
});

test('comprobaciones reales, semántica pendiente, regresiones y JSON estricto', async () => {
  const b = setup(), human = check('HUMAN', 'Responde sin inventar.'), r = prepare(b, [check('JSON'), check('CONTAINS', 'edad'), check('NOT_CONTAINS', 'inventado'), check('LENGTH', '', { min: 1, max: 50 }), human]);
  await complete(b, r, '```json\n{"edad":20}\n```', '{"edad":20}');
  assert.equal(r.results.A[0].status, 'FAIL'); assert.equal(r.results.B[0].status, 'PASS');
  assert.equal(r.results.B[4].status, 'PENDING'); assert.equal(T.outcome(r).label, 'Inconcluso');
  assert.throws(() => T.saveDraft(b, r.id, { responseA: 'otro', responseB: 'otro' }), /cerrada/);
  const repeat = T.prepare(b, r.testId, r.versionAId, r.versionBId, r.model, r.conditions);
  await complete(b, repeat, '{"edad":20}', '{"edad":"inventado"}', { [human.id]: { status: 'PASS', note: 'Se ajusta al dato.' } }, { [human.id]: { status: 'FAIL', note: 'Sustituye la edad.' } });
  assert.equal(T.outcome(repeat).regressions, 2); assert.equal(T.outcome(repeat).label, 'A preferible');
  assert.equal(T.group(b, r).length, 2);
  const t = b.tests[0]; T.saveCase(b, { ...t, expected: 'Otro criterio futuro.' }, t.id);
  assert.equal(r.testSnapshot.revision, 1); assert.equal(b.tests[0].revision, 2);
  assert.equal(r.testSnapshot.expected, 'JSON con edad.');
  assert.ok(!T.packet(b, r, 'A').includes('JSON con edad.'));
});

test('esquema local rechaza palabras no soportadas y verifica propiedades y tipos', async () => {
  const b = setup(), schema = { type: 'object', properties: { edad: { type: 'integer', minimum: 18 } }, required: ['edad'], additionalProperties: false };
  const r = prepare(b, [check('SCHEMA', JSON.stringify(schema))]);
  await complete(b, r, '{"edad":17}', '{"edad":20}');
  assert.equal(r.results.A[0].status, 'FAIL'); assert.equal(r.results.B[0].status, 'PASS');
  assert.throws(() => T.saveCase(b, fields([check('SCHEMA', '{"$ref":"https://example.test"}')])), /no compatibles/);
  assert.throws(() => T.saveCase(b, fields([check('REGEX', '[')])), /regular inválida/);
  assert.throws(() => T.saveCase(b, fields([])), /1 y 20/);
});

test('evidencia reúne todos los casos vigentes con condiciones iguales sin mezclar revisiones', async () => {
  const b = setup(), one = prepare(b, [check('JSON')]); await complete(b, one, 'texto', '{}');
  const two = prepare(b, [check('CONTAINS', 'fuente')]); await complete(b, two, 'fuente', 'omitida');
  assert.deepEqual(T.evidenceGroup(b, one).map(r => r.id), [one.id, two.id]);
  const different = T.prepare(b, two.testId, two.versionAId, two.versionBId, 'Otro modelo', two.conditions); await complete(b, different, 'fuente', 'fuente');
  assert.equal(T.evidenceGroup(b, one).length, 2);
  T.saveCase(b, { ...b.tests[1], input: 'Nueva entrada' }, two.testId);
  assert.deepEqual(T.evidenceGroup(b, one).map(r => r.id), [one.id]);
  assert.deepEqual(T.evidenceGroup(b, two).map(r => r.id), [two.id]);
});

test('comparación acepta evidencia vinculada, rechaza conteos inventados y ganadores sin respaldo', async () => {
  const b = setup(), r = prepare(b, [check('JSON')]); await complete(b, r, 'texto', '{"edad":20}');
  const req = P.startRequest(b, 'COMPARE', { testRunIds: [r.id] }), f = fixture(req);
  const evidence = JSON.parse(P.extractBlock(req.packageText, 'TEST_RESULTS', req.id));
  assert.equal(evidence.testsExecuted, 2); assert.equal(evidence.runs[0].responseA, 'texto');
  f.data.behavioralEvidence.testsExecuted = 99;
  assert.throws(() => P.importResponse(b, req.id, pack(req, f.data)), /no coincide/);
  f.data.behavioralEvidence.testsExecuted = 2; f.data.verdict = 'V2_BETTER_WITH_EVIDENCE';
  const comparison = P.importResponse(b, req.id, pack(req, f.data)); assert.deepEqual(comparison.testRunIds, [r.id]);
  assert.equal(b.project.activeVersionId, b.versions[0].id);
  const r2 = T.prepare(b, r.testId, r.versionAId, r.versionBId, r.model, r.conditions); await complete(b, r2, '{}', 'texto');
  const req2 = P.startRequest(b, 'COMPARE', { testRunIds: [r.id, r2.id] }), f2 = fixture(req2); f2.data.verdict = 'V2_BETTER_WITH_EVIDENCE';
  assert.throws(() => P.importResponse(b, req2.id, f2.response.replace('V2_BETTER_STRUCTURALLY', 'V2_BETTER_WITH_EVIDENCE')), /regresiones/);
});

test('migración IndexedDB v1 conserva datos y añade casos; backup recupera borradores y colisiones', async () => {
  const name = 'migration-' + Date.now(), b = setup();
  await new Promise((resolve, reject) => { const req = indexedDB.open(name, 1); req.onupgradeneeded = () => { for (const key of ['projects','versions','evaluations','refinements','comparisons','requests','settings']) { const s = req.result.createObjectStore(key, { keyPath: key === 'settings' ? 'key' : 'id' }); if (!['projects','settings'].includes(key)) s.createIndex('projectId','projectId'); } }; req.onerror = () => reject(req.error); req.onsuccess = () => { const db = req.result, tx = db.transaction('projects','readwrite'); tx.objectStore('projects').put(b.project); tx.oncomplete = () => { db.close(); resolve(); }; }; });
  const store = await new P.Store(name).init(); assert.equal(store.db.version, 2); assert.equal((await store.read('projects', b.project.id)).title, b.project.title);
  const r = prepare(b, [check('JSON')]); await complete(b, r, 'bad', '{}');
  const draft = T.prepare(b, r.testId, r.versionAId, r.versionBId, r.model, r.conditions); T.saveDraft(b, draft.id, { responseA: 'parcial', responseB: '', humanA: {}, humanB: {} });
  const payload = { format: 'prompt-flow-accelerator-backup', formatVersion: P.VERSION, testingVersion: 1, projects: [b] };
  const imported = await store.import(payload); const copy = await store.bundle(imported[0].id);
  assert.notEqual(copy.tests[0].id, b.tests[0].id); assert.equal(copy.testRuns[0].testId, copy.tests[0].id);
  assert.equal(copy.testRuns[0].testSnapshot.id, copy.tests[0].id); assert.equal(copy.testRuns[1].responseA, 'parcial');
  const tampered = structuredClone(payload); tampered.projects[0].testRuns[0].results.A[0].status = 'PASS'; await assert.rejects(store.import(tampered), /no coinciden/);
  const old = structuredClone(payload); delete old.testingVersion; delete old.projects[0].tests; delete old.projects[0].testRuns;
  assert.equal(store.validateBackup(old)[0].tests.length, 0);
  const missing = structuredClone(payload); delete missing.projects[0].testRuns; assert.throws(() => store.validateBackup(missing), /Falta la colección/);
  store.db.close();
});
