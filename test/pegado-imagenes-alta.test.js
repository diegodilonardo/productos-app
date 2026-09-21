const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('las familias principales admiten seleccionar, arrastrar y pegar imágenes', () => {
  const fuente = fs.readFileSync(path.join(__dirname, '../public/js/alta-productos.js'), 'utf8');
  assert.match(fuente, /addEventListener\('drop', manejarDropImagenDetalle\)/);
  assert.match(fuente, /addEventListener\('paste', manejarPegadoImagenDetalle\)/);
  assert.match(fuente, /Arrastrá o pegá con Ctrl\+V/);
  assert.match(fuente, /data-imagen-editable="true"/);
  assert.match(fuente, /\['image\/jpeg', 'image\/png'\]\.includes\(item\.type\)/);
  assert.match(fuente, /manejarCambioImagenDetalle\(\{ target: input \}, imagenes\[0\]\)/);
});

test('el pegado no intercepta formularios ni procesa varias imágenes silenciosamente', () => {
  const fuente = fs.readFileSync(path.join(__dirname, '../public/js/alta-productos.js'), 'utf8');
  assert.match(fuente, /input, textarea, \[contenteditable="true"\]/);
  assert.match(fuente, /Se pegaron varias imágenes/);
  assert.match(fuente, /event\.preventDefault\(\)/);
});
