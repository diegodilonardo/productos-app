const test = require('node:test');
const assert = require('node:assert/strict');
const service = require('../src/services/altasMaestros.service');
const repository = require('../src/repositories/altasMaestros.repository');
const maestrosRepository = require('../src/repositories/maestros.repository');
const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

test('genera códigos alfanuméricos con el largo del maestro', () => {
  assert.equal(service.codigoBase36(0, 2), '00');
  assert.equal(service.codigoBase36(35, 2), '0Z');
  assert.equal(service.codigoBase36(36, 2), '10');
});

test('la conciliación confirma colores y curvas además de modelos', () => {
  const fuente = fs.readFileSync(path.join(process.cwd(), 'src/repositories/altasMaestros.repository.js'), 'utf8');
  assert.match(fuente, /A\.TIPO='COLOR' AND EXISTS[\s\S]*MAESTRO_COLORES/);
  assert.match(fuente, /A\.TIPO='MODULO' AND EXISTS[\s\S]*MAESTRO_TALLES_MODULOS/);
  assert.match(fuente, /C\.ID_EMPRESA=A\.ID_EMPRESA/);
  assert.match(fuente, /T\.ID_EMPRESA=A\.ID_EMPRESA/);
});

test('un color guarda marca y rubro sólo como referencia sin modificar el DBI', async () => {
  const original = repository.crear;
  repository.crear = async datos => datos;
  try {
    const registro = await service.crear({ idEmpresa:1, usuario:'DIEGO', cuerpo:{tipo:'COLOR',codigo:'0F',nombre:'ORQUIDEA',marca:'ATOMIK',rubro:'CALZADO'} });
    assert.equal(registro.marca, 'ATOMIK');
    assert.equal(registro.rubro, 'CALZADO');
    const sinReferencia = await service.crear({ idEmpresa:1, usuario:'DIEGO', cuerpo:{tipo:'COLOR',codigo:'0G',nombre:'OTRO'} });
    assert.equal(sinReferencia.marca, '');
    assert.equal(sinReferencia.rubro, '');
    assert.deepEqual(service.definicionesDbi.COLOR.map({CODIGO:'0F',NOMBRE:'ORQUIDEA',MARCA:'ATOMIK',RUBRO:'CALZADO'}), {CODIGO:'0F',DET_COLOR:'ORQUIDEA'});
  } finally { repository.crear = original; }
});

test('sugiere el primer código libre sin repetir maestro ni solicitud', async () => {
  const original = repository.codigosOcupados;
  repository.codigosOcupados = async () => ['00', '01', '02'];
  try { assert.equal(await service.sugerirCodigo(1, 'COLOR'), '03'); }
  finally { repository.codigosOcupados = original; }
});

test('un código de maestro anulado puede reutilizarse conservando su historial', () => {
  const repositorySource = fs.readFileSync(
    path.join(process.cwd(), 'src/repositories/altasMaestros.repository.js'),
    'utf8'
  );

  assert.match(
    repositorySource,
    /AND ESTADO='ANULADO'[\s\S]*SET @REACTIVADO = 1/
  );
  assert.match(
    repositorySource,
    /'ANULADO','PENDIENTE_ENVIO'[\s\S]*Código reutilizado mediante una nueva solicitud/
  );
  assert.match(
    repositorySource,
    /ARCHIVO_DBI=NULL[\s\S]*FECHA_CONFIRMACION_ERP=NULL/
  );
  assert.match(
    repositorySource,
    /IF NOT EXISTS \(SELECT 1 FROM @RESULTADO\)[\s\S]*INSERT dbo\.ALTAS_MAESTROS/
  );
});

test('los códigos inactivos en Presea y anulados en la app quedan disponibles', () => {
  const repositorySource = fs.readFileSync(path.join(process.cwd(), 'src/repositories/altasMaestros.repository.js'), 'utf8');
  assert.match(repositorySource, /SELECT \$\{def\.codigo\} CODIGO FROM dbo\.\$\{def\.tabla\} WHERE ID_EMPRESA=@ID_EMPRESA AND ACTIVO=1/);
  assert.match(repositorySource, /FROM dbo\.MAESTRO_MODELOS WHERE ID_EMPRESA=@ID_EMPRESA AND ACTIVO=1/);
  assert.match(repositorySource, /TIPO=@TIPO AND ESTADO <> 'ANULADO'/);
});

