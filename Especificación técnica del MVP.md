# Prompt Flow Accelerator 2.0

## Especificación técnica del MVP

**Estado:** listo para implementación
**Arquitectura:** local-first
**Frontend inicial:** HTML + CSS + JavaScript
**Persistencia:** IndexedDB
**Transporte con LLM:** portapapeles
**Backend:** ninguno
**API:** ninguna
**Protocolo:** PIP 2.0.0

---

# 1. Objetivo técnico

Prompt Flow Accelerator 2.0 debe transformar el prototipo actual en una aplicación local capaz de administrar de forma reproducible:

```text
Prompt
↓
Evaluación
↓
Diagnóstico
↓
Refinamiento
↓
Nueva versión
↓
Reevaluación
↓
Comparación
↓
Decisión
```

El LLM externo realiza el análisis semántico.

PFA administra:

* prompts;
* versiones;
* metaprompts;
* requests;
* respuestas;
* estado;
* parsing;
* validación;
* historial;
* comparación;
* persistencia.

---

# 2. Principio arquitectónico

La aplicación debe funcionar completamente sin servidor.

```text
┌─────────────────────┐
│       Browser       │
│                     │
│   Prompt Flow       │
│   Accelerator       │
│                     │
│   IndexedDB         │
└─────────┬───────────┘
          │
      Clipboard
          │
          ▼
┌─────────────────────┐
│    LLM externo      │
│ ChatGPT / Claude /  │
│ Gemini / otro       │
└─────────────────────┘
```

PFA no envía automáticamente información a ningún proveedor.

Esto mantiene la ventaja local del proyecto actual y coincide con la recomendación de mantener el modo manual/local como predeterminado.

---

# 3. Stores de IndexedDB

El MVP utilizará estas stores:

```text
projects
versions
evaluations
refinements
comparisons
requests
settings
```

Dejamos preparadas para una fase posterior:

```text
tests
testRuns
```

---

# 4. Base de datos

Nombre:

```text
pfa-db
```

Versión inicial:

```text
1
```

---

# 5. Store: projects

Representa una sesión lógica de trabajo sobre un prompt.

## Estructura

```javascript
{
  id: "prj_xxxx",

  title: "Investigación sobre...",
  description: "",

  createdAt: "...",
  updatedAt: "...",

  activeVersionId: "ver_xxxx",

  workflowState: "EVALUATED",

  taskProfile: {
    primary: "RESEARCH",
    secondary: ["ANALYZE"],
    confidence: "HIGH"
  },

  targetModel: {
    family: "GENERIC",
    label: "Genérico"
  },

  analysisDepth: "NORMAL",

  archived: false
}
```

---

# 6. Índices de projects

```text
id
updatedAt
createdAt
workflowState
archived
```

El índice principal será:

```text
id
```

---

# 7. Store: versions

Cada modificación del prompt genera una nueva versión.

Nunca se sobrescribe una versión histórica.

## Estructura

```javascript
{
  id: "ver_xxxx",
  projectId: "prj_xxxx",

  number: 1,
  label: "V1",

  parentVersionId: null,

  content: "...",

  source: "USER",

  createdAt: "...",

  charCount: 2500,
  wordCount: 390,

  evaluationId: null,

  adopted: true
}
```

---

# 8. Valores de source

```text
USER
REFINEMENT
RESTORE
MANUAL_EDIT
IMPORT
```

---

# 9. Relaciones de versiones

Ejemplo:

```text
V1
│
├── evaluación E1
│
└── refinamiento R1
       ↓
      V2
       │
       ├── evaluación E2
       │
       └── refinamiento R2
              ↓
             V3
```

---

# 10. Restaurar versiones

No modificaremos versiones antiguas.

Si el usuario restaura V1 después de haber llegado a V3:

```text
V1
↓
V2
↓
V3

Restaurar V1
↓
V4
```

Entonces:

```javascript
{
  number: 4,
  parentVersionId: "ver_v1",
  source: "RESTORE"
}
```

---

# 11. Store: evaluations

Guarda tanto el reporte completo como los datos estructurados.

```javascript
{
  id: "eval_xxxx",
  projectId: "prj_xxxx",
  versionId: "ver_xxxx",

  requestId: "req_xxxx",

  createdAt: "...",

  rawResponse: "...",

  parsed: true,

  parsedData: {
    schema: "pfa-evaluation-v2",
    ...
  },

  score: 79,
  confidence: "MEDIUM",

  status: "VALID"
}
```

---

