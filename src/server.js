require('dotenv').config();

const app = require('./app');

const {
    getConnection
} = require('./config/database');

const {
    importarTodosLosMaestros
} = require('./services/importarMaestros.service');

const {
    iniciarJobMaestros
} = require('./jobs/importarMaestros.job');

const {
    iniciarSchedulerProductosErp
} = require('./jobs/productosErpSync.scheduler');


const PORT = process.env.PORT || 3000;


async function iniciarServidor() {

    try {

        /* ==============================================
           SQL SERVER
           ============================================== */

        await getConnection();

        console.log(
            'Conectado correctamente a PRODUCTOS_APP.'
        );


        /* ==============================================
           IMPORTACIÓN INICIAL
           ============================================== */

        console.log(
            'Ejecutando sincronización inicial...'
        );

        const resultadoInicial =
            await importarTodosLosMaestros();

        console.table(resultadoInicial);


        /* ==============================================
           CRON
           ============================================== */

        iniciarJobMaestros();

        iniciarSchedulerProductosErp();


        /* ==============================================
           API
           ============================================== */

        app.listen(PORT, () => {

            console.log(
                `Servidor activo en puerto ${PORT}`
            );

        });

    } catch (error) {

        console.error(
            'No se pudo iniciar la aplicación:',
            error
        );

        process.exit(1);
    }
}


iniciarServidor();