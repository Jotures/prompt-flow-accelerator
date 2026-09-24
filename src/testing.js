'use strict';
PFA.Testing = (() => {
  const { assert, id, now } = PFA;
  const types = { NORMAL: 'Normal', EDGE: 'Límite', ADVERSARIAL: 'Adversarial', REGRESSION: 'Regresión' };
  const kinds = { CONTAINS: 'Contiene', NOT_CONTAINS: 'No contiene', JSON: 'JSON válido', LENGTH: 'Longitud', REGEX: 'Expresión regular', SCHEMA: 'Esquema JSON', HUMAN: 'Criterio humano' };
  const text = (v, limit, required = false) => typeof v === 'string' && v.length <= limit && (!required || !!v.trim());
  const hypothesisStatus = { CONFIRMED: 'Confirmada en estos casos', PARTIAL: 'Apoyo parcial', NOT_CONFIRMED: 'Mejora no confirmada', NOT_TESTED: 'Sin evidencia concluyente' };
  function hypotheses(b, a, candidate) {
    return b.refinements.filter(r => r.parsed && (!a || r.sourceVersionId === a) && (!candidate || r.targetVersionId === candidate)).flatMap(r => {
      const list = b.evaluations.find(e => e.id === r.sourceEvaluationId && e.parsed)?.parsedData.hypotheses || [];
      // A local H1 is meaningful only inside its original refinement/evaluation.
      return list.filter(h => list.filter(other => other.id === h.id).length === 1).map(h => ({ ...h, refinementId: r.id, sourceEvaluationId: r.sourceEvaluationId, versionAId: r.sourceVersionId, versionBId: r.targetVersionId }));
    });
  }
  function validateLinks(b, t) {
    const available = hypotheses(b);
    for (const c of t.checks) if (c.hypothesis != null) {
      const link = c.hypothesis;
      assert(link && typeof link === 'object' && !Array.isArray(link) && Object.keys(link).length === 2 && available.some(h => h.refinementId === link.refinementId && h.id === link.hypothesisId), 'La comprobación apunta a una hipótesis inexistente o ambigua.');
    }
  }
  function hypothesisEvidence(b, runs, a, candidate) {
    return hypotheses(b, a, candidate).map(h => {
      const checks = runs.flatMap(r => r.testSnapshot.checks.flatMap((c, i) => c.hypothesis?.refinementId === h.refinementId && c.hypothesis.hypothesisId === h.id ? [{ runId: r.id, testId: r.testId, revision: r.testSnapshot.revision, checkId: c.id, criterion: c.value || kinds[c.kind], method: r.results.A[i].method, A: r.results.A[i].status, B: r.results.B[i].status }] : []));
      const improvements = checks.filter(c => c.A === 'FAIL' && c.B === 'PASS').length;
      const regressions = checks.filter(c => c.A === 'PASS' && c.B === 'FAIL').length;
      const unresolved = checks.filter(c => ['PENDING','ERROR'].includes(c.A) || ['PENDING','ERROR'].includes(c.B)).length;
      // This is a ceiling on the comparator's claim, not automatic causal proof.
      const allowedResults = !checks.length || unresolved === checks.length ? ['NOT_TESTED'] : improvements ? (regressions || unresolved || checks.some(c => c.B === 'FAIL') ? ['PARTIAL','NOT_CONFIRMED','NOT_TESTED'] : ['CONFIRMED','PARTIAL','NOT_CONFIRMED','NOT_TESTED']) : ['NOT_CONFIRMED','NOT_TESTED'];
      return { ...h, checks, improvements, regressions, unresolved, allowedResults };
    });
  }
  function schemaDefinition(s, depth = 0) {
    assert(s && typeof s === 'object' && !Array.isArray(s) && depth < 15, 'Esquema inválido o demasiado profundo.');
    const allowed = ['type','properties','required','additionalProperties','items','enum','minimum','maximum','minLength','maxLength','minItems','maxItems'];
    assert(Object.keys(s).every(k => allowed.includes(k)), 'El esquema usa palabras clave no compatibles.');
    if (s.type !== undefined) assert(['object','array','string','number','integer','boolean','null'].includes(s.type), 'Tipo de esquema no compatible.');
    if (s.properties !== undefined) { assert(s.properties && typeof s.properties === 'object' && !Array.isArray(s.properties), 'properties debe ser un objeto.'); Object.values(s.properties).forEach(v => schemaDefinition(v, depth + 1)); }
    if (s.items !== undefined) schemaDefinition(s.items, depth + 1);
    if (s.required !== undefined) assert(Array.isArray(s.required) && s.required.every(v => typeof v === 'string'), 'required debe ser una lista de nombres.');
    if (s.additionalProperties !== undefined) assert(typeof s.additionalProperties === 'boolean', 'additionalProperties debe ser booleano.');
    if (s.enum !== undefined) assert(Array.isArray(s.enum) && s.enum.length, 'enum debe contener valores.');
    for (const key of ['minimum','maximum','minLength','maxLength','minItems','maxItems']) if (s[key] !== undefined) assert(Number.isFinite(s[key]) && (['minimum','maximum'].includes(key) || Number.isInteger(s[key]) && s[key] >= 0), 'Límite de esquema inválido.');
  }
  function schemaMatches(v, s) {
    const type = v === null ? 'null' : Array.isArray(v) ? 'array' : typeof v;
    if (s.type && s.type !== type && !(s.type === 'integer' && Number.isInteger(v))) return false;
    if (s.enum && !s.enum.some(x => JSON.stringify(x) === JSON.stringify(v))) return false;
    if (typeof v === 'number' && (v < (s.minimum ?? -Infinity) || v > (s.maximum ?? Infinity))) return false;
    if (typeof v === 'string' && ([...v].length < (s.minLength ?? 0) || [...v].length > (s.maxLength ?? Infinity))) return false;
    if (Array.isArray(v) && (v.length < (s.minItems ?? 0) || v.length > (s.maxItems ?? Infinity) || s.items && !v.every(x => schemaMatches(x, s.items)))) return false;
    if (type === 'object') {
      if ((s.required || []).some(key => !Object.hasOwn(v, key))) return false;
      for (const key of Object.keys(v)) {
        if (Object.hasOwn(s.properties || {}, key)) { if (!schemaMatches(v[key], s.properties[key])) return false; }
        else if (s.additionalProperties === false) return false;
      }
    }
    return true;
  }
  function validateCase(t) {
    assert(text(t.name, 160, true) && Object.hasOwn(types, t.type) && text(t.input, 50000) && text(t.context, 50000) && text(t.expected, 10000), 'Completa el nombre y los campos del caso dentro de sus límites.');
    assert(Number.isInteger(t.revision) && t.revision > 0 && Array.isArray(t.checks) && t.checks.length > 0 && t.checks.length <= 20, 'Añade entre 1 y 20 comprobaciones.');
    assert(new Set(t.checks.map(c => c.id)).size === t.checks.length, 'Hay comprobaciones duplicadas.');
    for (const c of t.checks) {
      assert(text(c.id, 100, true) && /^[a-zA-Z0-9_-]+$/.test(c.id) && !['__proto__','constructor','prototype'].includes(c.id) && Object.hasOwn(kinds, c.kind) && text(c.value, 10000), 'Comprobación inválida.');
      if (['CONTAINS','NOT_CONTAINS','REGEX','SCHEMA','HUMAN'].includes(c.kind)) assert(c.value.trim(), 'Escribe el criterio o valor de cada comprobación.');
      if (c.kind === 'LENGTH') assert(Number.isInteger(c.min) && Number.isInteger(c.max) && c.min >= 0 && c.max >= c.min && c.max <= 200000, 'Longitud: usa un mínimo y máximo entre 0 y 200.000.');
      if (c.kind === 'REGEX') { assert(c.value.length <= 500, 'Regex: máximo 500 caracteres.'); try { new RegExp(c.value, 'u'); } catch { throw new Error('Expresión regular inválida (sin barras /…/).'); } }
      if (c.kind === 'SCHEMA') { let s; try { s = JSON.parse(c.value); } catch { throw new Error('El esquema debe ser JSON válido.'); } schemaDefinition(s); }
    }
  }
  function saveCase(b, data, testId) {
    assert(!b.project.archived, 'Restaura el proyecto para editar casos.');
    const old = testId && b.tests.find(t => t.id === testId);
    assert(!testId || old, 'Caso inexistente.');
    const t = { id: old?.id || id('test'), projectId: b.project.id, createdAt: old?.createdAt || now(), updatedAt: now(), archived: old?.archived || false, revision: (old?.revision || 0) + 1, name: data.name.trim(), type: data.type, input: data.input, context: data.context, expected: data.expected, checks: structuredClone(data.checks) };
    validateCase(t); validateLinks(b, t);
    if (old) b.tests[b.tests.indexOf(old)] = t; else b.tests.push(t);
    return t;
  }
  function prepare(b, testId, versionAId, versionBId, model, conditions) {
    assert(!b.project.archived, 'Restaura el proyecto para preparar pruebas.');
    const t = b.tests.find(t => t.id === testId && !t.archived);
    assert(t && PFA.version(b, versionAId) && PFA.version(b, versionBId) && versionAId !== versionBId, 'Selecciona un caso y dos versiones diferentes.');
    assert(text(model, 200, true) && text(conditions, 2000, true), 'Indica el modelo exacto y las condiciones compartidas.');
    const run = { id: id('run'), projectId: b.project.id, createdAt: now(), sequence: Math.max(0, ...b.testRuns.map(r => r.sequence || 0)) + 1, testId, testSnapshot: structuredClone(t), versionAId, versionBId, model: model.trim(), conditions: conditions.trim(), status: 'DRAFT', provenance: 'USER_REPORTED', responseA: '', responseB: '', humanA: {}, humanB: {}, results: null };
    b.testRuns.push(run); return run;
  }
  const packet = (b, r, side) => PFA.version(b, r['version' + side + 'Id']).content + (r.testSnapshot.context ? '\n\nCONTEXTO DEL CASO\n' + r.testSnapshot.context : '') + (r.testSnapshot.input ? '\n\nENTRADA DEL CASO\n' + r.testSnapshot.input : '');
  function saveDraft(b, runId, data) {
    const r = b.testRuns.find(r => r.id === runId);
    assert(!b.project.archived && r?.status === 'DRAFT', 'Esta ejecución ya está cerrada o el proyecto está archivado.');
    assert(text(data.responseA, 200000) && text(data.responseB, 200000), 'Cada respuesta admite hasta 200.000 caracteres.');
    for (const side of ['A','B']) {
      r['response' + side] = data['response' + side];
      r['human' + side] = structuredClone(data['human' + side] || {});
    }
  }
  function regexCheck(pattern, response) {
    // The worker prevents pathological expressions from blocking the workspace.
    if (typeof Worker === 'undefined') return Promise.resolve({ status: 'ERROR', detail: 'Regex requiere un navegador con Workers.' });
    return new Promise(resolve => {
      let worker, url, timer;
      const finish = result => { clearTimeout(timer); worker?.terminate(); if (url) URL.revokeObjectURL(url); resolve(result); };
      try {
        url = URL.createObjectURL(new Blob(['onmessage=e=>{try{postMessage({match:new RegExp(e.data.pattern,"u").test(e.data.response)})}catch{postMessage({error:true})}}'], { type: 'text/javascript' }));
        worker = new Worker(url);
        timer = setTimeout(() => finish({ status: 'ERROR', detail: 'Regex superó el límite de 1 segundo.' }), 1000);
        worker.onmessage = e => finish(e.data.error ? { status: 'ERROR', detail: 'Regex inválida.' } : { status: e.data.match ? 'PASS' : 'FAIL', detail: 'Coincidencia de expresión regular.' });
        worker.onerror = () => finish({ status: 'ERROR', detail: 'No se pudo ejecutar la expresión regular.' });
        worker.postMessage({ pattern, response });
      } catch { finish({ status: 'ERROR', detail: 'Regex no disponible en este navegador.' }); }
    });
  }
  async function assess(run) {
    const output = {};
    for (const side of ['A','B']) output[side] = await Promise.all(run.testSnapshot.checks.map(async c => {
      const response = run['response' + side]; let result;
      if (c.kind === 'HUMAN') {
        const row = run['human' + side]?.[c.id];
        result = row && ['PASS','FAIL'].includes(row.status) && row.note?.trim() ? { status: row.status, detail: row.note } : { status: 'PENDING', detail: 'Criterio pendiente de revisión humana con justificación.' };
      } else if (c.kind === 'REGEX') result = await regexCheck(c.value, response);
      else {
        let ok = false;
        if (c.kind === 'CONTAINS') ok = response.includes(c.value);
        if (c.kind === 'NOT_CONTAINS') ok = !response.includes(c.value);
        if (c.kind === 'LENGTH') ok = [...response].length >= c.min && [...response].length <= c.max;
        if (['JSON','SCHEMA'].includes(c.kind)) { try { const value = JSON.parse(response); ok = c.kind === 'JSON' || schemaMatches(value, JSON.parse(c.value)); } catch {} }
        result = { status: ok ? 'PASS' : 'FAIL', detail: c.kind === 'LENGTH' ? [...response].length + ' caracteres; rango ' + c.min + '–' + c.max + '.' : kinds[c.kind] + (c.value && c.kind !== 'SCHEMA' ? ': ' + c.value : '') };
      }
      return { checkId: c.id, method: c.kind === 'HUMAN' ? 'HUMAN' : 'LOCAL', ...result };
    }));
    return output;
  }
  function finish(b, runId, results) {
    const r = b.testRuns.find(r => r.id === runId);
    assert(!b.project.archived && r?.status === 'DRAFT' && r.responseA.trim() && r.responseB.trim(), 'Pega las dos respuestas antes de finalizar.');
    r.results = results; r.status = 'COMPLETED'; r.completedAt = now(); return r;
  }
  function outcome(r) {
    if (r.status !== 'COMPLETED') return { label: 'Pendiente', improvements: 0, regressions: 0, uncertain: true };
    let improvements = 0, regressions = 0, uncertain = false;
    r.results.A.forEach((a, i) => { const bb = r.results.B[i]; if (['PENDING','ERROR'].includes(a.status) || ['PENDING','ERROR'].includes(bb.status)) uncertain = true; if (a.status === 'FAIL' && bb.status === 'PASS') improvements++; if (a.status === 'PASS' && bb.status === 'FAIL') regressions++; });
    return { improvements, regressions, uncertain, label: uncertain ? 'Inconcluso' : improvements && regressions ? 'Mejora mixta' : improvements ? 'B mejora' : regressions ? 'A preferible' : 'Empate' };
  }
  function evidence(b, runIds, a, bb) {
    assert(Array.isArray(runIds) && runIds.length && new Set(runIds).size === runIds.length, 'Selecciona ejecuciones completas sin duplicados.');
    const runs = runIds.map(id => b.testRuns.find(r => r.id === id));
    assert(runs.every(r => r?.status === 'COMPLETED' && r.versionAId === a && r.versionBId === bb), 'La evidencia debe corresponder a ambas versiones y estar finalizada.');
    return { testsExecuted: runs.length * 2, provenance: 'USER_REPORTED', hypotheses: hypothesisEvidence(b, runs, a, bb), runs: runs.map(r => ({ id: r.id, case: r.testSnapshot, model: r.model, conditions: r.conditions, responseA: r.responseA, responseB: r.responseB, results: r.results, outcome: outcome(r) })) };
  }
  function group(b, run) {
    return b.testRuns.filter(r => r.status === 'COMPLETED' && r.testId === run.testId && r.testSnapshot.revision === run.testSnapshot.revision && r.versionAId === run.versionAId && r.versionBId === run.versionBId && r.model === run.model && r.conditions === run.conditions);
  }
  function evidenceGroup(b, run) {
    if (b.tests.find(t => t.id === run.testId)?.revision !== run.testSnapshot.revision) return group(b, run);
    return b.testRuns.filter(r => r.status === 'COMPLETED' && r.versionAId === run.versionAId && r.versionBId === run.versionBId && r.model === run.model && r.conditions === run.conditions && b.tests.some(t => t.id === r.testId && t.revision === r.testSnapshot.revision && !t.archived));
  }
  function validateBundle(b) {
    for (const t of b.tests) { validateCase(t); validateLinks(b, t); assert(typeof t.archived === 'boolean', 'Estado del caso inválido.'); }
    for (const r of b.testRuns) {
      assert(Number.isInteger(r.sequence) && r.sequence > 0, 'Orden de ejecución inválido.');
      const t = b.tests.find(t => t.id === r.testId);
      assert(t && r.testSnapshot?.id === r.testId && r.testSnapshot.projectId === b.project.id && r.testSnapshot.revision <= t.revision, 'La ejecución apunta a un caso inválido.');
      validateCase(r.testSnapshot); validateLinks(b, r.testSnapshot);
      assert(PFA.version(b, r.versionAId) && PFA.version(b, r.versionBId) && r.versionAId !== r.versionBId && ['DRAFT','COMPLETED'].includes(r.status) && r.provenance === 'USER_REPORTED', 'Referencias de ejecución inválidas.');
      assert(text(r.model, 200, true) && text(r.conditions, 2000, true) && text(r.responseA, 200000) && text(r.responseB, 200000), 'Datos de ejecución inválidos.');
      for (const side of ['A','B']) {
        const human = r['human' + side];
        assert(human && typeof human === 'object' && !Array.isArray(human), 'Revisión humana inválida.');
        for (const [key, row] of Object.entries(human)) assert(r.testSnapshot.checks.some(c => c.id === key && c.kind === 'HUMAN') && row && ['PASS','FAIL','PENDING'].includes(row.status) && text(row.note, 4000), 'Criterio humano inválido.');
      }
      if (r.status === 'COMPLETED') {
        assert(r.responseA.trim() && r.responseB.trim() && typeof r.completedAt === 'string' && Number.isFinite(Date.parse(r.completedAt)), 'Ejecución completa sin respuestas o fecha.');
        for (const side of ['A','B']) assert(Array.isArray(r.results?.[side]) && r.results[side].length === r.testSnapshot.checks.length && r.results[side].every((row, i) => row.checkId === r.testSnapshot.checks[i].id && ['PASS','FAIL','PENDING','ERROR'].includes(row.status) && row.method === (r.testSnapshot.checks[i].kind === 'HUMAN' ? 'HUMAN' : 'LOCAL') && text(row.detail, 11000)), 'Resultados de ejecución inválidos.');
      } else assert(r.results === null, 'Un borrador no puede declarar resultados.');
    }
    for (const req of b.requests) if (req.testRunIds) evidence(b, req.testRunIds, ...req.sourceVersionIds);
  }
  return { types, kinds, hypothesisStatus, hypotheses, hypothesisEvidence, validateCase, schemaMatches, saveCase, prepare, packet, saveDraft, assess, finish, outcome, evidence, group, evidenceGroup, validateBundle };
})();
