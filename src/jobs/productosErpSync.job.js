require('dotenv').config();
const { sincronizarProductosErp } = require('../services/productosErpSync.service');

let ejecutando = false;

async function ejecutarProductosErpSync() {
  if (ejecutando) {
    console.log('[PRODUCTOS ERP] Sincronizacion omitida: ya hay una ejecucion en curso.');
    return null;
  }

  ejecutando = true;
  const inicio = Date.now();

  try {
    const resultado = await sincronizarProductosErp();
    console.log('[PRODUCTOS ERP] OK', {
      registros: resultado.registrosLeidos,
      insertados: resultado.insertados,
      actualizados: resultado.actualizados,
      confirmados: resultado.confirmadosEnEstaSync,
      pendientes: resultado.pendientesTotal,
      ms: Date.now() - inicio,
    });
    return resultado;
  } catch (error) {
    console.error('[PRODUCTOS ERP] ERROR:', error.message);
    throw error;
  } finally {
    ejecutando = false;
  }
}

if (require.main === module) {
  ejecutarProductosErpSync()
    .then((resultado) => {
      if (resultado) console.log(JSON.stringify(resultado, null, 2));
      process.exit(0);
    })
    .catch(() => process.exit(1));
}

module.exports = { ejecutarProductosErpSync };