test('los módulos de todas las empresas comienzan en A0 y continúan la serie alfanumérica', async () => {
  const original = repository.codigosOcupados;
  try {
    repository.codigosOcupados = async () => [];
    assert.equal(await service.sugerirCodigo(1, 'MODULO'), 'A0');
    assert.equal(await service.sugerirCodigo(4, 'MODULO'), 'A0');
    repository.codigosOcupados = async () => ['A0', 'A1', 'A2'];
    assert.equal(await service.sugerirCodigo(2, 'MODULO'), 'A3');
    repository.codigosOcupados = async () => ['A0', ...Array.from({ length: 35 }, (_, indice) => service.codigoBase36(Number.parseInt('A1', 36) + indice, 2))];
    assert.equal(await service.sugerirCodigo(3, 'MODULO'), 'B0');
  } finally { repository.codigosOcupados = original; }
});

test('respeta exactamente la estructura DBI de colores y modelos de Presea', () => {
  assert.deepEqual(service.definicionesDbi.COLOR.campos.map(x => [x.nombre, x.tipo, x.largo]), [['CODIGO', 'C', 2], ['DET_COLOR', 'C', 30]]);
  assert.deepEqual(service.definicionesDbi.MODELO.campos.map(x => [x.nombre, x.tipo, x.largo]), [['COD_MODELO', 'C', 6], ['MODELO', 'C', 50], ['C_PROVEEDO', 'C', 6], ['LICENCIA', 'C', 20], ['MARCA', 'C', 20], ['RUBRO', 'C', 20]]);
  assert.deepEqual(service.definicionesDbi.MODELO.map({ CODIGO: 'AF0001', NOMBRE: 'REMERA', C_PROVEEDO: 'PB0001', LICENCIA: 'SIN LICENCIA', MARCA: 'ATOMIK', RUBRO: 'INDUMENTARIA' }), { COD_MODELO: 'AF0001', MODELO: 'REMERA', C_PROVEEDO: 'PB0001', LICENCIA: '', MARCA: 'ATOMIK', RUBRO: 'INDUMENTARIA' });
});

test('resuelve la configuración relativa de maestros contra el FTP compartido', () => {
  assert.equal(service.resolverRutaDestinoMaestros('ALTAS_MAESTROS\\VICBOR'), '/ALTAS_MAESTROS/VICBOR');
  assert.equal(service.resolverRutaDestinoMaestros('/ALTAS_MAESTROS/VICBOR'), '/ALTAS_MAESTROS/VICBOR');
  assert.equal(service.resolverRutaDestinoMaestros('\\\\ftpserver02\\ftpvicbor\\ALTAS_MAESTROS\\VICBOR'), '/ALTAS_MAESTROS/VICBOR');
  assert.throws(() => service.resolverRutaDestinoMaestros('carpeta-local\\VICBOR'), /ALTAS_MAESTROS/);
});

test('concilia modelos existentes en Presea y muestra quién realizó el alta', async () => {
  const originalConciliar = repository.conciliarModelosRegistrados;
  const originalListar = repository.listar;
  const llamadas = [];
  repository.conciliarModelosRegistrados = async (empresa, usuario) => { llamadas.push([empresa, usuario]); return 1; };
  repository.listar = async () => [{ CODIGO: 'AF0001', ESTADO: 'CONFIRMADO_ERP', USUARIO_CREACION: 'DIEGO' }];
  try {
    const registros = await service.listar(1, 'DIEGO');
    assert.deepEqual(llamadas, [[1, 'DIEGO']]);
    assert.equal(registros[0].ESTADO, 'CONFIRMADO_ERP');
  } finally {
    repository.conciliarModelosRegistrados = originalConciliar;
    repository.listar = originalListar;
  }
  const repositorySource = fs.readFileSync(path.join(process.cwd(), 'src/repositories/altasMaestros.repository.js'), 'utf8');
  const vista = fs.readFileSync(path.join(process.cwd(), 'views/altas-maestros/index.hbs'), 'utf8');
  const frontend = fs.readFileSync(path.join(process.cwd(), 'public/js/altas-maestros.js'), 'utf8');
  assert.match(repositorySource, /MAESTRO_MODELOS[\s\S]*CONFIRMADO_ERP/);
  assert.match(vista, /<th\s*>Usuario<\/th>/);
  assert.match(frontend, /USUARIO_CREACION/);
  assert.match(frontend, /REGISTRADO EN PRESEA/);
});

