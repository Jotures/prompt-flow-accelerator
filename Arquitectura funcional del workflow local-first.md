# Prompt Flow Accelerator 2.0

## Arquitectura funcional del workflow local-first

## 1. Objetivo

Prompt Flow Accelerator 2.0 debe convertir el proceso:

**Evaluar → Refinar → Reevaluar**

en un flujo reproducible y trazable.

El usuario seguirá pudiendo utilizar cualquier LLM externo.

PFA no ejecutará modelos directamente en esta primera versión.

Su responsabilidad será:

* preparar los paquetes de instrucciones;
* conservar el prompt original;
* recibir los resultados del LLM;
* asociarlos correctamente;
* administrar versiones;
* comparar versiones;
* conservar el historial;
* preparar la siguiente etapa.

El modelo externo seguirá realizando el trabajo semántico.

PFA será el **orquestador del proceso**.

---

# 2. Filosofía de interacción

La aplicación debe mantener una experiencia simple:

> **Escribe → Copia → Ejecuta en tu LLM → Pega el resultado → Continúa.**

Pero PFA administrará automáticamente el contexto interno.

El usuario ya no debería tener que recordar:

> “¿Qué prompt utilicé para generar esta evaluación?”

o:

> “¿Este reporte corresponde a V2 o V3?”

---

# 3. Workflow principal

```text
NUEVO PROYECTO
      ↓
PROMPT V1
      ↓
ANALIZAR
      ↓
COPIAR PAQUETE EVALUADOR
      ↓
LLM EXTERNO
      ↓
PEGAR EVALUACIÓN
      ↓
DIAGNÓSTICO V1
      ↓
REFINAR
      ↓
COPIAR PAQUETE REFINADOR
      ↓
LLM EXTERNO
      ↓
PEGAR RESULTADO
      ↓
PROMPT V2
      ↓
COMPARAR
      ↓
COPIAR PAQUETE COMPARADOR
      ↓
LLM EXTERNO
      ↓
PEGAR COMPARACIÓN
      ↓
DECISIÓN
```

Después:

```text
ADOPTAR V2
     ↓
V2 se convierte en versión activa
```

o:

```text
CREAR V3
     ↓
nuevo ciclo
```

---

# 4. Estados del workflow

Internamente cada proyecto puede estar en uno de estos estados:

```text
DRAFT
↓
READY_TO_EVALUATE
↓
WAITING_EVALUATION
↓
EVALUATED
↓
WAITING_REFINEMENT
↓
REFINED
↓
WAITING_COMPARISON
↓
COMPARED
↓
DECISION_PENDING
↓
ACCEPTED
```

No hace falta mostrar estos nombres técnicos al usuario.

La interfaz puede mostrar simplemente:

```text
Prompt
  ✓

Evaluación
  ✓

Refinamiento
  ✓

Comparación
  ●

Validación
  ○
```

---

# 5. Concepto de Proyecto

La unidad principal de PFA ya no será únicamente un textarea.

Será un:

## Prompt Project

Ejemplo:

```text
Proyecto
Investigación de mercado para cereal proteico

Versión activa
V2

Tipo
RESEARCH + ANALYZE

Modelo
Genérico

Estado
Comparación pendiente

Creado
22/09/2026
```

Cada proyecto contiene todo su historial.

---

# 6. Estructura de datos principal

Conceptualmente:

```javascript
Project {
  id
  title
  createdAt
  updatedAt

  taskProfile
  targetModel
  analysisDepth

  activeVersionId

  versions[]
  evaluations[]
  refinements[]
  comparisons[]
  tests[]
}
```

---

# 7. Versiones

Cada prompt será una entidad independiente.

```javascript
PromptVersion {
  id
  projectId

  versionNumber

  content

  parentVersionId

  createdAt

  source
}
```

Ejemplo:

```text
V1
Original
    ↓
V2
Refinamiento de V1
    ↓
V3
Simplificación de V2
```

---

# 8. Evaluaciones

Cada evaluación debe estar ligada explícitamente a una versión.

```javascript
Evaluation {
  id
  projectId
  versionId

  rawReport

  classification

  lint

  gates

  dimensions

  score

  confidence

  priorityProblems

  hypotheses

  createdAt
}
```

