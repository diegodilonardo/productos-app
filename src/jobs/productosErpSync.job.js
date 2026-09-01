require('dotenv').config();
const { sincronizarProductosErp } = require('../services/productosErpSync.service');

let ejecutando = false;

function obtenerCodigoEmpresa(argumentos = process.argv.slice(2)) {
  const prefijo = '--empresa=';
  const argumento = argumentos.find(item => String(item).startsWith(prefijo));

  if (!argumento) return null;

  const codigo = String(argumento).slice(prefijo.length).trim();
  if (!codigo) throw new Error('Debe informar un código en --empresa=.');
  return codigo;
}

async function ejecutarProductosErpSync(codigoEmpresa = null) {
  if (ejecutando) {
    console.log('[PRODUCTOS ERP] Sincronizacion omitida: ya hay una ejecucion en curso.');
    return null;
  }

  ejecutando = true;
  const inicio = Date.now();

  try {
    const resultado = await sincronizarProductosErp(codigoEmpresa);
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
  let codigoEmpresa;

  try {
    codigoEmpresa = obtenerCodigoEmpresa();
  } catch (error) {
    console.error('[PRODUCTOS ERP] ERROR:', error.message);
    process.exit(1);
  }

  ejecutarProductosErpSync(codigoEmpresa)
    .then((resultado) => {
      if (resultado) console.log(JSON.stringify(resultado, null, 2));
      process.exit(0);
    })
    .catch(() => process.exit(1));
}

module.exports = { ejecutarProductosErpSync, obtenerCodigoEmpresa };