test('solo permite eliminar solicitudes de maestros pendientes y conserva la trazabilidad', async () => {
  const original = repository.anularPendiente;
  const llamadas = [];
  repository.anularPendiente = async (...args) => { llamadas.push(args); return { ID_ALTA_MAESTRO: 8, ESTADO: 'ANULADO' }; };
  try {
    const registro = await service.eliminarPendiente({ idEmpresa: 2, idAltaMaestro: '8', usuario: 'DIEGO' });
    assert.equal(registro.ID_ALTA_MAESTRO, 8);
    assert.deepEqual(llamadas, [[2, 8, 'DIEGO']]);
    await assert.rejects(() => service.eliminarPendiente({ idEmpresa: 2, idAltaMaestro: 'x', usuario: 'DIEGO' }), /no es válida/);
  } finally { repository.anularPendiente = original; }

  const repositorySource = fs.readFileSync(path.join(process.cwd(), 'src/repositories/altasMaestros.repository.js'), 'utf8');
  const rutas = fs.readFileSync(path.join(process.cwd(), 'src/routes/altasMaestros.routes.js'), 'utf8');
  const frontend = fs.readFileSync(path.join(process.cwd(), 'public/js/altas-maestros.js'), 'utf8');
  assert.match(repositorySource, /ID_EMPRESA=@ID_EMPRESA[\s\S]*ID_ALTA_MAESTRO=@ID_ALTA_MAESTRO[\s\S]*ESTADO='PENDIENTE_ENVIO'/);
  assert.match(repositorySource, /'PENDIENTE_ENVIO','ANULADO'/);
  assert.match(rutas, /router\.delete\('\/:id', requerirEscrituraEmpresa/);
  assert.match(frontend, /ESTADO \|\| ''\)\.toUpperCase\(\) !== 'PENDIENTE_ENVIO'/);
  assert.match(frontend, /El código volverá a quedar disponible/);
});

test('crea módulos solamente para calzado o indumentaria y calcula su distribución', async () => {
  const originalCrear = repository.crear;
  const originalListar = repository.listar;
  const originalModulos = maestrosRepository.obtenerTallesModulosConsulta;
  let guardado;
  repository.crear = async datos => { guardado = datos; return datos; };
  repository.listar = async () => [];
  maestrosRepository.obtenerTallesModulosConsulta = async () => [];
  try {
    await service.crear({ idEmpresa: 1, usuario: 'DIEGO', cuerpo: { tipo: 'MODULO', codigo: '0A', rubro: 'CALZADO', datos: { distribucion: { T35: 1, T36: 2, T37: 1 } } } });
    assert.equal(guardado.nombre, '35 AL 37 X 4 (1,2,1)');
    assert.deepEqual(JSON.parse(guardado.datosJson), { rubro: 'CALZADO', distribucion: { T35: 1, T36: 2, T37: 1 }, pares: 4 });
    await assert.rejects(() => service.crear({ idEmpresa: 1, usuario: 'DIEGO', cuerpo: { tipo: 'MODULO', codigo: '0B', rubro: 'INDUMENTARIA', datos: { distribucion: { T35: 1 } } } }), /no corresponde a INDUMENTARIA/);
  } finally {
    repository.crear = originalCrear;
    repository.listar = originalListar;
    maestrosRepository.obtenerTallesModulosConsulta = originalModulos;
  }
});

test('el DBI de módulos respeta la estructura real de Presea', () => {
  const definicion = service.definicionesDbi.MODULO;
  assert.equal(definicion.archivo, 'TALLES_MODULOS.DBI');
  assert.equal(definicion.campos.length, 101);
  assert.deepEqual(definicion.campos.slice(0, 6).map(x => [x.nombre, x.tipo, x.largo]), [['CODIGO','C',2],['NOMBRE','C',50],['_3M','N',2],['_6M','N',2],['_9M','N',2],['_12M','N',2]]);
  assert.deepEqual(definicion.campos.at(-1), { nombre: 'TALLE_COMP', tipo: 'L', largo: 1 });
  const fila = definicion.map({ CODIGO: '0A', NOMBRE: '35 AL 37 X 4', DATOS_JSON: JSON.stringify({ distribucion: { T35: 1, T36: 2, T37: 1 }, pares: 4 }) });
  assert.equal(fila.CODIGO, '0A');
  assert.equal(fila.T35, 1);
  assert.equal(fila.T36, 2);
  assert.equal(fila.PARES, 4);
});

