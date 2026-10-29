const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const repository = require('../src/repositories/seguimiento.repository');

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
  assert.match(vista, /Imprimir módulos y sueltos/);
  assert.match(vista, /barcode-value/);
});

test('la impresión expande los sueltos del módulo y respeta un par seleccionado', async () => {
  const servicio = require('../src/services/seguimiento.service');
  const original = repository.listarProductosSeguimientoEan;
  const base = {
    ID_ALTA: 10,
    ID_EMPRESA: 1,
    CODIGO_ALTA: 'ALT-10',
    CODIGO_MARCA: '1',
    DETALLE_MARCA: 'ATOMIK',
    CODIGO_RUBRO: '2',
    DETALLE_RUBRO: 'INDUMENTARIA',
    CODIGO_ANO: '27',
    CODIGO_TEMPORADA: 'IN',
    DETALLE_TEMPORADA: 'INVIERNO',
    CODIGO_MODELO: 'I00001',
    DETALLE_MODELO: 'MODELO',
    CODIGO_COLOR: '01',
    DETALLE_COLOR: 'NEGRO',
    EAN_ERP: '7792800716269',
    REQUIERE_EAN: true,
    C_ESTADIO: '1',
  };
  repository.listarProductosSeguimientoEan = async () => [
    {
      ...base,
      COD_ALFA: 'MODULO1',
      CODIGO_ERP: '100',
      TIPO_PRODUCTO_DETALLE: 'MODULO',
      GENERADO_AUTOMATICO: false,
      CODIGO_MODULO: 'A0',
      DETALLE_MODULO: 'XS AL S X 2',
      PARES: 2,
      PARES_MAESTRO: 2,
      FAMILIAS_MODULO: '',
    },
    {
      ...base,
      COD_ALFA: 'SUELTO1',
      CODIGO_ERP: '101',
      TIPO_PRODUCTO_DETALLE: 'PAR_SUELTO',
      DETALLE_CLASIFICACION: 'PRIMERA',
      GENERADO_AUTOMATICO: true,
      CODIGO_TALLE: 'XS',
      DETALLE_TALLE: 'XS',
      FAMILIAS_MODULO: 'MODULO1',
    },
  ];
  try {
    const contexto = { idEmpresa: 1, acceso: { empresa: 'VICBOR', todasMarcas: true, todosRubros: true, todasLicencias: true } };
    const seguimiento = await servicio.listarSeguimientoEan(contexto);
    assert.deepEqual(seguimiento.productos.map(producto => producto.ESTADO_EAN), ['CONFIRMADO_ERP', 'CONFIRMADO_ERP']);
    const soloModulo = await servicio.prepararEtiquetasEan(['10|MODULO1'], contexto);
    assert.equal(soloModulo.cantidadModulos, 1);
    assert.equal(soloModulo.cantidadPares, 1);

    const soloSuelto = await servicio.prepararEtiquetasEan(['10|SUELTO1'], contexto);
    assert.equal(soloSuelto.cantidadModulos, 0);
    assert.equal(soloSuelto.cantidadPares, 1);

    const pdf = await servicio.generarPdfEtiquetasEan(['10|MODULO1'], contexto);
    assert.ok(Buffer.isBuffer(pdf));
    assert.equal(pdf.subarray(0, 4).toString(), '%PDF');
    assert.ok(pdf.length > 1000);

    const listarConEan = repository.listarProductosSeguimientoEan;
    for (const eanAnterior of ['', '7792800716269']) {
      repository.listarProductosSeguimientoEan = async () => (await listarConEan()).map(
        producto => ({ ...producto, REQUIERE_EAN: false, EAN_ERP: eanAnterior })
      );
      const sinEan = await servicio.prepararEtiquetasEan(['10|MODULO1'], contexto);
      assert.equal(sinEan.modulos.length, 1);
      assert.equal(sinEan.pares.length, 1);
      for (const etiqueta of [...sinEan.modulos, ...sinEan.pares]) {
        assert.equal(etiqueta.ean, '');
        assert.equal(etiqueta.barcodeEan, '');
        assert.ok(etiqueta.barcodeAlfa.includes('<svg'));
      }
      const handlebars = require('handlebars');
      const template = fs.readFileSync(path.join(__dirname, '..', 'views', 'seguimiento', 'etiquetas.hbs'), 'utf8');
      const html = handlebars.compile(template)(sinEan);
      assert.ok(!html.includes('class="barcode pair-ean"'));
      assert.ok(html.includes('module-barcodes without-ean'));
      assert.ok(html.includes('pair-label without-ean'));
      const pdfSinEan = await servicio.generarPdfEtiquetasEan(['10|MODULO1'], contexto);
      assert.equal(pdfSinEan.subarray(0, 4).toString(), '%PDF');
    }

  } finally {
    repository.listarProductosSeguimientoEan = original;
  }
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

test('la composición del módulo conserva talles cuyos sueltos están inactivos', () => {
  const servicio = require('../src/services/seguimiento.service');
  const producto = {
    TM_T28: 2, TM_T29: 2, TM_T30: 2, TM_T31: 3,
    TM_T32: 2, TM_T33: 2, TM_T34: 2,
    PARES_MAESTRO: 15,
  };
  assert.deepEqual(servicio.composicionCurvaDesdeMaestro(producto), [
    { talle: '28', pares: 2 },
    { talle: '29', pares: 2 },
    { talle: '30', pares: 2 },
    { talle: '31', pares: 3 },
    { talle: '32', pares: 2 },
    { talle: '33', pares: 2 },
    { talle: '34', pares: 2 },
  ]);
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

test('Seguimiento permite imprimir EAN confirmados y no requeridos', () => {
  const js = fs.readFileSync(
    path.join(__dirname, '..', 'public', 'js', 'seguimiento.js'),
    'utf8'
  );
  const servicio = fs.readFileSync(
    path.join(__dirname, '..', 'src', 'services', 'seguimiento.service.js'),
    'utf8'
  );
  assert.match(js, /btnImprimirEtiquetasEan/);
  assert.match(js, /btnDescargarEtiquetasEan/);
  assert.match(js, /\/api\/seguimiento\/ean\/etiquetas\.pdf/);
  assert.match(js, /ETIQUETAS_MODULOS_Y_SUELTOS\.pdf/);
  assert.match(js, /productosSeleccionadosEan\('CONFIRMADO_ERP', 'NO_REQUERIDO'\)/);
  assert.match(servicio, /no tienen un EAN válido habilitado para imprimir/);
  assert.match(servicio, /bwipjs\.toSVG/);
  assert.match(servicio, /includetext: false/);
  assert.match(servicio, /preserveAspectRatio="none"/);
  assert.match(servicio, /debeMostrarImagenEtiqueta\(producto, contexto\)/);
  assert.match(servicio, /imagenesAltaService\.buscarImagenProducto/);
  assert.match(servicio, /font\('Helvetica-Bold'\)\.fontSize\(38\).*modulo\.marca/);
  assert.match(servicio, /font\('Helvetica-Bold'\)\.fontSize\(16\).*underline: true/);
  assert.match(servicio, /fontSize\(10\.5\)[\s\S]*?modulo\.codigoAlfa/);
});

test('un producto sin requisito EAN es imprimible incluso sin EAN', () => {
  const servicio = require('../src/services/seguimiento.service');
  assert.equal(servicio.productoImprimibleEtiquetaEan({
    ESTADO_EAN: 'NO_REQUERIDO',
    EAN_ERP: '7792800015157',
  }), true);
  assert.equal(servicio.productoImprimibleEtiquetaEan({
    ESTADO_EAN: 'NO_REQUERIDO',
    EAN_ERP: '',
  }), true);
  assert.equal(servicio.productoImprimibleEtiquetaEan({
    ESTADO_EAN: 'PENDIENTE_GS1',
    EAN_ERP: '7792800015157',
  }), false);
});