Así PFA sabe:

```text
Evaluation E04
        ↓
pertenece a
        ↓
Prompt V2
```

---

# 9. Refinamientos

```javascript
Refinement {
  id

  sourceVersionId
  evaluationId

  resultingVersionId

  rawReport

  changes[]

  preservedElements[]

  suggestedTests[]

  createdAt
}
```

Esto crea una relación real:

```text
V1
 ↓
Evaluación E1
 ↓
Refinamiento R1
 ↓
V2
```

---

# 10. Comparaciones

```javascript
Comparison {
  id

  versionAId
  versionBId

  evaluationAId
  evaluationBId

  rawReport

  semanticChanges[]

  regressions[]

  improvements[]

  structuralScores

  evidenceLevel

  verdict

  nextAction

  createdAt
}
```

Así obtenemos:

```text
V1 ───────┐
          ├── Comparison C1
V2 ───────┘
```

---

# 11. El cambio técnico más importante: contratos estructurados

Los tres agentes no deberían devolver únicamente Markdown libre.

También deberían incluir un pequeño bloque estructurado que PFA pueda leer.

Por ejemplo:

```text
...reporte legible...

<PFA_DATA>
{
  "schema": "pfa-evaluation-v2",
  "profile": ["RESEARCH", "ANALYZE"],
  "score": 76,
  "confidence": "MEDIA",
  "gates": {
    "G01": "PASS",
    "G02": "PASS",
    "G03": "WARNING"
  },
  "priorityProblems": [
    {
      "id": "P1",
      "severity": "ALTO",
      "operation": "ACLARAR"
    }
  ]
}
</PFA_DATA>
```

Esto es muy importante.

El usuario sigue viendo un reporte normal.

Pero PFA puede extraer automáticamente la información importante.

---

# 12. Dos capas de output

Cada metaprompt de PFA debería producir:

## Capa humana

Markdown agradable para leer.

## Capa máquina

JSON estructurado.

Por ejemplo:

```text
REPORTE HUMANO
...

<PFA_DATA>
{
 ...
}
</PFA_DATA>
```

La aplicación busca:

```text
<PFA_DATA>
```

extrae JSON y lo guarda.

---

# 13. Ventaja

Sin esta estructura PFA tendría que intentar “entender” textos arbitrarios.

Con ella:

```text
LLM
 ↓
respuesta
 ↓
PFA_DATA
 ↓
JSON.parse()
 ↓
estado interno
```

No necesitamos API.

No necesitamos otro LLM.

No necesitamos backend.

---

# 14. Evaluador V2 — contrato de salida

El Evaluador deberá añadir al final:

```json
{
  "schema": "pfa-evaluation-v2",

  "classification": {
    "primary": "RESEARCH",
    "secondary": ["ANALYZE"]
  },

  "targetModel": "GENERIC",

  "lint": {
    "errors": 0,
    "warnings": 3
  },

  "gates": {
    "G01": "PASS",
    "G02": "PASS",
    "G03": "PASS",
    "G04": "PASS",
    "G05": "PASS",
    "G06": "WARNING",
    "G07": "WARNING"
  },

  "dimensions": {
    "intent": 92,
    "clarity": 88,
    "context": 64,
    "output": 91,
    "robustness": 52,
    "modelFit": 81,
    "safety": 75,
    "efficiency": 77
  },

  "score": 76,

  "confidence": "MEDIA",

  "complexity": "SUBESPECIFICADO",

  "priorityProblems": [
    {
      "id": "P1",
      "severity": "ALTO",
      "operation": "AÑADIR"
    }
  ],

  "readyForRefinement": true
}
```

---

# 15. Refinador V2 — contrato

El refinador devuelve:

```json
{
  "schema": "pfa-refinement-v2",

  "sourceVersion": "V1",

  "changes": [
    {
      "id": "C1",
      "operation": "AÑADIR",
      "sourceProblem": "P1"
    },
    {
      "id": "C2",
      "operation": "ELIMINAR",
      "sourceProblem": "P3"
    }
  ],

  "sizeChange": "MODERADAMENTE_MAYOR",

  "testsSuggested": 3,

  "status": "READY_FOR_REEVALUATION"
}
```

