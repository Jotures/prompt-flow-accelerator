'use strict';
PFA.Store = class Store {
  constructor(name = 'pfa-db') { this.name = name; }
  init() {
    return new Promise((resolve, reject) => {
      const r = indexedDB.open(this.name, 2);
      r.onupgradeneeded = () => {
        const db = r.result;
        for (const name of PFA.STORES) {
          if (db.objectStoreNames.contains(name)) continue;
          const store = db.createObjectStore(name, { keyPath: name === 'settings' ? 'key' : 'id' });
          if (PFA.COLLECTIONS.includes(name)) store.createIndex('projectId', 'projectId');
          if (name === 'projects') store.createIndex('updatedAt', 'updatedAt');
        }
      };
      r.onsuccess = () => { this.db = r.result; this.db.onversionchange = () => this.db.close(); resolve(this); };
      r.onerror = () => reject(new Error('No se pudo abrir el almacenamiento local: ' + r.error.message));
      r.onblocked = () => reject(new Error('Cierra otras pestañas de PFA para actualizar el almacenamiento.'));
    });
  }
  read(name, key) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(name), r = key === undefined ? tx.objectStore(name).getAll() : tx.objectStore(name).get(key);
      r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error);
    });
  }
  put(name, value) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(name, 'readwrite'); tx.objectStore(name).put(value);
      tx.oncomplete = () => resolve(value); tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error);
    });
  }
  async bundle(projectId) {
    return this.mutate(projectId, b => b, false);
  }
  mutate(projectId, fn, write = true) {
    return new Promise((resolve, reject) => {
      const names = ['projects', ...PFA.COLLECTIONS];
      const tx = this.db.transaction(names, write ? 'readwrite' : 'readonly');
      const b = {}; let remaining = names.length, result, error;
      for (const name of names) {
        const req = name === 'projects' ? tx.objectStore(name).get(projectId) : tx.objectStore(name).index('projectId').getAll(projectId);
        req.onsuccess = () => {
          b[name === 'projects' ? 'project' : name] = name === 'projects' ? req.result : req.result.sort((a, b) => name === 'versions' ? a.number - b.number : (a.sequence || 0) - (b.sequence || 0) || a.createdAt.localeCompare(b.createdAt));
          if (--remaining) return;
          try {
            PFA.assert(b.project, 'No se encontró el proyecto.');
            result = fn(b);
            PFA.assert(!result?.then, 'Las transacciones deben ser síncronas.');
            if (write) {
              b.project.updatedAt = PFA.now(); b.project.workflowState = PFA.derive(b).state;
              tx.objectStore('projects').put(b.project);
              for (const name of PFA.COLLECTIONS) for (const row of b[name]) tx.objectStore(name).put(row);
            }
          } catch (e) { error = e; tx.abort(); }
        };
      }
      tx.oncomplete = () => resolve(result);
      tx.onerror = () => reject(error || tx.error);
      tx.onabort = () => reject(error || tx.error || new Error('No se guardaron los cambios.'));
    });
  }
  async create(title, defaults) {
    const b = PFA.newProject(title, defaults); await this.put('projects', b.project); return b.project.id;
  }
  async export(projectId) {
    const bundles = await Promise.all((projectId ? [await this.read('projects', projectId)] : await this.read('projects')).map(p => this.bundle(p.id)));
    return { format: 'prompt-flow-accelerator-backup', formatVersion: PFA.VERSION, testingVersion: 1, exportedAt: PFA.now(), projects: bundles };
  }
  validateBackup(payload) {
    PFA.assert(payload && payload.formatVersion === PFA.VERSION, 'Versión de copia de seguridad no compatible.');
    PFA.assert(payload.testingVersion === undefined || payload.testingVersion === 1, 'Versión de pruebas de la copia no compatible.');
    const bundles = payload.format === 'prompt-flow-accelerator-project' ? [payload] : payload.projects;
    PFA.assert(['prompt-flow-accelerator-project', 'prompt-flow-accelerator-backup'].includes(payload.format) && Array.isArray(bundles) && bundles.length > 0, 'El archivo no es una copia de PFA.');
    const ids = new Set();
    for (const b of bundles) {
      if (payload.testingVersion === undefined) { b.tests ??= []; b.testRuns ??= []; }
      PFA.assert(b.project && typeof b.project.id === 'string' && typeof b.project.title === 'string' && typeof b.project.draft === 'string' && b.project.draft.length <= 200000, 'Proyecto incompleto.');
      const pid = b.project.id;
      PFA.assert(typeof b.project.archived === 'boolean' && b.project.targetModel && typeof b.project.targetModel.family === 'string' && b.project.taskProfile && Object.hasOwn(PFA.PROFILES, b.project.taskProfile.primary) && Array.isArray(b.project.taskProfile.secondary) && ['QUICK','NORMAL','DEEP'].includes(b.project.analysisDepth), 'Configuración del proyecto inválida.');
      PFA.assert(typeof b.project.updatedAt === 'string' && Number.isFinite(Date.parse(b.project.updatedAt)), 'Fecha del proyecto inválida.');
      for (const name of PFA.COLLECTIONS) {
        PFA.assert(Array.isArray(b[name]), 'Falta la colección ' + name + '. Exporta una copia completa desde PFA 2.0.');
        for (const row of b[name]) PFA.assert(row.projectId === pid && typeof row.id === 'string', 'Registro de otro proyecto en ' + name);
      }
      for (const row of [b.project, ...PFA.COLLECTIONS.flatMap(k => b[k])]) {
        PFA.assert(typeof row.id === 'string' && /^[a-zA-Z0-9_-]{1,100}$/.test(row.id) && !ids.has(row.id), 'Identificador inválido o duplicado en la copia.');
        PFA.assert(typeof row.createdAt === 'string' && Number.isFinite(Date.parse(row.createdAt)), 'Fecha inválida en la copia.'); ids.add(row.id);
      }
      const hasVersion = vid => b.versions.some(v => v.id === vid), hasEval = eid => b.evaluations.some(e => e.id === eid && e.parsed);
      PFA.assert(!b.project.activeVersionId || hasVersion(b.project.activeVersionId), 'La versión activa no existe.');
      PFA.assert(!b.project.workingVersionId || hasVersion(b.project.workingVersionId), 'La versión de trabajo no existe.');
      PFA.assert(!b.project.draftBaseId || hasVersion(b.project.draftBaseId), 'El borrador apunta a una versión inexistente.');
      PFA.assert(!b.project.iterationVersionId || hasVersion(b.project.iterationVersionId), 'La iteración apunta a una versión inexistente.');
      if (b.project.decision) PFA.assert(hasVersion(b.project.decision.versionId) && hasVersion(b.project.decision.activeVersionId) && b.comparisons.some(c => c.id === b.project.decision.comparisonId), 'La decisión apunta a artefactos inexistentes.');
      PFA.assert(new Set(b.versions.map(v => v.number)).size === b.versions.length, 'Numeración de versiones duplicada.');
      for (const v of b.versions) {
        PFA.assert(typeof v.content === 'string' && v.content.trim() && v.content.length <= 200000 && Number.isInteger(v.number) && v.number > 0, 'Versión inválida.');
        PFA.assert(!v.parentVersionId || b.versions.some(p => p.id === v.parentVersionId && p.number < v.number), 'La relación entre versiones es inválida.');
        v.label = 'V' + v.number;
      }
      for (const [name, schema] of [['evaluations', 'pfa-evaluation-v2'], ['refinements', 'pfa-refinement-v2'], ['comparisons', 'pfa-comparison-v2']]) {
        for (const a of b[name]) {
          PFA.assert(typeof a.rawResponse === 'string' && a.rawResponse.length <= 2000000, 'Falta el reporte original o supera el límite.');
          if (!Array.isArray(a.warnings)) a.warnings = [];
          PFA.assert(typeof a.parsed === 'boolean' && (name === 'evaluations' || a.parsed), 'Solo las evaluaciones pueden contener un reporte manual independiente.');
          if (a.parsed) {
            const errors = PFA.validateSchema(a.parsedData, PFA_DATA.schemas[schema]);
            PFA.assert(!errors.length, 'Datos inválidos en la copia: ' + errors.join('; '));
            PFA.assert(a.parsedData.projectId === pid && a.parsedData.requestId === a.requestId, 'Referencias inconsistentes en un reporte.');
          }
          PFA.assert(b.requests.some(r => r.id === a.requestId), 'El reporte no tiene solicitud de origen.');
        }
      }
      for (const e of b.evaluations) {
        PFA.assert(hasVersion(e.versionId), 'Una evaluación apunta a una versión inexistente.');
        if (e.parsed) {
          PFA.assert(e.status === 'VALID', 'Estado de evaluación incompatible.');
          PFA.assert(e.parsedData.versionId === e.versionId, 'Evaluación asociada a otra versión.');
          for (const d of Object.values(e.parsedData.dimensions)) PFA.assert(d.applicable ? Number.isFinite(d.score) : d.score === null, 'Aplicabilidad inconsistente.');
          PFA.assert(Math.abs(PFA.score(e.parsedData.dimensions) - e.parsedData.score) < 0.05, 'Puntuación inconsistente en la copia.');
          if (e.parsedData.gates.G02.status === 'FAIL') e.parsedData.readyForRefinement = false;
        }
      }
      for (const r of b.refinements) {
        PFA.assert(!r.userReviews || Array.isArray(r.userReviews) && new Set(r.userReviews.map(row => row.changeId)).size === r.userReviews.length && r.userReviews.every(row => row.accepted === true && typeof row.at === 'string' && Number.isFinite(Date.parse(row.at)) && r.parsedData.changes.some(c => c.id === row.changeId && c.intentReview?.kind === 'PROPOSAL')), 'Revisión de propuestas inválida.');
        PFA.assert(hasVersion(r.sourceVersionId) && hasVersion(r.targetVersionId) && hasEval(r.sourceEvaluationId), 'Refinamiento con referencias inexistentes.');
        PFA.assert(b.evaluations.find(e => e.id === r.sourceEvaluationId).versionId === r.sourceVersionId, 'El refinamiento usa la evaluación de otra versión.');
        if (r.parsed) for (const key of ['sourceVersionId','targetVersionId','sourceEvaluationId']) PFA.assert(r[key] === r.parsedData[key], 'Referencias del refinamiento inconsistentes.');
      }
      for (const c of b.comparisons) {
        PFA.assert(hasVersion(c.versionAId) && hasVersion(c.versionBId) && hasEval(c.evaluationAId) && hasEval(c.evaluationBId), 'Comparación con referencias inexistentes.');
        PFA.assert(b.evaluations.find(e => e.id === c.evaluationAId).versionId === c.versionAId && b.evaluations.find(e => e.id === c.evaluationBId).versionId === c.versionBId, 'La comparación usa evaluaciones de otras versiones.');
        if (c.parsed) for (const key of ['versionAId','versionBId','evaluationAId','evaluationBId']) PFA.assert(c[key] === c.parsedData[key], 'Referencias de comparación inconsistentes.');
        if (c.parsed) {
          const request = b.requests.find(r => r.id === c.requestId);
          PFA.assert(JSON.stringify(c.testRunIds || []) === JSON.stringify(request.testRunIds || []), 'Las pruebas de la comparación no coinciden con su solicitud.');
          PFA.validateComparisonEvidence(b, request, c.parsedData);
        }
      }
      for (const r of b.requests) {
        PFA.assert(r.hypothesisEvidenceVersion === undefined || r.hypothesisEvidenceVersion === 1 && r.operation === 'COMPARE' && r.testRunIds?.length, 'Versión de evidencia de hipótesis incompatible.');
        if (r.adjustment) {
          const ref = b.refinements.find(ref => ref.id === r.refinementId);
          PFA.assert(r.operation === 'REFINE' && ref && ref.targetVersionId === r.adjustment.candidateVersionId && r.sourceVersionIds[0] === ref.sourceVersionId && r.sourceEvaluationId === ref.sourceEvaluationId, 'Referencias del ajuste inválidas.');
          PFA.assert(typeof r.adjustment.instruction === 'string' && r.adjustment.instruction.trim() && r.adjustment.instruction.length <= 4000 && ref.parsedData.changes.some(c => c.id === r.adjustment.changeId) && Array.isArray(r.adjustment.acceptedChanges) && r.adjustment.acceptedChanges.every(id => ref.parsedData.changes.some(c => c.id === id && c.intentReview?.kind === 'PROPOSAL')), 'Instrucciones del ajuste inválidas.');
        }
        PFA.assert(['EVALUATE', 'REFINE', 'COMPARE'].includes(r.operation) && [...PFA.ACTIVE_REQUEST, 'COMPLETED', 'CANCELLED'].includes(r.status) && Array.isArray(r.sourceVersionIds) && r.sourceVersionIds.length && r.sourceVersionIds.every(hasVersion), 'Solicitud inválida.');
        for (const key of ['sourceEvaluationId', 'referenceEvaluationId', 'evaluationAId', 'evaluationBId']) PFA.assert(!r[key] || hasEval(r[key]), 'La solicitud apunta a una evaluación inexistente.');
        PFA.assert(!r.manualReports || Array.isArray(r.manualReports) && r.manualReports.every(m => typeof m.rawResponse === 'string' && m.rawResponse.length <= 2000000), 'Reportes manuales inválidos.');
        PFA.assert(!r.responseDraft || typeof r.responseDraft === 'string' && r.responseDraft.length <= 2000000, 'Borrador de respuesta inválido.');
        if (PFA.ACTIVE_REQUEST.includes(r.status)) {
          PFA.assert(r.config?.targetModel && r.config?.taskProfile && ['QUICK','NORMAL','DEEP'].includes(r.config?.analysisDepth), 'La solicitud pendiente no tiene configuración válida.');
          if (r.operation === 'REFINE') PFA.assert(hasEval(r.sourceEvaluationId) && typeof r.targetVersionId === 'string' && /^[a-zA-Z0-9_-]{1,100}$/.test(r.targetVersionId) && !hasVersion(r.targetVersionId), 'Reserva de refinamiento inválida.');
          if (r.operation === 'COMPARE') PFA.assert(hasEval(r.evaluationAId) && hasEval(r.evaluationBId) && r.sourceVersionIds.length === 2, 'Faltan evaluaciones para la comparación pendiente.');
          r.packageText = PFA.buildPackage(r, b);
        }
      }
      PFA.assert(b.requests.filter(r => PFA.ACTIVE_REQUEST.includes(r.status)).length <= 1, 'Hay operaciones pendientes incompatibles.');
      if (PFA.Testing) PFA.Testing.validateBundle(b);
    }
    return bundles;
  }
  async import(payload) {
    const bundles = structuredClone(this.validateBackup(payload));
    if (PFA.Testing) for (const b of bundles) for (const r of b.testRuns) if (r.status === 'COMPLETED') {
      const recalculated = await PFA.Testing.assess(r);
      PFA.assert(JSON.stringify(recalculated) === JSON.stringify(r.results), 'Los resultados de pruebas no coinciden con sus respuestas y comprobaciones.');
    }
    return new Promise((resolve, reject) => {
      const names = ['projects', ...PFA.COLLECTIONS], tx = this.db.transaction(names, 'readwrite');
      const known = new Set(); let remaining = names.length, result, error;
      for (const name of names) {
        const r = tx.objectStore(name).getAllKeys();
        r.onsuccess = () => {
          r.result.forEach(k => known.add(k));
          if (--remaining) return;
          try {
            result = [];
            for (let b of bundles) {
              const all = [b.project, ...PFA.COLLECTIONS.flatMap(k => b[k])], collision = all.some(row => known.has(row.id));
              if (collision) {
                const map = new Map(all.map(row => [row.id, PFA.id(row.id.split('_')[0])]));
                for (const r of b.requests) if (r.targetVersionId && !map.has(r.targetVersionId)) map.set(r.targetVersionId, PFA.id('ver'));
                const remap = value => typeof value === 'string' ? (map.get(value) || value) : Array.isArray(value) ? value.map(remap) : value && typeof value === 'object' ? Object.fromEntries(Object.entries(value).map(([k, v]) => [k, remap(v)])) : value;
                b = remap(b); b.project.title += ' (copia)';
                for (const r of b.requests) if (PFA.ACTIVE_REQUEST.includes(r.status)) { r.status = 'CANCELLED'; r.lastError = 'La copia tiene nuevos identificadores. Genera un paquete nuevo para continuar.'; }
              }
              b.project.updatedAt = PFA.now(); b.project.workflowState = PFA.derive(b).state;
              tx.objectStore('projects').put(b.project);
              for (const name of PFA.COLLECTIONS) for (const row of b[name]) tx.objectStore(name).put(row);
              [b.project, ...PFA.COLLECTIONS.flatMap(k => b[k])].forEach(row => known.add(row.id));
              result.push({ id: b.project.id, collision });
            }
          } catch (e) { error = e; tx.abort(); }
        };
      }
      tx.oncomplete = () => resolve(result); tx.onerror = () => reject(error || tx.error); tx.onabort = () => reject(error || tx.error);
    });
  }
  clear() {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(PFA.STORES, 'readwrite');
      PFA.STORES.forEach(name => tx.objectStore(name).clear());
      tx.oncomplete = resolve; tx.onerror = () => reject(tx.error);
    });
  }
};