# 12. Estados de Evaluation

```text
VALID
MANUAL
INVALID
```

### VALID

PFA_DATA correcto.

### MANUAL

Se guardó solamente el reporte de texto.

### INVALID

Existe PFA_DATA pero no pasa validación.

---

# 13. Store: refinements

```javascript
{
  id: "ref_xxxx",

  projectId: "prj_xxxx",

  sourceVersionId: "ver_001",
  targetVersionId: "ver_002",

  sourceEvaluationId: "eval_001",

  requestId: "req_xxxx",

  rawResponse: "...",
  parsed: true,

  parsedData: {...},

  createdAt: "..."
}
```

---

# 14. Store: comparisons

```javascript
{
  id: "cmp_xxxx",

  projectId: "prj_xxxx",

  versionAId: "ver_001",
  versionBId: "ver_002",

  evaluationAId: "eval_001",
  evaluationBId: "eval_002",

  refinementId: "ref_001",

  requestId: "req_xxxx",

  rawResponse: "...",
  parsed: true,

  parsedData: {...},

  createdAt: "..."
}
```

---

# 15. Store: requests

Esta store es fundamental.

Registra cada interacción que PFA espera recibir de un LLM.

```javascript
{
  id: "req_xxxx",

  projectId: "prj_xxxx",

  operation: "EVALUATE",

  sourceVersionIds: [
    "ver_001"
  ],

  targetVersionId: null,

  createdAt: "...",

  copiedAt: "...",

  completedAt: null,

  status: "WAITING_RESPONSE"
}
```

---

# 16. Operaciones

```text
EVALUATE
REFINE
COMPARE
```

Más adelante:

```text
TEST
OPTIMIZE
```

---

# 17. Estados de Request

```text
CREATED
COPIED
WAITING_RESPONSE
COMPLETED
INVALID_RESPONSE
CANCELLED
```

---

# 18. Store: settings

```javascript
{
  key: "app-settings",

  theme: "DARK",

  defaultModel: "GENERIC",

  analysisDepth: "NORMAL",

  autoSave: true,

  showAdvanced: false,

  protocolVersion: "2.0.0"
}
```

---

# 19. Qué NO debe ir en IndexedDB

No guardar:

* API keys;
* contraseñas;
* secretos;
* credenciales externas.

El MVP no necesita ninguna.

---

# 20. IDs

Todos los objetos tendrán IDs internos.

Ejemplo:

```text
prj_7a82...
ver_19da...
eval_ba81...
ref_51fe...
cmp_a712...
req_93fd...
```

Generados con:

```javascript
crypto.randomUUID()
```

y prefijo legible.

---

# 21. Labels visuales

Los IDs nunca se mostrarán como identificadores principales al usuario.

La interfaz mostrará:

```text
V1
V2
V3
```

aunque internamente existan:

```text
ver_89c...
ver_73a...
ver_18f...
```

---

# 22. Integridad referencial

Al guardar una entidad, PFA comprobará que existan sus dependencias.

Ejemplo:

Una evaluación:

```text
Evaluation.versionId
```

debe apuntar a una versión existente.

Un refinement:

```text
sourceVersionId
sourceEvaluationId
targetVersionId
```

debe apuntar a objetos válidos.

---

# 23. Eliminación

En el MVP evitaremos eliminación destructiva.

Un proyecto podrá:

```text
ARCHIVARSE
```

pero no borrarse desde la interfaz principal.

Esto reduce riesgo de pérdida accidental.

---

# 24. Máquina de estados del proyecto

El proyecto tendrá un estado principal.

```text
EMPTY
DRAFT
READY_TO_EVALUATE
WAITING_EVALUATION
EVALUATED
WAITING_REFINEMENT
REFINED
WAITING_REEVALUATION
REEVALUATED
WAITING_COMPARISON
COMPARED
DECISION_PENDING
ACCEPTED
```

---

# 25. Estado EMPTY

No existe prompt.

UI:

```text
Pega o escribe un prompt para comenzar.
```

Acciones:

```text
Editar
```

---

# 26. Estado DRAFT

Existe contenido pero aún no se ha consolidado como versión.

Acción principal:

```text
Analizar Prompt
```

---

# 27. READY_TO_EVALUATE

Se ha creado V1.

Puede construirse el paquete.

Acción:

```text
Copiar paquete de evaluación
```

---

# 28. WAITING_EVALUATION

PFA ya generó la request.

UI:

```text
Paquete copiado ✓

Ejecuta el paquete en tu LLM
y pega aquí la respuesta.
```