test('la pantalla permite editar cantidades de módulos por rubro', () => {
  const vista = fs.readFileSync(path.join(process.cwd(), 'views/altas-maestros/index.hbs'), 'utf8');
  const frontend = fs.readFileSync(path.join(process.cwd(), 'public/js/altas-maestros.js'), 'utf8');
  assert.match(vista, /id="rubroModulo"/);
  assert.match(vista, /value="CALZADO"/);
  assert.match(vista, /value="INDUMENTARIA"/);
  assert.match(vista, /id="paresModuloTotal"/);
  assert.match(frontend, /tallesModuloPorRubro/);
  assert.match(frontend, /cantidad-talle-modulo/);
  assert.match(frontend, /actualizarTotalModulo/);
});

test('sugiere modelo dentro de la numeración de empresa, marca, rubro y licencia', async () => {
  const original = repository.listarModelosParaSugerencia;
  repository.listarModelosParaSugerencia = async () => [
    { CODIGO: 'AB0000', MARCA: 'AT', RUBRO: '01', LICENCIA: 'MARVEL' },
    { CODIGO: 'AB0001', MARCA: 'AT', RUBRO: '01', LICENCIA: 'MARVEL' },
    { CODIGO: 'CD0000', MARCA: 'AT', RUBRO: '02', LICENCIA: 'MARVEL' }
  ];
  try { assert.equal(await service.sugerirCodigoModelo(1, { marca: 'AT', rubro: '01', licencia: 'MARVEL' }), 'AB0002'); }
  finally { repository.listarModelosParaSugerencia = original; }
});

test('otras marcas continúan el máximo de la serie correspondiente a marca y rubro', async () => {
  const original = repository.listarModelosParaSugerencia;
  repository.listarModelosParaSugerencia = async () => [
    { CODIGO: '470510', MARCA: '47 STREET', RUBRO: 'ACCESORIO', LICENCIA: null },
    { CODIGO: '470517', MARCA: '47 STREET', RUBRO: 'CALZADO', LICENCIA: null },
    { CODIGO: 'KV103', MARCA: 'KEVINGSTON', RUBRO: 'CALZADO', LICENCIA: null },
    { CODIGO: 'MT0471', MARCA: 'MONTAGNE', RUBRO: 'CALZADO', LICENCIA: null },
    { CODIGO: 'MTOO7', MARCA: 'MONTAGNE', RUBRO: 'CALZADO', LICENCIA: null },
    { CODIGO: 'MC1275', MARCA: 'MASSIMO', RUBRO: 'ACCESORIOS', LICENCIA: null }
  ];
  try {
    assert.equal(await service.sugerirCodigoModelo(2, { marca: '47 STREET', rubro: 'ACCESORIO', licencia: 'SIN LICENCIA' }), '470511');
    assert.equal(await service.sugerirCodigoModelo(2, { marca: '47 STREET', rubro: 'CALZADO', licencia: 'SIN LICENCIA' }), '470518');
    assert.equal(await service.sugerirCodigoModelo(2, { marca: 'KEVINGSTON', rubro: 'CALZADO', licencia: 'SIN LICENCIA' }), 'KV104');
    assert.equal(await service.sugerirCodigoModelo(2, { marca: 'MONTAGNE', rubro: 'CALZADO', licencia: 'SIN LICENCIA' }), 'MT0472');
    assert.equal(await service.sugerirCodigoModelo(3, { marca: 'MASSIMO', rubro: 'ACCESORIOS', licencia: 'SIN LICENCIA' }), 'MC1276');
  } finally { repository.listarModelosParaSugerencia = original; }
});

test('una licencia nueva exige dos caracteres todavía no utilizados', async () => {
  const original = repository.listarModelosParaSugerencia;
  repository.listarModelosParaSugerencia = async () => [{ CODIGO: 'AB0000', MARCA: 'ATOMIK', RUBRO: '01', LICENCIA: 'MARVEL' }];
  try {
    await assert.rejects(() => service.sugerirCodigoModelo(1, { marca: 'ATOMIK', rubro: '01', licencia: 'NUEVA', nuevaLicencia: true, prefijo: 'AB' }), /ya están utilizados/);
    assert.equal(await service.sugerirCodigoModelo(1, { marca: 'ATOMIK', rubro: '01', licencia: 'NUEVA', nuevaLicencia: true, prefijo: 'XY' }), 'XY0000');
  } finally { repository.listarModelosParaSugerencia = original; }
});

