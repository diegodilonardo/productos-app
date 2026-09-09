const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('la impresión compacta módulos y pares individuales en hojas A4', () => {
  const vista = fs.readFileSync(
    path.join(__dirname, '..', 'views', 'seguimiento', 'etiquetas.hbs'),
    'utf8'
  );
  assert.match(vista, /@page \{ size: A4 portrait; margin: 8mm/);
  assert.match(vista, /\.sheet \{ width: auto; min-height: auto; margin: 0; padding: 0; \}/);
  assert.match(vista, /grid-template-columns: repeat\(3, 60mm\)/);
  assert.match(vista, /\.module-label \{ width: 200mm; height: 100mm/);
  assert.match(vista, /\.pair-label \{ width: 60mm; height: 30mm/);
  assert.match(vista, /grid-template-columns: 48mm 1fr/);
  assert.match(vista, /@page moduleLabels \{ size: A4 portrait; margin: 5mm/);
  assert.match(vista, /font-size: 36pt/);
  assert.match(vista, /\.barcode-value[^}]*font-size: 9\.5pt/);
  assert.match(vista, /\.pair-label \.barcode-value \{ font-size: 6\.5pt/);
  assert.match(vista, /class="pair-photo"/);
  assert.match(vista, /<img src="\{\{imagen\}\}"/);
  assert.match(vista, /class="module-photo"[^>]*>\{\{#if imagen\}\}<img/);
  assert.match(vista, /\.module-photo \{[^}]*padding: 2mm/);
  assert.match(vista, /grid-template-columns: 14mm minmax\(0, 1fr\)/);
  assert.match(vista, /\.pair-heading \{ grid-column: 1 \/ 3;/);
  assert.match(vista, /\.pair-alpha \{ grid-column: 2; \}/);
  assert.match(vista, /\.pair-label \.pair-alpha \.barcode-bars \{ padding: 0; \}/);
  assert.match(vista, /grid-template-rows: 7mm 8\.5mm 10\.5mm/);
  assert.match(vista, /\.pair-size[^}]*font-size: 15pt/);
  assert.match(vista, /\.pair-title[^}]*overflow-wrap: anywhere/);
  assert.match(vista, /Imprimir módulos/);
  assert.match(vista, /Imprimir pares individuales/);
  assert.match(vista, /barcode-value/);
});

test('la composición impresa respeta las cantidades informadas por cada curva', () => {
  const servicio = require('../src/services/seguimiento.service');
  assert.deepEqual(servicio.extraerCantidadesCurva('38 AL 43 X 15 (3,3,3,3,2,1)', 6), [3,3,3,3,2,1]);
  assert.deepEqual(servicio.extraerCantidadesCurva('33 AL 37 X 12 PARES 2,2,2,3,3', 5), [2,2,2,3,3]);
  assert.deepEqual(servicio.extraerCantidadesCurva('35 AL 40 X 12 PARES 1 2 3 3 2 1', 6), [1,2,3,3,2,1]);
  assert.deepEqual(servicio.extraerCantidadesCurva('22 AL 28 X12 1,1,2,2,2,2,2', 7), [1,1,2,2,2,2,2]);
  assert.deepEqual(servicio.extraerCantidadesCurva('22 AL 28 X12 1 1 2 2 2 2 2', 7), [1,1,2,2,2,2,2]);
  assert.deepEqual(servicio.extraerCantidadesCurva('27 AL 32 1,1,2,2,2,2 X10', 6), [1,1,2,2,2,2]);
  assert.deepEqual(servicio.extraerCantidadesCurva('44/45 X 12 PARES', 1), [12]);
});

test('la etiqueta toma las cantidades estructuradas del maestro de módulos', () => {
  const servicio = require('../src/services/seguimiento.service');
  const producto = { TM_T22: 1, TM_T23: 1, TM_T24: 2, TM_T25: 2, TM_T26: 2, TM_T27: 2, TM_T28: 2, PARES_MAESTRO: 12 };
  const primeras = ['22', '23', '24', '25', '26', '27', '28'].map(DETALLE_TALLE => ({ DETALLE_TALLE }));
  assert.deepEqual(servicio.cantidadesCurvaDesdeMaestro(producto, primeras), [1,1,2,2,2,2,2]);
  assert.deepEqual(servicio.cantidadesCurvaDesdeMaestro({ ...producto, PARES_MAESTRO: 13 }, primeras), []);
});

test('VICBOR omite imágenes de indumentaria y accesorios en las etiquetas', () => {
  const servicio = require('../src/services/seguimiento.service');
  const vicbor = { acceso: { empresa: 'VICBOR' } };
  const otraEmpresa = { acceso: { empresa: 'INDUSTRIAS GYD' } };

  assert.equal(servicio.debeMostrarImagenEtiqueta({ DETALLE_RUBRO: 'INDUMENTARIA' }, vicbor), false);
  assert.equal(servicio.debeMostrarImagenEtiqueta({ DETALLE_RUBRO: 'ACCESORIOS' }, vicbor), false);
  assert.equal(servicio.debeMostrarImagenEtiqueta({ DETALLE_RUBRO: 'CALZADO' }, vicbor), true);
  assert.equal(servicio.debeMostrarImagenEtiqueta({ DETALLE_RUBRO: 'INDUMENTARIA' }, otraEmpresa), true);
});

test('Seguimiento ofrece imprimir solamente EAN confirmados en ERP', () => {
  const js = fs.readFileSync(
    path.join(__dirname, '..', 'public', 'js', 'seguimiento.js'),
    'utf8'
  );
  const servicio = fs.readFileSync(
    path.join(__dirname, '..', 'src', 'services', 'seguimiento.service.js'),
    'utf8'
  );
  assert.match(js, /btnImprimirEtiquetasEan/);
  assert.match(js, /productosSeleccionadosEan\('CONFIRMADO_ERP'\)/);
  assert.match(servicio, /todavía no tienen el EAN confirmado en Presea/);
  assert.match(servicio, /bwipjs\.toSVG/);
  assert.match(servicio, /includetext: false/);
  assert.match(servicio, /preserveAspectRatio="none"/);
  assert.match(servicio, /debeMostrarImagenEtiqueta\(producto, contexto\)/);
  assert.match(servicio, /imagenesAltaService\.buscarImagenProducto/);
});