Acción principal:

```text
Importar Evaluación
```

---

# 29. EVALUATED

Existe evaluación válida.

UI muestra:

```text
score
gates
problemas
fortalezas
hipótesis
```

Acción principal:

```text
Refinar Prompt
```

---

# 30. WAITING_REFINEMENT

Existe request de refinamiento pendiente.

Acción:

```text
Importar Refinamiento
```

---

# 31. REFINED

Se creó una nueva versión.

Ejemplo:

```text
V1 → V2
```

UI muestra:

```text
Diff disponible
```

Acción principal:

```text
Reevaluar V2
```

---

# 32. WAITING_REEVALUATION

Mismo comportamiento que una evaluación normal, pero asociada a V2.

---

# 33. REEVALUATED

Tenemos:

```text
V1 → E1
V2 → E2
```

Acción:

```text
Comparar V1 ↔ V2
```

---

# 34. WAITING_COMPARISON

Esperando resultado del comparador externo.

---

# 35. COMPARED

PFA dispone de:

* cambios;
* mejoras;
* regresiones;
* scores;
* nivel de evidencia;
* veredicto;
* acción sugerida.

---

# 36. DECISION_PENDING

La aplicación espera al usuario.

Opciones:

```text
Adoptar V2
Mantener V1
Crear V3
Probar
```

---

# 37. ACCEPTED

Existe una versión activa seleccionada.

Esto NO significa que el proyecto haya terminado para siempre.

Puede volver a:

```text
EVALUATED
```

si el usuario inicia otra iteración.

---

# 38. Diagrama de estados

```text
EMPTY
  ↓
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
WAITING_REEVALUATION
  ↓
REEVALUATED
  ↓
WAITING_COMPARISON
  ↓
COMPARED
  ↓
DECISION_PENDING
  ├───────────────┐
  ↓               ↓
ACCEPTED        EVALUATED
               nueva iteración
```

---

# 39. Eventos

La máquina de estados no cambia directamente.

Recibe eventos.

Ejemplos:

```text
PROMPT_CHANGED
VERSION_CREATED
EVALUATION_PACKAGE_COPIED
EVALUATION_IMPORTED
REFINEMENT_PACKAGE_COPIED
REFINEMENT_IMPORTED
REEVALUATION_IMPORTED
COMPARISON_IMPORTED
VERSION_ADOPTED
ITERATION_STARTED
```

---

# 40. Ejemplo

```text
state = EVALUATED

event = REFINEMENT_PACKAGE_COPIED

nextState =
WAITING_REFINEMENT
```

---

# 41. Transiciones inválidas

Ejemplo:

No debe poder ejecutarse:

```text
COMPARE
```

si V2 todavía no tiene evaluación.

PFA mostrará:

```text
V2 debe ser reevaluado antes de
realizar una comparación controlada.
```

---

# 42. Workflow derivado

La interfaz NO debe confiar únicamente en:

```text
project.workflowState
```

También debe comprobar la existencia real de artefactos.

Ejemplo:

```text
¿Existe V2?
¿Existe E2?
¿Existe Comparison?
```

Esto evita corrupción del estado.

---

# 43. Layout principal

La aplicación tendrá tres zonas.

```text
┌───────────────────────────────────────────────┐
│ Header                                        │
├──────────┬─────────────────────────┬──────────┤
│ Sidebar  │ Main Workspace          │ Context  │
│          │                         │ Panel    │
│          │                         │          │
└──────────┴─────────────────────────┴──────────┘
```

En pantallas pequeñas:

```text
Sidebar → drawer
Context → panel desplegable
```

---

# 44. Header

Debe contener:

```text
⚡ Prompt Flow Accelerator

Proyecto actual

Estado local

Settings
```

Ejemplo:

```text
⚡ PFA 2.0
Investigación mercados     ✓ Guardado local
                                      ⚙
```

---

# 45. Navegación

Sidebar:

```text
Prompt
Analysis
Versions
Tests
```

En español:

```text
Prompt
Análisis
Versiones
Pruebas
```

Para MVP:

```text
Pruebas
```

puede permanecer experimental.

---

# 46. Sidebar de proyectos

En escritorio puede existir un selector superior:

```text
Proyecto actual ▼
```

con:

```text
Nuevo proyecto
Abrir proyecto
Archivados
```

No hace falta una pantalla compleja de gestión.

---

# 47. Vista Prompt

Es la vista principal.

Componentes:

