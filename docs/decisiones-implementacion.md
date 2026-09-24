# Decisiones de implementación del MVP

Este documento complementa los documentos de diseño originales. La especificación técnica del MVP y PIP 2.0 prevalecen sobre los ejemplos conceptuales anteriores.

## Alcance implementado

HTML autónomo y sin dependencias de ejecución. El código fuente se divide por responsabilidad y se integra con un script de construcción sin librerías. El prototipo original se conserva.

El MVP inicial utilizó siete stores. La fase 2 migra IndexedDB a v2 y añade `tests` y `testRuns` a `projects`, `versions`, `evaluations`, `refinements`, `comparisons`, `requests`, `settings`. Las escrituras de una operación ocurren en una sola transacción. Si falla la validación o el guardado, no se completa parcialmente la operación.

El estado visible se deriva de los artefactos y de la decisión del usuario. Los estados transitorios de la especificación se agrupan cuando no tienen una interacción visible propia. La creación del paquete equivale a una solicitud recuperable, aunque el portapapeles sea rechazado.

Se permite una operación pendiente por proyecto. Distintos proyectos pueden tener operaciones pendientes. Repetir la acción pendiente recupera su paquete, sin crear duplicados.

## Metodología y transporte

Los tres documentos de agentes aportan la metodología. `PackageBuilder` añade un contrato operativo con mayor especificidad que reemplaza sus antiguos placeholders XML y formatos de ejemplo.

- Cada paquete incluye el JSON Schema completo correspondiente.
- Los delimitadores se correlacionan con una solicitud única.
- El comparador recibe **E1 y E2 independientes**. No sustituye al evaluador ni vuelve a inventar sus notas.
- Las etiquetas V1/V2 de los metaprompts significan original/candidato del ciclo actual; los identificadores y las etiquetas reales pueden ser V3/V4, etc.
- El refinador conserva cercas Markdown que sean parte legítima del prompt. Se prohíbe envolver todo `PFA_PROMPT` en una cerca adicional, no el código interno.
- Cero problemas y cero cambios son resultados válidos. Las cuotas de observaciones de los borradores metodológicos no obligan a inventar defectos.

Los reportes siempre se guardan íntegros. El programa solo interpreta los bloques JSON validados. Las respuestas se muestran como texto escapado, nunca como HTML ejecutable.

## Rúbrica reproducible

El documento adaptativo amplía los 35 conceptos originales a **61 criterios identificados**. Se conserva esa biblioteca y se fija una asignación a ocho dimensiones en `PFA.DIMENSION_CRITERIA`, sin duplicar criterios. Los perfiles sin módulo exclusivo utilizan el core y los módulos pertinentes, sin introducir nuevos criterios implícitos.

Para los criterios activos, el metaprompt pide:

1. Calificar de 1 a 5.
2. Convertir a 0–100 con `(nota - 1) * 25`.
3. Promediar dentro de cada dimensión solamente sus criterios aplicables.
4. Informar la asignación y las notas individuales en el reporte humano.

La aplicación recibe las notas dimensionales y calcula:

`total = round(sum(nota_dimensión * peso) / sum(pesos_aplicables), 1 decimal)`.

Pesos: intención 20, claridad 15, contexto 15, salida 10, robustez 15, modelo 10, seguridad 10 y eficiencia 5. Una dimensión no aplicable requiere `score: null`. Una dimensión aplicable requiere un número; al menos una debe aplicar.

El total del LLM no es la fuente aritmética definitiva: se conserva en `rawResponse`; el total operativo es el calculado y se muestra una observación si difiere. Los conteos de lint también se obtienen de los hallazgos importados. Las notas por criterio siguen siendo evidencia textual; PIP 2.0 no las define como campos estructurados y el programa no afirma verificarlas automáticamente.

Una reevaluación derivada conserva la clasificación, las dimensiones aplicables y la configuración de su evaluación de referencia. Para cambiar el modelo o el objetivo, se crea un proyecto independiente. `GENERIC` implica que la dimensión de modelo es N/A. Un fallo de información indispensable impide refinar hasta añadir los datos faltantes.

## Versiones, borradores y orden

El borrador se guarda con debounce de 500 ms, sin crear una versión por tecla. La acción de analizar congela el texto. Una modificación, refinamiento o restauración crea otra versión. El contenido histórico nunca se sobrescribe.

Las versiones se ordenan por número. Los artefactos llevan una secuencia monotónica para no depender del orden alfabético de sus UUID ni de empates entre marcas de tiempo. Las solicitudes guardan referencias exactas a las evaluaciones utilizadas.

La versión adoptada es independiente del candidato en revisión. El comparador nunca modifica la adopción. El usuario puede conservar el original, adoptar el candidato o iniciar otra iteración.

## Respaldo y recuperación

La copia incluye solicitudes, reportes manuales y borradores, además de las entidades de la especificación. Esto permite recuperar operaciones pendientes al importar sin colisiones.

Una colisión crea un grafo nuevo: se remapean todos los identificadores internos y campos estructurados relacionados. `rawResponse` conserva el documento original como evidencia. Las solicitudes pendientes se cancelan y se regeneran posteriormente, porque la respuesta externa anterior contiene los identificadores originales.

Antes de escribir se validan esquema, IDs seguros, fechas, contenido, numeración, dependencias y coherencia de puntuaciones. Toda la importación es atómica. Se rechazan copias incompletas antes de persistir datos.

## Límites explícitos

- Prompt: 200.000 unidades UTF-16; respuesta: 2.000.000; copia: 15 MB. Los contadores visibles de caracteres usan puntos de código Unicode.
- La clasificación automática y el lint semántico los realiza la IA externa. El lint local muestra señales conservadoras, nunca afirma conocer adjuntos o capacidades externas.
- El diff usa líneas; para documentos cuya matriz supera un millón de celdas, conserva todo el contenido como eliminación/adición, evitando un cálculo cuadrático descontrolado.
- La fase 2 permite casos y ejecuciones A/B manuales, con comprobaciones locales y revisión humana. El contrato se detalla en `pruebas-fase-2.md`. Los paquetes de comparación solo admiten evidencia conductual cuando incluyen ejecuciones completas vinculadas. Cada check puede referenciar una hipótesis mediante refinementId e hypothesisId; solo aporta evidencia al par exacto origen/candidato. Los resultados permitidos se limitan por las mejoras, regresiones y pendientes de esos checks, sin inferir causalidad.
- IndexedDB guarda texto local sin cifrado propio. Borrar los datos del navegador borra los proyectos; las copias exportadas permiten recuperarlos.
- Se requiere un navegador moderno con IndexedDB. Si el almacenamiento falla, se informa del error sin fingir que se guardó.

## Evidencia de aceptación

Las pruebas de dominio cubren ciclo completo, validación de PIP, rechazo de datos ajenos, no aplicabilidad, gates, reevaluación controlada, preservación de versiones, cancelación, cálculo, orden e importación atómica.

Las pruebas de navegador abren el HTML local, manipulan la interfaz y comprueban cierre y reapertura reales, reportes inválidos/manuales, refinamiento, diff, comparación, adopción, restauración, exportación/importación, temas, móvil y fallback del portapapeles. Utilizan fixtures sintéticos identificados como tales; no prueban el desempeño de un modelo.
