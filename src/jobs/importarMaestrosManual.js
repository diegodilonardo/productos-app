require('dotenv').config();

const {
    getConnection
} = require('../config/database');

const {
    importarTodosLosMaestros
} = require('../services/importarMaestros.service');


async function ejecutar() {

    try {

        await getConnection();

        const resultado =
            await importarTodosLosMaestros();

        console.table(resultado);

        process.exit(0);

    } catch (error) {

        console.error(error);

        process.exit(1);
    }
}


ejecutar();