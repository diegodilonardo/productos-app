const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

test('actualizar el alta recarga colores sincronizados conservando selección y búsqueda', async () => {
  const fuente = fs.readFileSync(path.join(__dirname, '../public/js/alta-productos.js'), 'utf8');
  const funcion = fuente.slice(fuente.indexOf('async function actualizarColoresDisponibles()'), fuente.indexOf('async function actualizarAltaYColores()'));
  let checks = [{ value: '10', checked: true }];
  let contador = 0;
  let filtro = 0;
  const contexto = {
    Set, colores: [],
    document: { querySelectorAll: selector => selector.includes(':checked') ? checks.filter(c => c.checked) : checks },
    obtenerListado: async urls => { assert.deepEqual(Array.from(urls), ['/api/maestros/colores']); return [{ CODIGO_COLOR: '10' }, { CODIGO_COLOR: '0A' }]; },
    pintarColores: lista => { checks = lista.map(c => ({ value: c.CODIGO_COLOR, checked: false })); },
    actualizarCantidadColores: () => contador++,
    filtrarColores: () => filtro++
  };
  vm.createContext(contexto);
  vm.runInContext(funcion, contexto);
  await contexto.actualizarColoresDisponibles();
  assert.deepEqual(checks, [{ value: '10', checked: true }, { value: '0A', checked: false }]);
  assert.equal(contador, 1);
  assert.equal(filtro, 1);
  assert.match(fuente, /btnActualizarAlta'\)\.addEventListener\('click', actualizarAltaYColores\)/);
});