```text
PromptEditor
PromptMeta
WorkflowStepper
PrimaryAction
```

---

# 48. PromptEditor

Textarea grande.

Debe ofrecer:

```text
contador de caracteres
contador de palabras
auto-save
copiar
limpiar
```

No debe tener un editor visual complejo.

---

# 49. PromptMeta

Campos:

```text
Tipo de tarea
AUTO

Modelo
GENÉRICO

Profundidad
NORMAL
```

No deben distraer.

Pueden estar en:

```text
Opciones ▾
```

---

# 50. WorkflowStepper

```text
Prompt
  ✓

Evaluar
  ✓

Refinar
  ●

Comparar
  ○

Validar
  ○
```

No debe comportarse como wizard rígido.

Es un indicador.

---

# 51. PrimaryAction

Debe existir una acción dominante.

Ejemplo:

```text
[ Analizar Prompt ]
```

Después:

```text
[ Refinar Prompt ]
```

Después:

```text
[ Reevaluar V2 ]
```

Después:

```text
[ Comparar V1 ↔ V2 ]
```

---

# 52. Regla de UX

Nunca mostrar simultáneamente cinco botones principales.

Debe existir:

```text
1 acción principal
+
acciones secundarias discretas
```

---

# 53. Modal de transferencia

Cuando PFA genera un paquete:

```text
┌─────────────────────────────────────┐
│ Paquete listo                       │
│                                     │
│ ✓ Copiado al portapapeles           │
│                                     │
│ 1. Abre tu LLM                      │
│ 2. Pega el paquete                  │
│ 3. Copia la respuesta               │
│ 4. Regresa a PFA                    │
│                                     │
│ [ Pegar respuesta ]                 │
└─────────────────────────────────────┘
```

---

# 54. Importar respuesta

Área:

```text
Pega aquí la respuesta completa
del LLM.
```

Botón:

```text
Procesar respuesta
```

PFA:

```text
parse
validate
correlate
store
```

---

# 55. Feedback de parsing

Éxito:

```text
✓ Respuesta reconocida
✓ PIP 2.0 válido
✓ Request verificada
✓ Evaluación importada
```

Error:

```text
⚠ PFA_DATA inválido

2 problemas encontrados
```

---

# 56. Vista Análisis

Secciones:

```text
Overview
Lint
Gates
Scorecard
Problemas
Hipótesis
Reporte completo
```

---

# 57. Overview

Ejemplo:

```text
RESEARCH + ANALYZE

79 / 100
Score estructural

Confianza
MEDIA

Validación conductual
NO REALIZADA
```

---

# 58. Scorecard

Tarjetas o barras:

```text
Objetivo        92
Claridad        82
Contexto        72
Output          88
Robustez        61
Eficiencia      84
```

Dimensiones N/A:

```text
Modelo
N/A
```

No mostrar:

```text
0
```

---

# 59. Gates

Diseño compacto:

```text
G01 ✓ PASS
G02 ✓ PASS
G03 ✓ PASS
G04 ✓ PASS
G05 ✓ PASS
G06 ⚠ WARNING
G07 ✓ PASS
```

---

# 60. Problemas prioritarios

Cards:

```text
HIGH · P1

No existe política ante
evidencia insuficiente.

Operación
ADD
```

Expandir:

```text
Evidencia
Consecuencia
Recomendación
Validación
```

---

# 61. Hipótesis

Representar:

```text
H1
P1 → ADD → menor riesgo de invención
```

Esto conecta evaluación con refinamiento.

---

# 62. Reporte completo

El `rawResponse` debe ser visible bajo:

```text
Ver reporte completo
```

No debe ocupar la pantalla principal.

---

# 63. Vista Versiones

Cabecera:

```text
V1 → V2 → V3
```

Cada versión:

```text
V2
Refinement
Score 86
23 Sep · 20:51
```

---

# 64. Version Detail

Al seleccionar V2:

```text
Prompt
Evaluación
Origen
Cambios
Comparaciones
```

---

# 65. Comparador visual

Modo:

```text
Side by Side
```

o:

```text
Diff
```

---

# 66. Diff

Para MVP puede implementarse mediante comparación por líneas.

Ejemplo:

```diff
- Investiga el mercado.
+ Investiga el mercado peruano entre 2024 y 2026.

+ Si la evidencia es insuficiente, indícalo.
```

Posteriormente podemos mejorar a diff semántico.

---

# 67. Métricas locales

PFA calcula directamente:

```text
caracteres
palabras
líneas
variación absoluta
variación %
```

