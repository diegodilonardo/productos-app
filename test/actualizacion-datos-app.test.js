const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const leer = archivo => fs.readFileSync(path.join(__dirname, '..', archivo), 'utf8');

test('las respuestas dinámicas no se reutilizan desde la caché del navegador', () => {
  const app = leer('src/app.js');
  assert.match(app, /req\.path\.startsWith\('\/api\/'\)/);
  assert.match(app, /Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate'/);
});

test('las pantallas de consulta actualizan datos al volver a la aplicación', () => {
  const navbar = leer('public/js/navbar-session.js');
  assert.match(navbar, /app:datos-actualizar/);
  assert.match(navbar, /visibilitychange/);
  assert.match(navbar, /event\.persisted/);

  const pantallas = [
    ['public/js/dashboard.js', 'cargarDashboard'],
    ['public/js/altas-index.js', 'cargarAltas'],
    ['public/js/pedidos-index.js', 'cargarPedidos'],
    ['public/js/seguimiento.js', 'cargarTodo'],
    ['public/js/seguimiento-detalle.js', 'cargarDetalleSeguimiento'],
  ];

  for (const [archivo, funcion] of pantallas) {
    assert.match(
      leer(archivo),
      new RegExp(`app:datos-actualizar', ${funcion}`),
      `${archivo} debe actualizarse al recuperar el foco`
    );
  }
});