test('continúa después del mayor correlativo de la licencia aunque existan huecos', async () => {
  const original = repository.listarModelosParaSugerencia;
  repository.listarModelosParaSugerencia = async () => [
    { CODIGO: 'VS0001', MARCA: 'ATOMIK', RUBRO: 'INDUMENTARIA', LICENCIA: 'VELEZ SARSFIELD' },
    { CODIGO: 'VS0031', MARCA: 'ATOMIK', RUBRO: 'INDUMENTARIA', LICENCIA: 'VELEZ SARSFIELD' },
    { CODIGO: 'VS0093', MARCA: 'ATOMIK', RUBRO: 'INDUMENTARIA', LICENCIA: 'VELEZ SARSFIELD' }
  ];
  try { assert.equal(await service.sugerirCodigoModelo(1, { marca: 'ATOMIK', rubro: 'INDUMENTARIA', licencia: 'VELEZ SARSFIELD' }), 'VS0094'); }
  finally { repository.listarModelosParaSugerencia = original; }
});

test('Talleres conserva CA y continúa el correlativo alfanumérico T###', async () => {
  const original = repository.listarModelosParaSugerencia;
  repository.listarModelosParaSugerencia = async () => [
    { CODIGO: 'CAT001', MARCA: 'ATOMIK', RUBRO: 'INDUMENTARIA', LICENCIA: 'TALLERES' },
    { CODIGO: 'CAT076', MARCA: 'ATOMIK', RUBRO: 'ACCESORIOS', LICENCIA: 'TALLERES' }
  ];
  try { assert.equal(await service.sugerirCodigoModelo(1, { marca: 'ATOMIK', rubro: 'INDUMENTARIA', licencia: 'TALLERES' }), 'CAT077'); }
  finally { repository.listarModelosParaSugerencia = original; }
});

test('indumentaria sin licencia utiliza la serie I de cinco números', async () => {
  const original = repository.listarModelosParaSugerencia;
  repository.listarModelosParaSugerencia = async () => [
    { CODIGO: 'I00027', MARCA: 'ATOMIK', RUBRO: 'INDUMENTARIA', LICENCIA: null },
    { CODIGO: 'I00029', MARCA: 'ATOMIK', RUBRO: 'INDUMENTARIA', LICENCIA: null }
  ];
  try { assert.equal(await service.sugerirCodigoModelo(1, { marca: 'ATOMIK', rubro: 'INDUMENTARIA', licencia: 'SIN LICENCIA' }), 'I00327'); }
  finally { repository.listarModelosParaSugerencia = original; }
});

test('calzado sin licencia continúa la serie numérica de seis posiciones', async () => {
  const original = repository.listarModelosParaSugerencia;
  repository.listarModelosParaSugerencia = async () => [
    { CODIGO: '505498', MARCA: 'ATOMIK', RUBRO: 'CALZADO', LICENCIA: null },
    { CODIGO: '505500', MARCA: 'ATOMIK', RUBRO: 'CALZADO', LICENCIA: null },
    { CODIGO: 'I00030', MARCA: 'ATOMIK', RUBRO: 'INDUMENTARIA', LICENCIA: null },
    { CODIGO: '600000', MARCA: 'OTRA', RUBRO: 'CALZADO', LICENCIA: null }
  ];
  try { assert.equal(await service.sugerirCodigoModelo(1, { marca: 'ATOMIK', rubro: 'CALZADO', licencia: 'SIN LICENCIA' }), '135184'); }
  finally { repository.listarModelosParaSugerencia = original; }
});

test('accesorios sin disciplina y POP usan sus series habilitadas', async () => {
  const original = repository.listarModelosParaSugerencia;
  repository.listarModelosParaSugerencia = async () => [
    { CODIGO: 'A00001', MARCA: 'ATOMIK', RUBRO: 'ACCESORIOS', LICENCIA: null },
    { CODIGO: 'P00001', MARCA: 'ATOMIK', RUBRO: 'POP', LICENCIA: null }
  ];
  try {
    assert.equal(await service.sugerirCodigoModelo(1, { marca: 'ATOMIK', rubro: 'ACCESORIOS', licencia: 'SIN LICENCIA', disciplina: 'SIN DISCIPLINA' }), '135184');
    assert.equal(await service.sugerirCodigoModelo(1, { marca: 'ATOMIK', rubro: 'POP', licencia: 'SIN LICENCIA' }), 'P00002');
  } finally { repository.listarModelosParaSugerencia = original; }
});

