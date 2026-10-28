const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('el navbar utiliza la imagen de marca VANTEK', () => {
  const raiz = path.resolve(__dirname, '..');
  const navbar = fs.readFileSync(path.join(raiz, 'public', 'js', 'navbar-session.js'), 'utf8');
  const logo = path.join(raiz, 'public', 'img', 'marcas', '80.png');

  assert.equal(fs.existsSync(logo), true);
  assert.ok(fs.statSync(logo).size > 0);
  assert.match(navbar, /identidad\.includes\('VANTEK'\)/);
  assert.match(navbar, /\/img\/marcas\/80\.png/);
});
