const test = require('node:test');
const assert = require('node:assert/strict');
require('fake-indexeddb/auto');
require('../src/data.js');
const P = require('../src/core.js');
require('../src/testing.js');
require('../src/store.js');
const { fixture, pack } = require('./fixtures.cjs');
const setup = () => { const b = P.newProject('Prueba'); b.project.draft = 'Investiga el mercado y devuelve fuentes.'; P.freezeDraft(b); return b; };
const importFixture = (b, op, options) => { const r = P.startRequest(b, op); P.importResponse(b, r.id, fixture(r, options).response); return r; };

test('revisión de intención exige citas reales; aceptar y ajustar conserva versiones y evaluaciones', async () => {
  const b = setup(); importFixture(b, 'EVALUATE');
  const req = P.startRequest(b, 'REFINE'), f = fixture(req);
  const legacy = structuredClone(f.data); delete legacy.changes[0].intentReview;
  assert.throws(() => P.importResponse(b, req.id, pack(req, legacy, f.prompt)), /intentReview/);
  f.data.changes[0].intentReview.kind = 'PROPOSAL';
  f.data.changes[0].intentReview.sourceExcerpt = 'Una prioridad que nunca fue escrita';
  assert.throws(() => P.importResponse(b, req.id, pack(req, f.data, f.prompt)), /cita original/);
  f.data.changes[0].intentReview.sourceExcerpt = '';
  const ref = P.importResponse(b, req.id, pack(req, f.data, f.prompt));
  const prior = b.versions.map(v => v.content), active = b.project.activeVersionId;
  P.reviewChange(b, ref.id, 'C1', true);
  assert.equal(b.project.activeVersionId, active); assert.deepEqual(b.versions.map(v => v.content), prior);
  P.reviewChange(b, ref.id, 'C1', false); assert.deepEqual(ref.userReviews, []);
  P.reviewChange(b, ref.id, 'C1', true);
  b.project.draft += ' edición pendiente';
  assert.throws(() => P.startAdjustment(b, ref.id, 'C1', 'Elimina esa prioridad.'), /edición manual/);
  b.project.draft = prior[1];
  const adj = P.startAdjustment(b, ref.id, 'C1', 'No fijes prioridades sin consultarlas.');
  assert.equal(adj.sourceEvaluationId, ref.sourceEvaluationId);
  assert.equal(adj.sourceVersionIds[0], ref.sourceVersionId);
  assert.equal(adj.adjustment.candidateVersionId, ref.targetVersionId);
  assert.match(adj.packageText, /No fijes prioridades sin consultarlas/);
  assert.equal(JSON.parse(P.extractBlock(adj.packageText, 'ADJUSTMENT', adj.id)).candidate, prior[1]);
  assert.equal(b.versions.length, 2);
  assert.throws(() => P.startAdjustment(b, ref.id, 'C1', 'Otro ajuste'), /pendiente/);
  P.importResponse(b, adj.id, fixture(adj, { prompt: 'Pregunta las prioridades antes de comparar alternativas.' }).response);
  assert.deepEqual(b.versions.slice(0, 2).map(v => v.content), prior);
  assert.equal(b.versions[2].parentVersionId, b.versions[0].id);
  assert.equal(P.derive(b).action, 'EVALUATE');
  const store = await new P.Store('review-' + Date.now()).init();
  const payload = { format: 'prompt-flow-accelerator-backup', formatVersion: P.VERSION, projects: [b] };
  await store.import(payload); const saved = (await store.export()).projects[0];
  assert.equal(saved.refinements[0].userReviews[0].changeId, 'C1');
  const tampered = structuredClone(payload); tampered.projects[0].requests.at(-1).adjustment.candidateVersionId = b.versions[0].id;
  assert.throws(() => store.validateBackup(tampered), /Referencias del ajuste/);
  store.db.close();
});

test('solicitudes antiguas aceptan refinamientos sin clasificación; nuevas no inventan categorías', () => {
  const b = setup(); importFixture(b, 'EVALUATE'); const r = P.startRequest(b, 'REFINE');
  delete r.changeReviewRequired; const f = fixture(r);
  const ref = P.importResponse(b, r.id, f.response);
  assert.equal(ref.parsedData.changes[0].intentReview, undefined);
  assert.throws(() => P.reviewChange(b, ref.id, 'C1', true), /no existe/);
});

