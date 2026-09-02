require('dotenv').config();

const app = require('./app');

const {
    getConnection
} = require('./config/database');

const {
    iniciarJobMaestros,
    ejecutarMaestrosAhora
} = require('./jobs/importarMaestros.job');

const {
    iniciarSchedulerProductosErp
} = require('./jobs/productosErpSync.scheduler');


const PORT =
    process.env.PORT ||
    3000;


/* ============================================================
   SINCRONIZACION INICIAL EN SEGUNDO PLANO

   IMPORTANTE:
   - Nunca bloquea app.listen().
   - Un error de FTP no baja la aplicacion.
   - Usa el mismo lock del job programado para evitar solapamientos.
   ============================================================ */

function iniciarSincronizacionInicial() {

    console.log(
        'Sincronización inicial de maestros iniciada en segundo plano.'
    );

    Promise
        .resolve()
        .then(
            () =>
                ejecutarMaestrosAhora()
        )
        .catch(
            error => {

                /*
                 * Defensa adicional.
                 * ejecutarMaestrosAhora ya captura sus errores,
                 * pero este catch garantiza que una excepción
                 * inesperada nunca se convierta en un rechazo
                 * no controlado del proceso web.
                 */
                console.error(
                    '[MAESTROS] Error inesperado en sincronización inicial:',
                    error.message
                );
            }
        );
}


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
           API

           La web queda disponible ANTES de cualquier FTP.
           ============================================== */

        app.listen(
            PORT,'0.0.0.0',
            () => {

                console.log(
                    `Servidor activo en puerto ${PORT}`
                );

                /*
                 * Los schedulers se levantan una vez que
                 * la API ya esta escuchando.
                 */
                iniciarJobMaestros();

                iniciarSchedulerProductosErp();

                /*
                 * La carga inicial deja de formar parte
                 * del camino critico de arranque.
                 */
                iniciarSincronizacionInicial();
            }
        );

    } catch (error) {

        /*
         * Solo un fallo critico de infraestructura local
         * (por ejemplo SQL Server) impide iniciar la app.
         * Los fallos FTP ya no llegan hasta aqui.
         */
        console.error(
            'No se pudo iniciar la aplicación:',
            error
        );

        process.exit(1);
    }
}


iniciarServidor();
