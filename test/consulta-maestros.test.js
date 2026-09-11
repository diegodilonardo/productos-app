const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const XLSX = require('xlsx');
const maestrosService = require('../src/services/maestros.service');

test('Maestros ofrece consultas de modelos, colores y módulos con paginación', () => {
  const vista = fs.readFileSync(path.join(process.cwd(), 'views/altas-maestros/index.hbs'), 'utf8');
  const js = fs.readFileSync(path.join(process.cwd(), 'public/js/altas-maestros.js'), 'utf8');
  assert.match(vista, /id="tabConsultaMaestros"/);
  assert.match(vista, /value="MODELOS"/);
  assert.match(vista, /value="COLORES"/);
  assert.match(vista, /value="MODULOS"/);
  assert.match(js, /const filasPorPaginaConsulta = 25/);
  assert.match(js, /MAESTRO_.*\.xlsx/);
  assert.match(js, /aplicarPermisosPantallaMaestros/);
  assert.match(vista, /id="filtroMarcaModelos"/);
  assert.match(vista, /id="filtroRubroModelos"/);
  assert.match(vista, /id="filtroLicenciaModelos"/);
  assert.match(js, /__SIN_LICENCIA__/);
});

test('la consulta de módulos incluye inconsistentes sin afectar el maestro operativo', () => {
  const repository = fs.readFileSync(path.join(process.cwd(), 'src/repositories/maestros.repository.js'), 'utf8');
  const rutas = fs.readFileSync(path.join(process.cwd(), 'src/routes/maestros.routes.js'), 'utf8');
  assert.match(repository, /async function obtenerTallesModulosConsulta/);
  assert.match(repository, /WHERE ID_EMPRESA = @ID_EMPRESA AND ACTIVO = 1/);
  assert.match(rutas, /\/consulta\/talles-modulos/);
});

test('la sección Maestros queda visible para consultas de solo lectura', () => {
  const navbar = fs.readFileSync(path.join(process.cwd(), 'views/partials/navbar.hbs'), 'utf8');
  const rutasWeb = fs.readFileSync(path.join(process.cwd(), 'src/routes/web.routes.js'), 'utf8');
  assert.match(navbar, /id="navAltasMaestros" class="nav-item"/);
  assert.match(rutasWeb, /router\.get\('\/altas-maestros', \(req, res\)/);
});

test('la consulta filtrada se exporta como un Excel válido', () => {
  const archivo = maestrosService.exportarConsultaMaestros('COLORES', [{ CODIGO_COLOR: '01', DETALLE_COLOR: 'NEGRO', CAMPO_PRIVADO: 'NO' }]);
  const libro = XLSX.read(archivo, { type: 'buffer' });
  const filas = XLSX.utils.sheet_to_json(libro.Sheets.COLORES);
  assert.deepEqual(filas, [{ CODIGO_COLOR: '01', DETALLE_COLOR: 'NEGRO' }]);
});

test('Maestros incorpora productos como consulta de solo lectura por empresa', () => {
  const vista = fs.readFileSync(path.join(process.cwd(), 'views/altas-maestros/index.hbs'), 'utf8');
  const js = fs.readFileSync(path.join(process.cwd(), 'public/js/altas-maestros.js'), 'utf8');
  const repository = fs.readFileSync(path.join(process.cwd(), 'src/repositories/maestros.repository.js'), 'utf8');
  const rutas = fs.readFileSync(path.join(process.cwd(), 'src/routes/maestros.routes.js'), 'utf8');

  assert.match(vista, /value="PRODUCTOS">Productos/);
  assert.match(js, /\/api\/maestros\/consulta\/productos/);
  assert.match(js, /Código alfa \/ ERP/);
  assert.match(vista, /id="filtroTipoProductos"/);
  assert.match(vista, /value="MODULO">Módulos/);
  assert.match(vista, /value="PAR_SUELTO">Pares sueltos/);
  assert.match(js, /item\.TIPO_PRODUCTO/);
  assert.match(js, /loading="lazy"/);
  assert.match(js, /Sin foto/);
  assert.match(repository, /A\.CODIGO_TEMPORADA/);
  assert.match(repository, /FROM dbo\.PRODUCTOS P/);
  assert.match(repository, /P\.ID_EMPRESA = @ID_EMPRESA/);
  assert.match(repository, /COALESCE\(D\.TIPO_PRODUCTO_DETALLE, A\.TIPO_PRODUCTO, P\.TIPO_PRODUCTO\) AS TIPO_PRODUCTO/);
  assert.match(rutas, /"\/consulta\/productos"/);
  assert.doesNotMatch(vista, /editarProductoMaestro|eliminarProductoMaestro/);
});
