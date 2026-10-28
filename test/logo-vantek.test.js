const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('el navbar utiliza la imagen de marca VANTEK', () => {
  const raiz = path.resolve(__dirname, '..');
  const navbar = fs.readFileSync(path.join(raiz, 'public', 'js', 'navbar-session.js'), 'utf8');
  const estilos = fs.readFileSync(path.join(raiz, 'public', 'css', 'app.css'), 'utf8');
  const logo = path.join(raiz, 'public', 'img', 'marcas', '80.png');

  assert.equal(fs.existsSync(logo), true);
  assert.ok(fs.statSync(logo).size > 0);
  assert.match(navbar, /identidad\.includes\('VANTEK'\)/);
  assert.match(navbar, /\/img\/marcas\/80\.png/);
  assert.match(navbar, /return 'marca-vantek'/);
  assert.match(estilos, /\.app-navbar-brand-chip\.marca-vantek\.has-logo[\s\S]*min-width:\s*176px/);
  assert.match(estilos, /\.app-navbar-brand-chip\.marca-vantek \.app-navbar-brand-logo[\s\S]*width:\s*170px/);
});
