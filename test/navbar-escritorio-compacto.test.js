const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('el encabezado usa una distribución compacta sin superponer marcas y navegación', () => {
  const css = fs.readFileSync(path.join(__dirname, '../public/css/app.css'), 'utf8');
  const layout = fs.readFileSync(path.join(__dirname, '../views/layouts/main.hbs'), 'utf8');

  assert.match(css, /min-width:\s*1200px[\s\S]*max-width:\s*1999\.98px/);
  assert.match(css, /\.app-navbar-brand-chip\.has-logo[\s\S]*max-width:\s*104px/);
  assert.match(css, /\.app-navbar-link[\s\S]*white-space:\s*nowrap/);
  assert.match(layout, /\/css\/app\.css\?v=2p/);
});