No dependen del LLM.

---

# 68. Comparison Dashboard

```text
             V1       V2

Score        79   →   87
Robustez     61   →   84
Claridad     82   →   92
Eficiencia   84   →   77
```

Después:

```text
4 mejoras
1 regresión
```

---

# 69. Evidence Badge

Siempre visible:

```text
EVIDENCIA
ESTRUCTURAL
```

o, posteriormente:

```text
EVIDENCIA
ESTRUCTURAL + CONDUCTUAL
```

Esto materializa una de las conclusiones centrales de la investigación: una inspección del prompt no demuestra por sí sola que su comportamiento haya mejorado.

---

# 70. Decision Panel

Ejemplo:

```text
V2_MEJOR_ESTRUCTURALMENTE

La versión V2 resuelve los principales
problemas detectados, pero todavía no
existen pruebas conductuales.

Siguiente acción sugerida

PROBAR ANTES DE DECIDIR
```

Botones:

```text
Adoptar V2
Mantener V1
Crear V3
```

---

# 71. La aplicación no decide automáticamente

Aunque el comparador indique:

```text
ADOPT_V2
```

la selección corresponde al usuario.

PFA presenta evidencia.

El usuario decide.

---

# 72. Tests

La arquitectura debe dejar preparada la sección.

Modelo futuro:

```javascript
TestCase {
  id
  projectId
  name
  type
  input
  context
  expected
  checks[]
}
```

Tipos:

```text
NORMAL
EDGE
ADVERSARIAL
REGRESSION
```

El informe precisamente recomienda estos cuatro grupos para un testing ligero.

---

# 73. Settings

Configuraciones:

```text
Tema

Modelo predeterminado

Profundidad de análisis

Mostrar funciones avanzadas

Exportar datos

Importar datos

Limpiar datos locales
```

---

# 74. Profundidad

Valores:

```text
QUICK
NORMAL
DEEP
```

Esto puede modificar el metaprompt.

### QUICK

* análisis compacto;
* máximo 3 problemas;
* menos detalle.

### NORMAL

* comportamiento estándar.

### DEEP

* mayor análisis;
* más hipótesis;
* más detalle en módulos adaptativos.

No modifica la filosofía de evaluación.

---

# 75. Auto-save

El editor guardará cambios utilizando debounce.

Conceptualmente:

```javascript
onPromptInput()
↓
wait 500 ms
↓
saveDraft()
```

No crear versión nueva con cada tecla.

---

# 76. Draft vs Version

Importante:

Mientras el usuario escribe:

```text
draft
```

Cuando pulsa:

```text
Analizar
```

PFA congela:

```text
V1
```

Si luego edita manualmente:

```text
Draft basado en V1
```

y al confirmar:

```text
V2
```

o una nueva versión correspondiente.

---

# 77. Inmutabilidad

Una vez una versión tenga una evaluación:

```text
NO SE EDITA
```

Si el usuario quiere cambiarla:

```text
Crear nueva versión
```

Esto garantiza reproducibilidad.

---

# 78. Exportación

Formato recomendado:

```text
.pfa.json
```

Internamente:

```json
{
  "format": "prompt-flow-accelerator-project",
  "formatVersion": "2.0.0",

  "exportedAt": "...",

  "project": {},
  "versions": [],
  "evaluations": [],
  "refinements": [],
  "comparisons": []
}
```

---

# 79. Importación

Proceso:

```text
Leer archivo
↓
Validar formatVersion
↓
Validar IDs
↓
Detectar colisiones
↓
Generar nuevos IDs si hace falta
↓
Importar
```

---

# 80. Export completo

También permitir:

```text
Exportar todos los proyectos
```

para backup.

---

# 81. StorageManager

Responsabilidades:

```javascript
init()
migrate()

createProject()
updateProject()
getProject()

createVersion()
getVersions()

saveEvaluation()
saveRefinement()
saveComparison()

createRequest()
completeRequest()

exportProject()
importProject()
```

---

# 82. ProjectManager

Responsable de reglas del dominio.

```javascript
createProject()

createVersion()

setActiveVersion()

archiveProject()

getProjectGraph()
```

---

# 83. WorkflowEngine

Responsable de:

```javascript
getState(project)

can(event)

dispatch(event)

getPrimaryAction()
```

Ejemplo:

```javascript
getPrimaryAction()
```

puede devolver:

```javascript
{
  type: "REFINE",
  label: "Refinar Prompt"
}
```

---

# 84. PackageBuilder

Ya definido.