test('disciplina define las series de indumentaria y accesorios sin licencia', async () => {
  const original = repository.listarModelosParaSugerencia;
  repository.listarModelosParaSugerencia = async () => [
    { CODIGO: 'AF0001', MARCA: 'ATOMIK', RUBRO: 'INDUMENTARIA', LICENCIA: null },
    { CODIGO: 'A00001', MARCA: 'ATOMIK', RUBRO: 'ACCESORIOS', LICENCIA: null },
    { CODIGO: 'BK0000', MARCA: 'ATOMIK', RUBRO: 'INDUMENTARIA', LICENCIA: null }
  ];
  try {
    assert.equal(await service.sugerirCodigoModelo(1, { marca: 'ATOMIK', rubro: 'INDUMENTARIA', licencia: 'SIN LICENCIA', disciplina: 'FUTBOL' }), 'AF0002');
    assert.equal(await service.sugerirCodigoModelo(1, { marca: 'ATOMIK', rubro: 'ACCESORIOS', licencia: 'SIN LICENCIA', disciplina: 'COLEGIAL' }), 'A00002');
    assert.equal(await service.sugerirCodigoModelo(1, { marca: 'ATOMIK', rubro: 'INDUMENTARIA', licencia: 'SIN LICENCIA', disciplina: 'BASKET', prefijoDisciplina: 'BK' }), 'BK0001');
  } finally { repository.listarModelosParaSugerencia = original; }
});

test('fútbol comienza en AF0001 cuando la serie todavía está libre', async () => {
  const original = repository.listarModelosParaSugerencia;
  repository.listarModelosParaSugerencia = async () => [];
  try {
    assert.equal(await service.sugerirCodigoModelo(1, { marca: 'ATOMIK', rubro: 'INDUMENTARIA', licencia: 'SIN LICENCIA', disciplina: 'FUTBOL' }), 'AF0001');
  } finally { repository.listarModelosParaSugerencia = original; }
});

test('la pantalla incorpora el maestro de disciplinas a la asignación de modelos', () => {
  const vista = fs.readFileSync(path.join(process.cwd(), 'views/altas-maestros/index.hbs'), 'utf8');
  const js = fs.readFileSync(path.join(process.cwd(), 'public/js/altas-maestros.js'), 'utf8');
  assert.match(vista, /id="disciplinaModelo"/);
  assert.match(vista, /id="disciplinaModelosMasivos"/);
  assert.match(vista, /value="DISCIPLINAS"/);
  assert.match(js, /api\('\/api\/maestros\/deportes'\)/);
  assert.match(js, /prefijoDisciplina/);
});

test('San Lorenzo comparte la misma serie entre rubros', async () => {
  const original = repository.listarModelosParaSugerencia;
  repository.listarModelosParaSugerencia = async () => [
    { CODIGO: 'SL0189', MARCA: 'ATOMIK', RUBRO: 'CALZADO', LICENCIA: 'SAN LORENZO' }
  ];
  try { assert.equal(await service.sugerirCodigoModelo(1, { marca: 'ATOMIK', rubro: 'ACCESORIOS', licencia: 'SAN LORENZO' }), 'SL0190'); }
  finally { repository.listarModelosParaSugerencia = original; }
});

