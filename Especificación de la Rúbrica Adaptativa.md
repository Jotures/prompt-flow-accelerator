# Prompt Flow Accelerator 2.0

## Especificación de la Rúbrica Adaptativa

### 1. Objetivo

La nueva rúbrica de Prompt Flow Accelerator debe responder:

> **¿Qué necesita este prompt concreto para funcionar correctamente en esta tarea concreta?**

No debe responder:

> ¿Cuántas técnicas de prompt engineering contiene?

La rúbrica funcionará como una **biblioteca de criterios activables**, no como una checklist fija.

---

# 2. Arquitectura general

La evaluación tendrá cuatro componentes:

**CORE UNIVERSAL**
Criterios fundamentales que casi siempre importan.

**MÓDULOS ADAPTATIVOS**
Se activan según el tipo de tarea.

**GATES CRÍTICOS**
Problemas capaces de invalidar el prompt aunque la puntuación general sea alta.

**CRITERIOS N/A**
Elementos legítimamente irrelevantes para una tarea determinada.

Esto sigue la arquitectura en capas propuesta por la investigación: Core universal + módulos adaptativos + gates críticos.

---

# 3. Clasificación inicial del prompt

Antes de evaluar, PFA clasifica la tarea.

Perfiles principales:

| Código      | Perfil                                         |
| ----------- | ---------------------------------------------- |
| `WRITE`     | Escritura / comunicación                       |
| `TRANSFORM` | Resumen / transformación                       |
| `EXTRACT`   | Extracción / clasificación                     |
| `ANALYZE`   | Análisis / razonamiento                        |
| `RESEARCH`  | Investigación / factual                        |
| `CODE`      | Programación                                   |
| `LEARN`     | Aprendizaje / tutoría                          |
| `CREATE`    | Creatividad / ideación                         |
| `AGENT`     | Agente / multiturno                            |
| `DEEP`      | Deep Research / RAG / uso intensivo de fuentes |
| `GENERAL`   | Tarea general/no clasificada                   |

Un prompt puede pertenecer a varios perfiles.

Ejemplo:

```text
RESEARCH   0.72
ANALYZE    0.21
WRITE      0.07
```

PFA propone la clasificación y el usuario puede modificarla.

---

# 4. Core Universal

Estos criterios forman el corazón de cualquier evaluación.

| ID    | Criterio            | Pregunta                                                           |
| ----- | ------------------- | ------------------------------------------------------------------ |
| `C01` | Objetivo            | ¿Está claro qué resultado se busca?                                |
| `C02` | Tarea explícita     | ¿Está claro qué debe hacer el modelo?                              |
| `C03` | Claridad            | ¿Las instrucciones son suficientemente precisas?                   |
| `C04` | Consistencia        | ¿Existen contradicciones o prioridades incompatibles?              |
| `C05` | Contexto suficiente | ¿Dispone el modelo de la información necesaria?                    |
| `C06` | Viabilidad          | ¿Puede realmente ejecutarse la tarea con los recursos disponibles? |
| `C07` | Criterios de éxito  | ¿Es posible saber cuándo la respuesta es satisfactoria?            |
| `C08` | Eficiencia          | ¿Existe complejidad, redundancia o longitud innecesaria?           |

No significa que todos tengan siempre el mismo peso.

Por ejemplo, en extracción estructurada `C04` y `C07` pueden ser mucho más importantes que `C08`.

---

# 5. Módulo de Output

Se activa cuando el usuario espera una salida concreta.

| ID    | Criterio                              |
| ----- | ------------------------------------- |
| `O01` | Formato solicitado claramente         |
| `O02` | Estructura de salida definida         |
| `O03` | Restricciones de longitud             |
| `O04` | Schema/JSON/tablas cuando corresponda |
| `O05` | Validabilidad del output              |

Ejemplo:

```text
Perfil: EXTRACT

O01 Activo
O02 Activo
O03 N/A
O04 Crítico
O05 Activo
```

---

# 6. Módulo Investigación / Factualidad

Se activa con `RESEARCH` y `DEEP`.

| ID    | Criterio                                         |
| ----- | ------------------------------------------------ |
| `R01` | Requisitos de fuentes                            |
| `R02` | Grounding en evidencia                           |
| `R03` | Política ante información insuficiente           |
| `R04` | Manejo de incertidumbre                          |
| `R05` | Actualidad temporal                              |
| `R06` | Distinción entre hechos, inferencias y opiniones |
| `R07` | Límites de conocimiento                          |
| `R08` | Verificabilidad/citas                            |