Debe recibir datos estructurados.

Nunca leer directamente elementos del DOM.

```text
DOM
↓
Controller
↓
Domain
↓
PackageBuilder
```

---

# 85. ResponseParser

Responsable únicamente de:

```text
extraer
parsear
validar
```

No guardar.

---

# 86. SchemaValidator

Responsable de:

```text
PFA Evaluation
PFA Refinement
PFA Comparison
```

Inicialmente podemos implementar validación manual ligera.

No necesitamos introducir una gran dependencia externa.

---

# 87. DiffEngine

Responsable de:

```text
lineDiff
wordCount
charCount
percentageChange
```

---

# 88. PromptLinter

Primera versión determinística.

Reglas iniciales:

```text
EMPTY_PLACEHOLDER
UNFINISHED_PLACEHOLDER
DUPLICATE_LINE
EXTREME_LENGTH
UNBALANCED_CODE_FENCE
UNBALANCED_XML_TAG
CONFLICTING_LENGTH_RULE
MISSING_ATTACHMENT_REFERENCE
```

No intentaremos resolver semántica compleja localmente.

El LLM hará el lint profundo.

---

# 89. UIController

Responsable de:

```text
render
dialogs
toasts
navigation
forms
```

No contiene lógica de evaluación.

---

# 90. EventBus

Aunque todo esté en un HTML, conviene separar componentes mediante eventos.

Ejemplo:

```text
evaluation:imported
version:created
comparison:completed
project:changed
```

Esto reducirá acoplamiento.

---

# 91. Arquitectura lógica JavaScript

```text
PFAApp
│
├── Data
│   └── StorageManager
│
├── Domain
│   ├── ProjectManager
│   ├── VersionManager
│   └── WorkflowEngine
│
├── Prompt Intelligence
│   ├── PromptLinter
│   ├── PackageBuilder
│   ├── ResponseParser
│   └── SchemaValidator
│
├── Utilities
│   ├── DiffEngine
│   ├── IdGenerator
│   ├── Clipboard
│   └── ExportImport
│
└── UI
    ├── AppShell
    ├── PromptView
    ├── AnalysisView
    ├── VersionsView
    ├── TransferModal
    └── SettingsModal
```

---

# 92. Aunque sea un solo index.html

La primera implementación puede seguir siendo:

```text
index.html
```

pero el código deberá estar dividido internamente:

```javascript
// Constants
// Schemas
// Storage
// Domain
// PIP
// Linter
// Diff
// UI
// App bootstrap
```

Esto facilitará separar archivos posteriormente.

---

# 93. Orden del código

Dentro del HTML:

```text
1. HTML shell

2. CSS variables

3. Layout

4. Components

5. Templates / icons

6. Constants

7. Schemas

8. Utilities

9. IndexedDB

10. Domain models

11. Workflow engine

12. PackageBuilder

13. ResponseParser

14. Linter

15. DiffEngine

16. UI controllers

17. Event handlers

18. App bootstrap
```

---

# 94. Tokens de diseño

Mantendría el ADN visual actual:

```text
dark
gradients
glass
azul/violeta
```

pero reduciría decoración.

La UI debe sentirse más como:

```text
herramienta de ingeniería
```

y menos como:

```text
landing page
```

---

# 95. Colores funcionales

Variables semánticas:

```text
--success
--warning
--danger
--info
--muted
```

No utilizar colores únicamente decorativos para estados.

---

# 96. Estados visuales

```text
PASS      → success
WARNING   → warning
FAIL      → danger
N/A       → muted
```

---

# 97. Responsive

Desktop:

```text
sidebar + workspace + context
```

Tablet:

```text
sidebar compacta + workspace
```

Mobile:

```text
workspace
+
navigation inferior
```

---

# 98. Accesibilidad

MVP debe incluir:

```text
labels reales
keyboard navigation
focus visible
aria-live para toasts
contraste
botones semánticos
```

No depender exclusivamente del color.

---

# 99. Atajos

Conservar:

```text
Ctrl/Cmd + Enter
```

para acción principal.

Añadir:

```text
Ctrl/Cmd + S
```

puede mostrar:

```text
Guardado automáticamente
```

sin crear versiones.

---

# 100. ErrorBoundary lógico

JavaScript vanilla no tiene React ErrorBoundary.

Pero podemos envolver acciones importantes:

```javascript
try {
  ...
} catch (error) {
  handleAppError(error)
}
```

---

# 101. Error log local

Para debugging:

```text
console
```