El prompt V2 puede ir en un bloque separado:

```text
<PFA_PROMPT>
...
</PFA_PROMPT>
```

PFA lo extrae automáticamente.

---

# 16. Comparador V2 — contrato

```json
{
  "schema": "pfa-comparison-v2",

  "from": "V1",
  "to": "V2",

  "goalPreserved": true,

  "structuralScore": {
    "V1": 76,
    "V2": 86
  },

  "improvements": 4,
  "regressions": 1,

  "behavioralEvidence": false,

  "evidenceLevel": "DEBIL",

  "verdict": "V2_MEJOR_ESTRUCTURALMENTE",

  "nextAction": "PROBAR_ANTES_DE_DECIDIR"
}
```

---

# 17. Vista principal de PFA

En lugar de dos tarjetas aisladas, propongo una sola experiencia.

```text
┌─────────────────────────────────────────────┐
│ ⚡ Prompt Flow Accelerator 2.0              │
│                                             │
│ Prompt  ✓  Evaluate ✓  Refine ●  Compare ○ │
└─────────────────────────────────────────────┘
```

Debajo:

```text
┌─────────────────────────────────────────────┐
│ Prompt Workspace                            │
│                                             │
│ [ Prompt................................ ]  │
│ [ ...................................... ]  │
│                                             │
│ Tipo: Auto          Modelo: Genérico        │
│                                             │
│                [ Analizar Prompt ]          │
└─────────────────────────────────────────────┘
```

---

# 18. Después de Analizar

Al pulsar:

## Analizar Prompt

PFA:

1. guarda V1;
2. ejecuta lint local;
3. genera `CONST_RUBRICA_V2 + V1`;
4. copia el paquete;
5. cambia estado.

La interfaz muestra:

```text
✓ Paquete de evaluación copiado

1. Pégalo en tu LLM.
2. Copia la respuesta.
3. Regresa aquí.
```

Y aparece:

```text
[ Pegar resultado de evaluación ]
```

---

# 19. Importar evaluación

Área:

```text
┌───────────────────────────────────────────┐
│ Resultado del Evaluador                   │
│                                           │
│ [ Pega aquí la respuesta del LLM...... ] │
│                                           │
│            [ Importar Evaluación ]        │
└───────────────────────────────────────────┘
```

PFA busca:

```text
<PFA_DATA>
```

Si existe:

```text
✓ Evaluación reconocida
✓ Schema válido
✓ Score importado
✓ Problemas detectados
```

---

# 20. Si el JSON falla

No debemos bloquear al usuario.

Mostrar:

```text
⚠ No se pudo leer automáticamente
el bloque estructurado.
```

Opciones:

**Reintentar**

**Guardar como reporte manual**

Así mantenemos compatibilidad con cualquier LLM.

---

# 21. Dashboard del diagnóstico

Después de importar:

```text
Prompt V1
────────────────────────

Tipo
RESEARCH + ANALYZE

Score
76 / 100

Confianza
MEDIA

Gates
6 PASS · 1 WARNING

Problemas
🔴 0 críticos
🟠 2 altos
🟡 1 medio
```

Después:

### Problemas prioritarios

```text
P1 · ALTO
No existe política de incertidumbre.

P2 · ALTO
Las fuentes no están delimitadas.

P3 · MEDIO
Formato de citas ambiguo.
```

Botón:

## Refinar Prompt

---

# 22. Refinamiento

Al pulsar:

PFA construye automáticamente:

```text
CONST_REFINADOR_V2
+
V1
+
EVALUACIÓN V1
```

No obliga al usuario a reunir nada.

Luego:

```text
✓ Paquete de refinamiento copiado
```

Usuario → LLM → copia respuesta.

Después:

```text
[ Importar Refinamiento ]
```

---

# 23. Creación automática de V2

PFA extrae:

```text
<PFA_PROMPT>
```

y crea automáticamente:

```text
Prompt Version V2
```

También guarda:

```text
V1
 ↓
Evaluation E1
 ↓
Refinement R1
 ↓
V2
```

Ahora sí tenemos un pipeline reproducible.

---

# 24. Vista V1 ↔ V2

La pantalla cambia a:

```text
┌──────────────────────┬──────────────────────┐
│ V1                   │ V2                   │
│                      │                      │
│ texto...             │ texto...             │
│                      │                      │
└──────────────────────┴──────────────────────┘
```

Botones:

**Ver Diff**

**Copiar V2**

**Reevaluar V2**

**Comparar V1 ↔ V2**

---

# 25. Diff local

Esto no necesita IA.

JavaScript puede mostrar:

```diff
- Analiza las estrategias.
+ Analiza las estrategias publicadas entre 2024 y 2026.

+ Si las fuentes no contienen evidencia suficiente,
+ indícalo explícitamente.
```

También:

```text
V1
2,481 caracteres

V2
2,713 caracteres

Δ
+232 (+9.3%)
```

---

# 26. Reevaluación de V2

Antes del Comparador sería recomendable volver a pasar V2 por:

## Evaluador V2

Esto produce:

```text
Evaluation E2
      ↓
Prompt V2
```

Entonces tenemos:

```text
V1 → E1

V2 → E2
```

Ahora la comparación es mucho más limpia.

---

# 27. Comparación

PFA genera automáticamente:

```text
CONST_COMPARADOR_V2

+

V1
E1

+

V2
E2

+

Refinement R1
```

Usuario lo ejecuta en el LLM.

Importa resultado.

---

# 28. Dashboard de comparación

Ejemplo:

```text
V1                   V2

76        →          86

Claridad
88        →          94

Robustez
52        →          81

Eficiencia
77        →          71
```

Abajo:

```text
✓ 4 mejoras
⚠ 1 regresión
```

---

# 29. Evidencia

Muy importante:

```text
Tipo de evidencia

ESTRUCTURAL
```

Y:

```text
⚠ Todavía no existen resultados de pruebas.
```

Esto evita que PFA afirme algo que no sabe.

La investigación precisamente advierte que inspeccionar el texto puede evaluar claridad o estructura, pero no demuestra que el modelo cumpla realmente el formato, sea factual o funcione bien en edge cases.

---

# 30. Decisión

Después del comparador:

```text
Veredicto metodológico

V2_MEJOR_ESTRUCTURALMENTE
```

Acción sugerida:

```text
PROBAR ANTES DE DECIDIR
```

Botones:

**Adoptar V2**

**Mantener V1**

**Crear V3**

**Añadir Tests**

El usuario mantiene la decisión final.

---

# 31. Versionado

En un lateral podemos tener:

```text
VERSIONES

● V1
  Original
  Score 76

● V2
  Refinamiento
  Score 86

○ V3
```

Al seleccionar cualquier versión:

* contenido;
* evaluación;
* cambios;
* comparación;
* fecha.

---

# 32. No hacer el historial demasiado complejo

No necesitamos Git.

No necesitamos branches avanzados.

Inicialmente basta con:

```text
V1
↓
V2
↓
V3
↓
V4
```

Opcionalmente:

```text
Restaurar como nueva versión
```

Por ejemplo:

```text
V1 → V2 → V3

Restaurar V1
       ↓
      V4
```

No modificamos versiones antiguas.

---

# 33. IndexedDB

La investigación ya contempla IndexedDB para versiones y estado local.

Propongo estas stores:

```text
projects

versions

evaluations

refinements

comparisons

settings
```

Más adelante:

```text
tests
testRuns
```

---

# 34. LocalStorage

Usaría `localStorage` únicamente para cosas pequeñas:

```text
theme
lastProjectId
selectedModel
analysisDepth
```

El contenido real:

```text
IndexedDB
```

---

# 35. Auto-save

Cada modificación del prompt puede guardarse automáticamente.

Indicador discreto:

```text
✓ Guardado localmente
```

No necesitamos botón:

**Guardar**

salvo para exportar.

---

# 36. Privacidad

Cabecera o Settings:

```text
🔒 Local-first

Tus proyectos se almacenan en este navegador.
PFA no envía prompts automáticamente.
```

Eso preserva una de las ventajas actuales: el HTML por sí mismo no envía el prompt a servidores.

---

# 37. Exportación

Añadiría desde temprano:

## Exportar proyecto

Formato:

```json
pfa-project.json
```

