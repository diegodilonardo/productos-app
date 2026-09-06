const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('la impresión compacta módulos y pares individuales en hojas A4', () => {
  const vista = fs.readFileSync(
    path.join(__dirname, '..', 'views', 'seguimiento', 'etiquetas.hbs'),
    'utf8'
  );
  assert.match(vista, /@page \{ size: A4 portrait/);
  assert.match(vista, /grid-template-columns: repeat\(2, 1fr\)/);
  assert.match(vista, /height: 88mm/);
  assert.match(vista, /height: 43mm/);
  assert.match(vista, /grid-template-columns: 48mm 1fr/);
  assert.match(vista, /font-size: 36pt/);
  assert.match(vista, /\.barcode-value[^}]*font-size: 9\.5pt/);
  assert.match(vista, /\.pair-label \.barcode-value \{ font-size: 8pt/);
  assert.match(vista, /Imprimir módulos/);
  assert.match(vista, /Imprimir pares individuales/);
  assert.match(vista, /barcode-value/);
});

test('la composición impresa respeta las cantidades informadas por cada curva', () => {
  const servicio = require('../src/services/seguimiento.service');
  assert.deepEqual(servicio.extraerCantidadesCurva('38 AL 43 X 15 (3,3,3,3,2,1)', 6), [3,3,3,3,2,1]);
  assert.deepEqual(servicio.extraerCantidadesCurva('33 AL 37 X 12 PARES 2,2,2,3,3', 5), [2,2,2,3,3]);
  assert.deepEqual(servicio.extraerCantidadesCurva('27 AL 32 1,1,2,2,2,2 X10', 6), [1,1,2,2,2,2]);
  assert.deepEqual(servicio.extraerCantidadesCurva('44/45 X 12 PARES', 1), [12]);
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
  assert.doesNotMatch(servicio, /imagen: await imagenProducto/);
});