y opcionalmente un array temporal.

No necesitamos persistir logs extensos.

---

# 102. Empty states

Ejemplo:

```text
Todavía no existen evaluaciones.

Analiza una versión para comenzar.
```

Nunca mostrar paneles vacíos confusos.

---

# 103. Progressive disclosure

Funciones avanzadas permanecen ocultas inicialmente.

Ejemplo:

```text
▸ Ver criterios activos
▸ Ver JSON PFA_DATA
▸ Ver reporte completo
```

La interfaz principal muestra solo lo necesario.

---

# 104. Seguridad de rendering

Todo texto importado del LLM debe renderizarse como:

```text
textContent
```

o Markdown sanitizado.

Nunca:

```javascript
innerHTML = rawLLMResponse
```

sin sanitización.

---

# 105. Protección de JSON

Nunca ejecutar contenido importado.

Solo:

```javascript
JSON.parse()
```

No utilizar:

```javascript
eval()
```

bajo ninguna circunstancia.

---

# 106. Clipboard

Fallback:

```text
navigator.clipboard
```

si falla:

```text
seleccionar texto
+
copiar manualmente
```

---

# 107. Compatibilidad sin HTTPS

Clipboard API puede tener restricciones según contexto.

Debemos contemplar:

```text
botón copiar
+
textarea/select fallback
```

para que el HTML local siga funcionando.

---

# 108. PWA

No la considero necesaria para el primer MVP.

Puede añadirse después.

El núcleo funciona como HTML local.

---

# 109. Dependencias

Objetivo:

```text
0 dependencias obligatorias
```

en primera versión.

Podemos implementar:

* IndexedDB;
* diff básico;
* schemas básicos;

con JavaScript nativo.

---

# 110. Estrategia de migración

IndexedDB tendrá:

```text
DB_VERSION = 1
```

Futuro:

```text
DB_VERSION = 2
```

Ejemplo:

```javascript
if (oldVersion < 2) {
  // migration
}
```

Nunca romper datos antiguos.

---

# 111. Modelo de migraciones

```text
v1
projects
versions
evaluations
refinements
comparisons
requests
settings
```

Posteriormente:

```text
v2
tests
testRuns
```

---

# 112. Derivaciones

Algunos datos NO necesitan persistirse porque pueden calcularse.

Ejemplo:

```text
wordCount
charCount
```

pueden calcularse.

Pero podemos almacenarlos como cache.

Fuente de verdad:

```text
content
```

---

# 113. Source of truth

Cada dato debe tener una fuente clara.

Ejemplo:

```text
Prompt
→ Version.content

Score
→ Evaluation.parsedData.score

Workflow
→ artefactos + project.workflowState

Diff
→ Version A.content + Version B.content
```

---

# 114. No duplicación innecesaria

No copiar todo el prompt dentro de:

```text
Evaluation
Refinement
Comparison
```

Utilizar IDs.

Esto evita inconsistencias.

---

# 115. Primera carga

```text
DOM ready
↓
StorageManager.init()
↓
loadSettings()
↓
loadLastProject()
↓
deriveWorkflow()
↓
render()
```

---

# 116. Sin proyectos

Mostrar:

```text
⚡ Prompt Flow Accelerator

Convierte un prompt en un proceso
de mejora verificable.

[ Nuevo proyecto ]
```

---

# 117. Crear proyecto

Modal pequeño:

```text
Nombre
(opcional)

Prompt
```

El título puede autogenerarse con:

```text
primeras palabras del prompt
```

sin usar IA.

---

# 118. Carga del proyecto

```text
load project
↓
load versions
↓
load artifacts
↓
derive active state
↓
render
```

---

# 119. Auto-recuperación

Si el navegador se cierra mientras existe:

```text
WAITING_EVALUATION
```

al regresar PFA debe mostrar:

```text
Tienes una evaluación pendiente.

[ Continuar ]
[ Cancelar ]
```

Gracias a `requests`.

---

# 120. Requests simultáneas

Permitiremos varias requests entre proyectos.

Pero solamente una request activa por:

```text
proyecto + operación + versión
```

Ejemplo:

No crear dos evaluaciones pendientes idénticas accidentalmente.

---

# 121. Cancelar request

No elimina versiones.

Solo:

```text
status = CANCELLED
```

---

# 122. Repetir evaluación

Permitido.

Generará:

```text
E1
E2
```

para la misma versión.

Esto puede ser útil posteriormente para medir variabilidad.

En el MVP:

PFA marca una como:

