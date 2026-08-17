const cron = require('node-cron');

const {
    importarTodosLosMaestros
} = require('../services/importarMaestros.service');


let ejecutando = false;


function iniciarJobMaestros() {

    cron.schedule(
        '*/10 * * * *',
        async () => {

            if (ejecutando) {

                console.log(
                    'Sincronización anterior todavía activa. ' +
                    'Se omite esta ejecución.'
                );

                return;
            }

            ejecutando = true;

            console.log('');
            console.log('======================================');
            console.log(
                'INICIO SINCRONIZACIÓN:',
                new Date().toLocaleString()
            );
            console.log('======================================');

            try {

                const resultados =
                    await importarTodosLosMaestros();

                console.table(resultados);

            } catch (error) {

                console.error(
                    'Error general:',
                    error
                );

            } finally {

                ejecutando = false;

                console.log(
                    'FIN SINCRONIZACIÓN:',
                    new Date().toLocaleString()
                );

            }
        }
    );

    console.log(
        'Job de maestros activo - frecuencia: 10 minutos.'
    );
}


module.exports = {
    iniciarJobMaestros
};