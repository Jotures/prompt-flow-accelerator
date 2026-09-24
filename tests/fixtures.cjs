const fs = require('node:fs');
const path = require('node:path');
const text = fs.readFileSync(path.join(__dirname, '../PFA Interchange Protocol — PIP 2.0.md'), 'utf8');
const examples = {};
for (const match of text.matchAll(/```json\s*([\s\S]*?)```/g)) {
  const value = JSON.parse(match[1]); if (value.schema) examples[value.artifactType] = value;
}
function fixture(req, options = {}) {
  const kind = { EVALUATE: 'EVALUATION', REFINE: 'REFINEMENT', COMPARE: 'COMPARISON' }[req.operation];
  const d = structuredClone(examples[kind]); d.requestId = req.id; d.projectId = req.projectId;
  if (kind === 'EVALUATION') {
    d.versionId = req.sourceVersionIds[0]; d.targetModel.family = req.config.targetModel.family;
    d.classification.primary = req.config.taskProfile.primary === 'AUTO' ? 'RESEARCH' : req.config.taskProfile.primary;
    d.dimensions.intent.score = options.score || 92;
    if (options.better) { d.dimensions.robustness.score = 90; d.priorityProblems = []; d.hypotheses = []; d.complexity = 'ADEQUATE'; }
  } else if (kind === 'REFINEMENT') {
    d.sourceVersionId = req.sourceVersionIds[0]; d.targetVersionId = req.targetVersionId; d.sourceEvaluationId = req.sourceEvaluationId;
  } else {
    d.versionAId = req.sourceVersionIds[0]; d.versionBId = req.sourceVersionIds[1]; d.evaluationAId = req.evaluationAId; d.evaluationBId = req.evaluationBId;
    if (req.testRunIds?.length) { d.comparisonType = 'STRUCTURAL_AND_BEHAVIORAL'; d.behavioralEvidence = { available: true, testsExecuted: req.testRunIds.length * 2 }; }
  }
  const prompt = options.prompt || 'Investiga el mercado con las fuentes proporcionadas.\nSi no existe evidencia suficiente, indícalo.\nDevuelve una tabla con conclusiones y fuentes.';
  if (kind === 'REFINEMENT' && req.changeReviewRequired) for (const change of d.changes) change.intentReview = { kind: 'CORRECTION', reason: 'Resuelve el problema de evidencia descrito en el diagnóstico.', sourceExcerpt: '', refinedExcerpt: prompt.split('\n').find(line => line.trim()) };
  return { data: d, prompt, response: pack(req, d, prompt) };
}
function pack(req, data, prompt = '') {
  return '# Reporte de prueba sintético\nEste fixture verifica el transporte y la interfaz; no es una evaluación de una IA.\n' +
    (req.operation === 'REFINE' ? '\n<<<PFA_PROMPT:' + req.id + '>>>\n' + prompt + '\n<<<END_PFA_PROMPT:' + req.id + '>>>\n' : '') +
    '\n<<<PFA_DATA:' + req.id + '>>>\n' + JSON.stringify(data, null, 2) + '\n<<<END_PFA_DATA:' + req.id + '>>>';
}
module.exports = { fixture, pack };
