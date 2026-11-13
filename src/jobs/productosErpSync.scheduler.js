require('dotenv').config();

const cron = require('node-cron');
const path = require('path');
const { spawn } = require('child_process');

const CRON_PRODUCTOS_ERP =
  process.env.PRODUCTOS_ERP_CRON ||
  '*/10 * * * *';

const PRODUCTOS_ERP_MAX_MS =
  numeroPositivo(
    process.env.PRODUCTOS_ERP_MAX_MS,
    5 * 60 * 1000
  );

let ejecutando = false;
let procesoActual = null;
let timerTimeout = null;


function numeroPositivo(
  valor,
  defecto
) {
  const numero =
    Number(valor);

  return Number.isFinite(numero) &&
    numero > 0
      ? Math.trunc(numero)
      : defecto;
}


function limpiarTimeout() {
  if (timerTimeout) {
    clearTimeout(timerTimeout);
    timerTimeout = null;
  }
}


function ejecutar(codigoEmpresa = null) {
  if (ejecutando) {
    console.log(
      '[PRODUCTOS ERP] Ejecución omitida: ' +
      'la sincronización anterior sigue activa.'
    );

    return Promise.resolve({
      ok: false,
      omitida: true,
      motivo: 'EN_CURSO',
    });
  }

  ejecutando = true;

  const inicio =
    Date.now();

  const archivoJob =
    path.join(
      __dirname,
      'productosErpSync.job.js'
    );

  const codigoEmpresaNormalizado =
    codigoEmpresa == null
      ? ''
      : String(codigoEmpresa).trim();

  console.log(
    '[PRODUCTOS ERP] Iniciando proceso aislado...',
    {
      empresa: codigoEmpresaNormalizado || 'TODAS',
      maxMs: PRODUCTOS_ERP_MAX_MS,
    }
  );

  return new Promise(
    (resolve) => {

      const argumentos =
        codigoEmpresaNormalizado
          ? [archivoJob, `--empresa=${codigoEmpresaNormalizado}`]
          : [archivoJob];

      const proceso =
        spawn(
          process.execPath,
          argumentos,
          {
            cwd: process.cwd(),
            stdio: 'inherit',
            shell: false,
            windowsHide: true,
          }
        );

      procesoActual =
        proceso;

      let vencioTimeout =
        false;

      timerTimeout =
        setTimeout(
          () => {
            vencioTimeout =
              true;

            console.error(
              '[PRODUCTOS ERP] TIMEOUT: ' +
              `superó ${PRODUCTOS_ERP_MAX_MS} ms. ` +
              'Se finalizará solamente este proceso de sincronización.'
            );

            try {
              proceso.kill();
            } catch (error) {
              console.error(
                '[PRODUCTOS ERP] No se pudo finalizar el proceso:',
                error.message
              );
            }
          },
          PRODUCTOS_ERP_MAX_MS
        );

      proceso.on(
        'error',
        (error) => {
          limpiarTimeout();

          ejecutando =
            false;

          procesoActual =
            null;

          console.error(
            '[PRODUCTOS ERP] Error iniciando proceso:',
            error.message
          );

          resolve({
            ok: false,
            motivo: 'NO_INICIADO',
            error: error.message,
          });
        }
      );

      proceso.on(
        'exit',
        (codigo, signal) => {
          limpiarTimeout();

          ejecutando =
            false;

          procesoActual =
            null;

          const ms =
            Date.now() -
            inicio;

          if (vencioTimeout) {
            console.error(
              '[PRODUCTOS ERP] Finalizada por TIMEOUT.',
              {
                codigo,
                signal,
                ms,
              }
            );

            return resolve({
              ok: false,
              motivo: 'TIMEOUT',
              ms,
            });
          }

          if (codigo === 0) {
            console.log(
              '[PRODUCTOS ERP] Proceso finalizado OK.',
              { ms }
            );
          } else {
            console.error(
              '[PRODUCTOS ERP] Proceso finalizado con error.',
              {
                codigo,
                signal,
                ms,
              }
            );
          }

          return resolve(
            codigo === 0
              ? { ok: true, ms }
              : {
                  ok: false,
                  motivo: 'ERROR_JOB',
                  codigo,
                  signal,
                  ms,
                }
          );
        }
      );
    }
  );
}


function iniciarSchedulerProductosErp() {
  if (
    !cron.validate(
      CRON_PRODUCTOS_ERP
    )
  ) {
    throw new Error(
      `Expresión CRON inválida para PRODUCTOS_ERP_CRON: ${CRON_PRODUCTOS_ERP}`
    );
  }

  console.log(
    '[PRODUCTOS ERP] Scheduler activo',
    {
      cron:
        CRON_PRODUCTOS_ERP,
      maxMs:
        PRODUCTOS_ERP_MAX_MS,
    }
  );

  /*
   * Primera ejecución sin bloquear el arranque
   * del scheduler.
   */
  ejecutar();

  cron.schedule(
    CRON_PRODUCTOS_ERP,
    () => {
      /*
       * No await:
       * la ejecución tiene su propio lock y watchdog.
       */
      ejecutar();
    },
    {
      scheduled: true,
    }
  );
}


function cerrarProcesoActual() {
  limpiarTimeout();

  if (
    procesoActual &&
    !procesoActual.killed
  ) {
    try {
      procesoActual.kill();
    } catch (_) {}
  }
}


process.on(
  'SIGINT',
  cerrarProcesoActual
);

process.on(
  'SIGTERM',
  cerrarProcesoActual
);


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
  ejecutarProductosErpProgramado:
    ejecutar,
};
