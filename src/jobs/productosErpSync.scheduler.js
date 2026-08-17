require('dotenv').config();

const cron = require('node-cron');
const {
  ejecutarProductosErpSync,
} = require('./productosErpSync.job');

const CRON_PRODUCTOS_ERP =
  process.env.PRODUCTOS_ERP_CRON || '*/10 * * * *';

let primeraEjecucionFinalizada = false;

async function ejecutar() {
  try {
    const resultado = await ejecutarProductosErpSync();

    if (resultado) {
      console.log('[PRODUCTOS ERP] Resumen:', {
        registrosLeidos: resultado.registrosLeidos,
        insertados: resultado.insertados,
        actualizados: resultado.actualizados,
        confirmadosEnEstaSync: resultado.confirmadosEnEstaSync,
        pendientesTotal: resultado.pendientesTotal,
      });
    }

    return resultado;
  } catch (error) {
    /*
      El scheduler no se termina por un error puntual.
      Se registra el error y se volverá a intentar
      en la siguiente ejecución programada.
    */
    console.error(
      '[PRODUCTOS ERP] La sincronización falló:',
      error.message
    );

    return null;
  } finally {
    primeraEjecucionFinalizada = true;
  }
}

function iniciarSchedulerProductosErp() {
  if (!cron.validate(CRON_PRODUCTOS_ERP)) {
    throw new Error(
      `Expresión CRON inválida para PRODUCTOS_ERP_CRON: ${CRON_PRODUCTOS_ERP}`
    );
  }

  console.log(
    `[PRODUCTOS ERP] Scheduler activo - frecuencia: ${CRON_PRODUCTOS_ERP}`
  );

  /*
    Primera sincronización al arrancar.
    No esperamos 10 minutos para conocer el estado real.
  */
  ejecutar();

  cron.schedule(
    CRON_PRODUCTOS_ERP,
    async () => {
      await ejecutar();
    },
    {
      scheduled: true,
    }
  );
}

if (require.main === module) {
  try {
    iniciarSchedulerProductosErp();
  } catch (error) {
    console.error(
      '[PRODUCTOS ERP] No se pudo iniciar el scheduler:',
      error.message
    );
    process.exit(1);
  }
}

module.exports = {
  iniciarSchedulerProductosErp,
  ejecutarProductosErpProgramado: ejecutar,
};
