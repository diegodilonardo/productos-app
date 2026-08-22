require('dotenv').config();

const {
    getConnection
} = require('../src/config/database');

const {
    sincronizarProveedores
} = require('../src/services/proveedoresSync.service');


async function main() {
    try {
        await getConnection();

        console.log('');
        console.log('==============================================');
        console.log(' SINCRONIZACION MAESTRO DE PROVEEDORES');
        console.log('==============================================');

        const resultado =
            await sincronizarProveedores();

        console.log(
            `Proveedores sincronizados: ${resultado.cantidad}`
        );

        console.log(
            'Origen:',
            resultado.urlOrigen
        );

        console.log('==============================================');
        console.log('');

        process.exit(0);

    } catch (error) {
        console.error('');
        console.error('ERROR SINCRONIZANDO PROVEEDORES:');
        console.error(error.message);
        console.error('');

        process.exit(1);
    }
}


main();
