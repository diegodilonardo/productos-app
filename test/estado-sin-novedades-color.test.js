const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

test('SIN_NOVEDADES_ERP usa un color distintivo en todas las pantallas', () => {
  const archivos = [
    'public/js/altas-index.js',
    'public/js/alta-productos.js',
    'public/js/dashboard.js',
    'public/js/seguimiento.js',
    'public/js/seguimiento-detalle.js'
  ];
  for (const archivo of archivos) {
    const contenido = fs.readFileSync(path.join(process.cwd(), archivo), 'utf8');
    assert.match(contenido, /badge-sin-novedades-erp/, `${archivo} debe aplicar el color distintivo`);
  }
  const css = fs.readFileSync(path.join(process.cwd(), 'public/css/app.css'), 'utf8');
  assert.match(css, /\.badge-sin-novedades-erp\{background-color:#6f42c1!important;color:#fff!important\}/);
});