```text
primary
```

o utiliza la más reciente.

---

# 123. Reevaluación real

Importante:

Reevaluar V2 significa volver a utilizar:

```text
CONST_RUBRICA_V2
```

No utilizar el Comparador como sustituto del evaluador.

Así mantenemos:

```text
V1 → E1
V2 → E2
```

y luego:

```text
E1 + E2 → Comparison
```

---

# 124. Separación de responsabilidades

```text
Evaluator
¿cómo está diseñado este prompt?

Refiner
¿qué cambio debería aplicarse?

Comparator
¿qué cambió entre las versiones?

Tester
¿funciona realmente mejor?
```

Esta separación es fundamental.

---

# 125. Criterio de implementación del MVP

El MVP estará terminado cuando podamos ejecutar este flujo completo:

```text
1. Crear proyecto

2. Introducir V1

3. Generar paquete de evaluación

4. Importar E1

5. Visualizar diagnóstico

6. Generar paquete de refinamiento

7. Importar V2

8. Mostrar diff V1/V2

9. Reevaluar V2

10. Importar E2

11. Generar comparación

12. Importar Comparison

13. Mostrar mejoras/regresiones

14. Adoptar versión

15. Cerrar navegador

16. Abrirlo nuevamente

17. Continuar exactamente donde estaba
```

---

# 126. Criterios de aceptación

## Persistencia

Cerrar/reabrir no pierde información.

## Trazabilidad

Toda evaluación conoce su versión.

## Integridad

Toda respuesta se valida mediante requestId.

## Reproducibilidad

Las versiones evaluadas nunca cambian.

## Independencia

PFA funciona con cualquier LLM capaz de seguir el protocolo.

## Simplicidad

No requiere cuentas, backend ni API keys.

## Transparencia

Siempre diferencia evaluación estructural de evidencia conductual.

---

# 127. Lo que NO pertenece al MVP

No implementar todavía:

```text
API OpenAI
API Anthropic
API Gemini
login
cloud sync
equipos
RAG
agentes
vector database
observability
automatic prompt optimization
automatic judge
billing
```

---

# 128. Fase 2

Después del MVP:

```text
Tests
Assertions
Test Runs
Comparación conductual
```

Esto coincide con el roadmap de la investigación: primero fundamentos y experiencia local; después testing y evidencia; conectividad más adelante.

---

# 129. Fase 3

Opcional:

```text
Connected Mode
```

mediante:

```text
Gateway
↓
Providers
```

sin romper el modo manual.

---

# 130. Filosofía final del código

La aplicación no debe construirse alrededor de:

```text
botones
```

Debe construirse alrededor de:

```text
PROJECT
VERSION
EVALUATION
REFINEMENT
COMPARISON
REQUEST
```

La interfaz será solamente una representación de ese modelo.

---

# 131. Arquitectura final

```text
                         PFA 2.0
                            │
              ┌─────────────┴─────────────┐
              │                           │
             UI                        DOMAIN
              │                           │
              │                    Workflow Engine
              │                           │
              └───────────┬───────────────┘
                          │
                     SERVICES
                          │
        ┌─────────────────┼─────────────────┐
        │                 │                 │
 PackageBuilder     ResponseParser       Linter
        │                 │                 │
        └─────────────────┼─────────────────┘
                          │
                     STORAGE
                          │
                      IndexedDB
                          │
        ┌─────────────────┼─────────────────┐
        │                 │                 │
    Projects          Versions          Artifacts
```

---

# 132. Resultado

Prompt Flow Accelerator 2.0 deja de ser:

> dos botones que preparan texto para otro LLM.

Y pasa a ser:

> **un sistema local de ingeniería de prompts que conserva estado, administra versiones, orquesta evaluación y refinamiento, compara cambios y construye evidencia progresiva sobre la calidad del prompt.**

Pero conserva exactamente la característica que originó el proyecto:

> **el LLM sigue siendo externo y el usuario mantiene el control.**

---

# 133. Estado del diseño

Con esta especificación quedan definidos:

* metodología de evaluación;
* rúbrica adaptativa;
* refinador;
* comparador;
* protocolo PIP 2.0;
* schemas;
* almacenamiento;
* versionado;
* requests;
* workflow;
* estados;
* arquitectura UI;
* arquitectura JavaScript;
* persistencia;
* validación;
* importación/exportación;
* criterios del MVP.

Por lo tanto:

> **Prompt Flow Accelerator 2.0 ya está suficientemente especificado para comenzar la implementación.**
