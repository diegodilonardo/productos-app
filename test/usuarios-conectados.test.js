const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const sesiones = require('../src/services/sesionesActivas.service');

test('registra actividad sin exponer el identificador de sesión', () => {
  sesiones.registrar({ sessionID: 'privada', session: { usuario: { idUsuario: 7, usuario: 'operador', nombre: 'Operador', empresas: [{ idEmpresa: 2, empresa: 'VICBOR' }] } }, get: nombre => nombre === 'x-id-empresa' ? '2' : '' });
  const lista = sesiones.listar();
  assert.equal(lista[0].usuario, 'operador');
  assert.equal(lista[0].empresa, 'VICBOR');
  assert.equal('idSesion' in lista[0], false);
  sesiones.eliminar('privada');
});

test('la consulta y la vista de conectados quedan restringidas a SUPER_ADMIN', () => {
  const rutas = fs.readFileSync(path.join(process.cwd(), 'src/routes/usuarios.routes.js'), 'utf8');
  const vista = fs.readFileSync(path.join(process.cwd(), 'views/usuarios/index.hbs'), 'utf8');
  assert.match(rutas, /router\.get\('\/conectados', requerirSuperAdmin/);
  assert.match(vista, /\{\{#if esSuperAdmin\}\}[\s\S]*panelUsuariosConectados/);
});
