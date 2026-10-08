const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

test('la aplicación ofrece una ayuda funcional accesible desde la navegación', () => {
  const rutas = fs.readFileSync('src/routes/web.routes.js', 'utf8');
  const navbar = fs.readFileSync('views/partials/navbar.hbs', 'utf8');
  const vista = fs.readFileSync('views/ayuda.hbs', 'utf8');

  assert.match(rutas, /router\.get\('\/ayuda'/);
  assert.match(rutas, /res\.render\('ayuda'/);
  assert.match(navbar, /href="\/ayuda"/);
  assert.match(navbar, /<span>Ayuda<\/span>/);

  for (const seccion of ['Dashboard', 'Maestros', 'Reportes', 'Altas', 'Pedidos', 'Seguimiento', 'Usuarios']) {
    assert.match(vista, new RegExp(`>${seccion}<`));
  }
});
