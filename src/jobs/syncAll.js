require('dotenv').config();

const {
    getConnection
} = require('../config/database');

const {
    importarTodosLosMaestros
} = require('../services/importarMaestros.service');

const {
    iniciarJobMaestros
} = require('./importarMaestros.job');

const {
    iniciarSchedulerProductosErp
} = require('./productosErpSync.scheduler');


async function iniciarSincronizacionGeneral() {

    console.log('========================================');
    console.log(' PRODUCTOS_APP - SINCRONIZACION GENERAL');
    console.log('========================================');

    try {

        /*
         * 1) Verificamos conexión a SQL Server.
         */
        await getConnection();

        console.log('Conectado correctamente a PRODUCTOS_APP.');

        /*
         * 2) Sincronización inicial de maestros.
         *
         * importarMaestros.job.js solamente programa el cron.
         * Por eso hacemos explícitamente una primera ejecución
         * al arrancar, igual que veníamos haciendo en el flujo
         * de sincronización anterior.
         */
        console.log('');
        console.log('Ejecutando sincronización inicial de maestros...');

        const resultados =
            await importarTodosLosMaestros();

        console.table(resultados);

        /*
         * 3) Dejamos activo el cron de maestros cada 10 minutos.
         */
        iniciarJobMaestros();

        /*
         * 4) Dejamos activo el scheduler del Maestro de Productos ERP.
         *
         * Este scheduler ya ejecuta automáticamente una sincronización
         * inicial al arrancar y luego continúa cada 10 minutos.
         */
        iniciarSchedulerProductosErp();

        console.log('');
        console.log('========================================');
        console.log(' SINCRONIZACIONES ACTIVAS');
        console.log('========================================');
        console.log('Maestros       : cada 10 minutos');
        console.log('Productos ERP  : cada 10 minutos');
        console.log('');
        console.log('Presioná Ctrl+C para detener el proceso.');

    } catch (error) {

        console.error('');
        console.error(
            '[SYNC] Error iniciando la sincronización general:',
            error
        );

        process.exit(1);
    }
}


iniciarSincronizacionGeneral();