test('ATOMIK habilita y selecciona sin licencia aunque el rubro todavía no tenga modelos', () => {
  const js = fs.readFileSync(path.join(process.cwd(), 'public/js/altas-maestros.js'), 'utf8');
  assert.match(js, /\['INDUMENTARIA', 'CALZADO', 'POP', 'ACCESORIOS'\]/);
  assert.match(js, /CODIGO_LICENCIA: '__SIN_LICENCIA__'/);
  assert.match(js, /licenciaModelo'\)\.value = '__SIN_LICENCIA__'/);
});

test('el template asigna códigos distintos a todos los modelos del lote', async () => {
  const original = repository.listarModelosParaSugerencia;
  repository.listarModelosParaSugerencia = async () => [{ CODIGO: 'A00001', MARCA: 'ATOMIK', RUBRO: 'ACCESORIOS', LICENCIA: null }];
  const libro = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(libro, XLSX.utils.json_to_sheet([
    { NOMBRE_MODELO: 'BOLSO UNO', PROVEEDOR: 'PROVEEDOR UNO' },
    { NOMBRE_MODELO: 'BOLSO DOS', PROVEEDOR: 'PROVEEDOR DOS' }
  ]), 'Modelos');
  try {
    const resultado = await service.previsualizarModelos({ idEmpresa: 1, buffer: XLSX.write(libro, { type: 'buffer', bookType: 'xlsx' }), contexto: { marca: 'ATOMIK', rubro: 'ACCESORIOS', licencia: 'SIN LICENCIA' }, proveedores: [{ CODIGO: 'PB0001', NVA_RAZON_SOCIAL: 'PROVEEDOR UNO' }, { CODIGO: 'PB0002', NVA_RAZON_SOCIAL: 'PROVEEDOR DOS' }] });
    assert.equal(resultado.listos, 2);
    assert.deepEqual(resultado.filas.map(x => x.codigo), ['135184', '135185']);
    assert.deepEqual(resultado.filas.map(x => x.cProveedor), ['PB0001', 'PB0002']);
  } finally { repository.listarModelosParaSugerencia = original; }
});

test('la pantalla permite descargar, previsualizar y confirmar la carga masiva', () => {
  const vista = fs.readFileSync(path.join(process.cwd(), 'views/altas-maestros/index.hbs'), 'utf8');
  const rutas = fs.readFileSync(path.join(process.cwd(), 'src/routes/altasMaestros.routes.js'), 'utf8');
  assert.match(vista, /id="btnDescargarTemplateModelos"/);
  assert.match(vista, /id="tablaVistaPreviaModelos"/);
  assert.match(vista, /id="btnConfirmarModelosMasivos"/);
  assert.match(vista, /id="marcaModelosMasivos"/);
  assert.match(vista, /id="rubroModelosMasivos"/);
  assert.match(vista, /id="licenciaModelosMasivos"/);
  assert.match(rutas, /\/modelos\/vista-previa/);
  assert.match(rutas, /\/modelos\/confirmar/);
  assert.match(rutas, /\/modelos\/template/);
});

test('el selector usa el código PBXXXX del maestro de proveedores', () => {
  const js = fs.readFileSync(path.join(process.cwd(), 'public/js/altas-maestros.js'), 'utf8');
  assert.match(js, /String\(x\.CODIGO \|\| ''\)/);
  assert.match(js, /\^PB\[A-Z0-9\]\{4\}\$/);
  assert.doesNotMatch(js, /x\.PRESEA \|\| x\.CODIGO/);
});

test('rechaza proveedores que no tengan código PBXXXX', async () => {
  const libro = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(libro, XLSX.utils.json_to_sheet([{ NOMBRE_MODELO: 'MODELO PRUEBA', PROVEEDOR: '1234' }]), 'Modelos');
  const resultado = await service.previsualizarModelos({ idEmpresa: 1, buffer: XLSX.write(libro, { type: 'buffer', bookType: 'xlsx' }), contexto: { marca: 'ATOMIK', rubro: 'ACCESORIOS', licencia: 'SIN LICENCIA' }, proveedores: [{ CODIGO: 'PB0001', NVA_RAZON_SOCIAL: 'PROVEEDOR UNO' }] });
  assert.equal(resultado.listos, 0);
  assert.match(resultado.filas[0].error, /nombre exacto del maestro/);
});

test('marca las filas con nombre o proveedor vacío antes de guardar', async () => {
  const libro = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(libro, XLSX.utils.json_to_sheet([
    { NOMBRE_MODELO: '', PROVEEDOR: 'PB0001' },
    { NOMBRE_MODELO: 'MODELO SIN PROVEEDOR', PROVEEDOR: '' }
  ]), 'Modelos');
  const resultado = await service.previsualizarModelos({ idEmpresa: 1, buffer: XLSX.write(libro, { type: 'buffer', bookType: 'xlsx' }), contexto: { marca: 'ATOMIK', rubro: 'ACCESORIOS', licencia: 'SIN LICENCIA' }, proveedores: [{ CODIGO: 'PB0001', NVA_RAZON_SOCIAL: 'PB0001' }] });
  assert.equal(resultado.listos, 0);
  assert.match(resultado.filas[0].error, /nombre del modelo/);
  assert.match(resultado.filas[1].error, /proveedor de la fila/);
});

test('el template contiene el nombre exacto del proveedor y conserva su código PBXXXX', async () => {
  const original = maestrosRepository.buscarProveedores;
  maestrosRepository.buscarProveedores = async () => [
    { CODIGO: 'PB0001', NVA_RAZON_SOCIAL: 'PROVEEDOR UNO' },
    { CODIGO: '1234', NVA_RAZON_SOCIAL: 'NO VALIDO' }
  ];
  try {
    const archivo = await service.generarTemplateModelos(1);
    const libro = new (require('exceljs').Workbook)();
    await libro.xlsx.load(archivo);
    const hoja = libro.getWorksheet('Modelos');
    assert.equal(hoja.getCell('A1').value, 'NOMBRE_MODELO');
    assert.equal(hoja.getCell('B1').value, 'PROVEEDOR');
    assert.equal(hoja.getCell('B2').dataValidation.type, 'list');
    assert.equal(libro.getWorksheet('Proveedores').getCell('A2').value, 'PROVEEDOR UNO');
    assert.equal(libro.getWorksheet('Proveedores').getCell('B2').value, 'PB0001');
    assert.equal(libro.getWorksheet('Proveedores').getCell('A3').value, null);
  } finally { maestrosRepository.buscarProveedores = original; }
});

test('permite descargar la asignación antes de guardar las solicitudes', () => {
  const filas = [{ fila: 2, codigo: 'A00002', nombre: 'BOLSO UNO', marca: 'ATOMIK', rubro: 'ACCESORIOS', licencia: 'SIN LICENCIA', proveedorNombre: 'PROVEEDOR UNO', cProveedor: 'PB0001', estado: 'LISTO', error: '' }];
  const archivo = service.generarExcelVistaPreviaModelos(filas);
  const libro = XLSX.read(archivo, { type: 'buffer' });
  const datos = XLSX.utils.sheet_to_json(libro.Sheets[libro.SheetNames[0]]);
  assert.equal(datos[0].CODIGO_ASIGNADO, 'A00002');
  assert.equal(datos[0].NOMBRE_MODELO, 'BOLSO UNO');
  assert.equal(datos[0].PROVEEDOR, 'PROVEEDOR UNO');
  assert.equal(datos[0].CODIGO_PROVEEDOR, 'PB0001');
  const vista = fs.readFileSync(path.join(process.cwd(), 'views/altas-maestros/index.hbs'), 'utf8');
  const rutas = fs.readFileSync(path.join(process.cwd(), 'src/routes/altasMaestros.routes.js'), 'utf8');
  assert.match(vista, /id="btnDescargarVistaPreviaModelos"/);
  assert.match(rutas, /\/modelos\/descargar-vista-previa/);
});

test('la vista previa permite modificar solamente el nombre del modelo', () => {
  const js = fs.readFileSync(path.join(process.cwd(), 'public/js/altas-maestros.js'), 'utf8');
  assert.match(js, /class="form-control form-control-sm text-uppercase nombre-modelo-vista-previa"/);
  assert.match(js, /vistaPreviaModelos\[indice\]\.nombre = nombre/);
  assert.match(js, /tablaVistaPreviaModelos'\)\.addEventListener\('input', actualizarNombreModeloVistaPrevia\)/);
  assert.doesNotMatch(js, /class="[^"\n]*codigo-modelo-vista-previa/);
});

test('el envío a Presea informa al usuario y diferencia visualmente sus estados', () => {
  const vista = fs.readFileSync(path.join(process.cwd(), 'views/altas-maestros/index.hbs'), 'utf8');
  const js = fs.readFileSync(path.join(process.cwd(), 'public/js/altas-maestros.js'), 'utf8');
  assert.match(vista, /id="modalEnvioMaestros"/);
  assert.match(vista, /Archivo\s+enviado a Presea/);
  assert.match(js, /mostrarConfirmacionEnvioMaestros\(d\)/);
  assert.match(js, /TBL_MODELOS\.DBI/);
  assert.match(js, /PENDIENTE_ENVIO: \{ etiqueta: 'PENDIENTE DE ENVÍO', clase: 'text-bg-warning' \}/);
  assert.match(js, /ENVIADO_PRESEA: \{ etiqueta: 'ENVIADO A PRESEA', clase: 'text-bg-primary' \}/);
  assert.match(js, /CONFIRMADO_ERP: \{ etiqueta: 'REGISTRADO EN PRESEA', clase: 'text-bg-success' \}/);
  assert.match(js, /ERROR_ENVIO: \{ etiqueta: 'ERROR DE ENVÍO', clase: 'text-bg-danger' \}/);
});

test('una solicitud individual se revisa antes de quedar pendiente de envío', () => {
  const vista = fs.readFileSync(path.join(process.cwd(), 'views/altas-maestros/index.hbs'), 'utf8');
  const js = fs.readFileSync(path.join(process.cwd(), 'public/js/altas-maestros.js'), 'utf8');
  assert.match(vista, /id="modalConfirmarSolicitudMaestro"/);
  assert.match(vista, /La solicitud quedará\s+pendiente de envío a Presea/);
  assert.match(vista, /id="btnConfirmarSolicitudMaestro"/);
  assert.match(js, /function mostrarConfirmacionSolicitudMaestro/);
  assert.match(js, /async function confirmarSolicitudMaestro/);
  assert.match(js, /solicitudMaestroPorConfirmar = cuerpoSolicitudMaestro\(\)/);
  assert.match(js, /JSON\.stringify\(solicitudMaestroPorConfirmar\)/);
});
