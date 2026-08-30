const {
    maestros
} = require('../config/masters');

const {
    importarMaestroGenerico
} = require('./importadorGenerico.service');

const {
    importarTallesModulos
} = require('./importarTallesModulos.service');


async function importarTodosLosMaestros(
    contextoEmpresa = null
) {

    const resultados = [];

    const configuraciones = [
        ['ANOS', maestros.ANOS],
        ['COLORES', maestros.COLORES],
        ['CLASIFICACION', maestros.CLASIFICACION],
        ['CONCEPTOS', maestros.CONCEPTOS],
        ['DEPORTES', maestros.DEPORTES],
        ['EDADES', maestros.EDADES],
        ['GRUPOS', maestros.GRUPOS],
        ['LINEA', maestros.LINEA],
        ['MARCAS', maestros.MARCAS],
        ['MODELOS', maestros.MODELOS],
        ['ORIGENES', maestros.ORIGENES],
        ['PAISES', maestros.PAISES],
        ['RUBROS', maestros.RUBROS],
        ['SUBGRUPOS', maestros.SUBGRUPOS],
        ['TALLES', maestros.TALLES],
        ['TEMPORADAS', maestros.TEMPORADAS],
        ['SEXO', maestros.SEXO],
        ['RUBRO_FACT', maestros.RUBRO_FACT]
    ];

    for (
        const [
            nombreConfig,
            maestro
        ]
        of configuraciones
    ) {

        if (!maestro) {
            console.error(
                `No existe la configuración "${nombreConfig}" ` +
                `en config/masters.js`
            );

            resultados.push({
                maestro: nombreConfig,
                estado: 'ERROR',
                error:
                    `Configuración "${nombreConfig}" ` +
                    `no definida en masters.js`
            });

            continue;
        }

        try {
            console.log(
                `Procesando ${maestro.nombre}...`
            );

            const resultado =
                await importarMaestroGenerico(
                    maestro,
                    contextoEmpresa
                );

            resultados.push(
                resultado
            );

        } catch (error) {
            resultados.push({
                maestro: maestro.nombre,
                empresa:
                    contextoEmpresa &&
                    (
                        contextoEmpresa.codigoEmpresa ??
                        contextoEmpresa.CODIGO_EMPRESA
                    ),
                estado: 'ERROR',
                error: error.message
            });
        }
    }

    try {
        console.log(
            'Procesando TBL_TALLES_MODULOS...'
        );

        const resultadoModulos =
            await importarTallesModulos(
                contextoEmpresa
            );

        resultados.push(
            resultadoModulos
        );

    } catch (error) {
        resultados.push({
            maestro: 'TBL_TALLES_MODULOS',
            empresa:
                contextoEmpresa &&
                (
                    contextoEmpresa.codigoEmpresa ??
                    contextoEmpresa.CODIGO_EMPRESA
                ),
            estado: 'ERROR',
            error: error.message
        });
    }

    return resultados;
}


module.exports = {
    importarTodosLosMaestros
};
