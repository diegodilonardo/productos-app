require('dotenv').config();

const {
    getConnection
} = require('../config/database');

const {
    descargarMaestrosDeEmpresas
} = require('../services/descargarMaestrosFTP.service');


async function ejecutar() {

    try {

        await getConnection();


        const resultados =
            await descargarMaestrosDeEmpresas();


        console.table(
            resultados
        );


        const hayErrores =
            resultados.some(
                item =>
                    item.estado === 'ERROR'
            );


        process.exit(
            hayErrores
                ? 1
                : 0
        );


    } catch (error) {

        console.error(
            error
        );

        process.exit(1);
    }
}


ejecutar();