Aquí entrarían muchos de los antiguos criterios de minimización de alucinaciones, incertidumbre y divulgación de limitaciones.

---

# 7. Módulo Programación

Se activa con `CODE`.

| ID    | Criterio                               |
| ----- | -------------------------------------- |
| `P01` | Lenguaje/framework definido            |
| `P02` | Entorno y dependencias                 |
| `P03` | Entradas                               |
| `P04` | Salidas                                |
| `P05` | Restricciones técnicas                 |
| `P06` | Manejo de errores                      |
| `P07` | Casos límite                           |
| `P08` | Criterio verificable de funcionamiento |

Un prompt de programación no debería perder puntos porque carece de resonancia emocional, cambio de marco hipotético o pensamiento divergente.

---

# 8. Módulo Escritura / Comunicación

Se activa con `WRITE`.

| ID    | Criterio                         |
| ----- | -------------------------------- |
| `W01` | Audiencia                        |
| `W02` | Propósito comunicativo           |
| `W03` | Tono                             |
| `W04` | Estilo                           |
| `W05` | Voz/perspectiva                  |
| `W06` | Longitud                         |
| `W07` | Resonancia emocional, si procede |

Aquí la resonancia emocional sí puede importar.

En extracción JSON:

```text
W07 = N/A
```

---

# 9. Módulo Creatividad

Se activa con `CREATE`.

| ID     | Criterio                    |
| ------ | --------------------------- |
| `CR01` | Espacio creativo suficiente |
| `CR02` | Restricciones creativas     |
| `CR03` | Diversidad de alternativas  |
| `CR04` | Pensamiento divergente      |
| `CR05` | Criterios para converger    |
| `CR06` | Referencias estilísticas    |

Aquí se recupera el antiguo criterio de pensamiento divergente/convergente sin imponerlo al resto de prompts.

---

# 10. Módulo Aprendizaje / Tutoría

Se activa con `LEARN`.

| ID    | Criterio                    |
| ----- | --------------------------- |
| `L01` | Nivel actual del estudiante |
| `L02` | Objetivo de aprendizaje     |
| `L03` | Complejidad progresiva      |
| `L04` | Explicación + práctica      |
| `L05` | Feedback                    |
| `L06` | Verificación de comprensión |
| `L07` | Adaptación al desempeño     |

La antigua “complejidad progresiva” deja de ser una regla universal y pasa a su contexto correcto.

---

# 11. Módulo Agentes / Multiturno

Se activa con `AGENT`.

| ID    | Criterio                       |
| ----- | ------------------------------ |
| `A01` | Estado/memoria                 |
| `A02` | Herramientas disponibles       |
| `A03` | Límites de autonomía           |
| `A04` | Manejo de fallos               |
| `A05` | Condiciones de parada          |
| `A06` | Autorreparación                |
| `A07` | Confirmaciones necesarias      |
| `A08` | Manejo de inputs no confiables |

Aquí encajan memoria y self-repair loops de la rúbrica original.

---

# 12. Módulo de Modelo

Se activa cuando existe un modelo objetivo conocido.

| ID    | Criterio                                |
| ----- | --------------------------------------- |
| `M01` | Compatibilidad con la familia de modelo |
| `M02` | Técnicas adecuadas al modelo            |
| `M03` | Longitud/context window razonables      |
| `M04` | Capacidades requeridas disponibles      |

La investigación concluye que las técnicas adecuadas cambian entre familias y generaciones de modelos. Por ello técnicas como chain-of-thought explícito no deben ser universales.

---

# 13. Gates críticos

Los gates no funcionan como una puntuación.

Funcionan como:

```text
PASS
WARNING
FAIL
```

### G01 — Contradicción crítica

Ejemplo:

```text
Máximo 200 palabras.
Escribe como mínimo 800 palabras.
```

Resultado:

**FAIL**

---

### G02 — Información indispensable ausente

Ejemplo:

```text
Analiza el documento adjunto.
```

pero no existe documento.

Resultado:

**FAIL**

---

### G03 — Tarea imposible

El prompt solicita capacidades que el modelo o entorno no posee.

Resultado:

**FAIL**

---

### G04 — Output incompatible

Ejemplo:

```text
Devuelve solamente JSON válido.
Incluye después una explicación detallada.
```

Resultado:

**FAIL/WARNING**

---

### G05 — Restricciones mutuamente incompatibles

Resultado:

**FAIL**

---

### G06 — Riesgo grave de interpretación