Contendría:

```text
Project
Versions
Evaluations
Refinements
Comparisons
```

Esto permite:

* backups;
* mover proyectos;
* compartir análisis;
* recuperar información.

---

# 38. Importación

Botón:

## Importar proyecto

Selecciona:

```text
.pfa.json
```

y reconstruye todo.

---

# 39. Arquitectura JavaScript

Aunque siga siendo un único HTML inicialmente, internamente deberíamos pensar en módulos.

```text
PFA
│
├── ProjectManager
├── VersionManager
├── PromptLinter
├── PromptClassifier
├── PackageBuilder
├── ResponseParser
├── EvaluationEngine
├── RefinementEngine
├── ComparisonEngine
├── DiffEngine
├── StorageManager
└── UIController
```

No significa crear todavía once archivos.

Significa separar responsabilidades lógicamente.

---

# 40. PackageBuilder

Responsable de:

```text
Evaluador
+
Prompt
```

o:

```text
Refinador
+
Prompt
+
Evaluación
```

o:

```text
Comparador
+
V1
+
E1
+
V2
+
E2
+
Refinement
```

Es una pieza central.

---

# 41. ResponseParser

Responsable de buscar:

```text
<PFA_DATA>
```

y:

```text
<PFA_PROMPT>
```

Proceso:

```javascript
response
↓
find tags
↓
extract text
↓
JSON.parse
↓
validate schema
↓
store
```

---

# 42. Schemas versionados

Cada respuesta incluirá:

```json
"schema": "pfa-evaluation-v2"
```

o:

```json
"schema": "pfa-refinement-v2"
```

o:

```json
"schema": "pfa-comparison-v2"
```

Esto permitirá modificar PFA posteriormente sin romper proyectos antiguos.

---

# 43. Linter local

Una parte sí puede ocurrir antes del LLM.

Ejemplos:

```text
placeholders
contradicciones simples
repeticiones
bloques sin cerrar
longitud
variables
```

Resultado:

```text
Local Lint

2 warnings
0 errors
```

Luego el Evaluador realiza el lint semántico más profundo.

---

# 44. Clasificador

Para el MVP no intentaría crear un clasificador sofisticado en JavaScript.

Podemos hacer:

```text
Tipo:
AUTO
```

y dejar que el Evaluador externo clasifique.

Una vez importado:

```text
RESEARCH + ANALYZE
```

PFA actualiza el proyecto.

Posteriormente podemos experimentar con clasificación local.

---

# 45. Navegación principal

Yo usaría únicamente:

```text
PROMPT
ANÁLISIS
VERSIONES
TESTS
```

Y:

```text
⚙
```

No más.

---

# 46. Prompt

Área de trabajo principal.

---

# 47. Análisis

Contiene:

```text
Lint
Evaluación
Problemas
Hipótesis
Comparación
```

---

# 48. Versiones

Contiene:

```text
V1
V2
V3
```

y Diff.

---

# 49. Tests

Inicialmente puede mostrar:

```text
Testing

Próximamente / experimental
```

o implementarse después del núcleo.

La investigación sitúa casos de prueba como una capacidad de mucho valor, pero posterior al establecimiento del núcleo adaptativo y del versionado.

---

# 50. Modo de interfaz recomendado

No haría wizard rígido.

Es mejor un:

## Workflow progresivo

Las funciones se desbloquean cuando pueden utilizarse.

Inicialmente:

```text
Analizar ✓

Refinar 🔒

Comparar 🔒
```

Después de la evaluación:

```text
Analizar ✓

Refinar ✓

Comparar 🔒
```

Después de V2:

```text
Analizar ✓

Refinar ✓

Comparar ✓
```

---

# 51. Acción primaria única

En cada etapa debe existir un solo botón visualmente dominante.

Ejemplo:

### Draft

**Analizar Prompt**

### Evaluado

**Refinar Prompt**

### Refinado

**Reevaluar V2**

### Reevaluado

**Comparar V1 ↔ V2**

### Comparado

**Decidir**

Esto reduce carga cognitiva.

---

# 52. Flujo completo del MVP

