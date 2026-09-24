# Prompt Flow Accelerator 2.0

La versión pública se abre en [GitHub Pages](https://jotures.github.io/prompt-flow-accelerator/). En iPhone, la navegación inferior, el editor y los diálogos se adaptan a pantallas pequeñas y respetan las zonas seguras. Los proyectos se guardan en el navegador y origen donde se crean: para trasladarlos desde otra dirección o dispositivo, exporta una copia e impórtala en el nuevo navegador.

Aplicación local para evaluar, refinar y comparar prompts con una IA externa. No requiere cuentas, servidor, claves API ni conexión a internet para utilizar la aplicación.

## Abrir

Abre **`index.html`** con Chrome, Edge o Firefox. El archivo incluye los estilos, el código, la rúbrica, los metaprompts y los schemas. No necesitas instalar Node ni descargar dependencias para usarlo.

Usa siempre el mismo navegador y la misma ubicación del archivo para conservar el acceso a su almacenamiento. El almacenamiento de una página local depende del navegador. Antes de trasladar el HTML, cambiar de navegador o borrar datos de navegación, utiliza **Exportar**.

El archivo `index (2) prmpt.html` conserva el prototipo original como referencia.

## Flujo de trabajo

1. Escribe un prompt. El borrador se guarda automáticamente después de 500 ms sin escribir; `Ctrl/Cmd + S` guarda de inmediato.
2. Pulsa **Analizar prompt**. Se congela una versión y se prepara un paquete de evaluación.
3. Copia el paquete, pégalo en una conversación con tu IA y copia **la respuesta completa**, incluido el bloque `PFA_DATA`.
4. Regresa a PFA e importa la respuesta. Revisa el diagnóstico, los controles críticos y las hipótesis.
5. Pulsa **Refinar Vn con IA** desde el análisis o el espacio de trabajo. El paquete incluye la versión y la evaluación exactas.
6. Importa el refinamiento. Se crea una nueva versión; la original permanece intacta.
7. **Reevalúa** la nueva versión con el evaluador independiente, e importa esa evaluación.
8. **Compara** ambas versiones, importa el resultado y decide si adoptar el candidato, conservar el original o iniciar otra iteración.

La aplicación conserva operaciones pendientes y borradores de respuesta. Puedes cerrar el diálogo y continuar más tarde. Espera a que termine el guardado antes de cerrar el navegador.

El botón **Ampliar editor**, junto a copiar, ofrece más espacio para prompts largos y conserva el borrador al cambiar de tamaño. Las opciones del análisis permanecen abiertas mientras ajustas la configuración. El indicador de progreso distingue la evaluación inicial de la reevaluación del candidato.

En la ventana de intercambio, los pasos para copiar y traer la respuesta están separados. **Importar respuesta** permanece visible al desplazarte y se activa cuando hay texto. Las opciones de recuperación se despliegan automáticamente si la importación falla.

Una versión puede proceder de un refinamiento de IA o de una edición manual. Si dos versiones son idénticas o solo difieren en líneas vacías al inicio o al final, PFA lo indica expresamente. Tras una comparación puedes elegir directamente **Refinar Vn con IA** (usa esa versión y su evaluación actual) o **Editar Vn manualmente**; la edición seguida de análisis crea una versión manual.

## Revisar las decisiones del refinador

En **Versiones**, los nuevos refinamientos distinguen aclaraciones, correcciones y propuestas de la IA. Cada cambio incluye una explicación y citas del prompt. Las prioridades o supuestos nuevos se muestran como propuestas pendientes. La clasificación es declarada por el refinador; las citas se comprueban contra los textos importados.

**Aceptar propuesta** registra una preferencia reversible, independiente de la puntuación y de la adopción del prompt. **Pedir ajuste** prepara un paquete con tu instrucción, el candidato completo y las demás propuestas aceptadas. Importarlo crea una nueva alternativa del original evaluado; conserva el candidato previo y exige reevaluar la nueva alternativa. El ajuste queda asociado al cambio y su solicitud en el historial.

Los informes anteriores aparecen como **Sin clasificar**. No se infiere su intención desde operaciones como “Añadir” o “Aclarar”. Las copias de seguridad conservan las revisiones y las solicitudes de ajuste.

## Respuestas que no se pueden importar

PFA valida JSON, schema, versión de protocolo, solicitud, proyecto y referencias entre versiones. Una respuesta de otra operación nunca se importa automáticamente.

- **Preparar reparación** crea una instrucción para corregir el formato sin repetir el análisis. Pégala en la misma conversación con tu IA.
- **Guardar solo como texto** conserva el reporte sin atribuirle una puntuación válida. El texto manual no desbloquea automáticamente el siguiente paso.
- Puedes cancelar la operación y continuar editando el prompt manualmente; analizar el nuevo borrador crea otra versión.
- Si falla el portapapeles, el paquete se muestra seleccionado para copiarlo con `Ctrl/Cmd + C`.

## Datos y privacidad

- Proyectos, versiones, evaluaciones, refinamientos, comparaciones, solicitudes, casos, ejecuciones y preferencias viven en **IndexedDB**, base `pfa-db`.
- No hay telemetría, fuentes remotas, llamadas a modelos ni solicitudes de red de la aplicación.
- Al pegar un paquete en una IA externa, compartes ese contenido con el servicio que elegiste.
- **Exportar** guarda un proyecto; **Preferencias → Exportar todo** guarda todos, incluidos los archivados.
- Importar una copia nunca sobrescribe proyectos existentes. Si hay identificadores repetidos, crea una copia con referencias nuevas. Las operaciones pendientes de esa copia se cancelan para regenerar paquetes coherentes; el texto y los reportes se conservan.
- Restaurar una versión crea otra versión. La adopción siempre requiere una decisión del usuario.

## Qué verifica la aplicación

La evaluación es **estructural**. El total se calcula con pesos sobre las dimensiones aplicables; N/A no cuenta como cero. La nota declarada por la IA se conserva en el reporte original y se señala cualquier ajuste al total.

El apartado **Pruebas** permite comprobar las respuestas de dos versiones con el mismo caso. La ejecución en la IA externa es manual; PFA comprueba localmente las respuestas pegadas y distingue las valoraciones humanas. La puntuación estructural no cambia por completar pruebas.

## Usar Pruebas

1. Crea un caso o prepara una sugerencia del refinador. Define entrada, contexto, resultado esperado y comprobaciones. Revisa que los escenarios sugeridos contengan datos concretos para ejecutarlos.
2. Elige dos versiones guardadas y anota el modelo exacto y las condiciones compartidas. PFA prepara un texto por versión sin incluir la respuesta esperada ni los criterios de revisión.
3. Ejecuta A y B en conversaciones nuevas de tu IA. Pega ambas respuestas. Los borradores se guardan automáticamente y se recuperan con **Continuar**.
4. Valora los criterios humanos con una justificación, o déjalos pendientes. Pulsa **Finalizar y comprobar** para obtener resultados locales y detectar mejoras/regresiones.
5. Repite si hace falta. Las ejecuciones terminadas son inmutables; editar un caso crea otra revisión. Los resultados se agrupan por versiones, revisión del caso, modelo y condiciones.
6. Si ambas versiones tienen evaluaciones y B es la versión de trabajo, puedes **Comparar con los intentos**. Se adjuntan las respuestas y comprobaciones de todos los casos activos en su revisión actual con esas versiones y condiciones, incluyendo sus repeticiones. Desde una ejecución histórica se adjuntan solo los intentos de esa revisión del caso.

Comprobaciones disponibles: contiene/no contiene literal, JSON estricto, longitud, regex con límite de tiempo, esquema JSON local y criterio humano. Los criterios pendientes o con error no cuentan como aprobados. El esquema admite un subconjunto explícito de palabras clave; rechaza las no soportadas. PFA no verifica el proveedor de una respuesta pegada ni ejecuta un juez automático. Los resultados describen los casos registrados, no una garantía general de desempeño.

Cada comprobación permite elegir una hipótesis del refinamiento. El vínculo conserva su ciclo y sus versiones; los resultados históricos no cambian al editar el caso. En la comparación puedes consultar qué pruebas respaldan cada hipótesis y cuáles siguen sin evidencia.

El modelo de datos, reglas de comparación y compatibilidad se explican en [Pruebas — fase 2](docs/pruebas-fase-2.md).

La compatibilidad se basa en que el modelo externo siga PIP 2.0. La aplicación no garantiza que todo modelo emita JSON correcto en el primer intento.

## Desarrollo

Se necesita Node.js moderno para construir y ejecutar las pruebas. Las dependencias son exclusivamente de desarrollo.

```powershell
npm ci
npm run build
npm test
npm run test:e2e
```

`test:e2e` usa Google Chrome instalado mediante Playwright. Abre el HTML con `file://`, utiliza un perfil aislado y respuestas sintéticas PIP. Comprueba la aplicación, no la calidad de una IA externa. Los resultados y capturas se guardan en `test-results/`.

La validación realizada y sus límites se detallan en [Validación del MVP](docs/validacion-mvp.md).

Para una vista previa HTTP opcional:

```powershell
npm start
```

Abre `http://127.0.0.1:4173`. Ese origen tiene almacenamiento separado del HTML abierto con `file://`.

### Organización

| Archivo | Responsabilidad |
|---|---|
| `src/core.js` | Versiones, rúbrica, PIP, paquetes, validación, estados, lint y diff |
| `src/store.js` | IndexedDB, transacciones, copias e integridad referencial |
| `src/testing.js` | Casos, ejecuciones, comprobaciones y evidencia conductual |
| `src/testing-ui.js` | Interfaz de casos y resultados A/B |
| `src/app.js` | Interfaz y coordinación de acciones |
| `src/styles.css` | Tema oscuro/claro, disposición y accesibilidad |
| `src/shell.html` | Documento base |
| `src/data.js` | Datos generados desde la documentación; no editar a mano |
| `scripts/build.mjs` | Genera `src/data.js` e `index.html` autónomo |
| `tests/` | Pruebas del dominio y recorrido en navegador |
| `docs/decisiones-implementacion.md` | Resolución de ambigüedades de las especificaciones |

Los metaprompts y JSON Schemas proceden de los documentos originales del repositorio. Después de modificarlos, ejecuta `npm run build`.
