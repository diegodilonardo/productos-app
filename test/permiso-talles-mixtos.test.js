const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

test('Usuarios administra el permiso de talles mixtos por empresa', () => {
  const migracion = fs.readFileSync('sql/32_permiso_talles_mixtos_usuarios.sql', 'utf8');
  const repositorio = fs.readFileSync('src/repositories/usuarios.repository.js', 'utf8');
  const auth = fs.readFileSync('src/services/auth.service.js', 'utf8');
  const interfaz = fs.readFileSync('public/js/usuarios-admin-v2f.js', 'utf8');

  assert.match(migracion, /PUEDE_USAR_TALLES_MIXTOS BIT NOT NULL/);
  assert.match(repositorio, /PUEDE_USAR_TALLES_MIXTOS/);
  assert.match(auth, /puedeUsarTallesMixtos/);
  assert.match(interfaz, /permiso-talles-mixtos/);
  assert.match(interfaz, /Permitir talles mixtos/);
});

test('SUPER_ADMIN conserva habilitación total para talles mixtos', () => {
  const auth = fs.readFileSync('src/services/auth.service.js', 'utf8');
  assert.match(auth, /puedeUsarTallesMixtos:\s*true/);
});
