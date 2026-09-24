'use strict';
PFA.createTestingUI = helpers => {
  const { esc, badge, button, raw, openDialog, mutate, getBundle, refresh, toast, copy, showTransfer } = helpers;
  const T = PFA.Testing, $ = s => document.querySelector(s);
  let selection = null, editor = null, runId = null, timer, saving = Promise.resolve();
  const b = () => getBundle();
  const status = value => ({ PASS: 'Cumple', FAIL: 'No cumple', PENDING: 'Pendiente', ERROR: 'Sin comprobar' })[value];
  const counted = (n, one, many) => n + ' ' + (n === 1 ? one : many);
  const time = value => new Intl.DateTimeFormat('es', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value));
  const select = (id, values, current) => '<select id="' + id + '">' + Object.entries(values).map(([v, name]) => '<option value="' + esc(v) + '" ' + (v === current ? 'selected' : '') + '>' + esc(name) + '</option>').join('') + '</select>';
  function hypothesisLabel(h) {
    return PFA.version(b(), h.versionAId).label + ' → ' + PFA.version(b(), h.versionBId).label + ' · ' + h.id + ' · ' + h.expectedBehavior;
  }
  function checkHypothesis(c) {
    const h = T.hypotheses(b()).find(h => h.refinementId === c.hypothesis?.refinementId && h.id === c.hypothesis.hypothesisId);
    return h ? '<p class="small muted">Hipótesis: ' + esc(hypothesisLabel(h)) + '</p>' : '';
  }
  function hypothesisSelect(c) {
    const available = T.hypotheses(b());
    if (!available.length) return '';
    return '<label>Hipótesis que comprueba (opcional)<select data-check-hypothesis><option value="">Sin vínculo</option>' + available.map(h => '<option value="' + esc(JSON.stringify({ refinementId: h.refinementId, hypothesisId: h.id })) + '" ' + (h.refinementId === c.hypothesis?.refinementId && h.id === c.hypothesis.hypothesisId ? 'selected' : '') + '>' + esc(hypothesisLabel(h)) + '</option>').join('') + '</select></label><p class="small muted" data-hypothesis-description>' + esc(hypothesisDescription(c.hypothesis)) + '</p>';
  }
  function hypothesisDescription(link) {
    const h = T.hypotheses(b()).find(h => h.refinementId === link?.refinementId && h.id === link.hypothesisId);
    return h ? h.expectedBehavior + ' Prueba propuesta: ' + h.validation : 'El caso puede guardarse sin vincular hipótesis.';
  }
  function hypothesisResults(runs, a, candidate, conclusions) {
    const rows = T.hypothesisEvidence(b(), runs, a, candidate);
    if (!rows.length) return '';
    return '<section class="test-hypotheses"><h3>Hipótesis y evidencia</h3><p class="small muted">Solo cuentan las comprobaciones vinculadas a este refinamiento y estas versiones. Una mejora observada no demuestra causalidad ni garantiza otros casos.</p>' + rows.map(h => {
      const conclusion = conclusions?.find(row => row.id === h.id);
      return '<article class="test-hypothesis"><h4>' + esc(h.id + ' · ' + h.expectedBehavior) + '</h4>' + (conclusion ? '<p>' + badge(T.hypothesisStatus[conclusion.behavioralResult]) + '</p>' : '') + '<p class="small">' + (h.checks.length ? counted(h.checks.length, 'comprobación', 'comprobaciones') + ' · ' + counted(h.improvements, 'mejora', 'mejoras') + ' · ' + counted(h.regressions, 'regresión', 'regresiones') + ' · ' + h.unresolved + ' pendientes o sin comprobar' : 'Sin pruebas vinculadas para este par de versiones.') + '</p>' + (h.checks.length ? '<details><summary>Ver evidencia vinculada</summary><ul class="list">' + h.checks.map(c => '<li>' + esc(b().testRuns.find(r => r.id === c.runId).testSnapshot.name + ' · r' + c.revision + ' · intento ' + b().testRuns.find(r => r.id === c.runId).sequence) + '<br>' + esc(c.criterion) + '<br><span class="muted">A: ' + status(c.A) + ' → B: ' + status(c.B) + ' · ' + (c.method === 'HUMAN' ? 'Valoración humana' : 'Comprobación local') + '</span></li>').join('') + '</ul></details>' : '') + '</article>';
    }).join('') + '</section>';
  }
  function comparisonEvidence(c) {
    const req = b().requests.find(r => r.id === c.requestId);
    if (req?.hypothesisEvidenceVersion !== 1 || !c.testRunIds?.length) return '';
    return hypothesisResults(b().testRuns.filter(r => c.testRunIds.includes(r.id)), c.versionAId, c.versionBId, c.parsedData.hypotheses);
  }
  function resultTable(r) {
    if (r.status !== 'COMPLETED') return '';
    return '<div class="test-table-wrap"><table class="test-table"><thead><tr><th>Comprobación</th><th>' + esc(PFA.version(b(), r.versionAId).label) + ' · A</th><th>' + esc(PFA.version(b(), r.versionBId).label) + ' · B</th></tr></thead><tbody>' + r.testSnapshot.checks.map((c, i) => '<tr><th>' + esc(T.kinds[c.kind]) + '<small>' + esc(c.kind === 'LENGTH' ? c.min + '–' + c.max + ' caracteres' : c.value) + '</small></th>' + ['A','B'].map(side => { const result = r.results[side][i]; return '<td>' + badge(status(result.status), result.status === 'PASS' ? 'success' : result.status === 'FAIL' ? 'danger' : 'warning') + '<small>' + esc(result.method === 'HUMAN' ? 'Revisión humana: ' + result.detail : result.detail) + '</small></td>'; }).join('') + '</tr>').join('') + '</tbody></table></div>';
  }
  function view() {
    const data = b(), cases = data.tests || [], runs = data.testRuns || [];
    if (!cases.some(t => t.id === selection)) selection = cases.find(t => !t.archived)?.id || cases[0]?.id;
    const t = cases.find(t => t.id === selection);
    const suggestions = data.refinements.filter(r => r.parsed).flatMap(r => r.parsedData.suggestedTests.map(s => ({ ...s, refinementId: r.id, version: PFA.version(data, r.targetVersionId).label })));
    const disabled = data.project.archived ? 'disabled' : '';
    const heading = '<div class="page-heading"><div><div class="eyebrow">Evidencia de tus respuestas</div><h1>Prueba lo que cambió</h1><p>El mismo caso, dos versiones y criterios concretos.</p></div>' + button('test-new', 'Crear caso', 'plus', 'primary', disabled) + '</div>';
    const intro = '<div class="notice">Ejecuta cada versión en una conversación nueva con el mismo modelo y condiciones. PFA guarda tus respuestas y comprueba los criterios. ' + (data.versions.length < 2 ? 'Necesitas dos versiones guardadas para iniciar una comparación.' : 'Puedes empezar con un solo caso.') + '</div>';
    const suggestionHTML = suggestions.length ? '<section class="panel test-suggestions"><details' + (!cases.length ? ' open' : '') + '><summary>Casos sugeridos por el refinador · ' + suggestions.length + '</summary><div class="test-suggestion-grid">' + suggestions.map((s, i) => '<article><div class="tag-line">' + badge(s.version) + badge(T.types[s.type]) + '</div><h2>' + esc(s.objective) + '</h2><p>' + esc(s.scenario) + '</p><p><strong>Esperado:</strong> ' + esc(s.expected) + '</p>' + button('test-suggestion', 'Preparar este caso', 'plus', '', 'data-id="' + i + '" ' + disabled) + '</article>').join('') + '</div></details></section>' : '';
    if (!t) return heading + intro + '<section class="panel empty"><div class="empty-symbol">◈</div><h2>Define qué sería una buena respuesta</h2><p>Crea una entrada y las comprobaciones que debe superar. Luego prueba ambas versiones y conserva sus resultados.</p>' + button('test-new', 'Crear mi primer caso', 'plus', '', disabled) + '</section>' + suggestionHTML;
    const caseRuns = runs.filter(r => r.testId === t.id).sort((a, bb) => bb.sequence - a.sequence);
    const groups = new Map();
    for (const r of caseRuns.filter(r => r.status === 'COMPLETED')) {
      const key = JSON.stringify([r.testSnapshot.revision, r.versionAId, r.versionBId, r.model, r.conditions]);
      if (!groups.has(key)) groups.set(key, T.group(data, r));
    }
    const summary = groups.size ? '<section class="panel test-history"><div class="panel-head"><h2>Resultados por condiciones</h2></div><div class="section-body"><p class="small muted">Aprobado = todas las comprobaciones cumplidas. Los intentos pendientes o con errores quedan fuera de los aprobados. Cada grupo conserva su modelo, versiones y revisión del caso.</p>' + [...groups.values()].map(rows => {
      const r = rows[0], outcomes = rows.map(T.outcome);
      const counts = side => rows.filter(row => row.results[side].every(x => x.status === 'PASS')).length + '/' + rows.length;
      return '<div class="test-run-row"><div><h3>' + esc(PFA.version(data, r.versionAId).label + ' / ' + PFA.version(data, r.versionBId).label + ' · ' + r.model) + '</h3><p class="small muted">Caso r' + r.testSnapshot.revision + ' · ' + esc(r.conditions) + '</p><p>Aprobados A: ' + counts('A') + ' · B: ' + counts('B') + '</p><p class="small muted">' + outcomes.filter(x => x.uncertain).length + ' inconclusos · ' + outcomes.filter(x => x.regressions).length + ' con regresiones · ' + rows.length + ' intentos</p></div></div>';
    }).join('') + '</div></section>' : '';
    const caseNav = '<div class="test-case-list" aria-label="Casos de prueba">' + cases.map(c => '<button data-action="test-select" data-id="' + esc(c.id) + '" class="version-tab ' + (c.id === t.id ? 'selected' : '') + '" aria-pressed="' + (c.id === t.id) + '"><strong>' + esc(c.name) + '</strong><small>' + esc(T.types[c.type]) + ' · r' + c.revision + (c.archived ? ' · Archivado' : '') + '</small></button>').join('') + '</div>';
    const caseCard = '<section class="panel"><div class="panel-head"><div><div class="tag-line">' + badge(T.types[t.type]) + badge('Revisión ' + t.revision) + (t.archived ? badge('Archivado') : '') + '</div><h2>' + esc(t.name) + '</h2></div><div class="inline-actions">' + button('test-edit', 'Editar caso', 'edit', 'ghost', 'data-id="' + t.id + '" ' + disabled) + button('test-archive', t.archived ? 'Restaurar' : 'Archivar', 'history', 'ghost', 'data-id="' + t.id + '" ' + disabled) + '</div></div><div class="section-body"><div class="test-case-data"><div><h3>Entrada</h3><p>' + esc(t.input || 'El propio prompt define la tarea.') + '</p>' + (t.context ? '<h3>Contexto</h3><p>' + esc(t.context) + '</p>' : '') + '</div><div><h3>Resultado esperado</h3><p>' + esc(t.expected || 'Definido por las comprobaciones.') + '</p><h3>Comprobaciones · ' + t.checks.length + '</h3><ul class="list">' + t.checks.map(c => '<li>' + esc(T.kinds[c.kind]) + (c.kind === 'JSON' ? '' : ': ' + esc(c.kind === 'LENGTH' ? c.min + '–' + c.max + ' caracteres' : c.value)) + checkHypothesis(c) + '</li>').join('') + '</ul></div></div><div class="action-bar"><p>La respuesta esperada y los criterios se reservan para la revisión.</p>' + button('test-prepare', 'Probar dos versiones', 'flask', 'primary', 'data-id="' + t.id + '" ' + (data.project.archived || t.archived || data.versions.length < 2 ? 'disabled' : '')) + '</div></div></section>';
    const history = '<section class="panel test-history"><div class="panel-head"><h2>Ejecuciones · ' + caseRuns.length + '</h2><span class="small muted">Cada intento conserva su evidencia</span></div>' + (caseRuns.length ? caseRuns.map(r => {
      const outcome = T.outcome(r), a = PFA.version(data, r.versionAId), bb = PFA.version(data, r.versionBId);
      return '<article class="test-run-row"><div><div class="tag-line">' + badge(a.label + ' / ' + bb.label, 'accent') + badge('Caso r' + r.testSnapshot.revision) + badge(r.status === 'DRAFT' ? 'Borrador' : outcome.label, outcome.regressions ? 'warning' : '') + '</div><h3>' + esc(r.model) + '</h3><p class="small muted">' + esc(r.conditions) + ' · ' + esc(time(r.createdAt)) + '</p>' + (r.status === 'COMPLETED' ? '<p class="small">A: ' + r.results.A.filter(x => x.status === 'PASS').length + '/' + r.results.A.length + ' comprobaciones · B: ' + r.results.B.filter(x => x.status === 'PASS').length + '/' + r.results.B.length + ' · ' + outcome.improvements + ' mejoras · ' + outcome.regressions + ' regresiones</p>' : '') + '</div>' + button('test-open-run', r.status === 'DRAFT' ? 'Continuar' : 'Ver resultados', 'arrow', '', 'data-id="' + r.id + '"') + '</article>';
    }).join('') : '<div class="section-body muted">Todavía no hay ejecuciones. Los casos guardados no cuentan como pruebas realizadas.</div>') + '</section>';
    return heading + intro + caseNav + caseCard + summary + history + suggestionHTML;
  }
  function checkRow(c) {
    return '<div class="test-check-editor" data-check="' + esc(c.id) + '"><div class="test-check-head"><label>Comprobación<select data-check-kind>' + Object.entries(T.kinds).map(([k, name]) => '<option value="' + k + '" ' + (c.kind === k ? 'selected' : '') + '>' + name + '</option>').join('') + '</select></label>' + button('test-remove-check', 'Quitar', 'close', 'ghost', 'data-id="' + c.id + '"') + '</div><label data-value-wrap ' + (['JSON','LENGTH'].includes(c.kind) ? 'hidden' : '') + '>Texto, criterio, expresión o esquema<textarea class="field" data-check-value maxlength="10000"></textarea></label><div data-length-wrap class="test-two" ' + (c.kind !== 'LENGTH' ? 'hidden' : '') + '><label>Mínimo<input data-check-min type="number" min="0" max="200000" value="' + (c.min ?? 0) + '"></label><label>Máximo<input data-check-max type="number" min="0" max="200000" value="' + (c.max ?? 2000) + '"></label></div>' + hypothesisSelect(c) + '</div>';
  }
  function readCase() {
    return { name: $('#test-name').value, type: $('#test-type').value, input: $('#test-input').value, context: $('#test-context').value, expected: $('#test-expected').value, checks: [...document.querySelectorAll('[data-check]')].map(row => ({ id: row.dataset.check, hypothesis: row.querySelector('[data-check-hypothesis]')?.value ? JSON.parse(row.querySelector('[data-check-hypothesis]').value) : null, kind: row.querySelector('[data-check-kind]').value, value: row.querySelector('[data-check-value]').value, min: Number(row.querySelector('[data-check-min]').value), max: Number(row.querySelector('[data-check-max]').value) })) };
  }
  function caseDialog(data, testId = null) {
    editor = testId;
    openDialog(testId ? 'Editar caso · nueva revisión' : 'Crear caso de prueba', '<p>Define el caso antes de ver las respuestas. Las ejecuciones anteriores conservarán sus criterios.</p><label for="test-name">Nombre del caso</label><input id="test-name" maxlength="160"><label for="test-type">Tipo</label>' + select('test-type', T.types, data.type || 'NORMAL') + '<label for="test-input">Entrada concreta</label><textarea id="test-input" class="field" maxlength="50000" placeholder="La pregunta o los datos que recibirán ambas versiones."></textarea><label for="test-context">Contexto compartido (opcional)</label><textarea id="test-context" class="field" maxlength="50000"></textarea><label for="test-expected">Resultado esperado (opcional)</label><textarea id="test-expected" class="field" maxlength="10000"></textarea><h3>Comprobaciones</h3><p class="small muted">Contiene distingue mayúsculas. JSON exige una respuesta JSON sin cercas. Longitud cuenta caracteres. Regex se escribe sin barras. Los criterios humanos se valoran después. Vincula una hipótesis solo si la comprobación mide el comportamiento que esperas mejorar.</p><details class="test-schema-help"><summary>Esquema JSON admitido</summary><p class="small muted">type, properties, required, additionalProperties (booleano), items, enum, minimum, maximum, minLength, maxLength, minItems, maxItems. Otras palabras clave se rechazan.</p></details><div id="test-checks">' + data.checks.map(checkRow).join('') + '</div>' + button('test-add-check', 'Añadir comprobación', 'plus') + '<div class="dialog-footer">' + button('test-save-case', 'Guardar caso', 'check', 'primary') + '</div>', 'test-case');
    for (const key of ['name','input','context','expected']) $('#test-' + key).value = data[key] || '';
    data.checks.forEach((c, i) => document.querySelectorAll('[data-check-value]')[i].value = c.value || '');
    $('#test-name').focus();
  }
  function setupRun(testId, previous) {
    const versions = Object.fromEntries(b().versions.map(v => [v.id, v.label]));
    const v = PFA.working(b()), testCase = b().tests.find(t => t.id === testId);
    const linked = T.hypotheses(b()).find(h => testCase.checks.some(c => c.hypothesis?.refinementId === h.refinementId && c.hypothesis.hypothesisId === h.id));
    previous = previous || (linked ? { versionAId: linked.versionAId, versionBId: linked.versionBId } : null);
    openDialog('Preparar una ejecución A/B', '<p>Usa el mismo modelo, herramientas y datos en ambas conversaciones. Registrarás los resultados de este intento.</p><div class="test-two"><label for="run-a">Versión A</label><label for="run-b">Versión B</label>' + select('run-a', versions, previous?.versionAId || v?.parentVersionId || b().versions[0]?.id) + select('run-b', versions, previous?.versionBId || v?.id) + '</div><label for="run-model">Modelo exacto</label><input id="run-model" maxlength="200" placeholder="Nombre y versión que muestra tu proveedor"><label for="run-conditions">Condiciones compartidas</label><textarea id="run-conditions" class="field" maxlength="2000" placeholder="Conversaciones nuevas, búsqueda desactivada, mismos documentos…"></textarea><div class="dialog-footer">' + button('test-create-run', 'Preparar los textos', 'arrow', 'primary', 'data-id="' + testId + '"') + '</div>', 'test-setup');
    $('#run-model').value = previous?.model || '';
    $('#run-conditions').value = previous?.conditions || 'Conversaciones nuevas; mismas herramientas, contexto y configuración.';
  }
  function readRun() {
    const data = { responseA: $('#test-response-A').value, responseB: $('#test-response-B').value, humanA: {}, humanB: {} };
    for (const row of document.querySelectorAll('[data-human]')) data['human' + row.dataset.side][row.dataset.human] = { status: row.querySelector('select').value, note: row.querySelector('textarea').value };
    return data;
  }
  async function save() {
    clearTimeout(timer);
    if (!runId || !$('#test-response-A') || $('#test-response-A').readOnly) return saving;
    const id = runId, data = readRun();
    saving = saving.catch(() => {}).then(() => mutate(bundle => T.saveDraft(bundle, id, data), false));
    await saving;
    if ($('#test-save-state')) $('#test-save-state').textContent = 'Borrador guardado localmente';
  }
  async function runDialog(id) {
    runId = id;
    await refresh(false);
    const r = b().testRuns.find(r => r.id === id), done = r.status === 'COMPLETED', readonly = done || b().project.archived;
    const sides = ['A','B'].map(side => '<section class="test-output"><div class="panel-head"><h3>' + side + ' · ' + esc(PFA.version(b(), r['version' + side + 'Id']).label) + '</h3>' + button('test-copy-run', 'Copiar texto', 'copy', '', 'data-id="' + side + '"') + '</div><details><summary>Ver texto para ejecutar</summary>' + raw(T.packet(b(), r, side)) + '</details><label for="test-response-' + side + '">Respuesta ' + side + '</label><textarea class="field test-response" id="test-response-' + side + '" maxlength="200000" ' + (readonly ? 'readonly' : '') + '></textarea>' + r.testSnapshot.checks.filter(c => c.kind === 'HUMAN').map(c => '<div class="test-human" data-human="' + esc(c.id) + '" data-side="' + side + '"><label>' + esc(c.value) + '<select ' + (readonly ? 'disabled' : '') + '><option value="PENDING">Pendiente / no puedo determinarlo</option><option value="PASS">Cumple</option><option value="FAIL">No cumple</option></select></label><label>Justificación<textarea class="field" maxlength="4000" ' + (readonly ? 'readonly' : '') + '></textarea></label></div>').join('') + '</section>').join('');
    const evidenceRuns = done ? T.evidenceGroup(b(), r) : [];
    const otherLinks = r.testSnapshot.checks.filter(c => c.hypothesis && !T.hypotheses(b(), r.versionAId, r.versionBId).some(h => h.refinementId === c.hypothesis.refinementId && h.id === c.hypothesis.hypothesisId)).length;
    const canCompare = done && evidenceRuns.length && r.versionBId === b().project.workingVersionId && PFA.evaluation(b(), r.versionAId) && PFA.evaluation(b(), r.versionBId) && !PFA.derive(b()).pending && !b().project.archived;
    openDialog((done ? 'Resultados' : 'Ejecutar caso') + ' · ' + r.testSnapshot.name, '<div class="transfer-info"><span>' + esc(r.model) + '</span><span>Revisión ' + r.testSnapshot.revision + '</span><span>Ejecución manual declarada</span></div><p>' + esc(r.conditions) + '</p>' + (done ? '<div class="notice"><strong>' + T.outcome(r).label + '</strong><p>Resultado de este caso e intento. Una comprobación pendiente no cuenta como aprobada.</p></div>' + resultTable(r) + hypothesisResults([r], r.versionAId, r.versionBId) : '<p>Copia A y B en conversaciones nuevas, ejecuta la tarea y pega las respuestas completas. Puedes cerrar y continuar más tarde.</p>') + '<div class="test-outputs">' + sides + '</div>', 'test-run', '<p class="small muted" id="test-save-state">' + (done ? 'Resultado guardado · ' + esc(time(r.completedAt)) : 'Guardado automático de respuestas') + '</p>' + (canCompare ? '<p class="small muted">Se adjuntarán ' + evidenceRuns.length + ' intentos de ' + new Set(evidenceRuns.map(row => row.testId)).size + ' caso(s) con estas versiones, modelo y condiciones. Se incluyen todas sus repeticiones guardadas.</p>' : '') + '<div class="dialog-footer">' + (done ? button('test-repeat', 'Repetir caso actual', 'history', '', 'data-id="' + r.id + '" ' + (b().project.archived || b().tests.find(t => t.id === r.testId).archived ? 'disabled' : '')) + (canCompare ? button('test-evidence', 'Comparar con ' + evidenceRuns.length + (evidenceRuns.length === 1 ? ' intento' : ' intentos'), 'chart', 'primary', 'data-id="' + r.id + '"') : '') : button('test-finish', 'Finalizar y comprobar', 'check', 'primary', readonly ? 'disabled' : '')) + '</div>');
    for (const side of ['A','B']) $('#test-response-' + side).value = r['response' + side];
    if (otherLinks) {
      const note = document.createElement('p'); note.className = 'notice warning';
      note.textContent = otherLinks + ' comprobaciones están vinculadas a otro par de versiones. Sus resultados se guardarán, pero no se atribuirán a esas hipótesis.';
      $('.test-outputs').before(note);
    }
    for (const row of document.querySelectorAll('[data-human]')) { const value = r['human' + row.dataset.side][row.dataset.human]; row.querySelector('select').value = value?.status || 'PENDING'; row.querySelector('textarea').value = value?.note || ''; }
  }
  async function action(name, element) {
    if (!name.startsWith('test-')) return false;
    const id = element.dataset.id;
    if (name === 'test-new') caseDialog({ checks: [{ id: PFA.id('check'), kind: 'HUMAN', value: '' }] });
    if (name === 'test-select') { selection = id; await refresh(); }
    if (name === 'test-suggestion') {
      const suggestions = b().refinements.filter(r => r.parsed).flatMap(r => r.parsedData.suggestedTests);
      const s = suggestions[Number(id)]; caseDialog({ name: s.objective, type: s.type, input: s.scenario, expected: s.expected, checks: [{ id: PFA.id('check'), kind: 'HUMAN', value: s.expected }] });
    }
    if (name === 'test-edit') caseDialog(b().tests.find(t => t.id === id), id);
    if (name === 'test-add-check') { const data = readCase(); PFA.assert(data.checks.length < 20, 'Máximo 20 comprobaciones.'); data.checks.push({ id: PFA.id('check'), kind: 'CONTAINS', value: '' }); caseDialog(data, editor); }
    if (name === 'test-remove-check') { const data = readCase(); data.checks = data.checks.filter(c => c.id !== id); caseDialog(data, editor); }
    if (name === 'test-save-case') { const data = readCase(); selection = await mutate(bundle => T.saveCase(bundle, data, editor).id); document.querySelector('#dialog').close(); await refresh(); toast('Caso guardado. Las ejecuciones anteriores conservan sus criterios.'); }
    if (name === 'test-archive') { await mutate(bundle => { PFA.assert(!bundle.project.archived, 'Restaura el proyecto primero.'); const t = bundle.tests.find(t => t.id === id); t.archived = !t.archived; }); }
    if (name === 'test-prepare') setupRun(id);
    if (name === 'test-create-run') {
      const a = $('#run-a').value, bb = $('#run-b').value, model = $('#run-model').value, conditions = $('#run-conditions').value;
      const rid = await mutate(bundle => T.prepare(bundle, id, a, bb, model, conditions).id); await runDialog(rid);
    }
    if (name === 'test-open-run') await runDialog(id);
    if (name === 'test-copy-run') { await save(); await copy(T.packet(b(), b().testRuns.find(r => r.id === runId), id)); }
    if (name === 'test-finish') {
      await save(); const r = b().testRuns.find(r => r.id === runId);
      PFA.assert(r.responseA.trim() && r.responseB.trim(), 'Pega las dos respuestas antes de finalizar.');
      const snapshot = JSON.stringify([r.responseA, r.responseB, r.humanA, r.humanB]), results = await T.assess(r);
      const visible = $('#test-response-A') && readRun();
      PFA.assert(visible && snapshot === JSON.stringify([visible.responseA, visible.responseB, visible.humanA, visible.humanB]), 'La respuesta cambió durante la comprobación. Vuelve a finalizar.');
      await mutate(bundle => { const current = bundle.testRuns.find(x => x.id === r.id); PFA.assert(snapshot === JSON.stringify([current.responseA, current.responseB, current.humanA, current.humanB]), 'La respuesta cambió durante la comprobación. Vuelve a finalizar.'); T.finish(bundle, r.id, results); }); await runDialog(r.id);
    }
    if (name === 'test-repeat') { const r = b().testRuns.find(r => r.id === id); setupRun(r.testId, r); }
    if (name === 'test-evidence') {
      const r = b().testRuns.find(r => r.id === id);
      const rid = await mutate(bundle => PFA.startRequest(bundle, 'COMPARE', { versionAId: r.versionAId, testRunIds: T.evidenceGroup(bundle, r).map(row => row.id) }).id);
      runId = null; await showTransfer(rid, true);
    }
    return true;
  }
  function input(event) {
    if (event.target.matches('[data-check-hypothesis]')) event.target.closest('[data-check]').querySelector('[data-hypothesis-description]').textContent = hypothesisDescription(event.target.value ? JSON.parse(event.target.value) : null);
    if (event.target.closest('[data-check]') && event.target.matches('[data-check-kind]')) { const row = event.target.closest('[data-check]'), kind = event.target.value; row.querySelector('[data-value-wrap]').hidden = ['JSON','LENGTH'].includes(kind); row.querySelector('[data-length-wrap]').hidden = kind !== 'LENGTH'; }
    if (event.target.closest('.test-output') && !event.target.readOnly && !event.target.disabled && b().testRuns.find(r => r.id === runId)?.status === 'DRAFT') { if ($('#test-save-state')) $('#test-save-state').textContent = 'Guardando…'; clearTimeout(timer); timer = setTimeout(() => save().catch(e => toast(e.message, true)), 500); }
  }
  return { view, action, input, save, comparisonEvidence };
};