La ambigüedad afecta directamente el objetivo central.

Resultado:

**WARNING/FAIL**

---

### G07 — Frontera instrucciones/datos insegura

Especialmente relevante si documentos o inputs externos podrían contener instrucciones.

Resultado:

**WARNING**

---

# 14. Sistema de puntuación

Mantendría la escala `1–5` del PFA original porque es fácil de entender.

Pero cambiaría completamente su significado agregado.

### Escala

| Nota | Significado                             |
| ---: | --------------------------------------- |
|    1 | Deficiente / afecta seriamente la tarea |
|    2 | Insuficiente                            |
|    3 | Aceptable pero mejorable                |
|    4 | Bien resuelto                           |
|    5 | Muy bien resuelto                       |
|  N/A | No corresponde a esta tarea             |

El `N/A` nunca reduce la puntuación.

---

# 15. Dimensiones finales

Los criterios activos se agrupan en dimensiones.

| Dimensión                 | Peso base |
| ------------------------- | --------: |
| Intención, tarea y éxito  |        20 |
| Claridad y consistencia   |        15 |
| Contexto y grounding      |        15 |
| Output                    |        10 |
| Robustez y validabilidad  |        15 |
| Adecuación tarea/modelo   |        10 |
| Seguridad aplicable       |        10 |
| Eficiencia/mantenibilidad |         5 |

**Total: 100**

Estos pesos son parámetros iniciales de diseño, no verdades científicas; el propio informe advierte que deben validarse experimentalmente.

---

# 16. Resultado de evaluación

PFA nunca debería mostrar solamente:

```text
87/100
```

Debe mostrar primero el perfil.

Ejemplo:

```text
TIPO DETECTADO
Investigación factual
Confianza: alta

GATES
✓ Sin contradicciones críticas
✓ Tarea viable
⚠ Política de incertidumbre ausente

DIMENSIONES

Intención y tarea............. 92
Claridad...................... 88
Contexto/grounding............ 64
Output........................ 91
Robustez...................... 52
Modelo........................ 81
Eficiencia.................... 77

Score estructural indicativo
76/100

Confianza de evaluación
Media

IMPORTANTE
Este resultado evalúa la estructura del prompt.
No demuestra todavía que genere mejores respuestas.
```

---

# 17. Diagnóstico prioritario

Después del score, el evaluador debe seleccionar solamente los problemas de mayor impacto.

No:

```text
35 recomendaciones
```

Sí:

```text
PROBLEMAS PRIORITARIOS

CRÍTICO
No existe una política para información no encontrada.

ALTO
Las fuentes están mezcladas con las instrucciones.

MEDIO
El formato de citas no está definido.
```

Cada problema tendrá:

```text
Problema
↓
Evidencia
↓
Consecuencia probable
↓
Cambio recomendado
↓
Cómo comprobarlo
```

---

# 18. Nuevo principio de refinamiento

Cada recomendación debe corresponder a una de cinco operaciones:

```text
AÑADIR
ACLARAR
REORGANIZAR
ELIMINAR
NO CAMBIAR
```

Esto evita la tendencia de los refinadores a hacer todos los prompts más largos.

La investigación recomienda explícitamente un enfoque:

> diagnóstico → hipótesis → cambio mínimo.

Ejemplo:

```text
CRITERIO
R03 — Política ante información insuficiente

PROBLEMA
El prompt exige responder usando exclusivamente fuentes,
pero no especifica qué hacer cuando la respuesta no aparece.

HIPÓTESIS
El modelo podría rellenar la ausencia mediante inferencia.

OPERACIÓN
AÑADIR

CAMBIO PROPUESTO
"Si las fuentes proporcionadas no contienen evidencia
suficiente para responder, indícalo explícitamente y no
infieras una respuesta."

TEST
Utilizar un caso donde la respuesta no exista.
```

---

# 19. Conversión de los 35 criterios actuales

No los vamos a destruir.

Su evolución sería:

|  # | Criterio original           | PFA 2.0                      |
| -: | --------------------------- | ---------------------------- |
|  1 | Claridad/especificidad      | `C03` Core                   |
|  2 | Contexto                    | `C05` Core                   |
|  3 | Tarea explícita             | `C02` Core                   |
|  4 | Viabilidad                  | `C06` Core                   |
|  5 | Ambigüedad/contradicción    | `C04` + Gate                 |
|  6 | Ajuste modelo               | `M01`                        |
|  7 | Formato/output              | módulo Output                |
|  8 | Rol/persona                 | Condicional WRITE/AGENT      |
|  9 | Razonamiento paso a paso    | Condicional por modelo/tarea |
| 10 | Instrucciones estructuradas | Condicional por complejidad  |
| 11 | Brevedad/detalle            | `C08`                        |
| 12 | Iteración/refinamiento      | Workflow, no score universal |
| 13 | Ejemplos                    | Técnica condicional          |
| 14 | Incertidumbre               | `R03/R04`                    |
| 15 | Alucinaciones               | `R02/R03`                    |
| 16 | Límites de conocimiento     | `R07`                        |
| 17 | Audiencia                   | `W01`                        |
| 18 | Imitación de estilo         | `W04/W06`                    |
| 19 | Memoria                     | `A01`                        |
| 20 | Metacognición               | Experimental/condicional     |
| 21 | Divergente/convergente      | `CR04/CR05`                  |
| 22 | Reframing hipotético        | Técnica opcional             |
| 23 | Falla segura                | Gate / riesgo                |
| 24 | Complejidad progresiva      | `L03`                        |
| 25 | Métricas de evaluación      | `C07`                        |
| 26 | Calibración                 | RESEARCH/ANALYZE condicional |
| 27 | Validación de output        | `O05`                        |
| 28 | Tiempo/esfuerzo             | Fuera del score general      |
| 29 | Ética/sesgo                 | Módulo riesgo                |
| 30 | Limitaciones                | `R07`                        |
| 31 | Compresión/resumen          | TRANSFORM                    |
| 32 | Puente interdisciplinario   | Opcional ANALYZE             |
| 33 | Resonancia emocional        | `W07`                        |
| 34 | Riesgo de salida            | Módulo riesgo                |
| 35 | Autorreparación             | `A06`                        |

Así, **ninguno de los conocimientos acumulados se pierde**.

Cambia únicamente dónde y cuándo son utilizados.

---

# 20. Regla maestra del evaluador

La regla central de PFA 2.0 será:

> **La ausencia de una técnica de prompting no constituye un defecto salvo que esa técnica resuelva un problema relevante para la tarea evaluada.**

Ejemplos:

```text
No tiene persona.
→ ¿La tarea necesita persona?
→ No.
→ N/A.
```

```text
No contiene few-shot.
→ ¿El comportamiento puede expresarse con claridad sin ejemplos?
→ Sí.
→ N/A.
```

```text
No pide razonamiento paso a paso.
→ ¿Es necesario para esta tarea/modelo?
→ No.
→ N/A.
```

```text
No especifica qué hacer cuando faltan datos.
→ ¿La tarea depende de factualidad?
→ Sí.
→ Problema importante.
```

---

# 21. Orden del motor de evaluación

Internamente PFA debería trabajar así:

```text
INPUT
  ↓
NORMALIZAR
  ↓
LINT
  ↓
DETECTAR TAREA
  ↓
DETECTAR MODELO
  ↓
ACTIVAR CORE
  ↓
ACTIVAR MÓDULOS
  ↓
COMPROBAR GATES
  ↓
EVALUAR CRITERIOS ACTIVOS
  ↓
ASIGNAR N/A
  ↓
GENERAR PERFIL
  ↓
PRIORIZAR PROBLEMAS
  ↓
GENERAR HIPÓTESIS
  ↓
PROPONER CAMBIOS
```

---

# 22. Regla de complejidad

PFA debe tener una protección contra la sobreingeniería.

Antes de añadir una instrucción, el refinador debe preguntarse:

```text
¿Resuelve un problema real?

NO
→ no añadir.

SÍ
↓
¿Existe una solución más corta?

SÍ
→ usarla.
```

La meta no será maximizar la cantidad de instrucciones.

Será:

> **mínima especificación suficiente.**

---

# 23. Resultado conceptual

Con este rediseño, los 35 criterios dejan de ser:

```text
35 preguntas obligatorias
×
5 puntos
=
175
```

y pasan a ser:

```text
BIBLIOTECA DE CONOCIMIENTO
        ↓
TIPO DE TAREA
        ↓
CRITERIOS APLICABLES
        ↓
DIAGNÓSTICO
        ↓
CAMBIOS NECESARIOS
```

Este es, en mi opinión, el verdadero salto entre **Prompt Flow Accelerator 1.x y Prompt Flow Accelerator 2.0**.

No necesitamos que el evaluador sepa más técnicas.

Necesitamos que sepa **cuándo una técnica importa y cuándo no**.
