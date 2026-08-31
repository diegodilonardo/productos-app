const test = require('node:test');
const assert = require('node:assert/strict');

const authService = require('../src/services/auth.service');
const authRepository = require('../src/repositories/auth.repository');
const authMiddleware = require('../src/middlewares/auth.middleware');

function reemplazarRepositorio(t, reemplazos) {
  const originales = {};
  for (const [nombre, implementacion] of Object.entries(reemplazos)) {
    originales[nombre] = authRepository[nombre];
    authRepository[nombre] = implementacion;
  }
  t.after(() => {
    for (const [nombre, implementacion] of Object.entries(originales)) {
      authRepository[nombre] = implementacion;
    }
  });
}

function usuarioBase(id = 10) {
  return {
    ID_USUARIO: id,
    USUARIO: `usuario${id}`,
    NOMBRE: `Usuario ${id}`,
    EMAIL: `usuario${id}@test.local`,
    SESION_VERSION: 1,
    DEBE_CAMBIAR_PASSWORD: false,
  };
}

function requestConEmpresa(contexto, idEmpresa) {
  return {
    session: { usuario: contexto },
    query: {},
    body: {},
    get(nombre) {
      return nombre.toLowerCase() === 'x-id-empresa' ? String(idEmpresa ?? '') : '';
    },
  };
}

test('SUPER_ADMIN recibe todas las empresas y alcance total', async t => {
  reemplazarRepositorio(t, {
    obtenerRolesGlobales: async () => [{ CODIGO_ROL: 'SUPER_ADMIN' }],
    obtenerTodasEmpresas: async () => [
      { ID_EMPRESA: 1, CODIGO_EMPRESA: 'VICBOR', RAZON_SOCIAL: 'VICBOR' },
      { ID_EMPRESA: 2, CODIGO_EMPRESA: 'MIDING', RAZON_SOCIAL: 'MIDING' },
    ],
  });

  const contexto = await authService.construirContextoUsuario(usuarioBase(1));
  assert.equal(contexto.superAdmin, true);
  assert.equal(contexto.empresas.length, 2);
  assert.ok(contexto.empresas.every(item =>
    item.rol === 'SUPER_ADMIN' && item.todasMarcas && item.todosRubros && item.todasLicencias
  ));
});

test('un usuario común conserva únicamente empresas y scopes asignados', async t => {
  reemplazarRepositorio(t, {
    obtenerRolesGlobales: async () => [],
    obtenerAccesosEmpresa: async () => [{
      ID_ACCESO: 50,
      ID_EMPRESA: 2,
      CODIGO_EMPRESA: 'MIDING',
      RAZON_SOCIAL: 'MIDING',
      CODIGO_ROL: 'OPERADOR',
      TODAS_MARCAS: false,
      TODOS_RUBROS: false,
      TODAS_LICENCIAS: false,
    }],
    obtenerMarcasAcceso: async () => [{ ID_EMPRESA_MARCA: 8, CODIGO_MARCA: '47', DETALLE_MARCA: '47 STREET' }],
    obtenerRubrosAcceso: async () => [{ CODIGO_RUBRO: 'CALZADO', DETALLE_RUBRO: 'CALZADO' }],
    obtenerLicenciasAcceso: async () => [{ LICENCIA: 'SIN LICENCIA' }],
  });

  const contexto = await authService.construirContextoUsuario(usuarioBase());
  assert.equal(contexto.superAdmin, false);
  assert.deepEqual(contexto.empresas.map(item => item.idEmpresa), [2]);
  assert.equal(contexto.empresas[0].rol, 'OPERADOR');
  assert.deepEqual(contexto.empresas[0].marcas.map(item => item.codigoMarca), ['47']);
  assert.deepEqual(contexto.empresas[0].rubros.map(item => item.codigoRubro), ['CALZADO']);
  assert.deepEqual(contexto.empresas[0].licencias, ['SIN LICENCIA']);
});

test('el backend rechaza una empresa que no pertenece al usuario', () => {
  const contexto = {
    superAdmin: false,
    empresas: [{ idEmpresa: 2, rol: 'OPERADOR' }],
  };
  assert.throws(
    () => authMiddleware.resolverIdEmpresa(requestConEmpresa(contexto, 1)),
    error => error.status === 403 && /No tiene permisos/.test(error.message)
  );
});

test('un usuario multiempresa debe seleccionar empresa explícitamente', () => {
  const contexto = {
    superAdmin: true,
    empresas: [{ idEmpresa: 1, rol: 'SUPER_ADMIN' }, { idEmpresa: 2, rol: 'SUPER_ADMIN' }],
  };
  assert.throws(
    () => authMiddleware.resolverIdEmpresa(requestConEmpresa(contexto, null)),
    error => error.status === 400 && /seleccionar una empresa/.test(error.message)
  );
});

test('ADMIN y OPERADOR escriben; un rol de consulta queda bloqueado', () => {
  assert.equal(authMiddleware.rolPermiteEscritura('SUPER_ADMIN'), true);
  assert.equal(authMiddleware.rolPermiteEscritura(' admin '), true);
  assert.equal(authMiddleware.rolPermiteEscritura('OPERADOR'), true);
  assert.equal(authMiddleware.rolPermiteEscritura('CONSULTA'), false);
  assert.equal(authMiddleware.rolPermiteEscritura('LECTURA'), false);
  assert.equal(authMiddleware.rolPermiteEscritura(''), false);
});

test('una empresa única se resuelve automáticamente sin mezclar contextos', () => {
  const acceso = { idEmpresa: 2, rol: 'ADMIN', todasMarcas: true };
  const contexto = { superAdmin: false, empresas: [acceso] };
  const resultado = authMiddleware.resolverIdEmpresa(requestConEmpresa(contexto, null));
  assert.equal(resultado.idEmpresa, 2);
  assert.equal(resultado.acceso, acceso);
});
