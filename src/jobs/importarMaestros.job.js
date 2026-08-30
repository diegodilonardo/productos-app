require('dotenv').config();

const cron = require('node-cron');
const { spawn } = require('child_process');


const CRON_MAESTROS =
    process.env.MAESTROS_CRON ||
    '*/10 * * * *';

const MAESTROS_MAX_MS =
    numeroPositivo(
        process.env.MAESTROS_MAX_MS,
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

        clearTimeout(
            timerTimeout
        );

        timerTimeout = null;
    }
}


/* ============================================================
   WORKER AISLADO

   Este bloque se ejecuta solamente dentro del proceso hijo.
   Toda la sincronizacion real de maestros (FTP + importacion SQL)
   queda fuera del proceso web.
   ============================================================ */

async function ejecutarWorker(
    origen
) {

    const {
        importarMaestrosMultiempresa
    } = require(
        '../services/importarMaestrosMultiempresa.service'
    );

    const inicio =
        Date.now();


    console.log('');
    console.log(
        '======================================'
    );

    console.log(
        `[MAESTROS] INICIO ${origen}:`,
        new Date().toLocaleString()
    );

    console.log(
        '======================================'
    );


    try {

        const resultados =
            await importarMaestrosMultiempresa();

        console.table(
            resultados
        );

        const resultadosConError =
            Array.isArray(resultados)
                ? resultados.filter(
                    resultado => {

                        const estado =
                            String(
                                resultado &&
                                resultado.estado ||
                                ''
                            )
                                .trim()
                                .toUpperCase();

                        return (
                            estado === 'ERROR' ||
                            (
                                resultado &&
                                resultado.ok === false
                            )
                        );
                    }
                )
                : [];

        if (
            resultadosConError.length > 0
        ) {

            const error =
                new Error(
                    `La sincronización de maestros terminó con ` +
                    `${resultadosConError.length} resultado(s) en ERROR.`
                );

            error.resultados =
                resultados;

            throw error;
        }

        console.log(
            `[MAESTROS] FIN ${origen}:`,
            new Date().toLocaleString(),
            `(${Date.now() - inicio} ms)`
        );

        return resultados;

    } catch (error) {

        console.error(
            `[MAESTROS] ERROR ${origen}:`,
            error.message
        );

        console.log(
            `[MAESTROS] FIN ${origen}:`,
            new Date().toLocaleString(),
            `(${Date.now() - inicio} ms)`
        );

        throw error;
    }
}


/* ============================================================
   EJECUCION AISLADA CON WATCHDOG

   Tanto la sincronizacion inicial como la programada usan
   este mismo lock. Si el FTP, Presea o una operacion SQL no
   devuelve nunca el control, el watchdog finaliza solamente
   el proceso hijo y libera el scheduler/web.
   ============================================================ */

function ejecutarMaestros(
    origen = 'PROGRAMADO'
) {

    if (ejecutando) {

        console.log(
            `[MAESTROS] ${origen}: ejecución omitida; ` +
            'la sincronización anterior sigue activa.'
        );

        return Promise.resolve(null);
    }


    ejecutando = true;

    const inicio =
        Date.now();


    console.log(
        '[MAESTROS] Iniciando proceso aislado...',
        {
            origen,
            maxMs:
                MAESTROS_MAX_MS
        }
    );


    return new Promise(
        resolve => {

            const proceso =
                spawn(
                    process.execPath,
                    [
                        __filename,
                        '--run-once',
                        origen
                    ],
                    {
                        cwd:
                            process.cwd(),

                        stdio:
                            'inherit',

                        shell:
                            false,

                        windowsHide:
                            true
                    }
                );


            procesoActual =
                proceso;

            let vencioTimeout =
                false;

            let finalizado =
                false;


            function finalizar(
                resultado
            ) {

                if (finalizado) {
                    return;
                }

                finalizado =
                    true;

                limpiarTimeout();

                ejecutando =
                    false;

                procesoActual =
                    null;

                resolve(
                    resultado
                );
            }


            timerTimeout =
                setTimeout(
                    () => {

                        vencioTimeout =
                            true;

                        console.error(
                            '[MAESTROS] TIMEOUT: ' +
                            `superó ${MAESTROS_MAX_MS} ms. ` +
                            'Se finalizará solamente este proceso de sincronización.'
                        );

                        try {

                            proceso.kill();

                        } catch (error) {

                            console.error(
                                '[MAESTROS] No se pudo finalizar el proceso:',
                                error.message
                            );
                        }
                    },
                    MAESTROS_MAX_MS
                );


            proceso.on(
                'error',
                error => {

                    console.error(
                        '[MAESTROS] Error iniciando proceso:',
                        error.message
                    );

                    finalizar(
                        null
                    );
                }
            );


            proceso.on(
                'exit',
                (codigo, signal) => {

                    const ms =
                        Date.now() -
                        inicio;


                    if (vencioTimeout) {

                        console.error(
                            '[MAESTROS] Finalizada por TIMEOUT.',
                            {
                                origen,
                                codigo,
                                signal,
                                ms
                            }
                        );

                        return finalizar(
                            null
                        );
                    }


                    if (codigo === 0) {

                        console.log(
                            '[MAESTROS] Proceso finalizado OK.',
                            {
                                origen,
                                ms
                            }
                        );

                    } else {

                        console.error(
                            '[MAESTROS] Proceso finalizado con error.',
                            {
                                origen,
                                codigo,
                                signal,
                                ms
                            }
                        );
                    }


                    return finalizar(
                        codigo === 0
                            ? {
                                ok: true,
                                ms
                            }
                            : null
                    );
                }
            );
        }
    );
}


/* ============================================================
   SCHEDULER
   ============================================================ */

function iniciarJobMaestros() {

    if (
        !cron.validate(
            CRON_MAESTROS
        )
    ) {

        throw new Error(
            `Expresión CRON inválida para MAESTROS_CRON: ${CRON_MAESTROS}`
        );
    }


    cron.schedule(
        CRON_MAESTROS,
        () => {

            /*
             * No await:
             * la ejecucion tiene lock y watchdog propios.
             */
            ejecutarMaestros(
                'PROGRAMADO'
            );
        }
    );


    console.log(
        '[MAESTROS] Job activo',
        {
            cron:
                CRON_MAESTROS,

            maxMs:
                MAESTROS_MAX_MS
        }
    );
}


/* ============================================================
   EJECUCION INICIAL / MANUAL INTERNA
   ============================================================ */

function ejecutarMaestrosAhora() {

    return ejecutarMaestros(
        'INICIAL'
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


/* ============================================================
   ENTRY POINT DEL WORKER
   ============================================================ */

if (
    require.main === module &&
    process.argv[2] === '--run-once'
) {

    const origen =
        process.argv[3] ||
        'MANUAL';

    ejecutarWorker(
        origen
    )
        .then(
            () =>
                process.exit(0)
        )
        .catch(
            () =>
                process.exit(1)
        );
}


module.exports = {
    iniciarJobMaestros,
    ejecutarMaestrosAhora
};