```text
CREAR PROYECTO
      ↓
PEGAR PROMPT
      ↓
ANALIZAR
      ↓
COPIAR EVALUADOR
      ↓
PEGAR RESPUESTA
      ↓
IMPORTAR EVALUACIÓN
      ↓
VER DIAGNÓSTICO
      ↓
REFINAR
      ↓
COPIAR REFINADOR
      ↓
PEGAR RESPUESTA
      ↓
IMPORTAR V2
      ↓
VER DIFF
      ↓
REEVALUAR V2
      ↓
IMPORTAR EVALUACIÓN V2
      ↓
COMPARAR
      ↓
IMPORTAR COMPARACIÓN
      ↓
DECIDIR
```

---

# 53. Qué automatiza PFA

PFA automatiza:

* ensamblaje de metaprompts;
* asociación entre versiones;
* almacenamiento;
* diff;
* parsing;
* scores;
* historial;
* navegación;
* contexto entre agentes.

---

# 54. Qué NO automatiza todavía

El LLM sigue realizando:

* clasificación semántica;
* evaluación;
* diagnóstico;
* refinamiento;
* comparación semántica.

Esto mantiene PFA:

* pequeño;
* portable;
* local;
* independiente del proveedor.

---

# 55. Qué desaparece del workflow actual

Ya no necesitaremos que el usuario copie manualmente un refinador genérico sin contexto.

Actualmente el segundo módulo simplemente copia `CONST_REFINADOR`, mientras el vínculo con la evaluación depende de la conversación externa.

Ahora PFA construye:

```text
REFINADOR
+
PROMPT EXACTO
+
EVALUACIÓN EXACTA
```

automáticamente.

Ese cambio parece pequeño, pero convierte las dos tarjetas actuales en un verdadero pipeline.

---

# 56. MVP 2.0

Para la primera implementación construiría solamente:

### Núcleo

* Projects
* Prompt V1
* Evaluador V2
* Importar evaluación
* Parsing `PFA_DATA`
* Dashboard del diagnóstico
* Refinador V2
* Importar refinamiento
* Crear V2
* Diff
* Reevaluación
* Comparador
* Versiones
* IndexedDB
* Exportar/importar proyecto

---

# 57. Fase posterior

Después:

* test cases;
* assertions;
* resultados conductuales;
* comparación A/B;
* varias ejecuciones;
* modelo objetivo más sofisticado.

---

# 58. Mucho después

Solo si demuestra utilidad:

* conexión API;
* multi-provider;
* ejecución automática;
* LLM-as-a-Judge;
* optimización automática.

---

# 59. La arquitectura final del MVP

```text
┌─────────────────────────────────────────────┐
│            PROMPT FLOW ACCELERATOR          │
└─────────────────────────────────────────────┘

                    USER
                      │
                      ▼
              PROMPT WORKSPACE
                      │
                      ▼
               VERSION MANAGER
                      │
              ┌───────┴───────┐
              ▼               ▼
          LOCAL LINT      PACKAGE BUILDER
                              │
                              ▼
                         CLIPBOARD
                              │
                              ▼
                         EXTERNAL LLM
                              │
                              ▼
                       RESPONSE IMPORT
                              │
                              ▼
                       RESPONSE PARSER
                              │
                 ┌────────────┼────────────┐
                 ▼            ▼            ▼
             EVALUATION   REFINEMENT   COMPARISON
                 │            │            │
                 └────────────┼────────────┘
                              ▼
                         INDEXEDDB
                              │
                              ▼
                         DASHBOARD
```

---

# 60. Identidad final del producto

PFA 2.0 seguirá siendo reconocible como PFA.

Antes:

> **Genera instrucciones para evaluar y refinar prompts.**

Ahora:

> **Gestiona sistemáticamente el ciclo completo de evaluación, refinamiento y comparación de prompts.**

La diferencia no está en convertirlo en algo gigantesco.

La diferencia está en que ahora **recuerda el proceso**.

Sabe:

> cuál fue el prompt;

> qué problemas tenía;

> qué se cambió;

> por qué se cambió;

> cuál fue la versión resultante;

> qué mejoró;

> qué empeoró;

> y qué debería ocurrir después.

Ese es el salto funcional de Prompt Flow Accelerator 1.x a Prompt Flow Accelerator 2.0.
