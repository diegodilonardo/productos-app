const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const servicio = require('../src/services/imagenesAlta.service');

test('las fotos de ERP se separan por empresa y marca en la ruta de Presea', () => {
  const anterior = process.env.FOTOS_ERP_BASE_PATH;
  process.env.FOTOS_ERP_BASE_PATH = '\\\\172.24.0.175\\Vicbor2\\FOTOS';
  try {
    assert.equal(
      servicio.rutaFotosErp({ ID_EMPRESA: 1, RAZON_SOCIAL: 'VICBOR', DETALLE_MARCA: 'ATOMIK' }),
      path.join('\\\\172.24.0.175\\Vicbor2\\FOTOS', 'VICBOR', 'ATOMIK')
    );
    assert.equal(
      servicio.rutaFotosErp({ ID_EMPRESA: 3, RAZON_SOCIAL: 'INDUSTRIAS GYD', DETALLE_MARCA: 'WAKE' }),
      path.join('\\\\172.24.0.175\\Vicbor2\\FOTOS', 'GYD', 'WAKE')
    );
  } finally {
    if (anterior === undefined) delete process.env.FOTOS_ERP_BASE_PATH;
    else process.env.FOTOS_ERP_BASE_PATH = anterior;
  }
});

test('el detalle del Alta ofrece enviar fotos sueltas a ERP y registra el envío', () => {
  const vista = fs.readFileSync(path.resolve(__dirname, '../views/altas/productos.hbs'), 'utf8');
  const frontend = fs.readFileSync(path.resolve(__dirname, '../public/js/alta-productos.js'), 'utf8');
  const rutas = fs.readFileSync(path.resolve(__dirname, '../src/routes/altas.routes.js'), 'utf8');
  const repositorio = fs.readFileSync(path.resolve(__dirname, '../src/repositories/imagenesAlta.repository.js'), 'utf8');
  assert.match(vista, /Enviar fotos a ERP/);
  assert.match(frontend, /\/fotos-erp/);
  assert.match(frontend, /fotos ya existían/);
  assert.match(frontend, /pintarProgresoFotosErp/);
  assert.match(vista, /id="barraProgresoFotosErp"/);
  assert.match(rutas, /router\.post\('\/:id\/fotos-erp'/);
  assert.match(repositorio, /ALTAS_PRODUCTOS_FOTOS_ERP_ENVIOS/);
});

test('las tarjetas de Altas indican cuando las fotos ya fueron enviadas a Presea', () => {
  const repositorio = fs.readFileSync(path.resolve(__dirname, '../src/repositories/altas.repository.js'), 'utf8');
  const frontend = fs.readFileSync(path.resolve(__dirname, '../public/js/altas-index.js'), 'utf8');
  assert.match(repositorio, /AS FOTOS_EN_PRESEA/);
  assert.match(repositorio, /ALTAS_PRODUCTOS_FOTOS_ERP_ENVIOS/);
  assert.match(frontend, /FOTOS EN PRESEA/);
});
