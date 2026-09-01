require('dotenv').config();

const {
    getConnection
} = require('../config/database');

const {
    importarMaestrosMultiempresa
} = require('../services/importarMaestrosMultiempresa.service');

function obtenerCodigoEmpresa(argumentos = process.argv.slice(2)) {
    const prefijo = '--empresa=';
    const argumento = argumentos.find(item => String(item).startsWith(prefijo));

    if (!argumento) {
        return null;
    }

    const codigo = String(argumento).slice(prefijo.length).trim();

    if (!codigo) {
        throw new Error('Debe informar un código en --empresa=.');
    }

    return codigo;
}


async function ejecutar() {

    try {

        await getConnection();

        const codigoEmpresa = obtenerCodigoEmpresa();

        const resultados =
            await importarMaestrosMultiempresa(codigoEmpresa);

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

module.exports = {
    obtenerCodigoEmpresa
};
