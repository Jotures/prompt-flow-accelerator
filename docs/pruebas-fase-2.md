# Pruebas locales — fase 2

El caso define entrada, contexto, resultado esperado y comprobaciones. Las sugerencias del refinador se convierten en borradores editables; no son resultados. Los tipos son normal, límite, adversarial y regresión.

Una ejecución A/B conserva una copia del caso y sus comprobaciones, las dos versiones exactas, el modelo declarado y las condiciones de ejecución. PFA prepara un texto por versión (prompt + contexto + entrada); el usuario lo ejecuta en conversaciones nuevas con el mismo modelo y pega ambas respuestas. El resultado esperado y las comprobaciones no se incluyen en el texto ejecutable. La procedencia se indica como ejecución manual declarada por el usuario.

Las ejecuciones se guardan como borradores recuperables. Al finalizar, quedan inmutables. Repetir crea una ejecución nueva; editar el caso aumenta su revisión y no altera ejecuciones previas.

Comprobaciones: contiene/no contiene (literal sensible a mayúsculas), JSON estricto, longitud en caracteres Unicode, expresión regular y esquema JSON local limitado. Los criterios semánticos requieren revisión humana explícita con nota, o quedan pendientes. No se ejecuta código de respuestas ni se llama a un juez. Las expresiones regulares se ejecutan en un Worker con límite de tiempo.

El esquema local admite type, properties, required, additionalProperties booleano, items, enum, minimum, maximum, minLength, maxLength, minItems y maxItems. Se rechazan otras palabras clave para no aparentar que fueron verificadas.

Cada comprobación devuelve PASS, FAIL, PENDING o ERROR. Un caso pasa solo si todas sus comprobaciones pasan; pendientes y errores nunca cuentan como aprobados. Las comparaciones muestran mejoras y regresiones por comprobación, empates e incertidumbre. No convierten una pequeña muestra en una garantía general. Los grupos se distinguen por modelo/condiciones y revisión del caso.

Las ejecuciones completas pueden adjuntarse explícitamente al comparador. El paquete incluye ambas respuestas, comprobaciones y valoraciones humanas, y una síntesis calculada localmente. El número de ejecuciones se verifica al importar. La nota estructural sigue separada. La adopción sigue siendo una decisión del usuario.

La selección de evidencia reúne todos los intentos de los casos activos en su revisión actual con las mismas versiones, modelo y condiciones. Una ejecución histórica reúne solo intentos de ese caso/revisión. El diálogo indica cuántos casos e intentos adjuntará. `testsExecuted` cuenta respuestas ejecutadas por versión (dos por intento A/B). Las comprobaciones pueden vincularse explícitamente a hipótesis del refinamiento. El contrato se detalla abajo.

Persistencia: IndexedDB v2 añade tests y testRuns. Las copias nuevas incluyen testingVersion: 1; copias antiguas sin esas colecciones se migran como vacías. Exportar/importar conserva casos, revisiones, respuestas y referencias. Las copias con colisiones remapean las referencias. Los datos de pruebas se validan antes de escribir.

## Hipótesis, comprobaciones y resultados

Cada comprobación admite `hypothesis: { refinementId, hypothesisId }` o ningún vínculo. La identidad incluye el refinamiento porque H1 puede repetirse en otros ciclos. Las hipótesis se recuperan de la evaluación original usada por ese refinamiento, aunque después se haya reevaluado la versión. Los identificadores ambiguos no se ofrecen para vincular. La selección es del usuario: convertir una sugerencia del refinador en caso no atribuye automáticamente una hipótesis.

El vínculo se guarda antes de preparar la ejecución y forma parte de su snapshot inmutable. Editar o quitar vínculos crea una nueva revisión del caso; nunca reclasifica los intentos anteriores. Las copias antiguas sin vínculos siguen funcionando. Las importaciones validan las referencias y remapean refinementId cuando hay colisiones.

Solo se atribuye evidencia cuando A y B coinciden, en ese orden, con origen y candidato del refinamiento. Las comprobaciones de otro ciclo siguen funcionando como checks generales, pero no aportan evidencia a esa hipótesis; la interfaz lo indica. Se pueden vincular varias comprobaciones de varios casos a una misma hipótesis.

Los paquetes nuevos con pruebas llevan `hypothesisEvidenceVersion: 1` en la solicitud. `TEST_RESULTS.hypotheses` incluye las hipótesis de origen, los resultados A/B vinculados (caso, revisión, intento, check y método), mejoras, regresiones, pendientes y `allowedResults`. Las solicitudes anteriores conservan NOT_TESTED para sus hipótesis.

Reglas de respaldo del resultado conductual:

- Sin comprobaciones vinculadas, o todas pendientes/error: solo NOT_TESTED.
- Sin mejoras FAIL → PASS: NOT_CONFIRMED o NOT_TESTED. Un empate PASS/PASS no demuestra una mejora.
- Con mejora y alguna regresión, fallo de B o comprobación pendiente/error: como máximo PARTIAL.
- Con mejora, B cumpliendo todas las comprobaciones vinculadas y sin incertidumbre: puede admitirse CONFIRMED.

Estas reglas limitan la afirmación del comparador; no confirman automáticamente una hipótesis. La IA debe valorar si los criterios miden el comportamiento esperado, justificar la conclusión en el reporte y usar NOT_TESTED cuando no sean pertinentes. Una confirmación se muestra como «Confirmada en estos casos»: no acredita causalidad, significación estadística ni generalización. El veredicto global sigue considerando todas las comprobaciones, incluidas las no vinculadas.

La importación exige cada hipótesis de origen exactamente una vez y rechaza resultados fuera de allowedResults. La vista de resultados muestra los checks vinculados; la comparación añade la conclusión importada. Las valoraciones humanas se identifican como tales.
