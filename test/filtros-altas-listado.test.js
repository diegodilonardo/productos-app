const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('el listado de Altas permite combinar filtros de año, temporada, rubro y licencia', () => {
  const vista = fs.readFileSync(path.resolve(__dirname, '../views/altas/index.hbs'), 'utf8');
  const frontend = fs.readFileSync(path.resolve(__dirname, '../public/js/altas-index.js'), 'utf8');
  for (const id of ['filtroAnoAlta', 'filtroTemporadaAlta', 'filtroRubroAlta', 'filtroLicenciaAlta']) {
    assert.match(vista, new RegExp(`id="${id}"`));
    assert.match(frontend, new RegExp(id));
  }
  assert.match(frontend, /completarFiltrosAltas/);
  assert.match(frontend, /limpiarFiltrosAltas/);
});
