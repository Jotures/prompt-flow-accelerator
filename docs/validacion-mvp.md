# Validación del MVP

Validado el 22 de septiembre de 2026 (hora de Bogotá) con Node.js y Google Chrome en Windows. El navegador abre `index.html` directamente mediante `file://`; utiliza datos sintéticos y perfiles aislados.

## Resultado

Ampliación de Pruebas (fase 2): `tests/testing.test.cjs` verifica comprobaciones, revisión humana pendiente, esquemas limitados, regresiones, copias inmutables del caso, evidencia vinculada, migración desde IndexedDB v1 y copias con colisiones. Rechaza resultados alterados y conteos conductuales inventados.

`tests/testing-browser.cjs` recorre la interfaz desde crear el caso hasta importar una comparación con evidencia; verifica guardar/reabrir borradores, repetir, editar el caso sin alterar ejecuciones anteriores, escritorio/móvil y exportar/importar. Ejecuta una regex patológica en un Worker para comprobar que termina por tiempo sin bloquear la página. Los datos son sintéticos y no demuestran mejoras de un modelo real.

Registro de la validación inicial del MVP:

- Construcción del HTML autónomo completada.
- 12 pruebas de dominio y persistencia aprobadas (`npm test`).
- 11 escenarios de interfaz aprobados, agrupados en dos recorridos (`npm run test:e2e`).
- Sin errores JavaScript en ambos recorridos. El recorrido principal no registró solicitudes de red.

## Criterios de aceptación

| Criterio | Evidencia comprobada |
|---|---|
| Flujo completo | Crear proyecto, congelar V1, importar E1, refinar a V2, mostrar diff, importar E2 independiente, comparar y adoptar explícitamente. |
| Persistencia | Cerrar y relanzar Chrome conserva el borrador, la respuesta parcial, la solicitud pendiente, las versiones y sus relaciones. |
| Trazabilidad e integridad | Rechazo de respuestas con IDs ajenos, schema incorrecto, JSON inválido o bloques duplicados. |
| Versiones inmutables | Editar, refinar y restaurar generan versiones nuevas; cancelar una operación preserva las anteriores. |
| Rúbrica adaptativa | 61 criterios asignados sin duplicación, N/A excluido del cálculo, total ponderado recalculado y bloqueo por información indispensable ausente. |
| Reevaluación comparable | Se conservan la configuración, la clasificación y las dimensiones aplicables. Repetir una evaluación invalida la decisión basada en una comparación anterior. |
| Transparencia | Se distingue estructura de conducta. Sin ejecuciones adjuntas se rechaza evidencia conductual; con ellas se validan referencias, conteos y respaldo del resultado. Las sugerencias no cuentan como pruebas ejecutadas. |
| Recuperación de errores | Reporte manual conservado, respuesta inválida recuperable, reparación de formato disponible y copia manual cuando se bloquea el portapapeles. |
| Copias de seguridad | Exportación de uno y varios proyectos; importación atómica; colisiones remapeadas; recuperación de solicitudes pendientes al importar sin colisiones. |
| Gestión | Proyectos independientes, archivo/restauración, repetición de evaluaciones, historial accesible y conservación explícita del original. |
| Interfaz | Temas claro/oscuro, tamaños de escritorio/tablet/móvil sin desbordamiento horizontal, diálogo móvil, atajos y cierre con Escape. |
| Contenido importado | Un prompt con etiquetas HTML y script se muestra como texto y no ejecuta código. |

## Archivos de evidencia

- `tests/core.test.cjs`: pruebas de dominio e IndexedDB con `fake-indexeddb`.
- `tests/browser.cjs`: ciclo completo y reapertura con Chrome real.
- `tests/management.cjs`: proyectos, historial, comparaciones antiguas y recuperación desde copias.
- `test-results/verification.json` y `test-results/management-verification.json`: resultados de la última ejecución; esta carpeta está excluida de Git.
- `test-results/*.png`: capturas de revisión visual.

## Límites de esta validación

Las respuestas PIP son fixtures sintéticos. Estas pruebas validan la aplicación y el protocolo, no la calidad del análisis de un LLM ni su cumplimiento del formato. No se realizaron sesiones con proveedores externos ni pruebas específicas en Firefox, Edge o dispositivos móviles físicos.

La fase 2 añade registro de ejecuciones manuales, comprobaciones locales y comparación con evidencia adjunta. La aplicación no conecta con proveedores ni acredita que una respuesta pegada provenga del modelo declarado.

## Pulido de la interfaz — 23 de septiembre de 2026

Se refinó la presentación y la comodidad del flujo existente: editor ampliable, opciones de análisis que conservan su apertura, reevaluación visible en el progreso, ventana de intercambio con acciones fijas, confirmación de copia junto al botón, avisos que pueden cerrarse y etiquetas de versión en uso. La rúbrica, los metaprompts, el protocolo y el modelo de almacenamiento permanecen intactos.

El recorrido de gestión comprueba además que ampliar el editor conserva el texto, cambiar la configuración mantiene abiertas sus opciones, una respuesta vacía no activa la importación, Escape devuelve el foco a la acción de origen y el botón de importar permanece fijo al desplazar el diálogo móvil. Se revisaron capturas de escritorio, móvil y ambos temas.

## Corrección de la segunda iteración — 23 de septiembre de 2026

Se reprodujo un fallo de conservación del texto: al insertar el prompt directamente entre las etiquetas `textarea`, el parser HTML descartaba un salto de línea inicial. El guardado posterior interpretaba esa diferencia como una edición y podía crear una versión manual al intentar continuar con el refinamiento.

Los campos se cargan ahora mediante su propiedad `value`. El guardado del borrador comprueba si el usuario cambió el valor mostrado antes de persistirlo. También se preservan las líneas iniciales de respuestas pendientes, la copia manual y los reportes completos.

La interfaz identifica textos idénticos y diferencias limitadas a líneas vacías en los extremos. Esta comprobación conserva la indentación, los espacios y las líneas vacías internas; no declara equivalencia semántica de otros cambios. Los porcentajes pequeños se muestran con precisión suficiente para evitar `−0 %`.

`tests/iteration.cjs` reproduce un ciclo V1 → V2 → V3 desde la interfaz: el segundo paquete usa `REFINE`, la evaluación de V2 y un ID nuevo; no se genera una edición manual involuntaria. Verifica además respuestas parciales, copia manual, reapertura y la explicación de diferencias por líneas vacías. Las pruebas de dominio comprueban tanto refinamientos sin cambios como respuestas distintas, con evaluaciones independientes.

## Vinculación de hipótesis — 23 de septiembre de 2026

Las comprobaciones pueden vincular una hipótesis de un refinamiento concreto. Las pruebas de dominio verifican separación entre ciclos con H1 repetida, uso de la evaluación original, versiones exactas, snapshots, pendientes, empates, regresiones, límites de confirmación, solicitudes anteriores y exportación/importación con colisiones. El flujo de navegador comprueba selección del vínculo, conservación al añadir checks, resultados, comparación con hipótesis confirmada en el fixture y recuperación de la copia. Se revisa también el editor en viewport móvil.

Los fixtures siguen siendo sintéticos: esta validación acredita el transporte, la persistencia y las reglas de respaldo, no una mejora real del modelo ni causalidad del cambio.