test('flujo completo conserva original, contexto exacto y reevaluación independiente', () => {
  const b = setup(), original = b.versions[0].content;
  const r1 = importFixture(b, 'EVALUATE');
  assert.equal(P.derive(b).action, 'REFINE');
  assert.match(r1.packageText, /pfa-evaluation-v2/);
  const r2 = P.startRequest(b, 'REFINE');
  assert.ok(r2.packageText.includes(original)); assert.ok(r2.packageText.includes(b.evaluations[0].id));
  P.importResponse(b, r2.id, fixture(r2).response);
  assert.equal(b.versions[0].content, original); assert.equal(b.versions.length, 2); assert.equal(b.project.activeVersionId, b.versions[0].id);
  assert.throws(() => P.startRequest(b, 'COMPARE'), /Ambas versiones/);
  const r3 = importFixture(b, 'EVALUATE', { better: true });
  assert.equal(r3.referenceEvaluationId, b.evaluations[0].id);
  assert.equal(P.derive(b).action, 'COMPARE');
  const r4 = importFixture(b, 'COMPARE');
  assert.ok(r4.packageText.includes(b.evaluations[1].id));
  assert.equal(P.derive(b).action, 'DECIDE');
  assert.equal(b.comparisons[0].parsedData.structuralScores.B, b.evaluations[1].parsedData.score);
  assert.equal(b.project.activeVersionId, b.versions[0].id, 'El comparador nunca adopta automáticamente');
  b.project.iterationVersionId = b.project.workingVersionId;
  assert.equal(P.derive(b).action, 'REFINE');
});
test('PIP rechaza JSON inválido, ids ajenos, bloques duplicados y schema incompleto sin mutar versiones', () => {
  const b = setup(), r = P.startRequest(b, 'EVALUATE'), f = fixture(r);
  for (const bad of [f.response.replace(r.id, 'wrong'), f.response + f.response, pack(r, { ...f.data, projectId: 'other' }), pack(r, { ...f.data, score: 101 }), pack(r, { ...f.data, surprise: true }), pack(r, { schema: f.data.schema })]) {
    const before = JSON.stringify(b);
    assert.throws(() => P.importResponse(b, r.id, bad)); assert.equal(JSON.stringify(b), before);
  }
  P.importResponse(b, r.id, f.response);
  assert.throws(() => P.importResponse(b, r.id, f.response), /completó/);
});
test('segunda iteración V2 a V3 usa V2 y E2; un refinamiento sin cambios conserva artefactos independientes', () => {
  const b = setup(); importFixture(b, 'EVALUATE');
  const candidate = '\nInvestiga el mercado con fuentes.\nSi faltan datos, indícalo.\nDevuelve una tabla de conclusiones.';
  importFixture(b, 'REFINE', { prompt: candidate }); importFixture(b, 'EVALUATE', { better: true }); importFixture(b, 'COMPARE');
  P.decide(b, b.comparisons[0].id, 'adopt');
  const v2 = structuredClone(b.versions[1]), e2 = structuredClone(P.evaluation(b, v2.id));
  b.project.decision = null; b.project.iterationVersionId = v2.id;
  assert.equal(P.derive(b).action, 'REFINE');
  const r2 = P.startRequest(b, 'REFINE');
  assert.deepEqual(r2.sourceVersionIds, [v2.id]); assert.equal(r2.sourceEvaluationId, e2.id);
  assert.equal(P.extractBlock(r2.packageText, 'CANDIDATE', r2.id), v2.content);
  assert.ok(r2.packageText.includes('<<<PFA_EVALUATION_' + e2.id + ':' + r2.id + '>>>'));
  assert.ok(!r2.packageText.includes('<<<PFA_EVALUATION_' + b.evaluations[0].id + ':' + r2.id + '>>>'));
  const f2 = fixture(r2, { prompt: candidate.slice(1) }); f2.data.changes = []; f2.data.suggestedTests = [];
  P.importResponse(b, r2.id, pack(r2, f2.data, f2.prompt));
  const v3 = b.versions[2];
  assert.equal(v3.parentVersionId, v2.id); assert.notEqual(v3.id, v2.id);
  assert.equal(v3.content, candidate.slice(1)); assert.deepEqual(b.versions[1], v2);
  const reevaluation = importFixture(b, 'EVALUATE', { better: true });
  assert.equal(reevaluation.referenceEvaluationId, e2.id);
  const e3 = P.evaluation(b, v3.id); assert.notEqual(e3.id, e2.id); assert.equal(e3.score, e2.score);
  const compare = P.startRequest(b, 'COMPARE');
  assert.deepEqual(compare.sourceVersionIds, [v2.id, v3.id]);
  assert.equal(compare.evaluationAId, e2.id); assert.equal(compare.evaluationBId, e3.id);
  const f3 = fixture(compare); f3.data.verdict = 'NO_MATERIAL_IMPROVEMENT'; f3.data.improvements = []; f3.data.regressions = [];
  P.importResponse(b, compare.id, pack(compare, f3.data));
  assert.equal(b.comparisons[1].parsedData.structuralScores.delta, 0);
  assert.deepEqual(b.evaluations[1], e2);
  // A subsequent non-identical response must also be imported verbatim.
  b.project.iterationVersionId = v3.id;
  const r3 = P.startRequest(b, 'REFINE'), f4 = fixture(r3, { prompt: v3.content + '\nIndica la fecha de cada fuente.' });
  f4.data.changes.forEach(c => c.sourceProblemId = null);
  P.importResponse(b, r3.id, pack(r3, f4.data, f4.prompt));
  assert.equal(b.versions[3].content, f4.prompt); assert.equal(b.versions[3].parentVersionId, v3.id);
});
test('equivalencia de líneas vacías no ignora indentación, espacios ni saltos internos', () => {
  assert.equal(P.textChangeKind('Texto', 'Texto'), 'IDENTICAL');
  assert.equal(P.textChangeKind('\nTexto\n', 'Texto\n'), 'EDGE_BLANK_LINES');
  assert.equal(P.textChangeKind('\n\nTexto', '\nTexto\n\n'), 'EDGE_BLANK_LINES');
  for (const [a, b] of [['Texto A', 'Texto B'], ['  Texto', 'Texto'], ['Texto ', 'Texto'], ['A\n\nB', 'A\nB'], ['a b', 'ab']]) {
    assert.equal(P.textChangeKind(a, b), 'CHANGED');
  }
});
test('N/A no suma cero; total es ponderado y normalizado, sin dimensiones inconsistentes', () => {
  const b = setup(), r = P.startRequest(b, 'EVALUATE'), f = fixture(r);
  const expected = Math.round((92 * 20 + 82 * 15 + 72 * 15 + 88 * 10 + 61 * 15 + 84 * 5) / 80 * 10) / 10;
  const parsed = P.parseResponse(f.response, r, b);
  assert.equal(parsed.data.score, expected); assert.ok(parsed.warnings.length);
  f.data.dimensions.modelFit.score = 0;
  assert.throws(() => P.parseResponse(pack(r, f.data), r, b), /N\/A/);
  const criteria = Object.values(P.DIMENSION_CRITERIA).flat();
  assert.equal(criteria.length, 61); assert.equal(new Set(criteria).size, 61);
});
test('los gates por falta de datos impiden refinar; no se inventan datos', () => {
  const b = setup(), r = P.startRequest(b, 'EVALUATE'), f = fixture(r); f.data.gates.G02.status = 'FAIL';
  P.importResponse(b, r.id, pack(r, f.data));
  assert.equal(P.derive(b).blocked, true); assert.throws(() => P.startRequest(b, 'REFINE'), /información adicional/);
});
test('la reevaluación conserva perfil y aplicabilidad', () => {
  const b = setup(); importFixture(b, 'EVALUATE'); importFixture(b, 'REFINE'); const r = P.startRequest(b, 'EVALUATE'), f = fixture(r);
  f.data.dimensions.context.applicable = false; f.data.dimensions.context.score = null;
  assert.throws(() => P.parseResponse(pack(r, f.data), r, b), /dimensiones aplicables/);
});
test('el comparador rechaza evidencia conductual inventada', () => {
  const b = setup(); importFixture(b, 'EVALUATE'); importFixture(b, 'REFINE'); importFixture(b, 'EVALUATE');
  const r = P.startRequest(b, 'COMPARE'), f = fixture(r); f.data.verdict = 'V2_BETTER_WITH_EVIDENCE';
  assert.throws(() => P.parseResponse(pack(r, f.data), r, b), /evidencia estructural/);
});
test('restauración inmutable, cancelación y operaciones duplicadas', () => {
  const b = setup(), r = P.startRequest(b, 'EVALUATE'); assert.equal(P.startRequest(b, 'EVALUATE').id, r.id);
  b.project.draft += ' Nueva instrucción.'; assert.throws(() => P.freezeDraft(b), /pendiente/);
  r.status = 'CANCELLED'; const original = structuredClone(b.versions[0]); P.freezeDraft(b); P.createVersion(b, original.content, 'RESTORE', original.id);
  assert.equal(b.versions[2].number, 3); assert.deepEqual(b.versions[0], original); assert.equal(b.versions[2].parentVersionId, original.id);
});
test('linter y diff detectan cambios sin ejecutar contenido', () => {
  const codes = P.lint('Máximo 100 palabras.\nAl menos 500 palabras.\n{{PAIS}}\n```\n<doc>\nDocumento adjunto').map(f => f.code);
  for (const code of ['CONFLICTING_LENGTH_RULE', 'EMPTY_PLACEHOLDER', 'UNBALANCED_CODE_FENCE', 'UNBALANCED_XML_TAG', 'MISSING_ATTACHMENT_REFERENCE']) assert.ok(codes.includes(code));
  assert.deepEqual(P.diff('uno\ndos', 'uno\ntres'), [{ type: 'same', text: 'uno' }, { type: 'remove', text: 'dos' }, { type: 'add', text: 'tres' }]);
});
test('IndexedDB conserva solicitudes, recupera al reabrir y escribe importaciones atómicamente', async () => {
  const name = P.id('test'), db = await new P.Store(name).init(), pid = await db.create('Persistencia');
  const rid = await db.mutate(pid, b => { b.project.draft = 'Investiga el mercado y devuelve fuentes.'; P.freezeDraft(b); return P.startRequest(b, 'EVALUATE').id; });
  db.db.close(); const reopened = await new P.Store(name).init(); const b = await reopened.bundle(pid);
  assert.equal(P.derive(b).pending.id, rid);
  await assert.rejects(reopened.mutate(pid, b => { b.project.title = 'NO GUARDAR'; throw new Error('falla'); }), /falla/);
  assert.equal((await reopened.bundle(pid)).project.title, 'Persistencia');
  const r = b.requests[0]; await reopened.mutate(pid, b => P.importResponse(b, rid, fixture(r).response));
  const backup = await reopened.export(pid); const imported = await reopened.import(backup); assert.equal(imported[0].collision, true);
  const copy = await reopened.bundle(imported[0].id); assert.notEqual(copy.project.id, pid); assert.equal(copy.evaluations[0].versionId, copy.versions[0].id); assert.equal(copy.evaluations[0].parsedData.projectId, copy.project.id);
  const invalid = structuredClone(backup); invalid.projects[0].evaluations[0].versionId = 'missing';
  const count = (await reopened.read('projects')).length; await assert.rejects(reopened.import(invalid), /inexistente/); assert.equal((await reopened.read('projects')).length, count);
  reopened.db.close();
});
test('backup del ciclo completo conserva referencias de E1, R1, E2 y comparación', async () => {
  const db = await new P.Store(P.id('test')).init(), pid = await db.create('Completo');
  await db.mutate(pid, b => { b.project.draft = 'Investiga el mercado.'; P.freezeDraft(b); importFixture(b, 'EVALUATE'); importFixture(b, 'REFINE'); importFixture(b, 'EVALUATE'); importFixture(b, 'COMPARE'); });
  const out = await db.export(pid); const [result] = await db.import(out); const b = await db.bundle(result.id);
  assert.equal(b.comparisons[0].evaluationAId, b.evaluations[0].id);
  assert.equal(b.comparisons[0].parsedData.evaluationBId, b.evaluations[1].id);
  assert.equal(b.refinements[0].parsedData.sourceEvaluationId, b.evaluations[0].id);
  assert.equal(b.requests.filter(r => r.status === 'COMPLETED').length, 4);
  db.db.close();
});
test('repetir evaluación conserva reportes y exige actualizar la comparación', () => {
  const b = setup(); importFixture(b, 'EVALUATE'); importFixture(b, 'REFINE'); importFixture(b, 'EVALUATE'); importFixture(b, 'COMPARE');
  assert.equal(P.derive(b).action, 'DECIDE'); const oldComparison = structuredClone(b.comparisons[0]);
  importFixture(b, 'EVALUATE', { better: true });
  assert.equal(b.evaluations.length, 3); assert.equal(P.derive(b).action, 'COMPARE'); assert.deepEqual(b.comparisons[0], oldComparison);
  assert.throws(() => P.decide(b, oldComparison.id, 'adopt'), /evaluaciones anteriores/);
  importFixture(b, 'COMPARE'); P.decide(b, b.comparisons[1].id, 'keep');
  assert.equal(b.project.activeVersionId, b.versions[0].id);
  assert.equal(P.derive(b).action, 'ITERATE');
});
test('importación rechaza IDs inseguros y vínculos alterados aunque el schema JSON sea válido', async () => {
  const db = await new P.Store(P.id('test')).init(), pid = await db.create('Integridad');
  await db.mutate(pid, b => { b.project.draft = 'Investiga el mercado.'; P.freezeDraft(b); importFixture(b, 'EVALUATE'); importFixture(b, 'REFINE'); importFixture(b, 'EVALUATE'); importFixture(b, 'COMPARE'); });
  const backup = await db.export(pid);
  const unsafe = structuredClone(backup); unsafe.projects[0].versions[0].id = '" onclick="alert(1)';
  await assert.rejects(db.import(unsafe), /Identificador/);
  const cross = structuredClone(backup); cross.projects[0].refinements[0].sourceEvaluationId = cross.projects[0].evaluations[1].id;
  await assert.rejects(db.import(cross), /otra versión/);
  assert.equal((await db.read('projects')).length, 1);
  const label = structuredClone(backup); label.projects[0].versions[0].label = '<script>alert(1)</script>';
  const [copy] = await db.import(label); assert.equal((await db.bundle(copy.id)).versions[0].label, 'V1');
  db.db.close();
});
