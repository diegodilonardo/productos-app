const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const frontend = fs.readFileSync(path.resolve(__dirname, '../public/js/alta-productos.js'), 'utf8');
const estilos = fs.readFileSync(path.resolve(__dirname, '../public/css/alta-productos-v2.css'), 'utf8');

test('los buscadores del Alta navegan resultados con flechas y resaltan la opción activa', () => {
  assert.match(frontend, /\['ArrowDown', 'ArrowUp'\]\.includes\(event\.key\)/);
  assert.match(frontend, /classList\.add\('is-keyboard-active'\)/);
  assert.match(frontend, /scrollIntoView\(\{ block: 'nearest' \}\)/);
  assert.match(estilos, /\.alta-master-item\.is-keyboard-active/);
});

test('la navegación se aplica a modelos, módulos, maestros, talles y colores', () => {
  assert.match(frontend, /#listaModelos \.alta-model-item/);
  assert.match(frontend, /#listaModulos \.alta-module-item/);
  assert.match(frontend, /#lista\$\{clave\} \.alta-master-item/);
  assert.match(frontend, /#listaTalles \.app-talle-item/);
  assert.match(frontend, /#listaColores \.app-color-item/);
});

test('Enter acepta la opción resaltada en búsquedas simples y múltiples', () => {
  assert.match(frontend, /const activa = opcionActivaConTeclado/);
  assert.match(frontend, /checkActivo\.checked = true/);
  assert.match(frontend, /activa\.click\(\)/);
});
