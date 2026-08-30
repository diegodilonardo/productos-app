const {
    descargarMaestrosDeEmpresas
} = require('./descargarMaestrosFTP.service');

const {
    importarTodosLosMaestros
} = require('./importarMaestros.service');


async function importarMaestrosMultiempresa() {

    /*
     * Paso 1:
     * descarga todos los juegos de maestros según
     * EMPRESAS + EMPRESAS_CONFIG.
     */
    const descargas =
        await descargarMaestrosDeEmpresas();

    const resultados = [];

    for (
        const descarga
        of descargas
    ) {

        if (
            descarga.estado !== 'OK'
        ) {
            resultados.push({
                empresa:
                    descarga.codigoEmpresa,
                razonSocial:
                    descarga.empresa,
                maestro:
                    'DESCARGA_FTP',
                estado:
                    'ERROR',
                error:
                    descarga.error
            });

            continue;
        }

        console.log('');
        console.log(
            '======================================'
        );
        console.log(
            `IMPORTANDO EMPRESA: ` +
            `${descarga.empresa} ` +
            `(${descarga.codigoEmpresa})`
        );
        console.log(
            '======================================'
        );

        const contextoEmpresa = {
            idEmpresa:
                descarga.idEmpresa,
            codigoEmpresa:
                String(
                    descarga.codigoEmpresa
                ),
            empresa:
                descarga.empresa,
            carpetaLocal:
                descarga.carpetaLocal
        };

        const resultadoEmpresa =
            await importarTodosLosMaestros(
                contextoEmpresa
            );

        resultados.push(
            ...resultadoEmpresa
        );
    }

    return resultados;
}


module.exports = {
    importarMaestrosMultiempresa
};
