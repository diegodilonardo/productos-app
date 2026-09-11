const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('seleccionar una imagen dispara su guardado sin botón adicional', () => {
  const fuente = fs.readFileSync(
    path.resolve(__dirname, '../public/js/alta-productos.js'),
    'utf8'
  );

  const cambioImagen = fuente.match(
    /async function manejarCambioImagenDetalle[\s\S]*?async function archivoABase64Familia/
  )?.[0] ?? '';

  assert.match(cambioImagen, /await guardarImagenFamilia\(\s*input,\s*archivo\s*\)/);
  assert.doesNotMatch(fuente, /data-accion="guardar-imagen-familia"/);
  assert.doesNotMatch(fuente, />\s*Guardar\s*<\/button>/);
});

test('el recuadro permite arrastrar una imagen y reutiliza el guardado automático', () => {
  const fuente = fs.readFileSync(
    path.resolve(__dirname, '../public/js/alta-productos.js'),
    'utf8'
  );

  assert.match(fuente, /addEventListener\('dragover', manejarArrastreImagenDetalle\)/);
  assert.match(fuente, /addEventListener\('drop', manejarDropImagenDetalle\)/);
  assert.match(
    fuente,
    /await manejarCambioImagenDetalle\(\s*\{ target: input \},\s*archivo\s*\)/
  );
  assert.match(fuente, /data-imagen-editable="\$\{editable \? 'true' : 'false'\}"/);
});

test('un Alta cerrada en ERP permite reponer imágenes sin reabrir sus productos', () => {
  const frontend = fs.readFileSync(
    path.resolve(__dirname, '../public/js/alta-productos.js'),
    'utf8'
  );
  const backend = fs.readFileSync(
    path.resolve(__dirname, '../src/routes/imagenes.routes.js'),
    'utf8'
  );

  for (const estado of ['GENERADO_OK_EN_ERP', 'SIN_NOVEDADES_ERP']) {
    assert.match(frontend, new RegExp(`'${estado}'`));
    assert.match(backend, new RegExp(`'${estado}'`));
  }
  assert.match(backend, /if \(estadoAlta !== 'BORRADOR'\)/);
});
