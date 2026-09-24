import { readFile, writeFile, mkdir } from 'node:fs/promises';
const read = file => readFile(new URL('../' + file, import.meta.url), 'utf8');
const pip = await read('PFA Interchange Protocol — PIP 2.0.md');
const schemas = {};
for (const match of pip.matchAll(/```json\s*([\s\S]*?)```/g)) {
  const value = JSON.parse(match[1]);
  if (value.$schema) schemas[value.properties.schema.const] = value;
}
if (Object.keys(schemas).length !== 3) throw new Error('Se requieren los tres schemas de PIP.');
const prompts = {};
for (const [operation, name] of Object.entries({ EVALUATE: 'Evaluador Adaptativo de Prompts.md', REFINE: 'Refinador Dirigido de Prompts.md', COMPARE: 'Comparador y Reevaluador de Prompts.md' })) {
  prompts[operation] = (await read(name)).split(/# (?:INPUT|PROMPT A EVALUAR)\s*\r?\n/)[0].trim();
}
const data = { schemas, prompts, rubric: await read('Especificación de la Rúbrica Adaptativa.md') };
await mkdir(new URL('../src', import.meta.url), { recursive: true });
await writeFile(new URL('../src/data.js', import.meta.url), 'globalThis.PFA_DATA = ' + JSON.stringify(data).replaceAll('<', '\\u003c') + ';\n');
const scripts = await Promise.all(['data', 'core', 'testing', 'store', 'testing-ui', 'app'].map(name => read('src/' + name + '.js')));
const css = await read('src/styles.css');
const html = (await read('src/shell.html')).replace('/* PFA_STYLES */', () => css).replace('/* PFA_SCRIPTS */', () => scripts.join('\n').replace(/<\/script/gi, '<\\/script'));
await writeFile(new URL('../index.html', import.meta.url), html);
console.log('index.html generado: HTML autónomo, sin solicitudes de red.');
