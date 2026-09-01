const path =
    require('path');

const {
    getConnection
} = require('../config/database');

const {
    maestros
} = require('../config/masters');

const {
    descargarArchivos
} = require('./ftp.service');


/* =============================================================
   OBTENER EMPRESAS ACTIVAS CON RUTA DE MAESTROS
   ============================================================= */

async function obtenerEmpresasParaImportar() {

    const pool =
        await getConnection();


    const resultado =
        await pool.request().query(`
            SELECT
                E.ID_EMPRESA,
                E.CODIGO_EMPRESA,
                E.RAZON_SOCIAL,
                C.FTP_RUTA_MAESTROS

            FROM dbo.EMPRESAS E

            INNER JOIN dbo.EMPRESAS_CONFIG C
                ON C.ID_EMPRESA =
                   E.ID_EMPRESA

            WHERE
                E.ACTIVA = 1

                AND
                C.ACTIVA = 1

            ORDER BY
                E.ID_EMPRESA;
        `);


    return resultado.recordset;
}


/* =============================================================
   LISTADO DE ARCHIVOS CONFIGURADOS
   ============================================================= */

function obtenerArchivosMaestros() {

    const archivos =
        Object
            .values(
                maestros
            )
            .map(
                maestro =>
                    maestro &&
                    maestro.archivo
                        ? String(
                            maestro.archivo
                        ).trim()
                        : ''
            )
            .filter(Boolean);


    return [
        ...new Set(
            archivos
        )
    ];
}


/* =============================================================
   CARPETA LOCAL TEMPORAL
   ============================================================= */

function obtenerCarpetaLocal(
    empresa
) {

    const raiz =
        process.env.MAESTROS_TEMP_PATH
            ? String(
                process.env.MAESTROS_TEMP_PATH
            ).trim()
            : path.join(
                process.cwd(),
                'tmp',
                'maestros'
            );


    return path.join(
        raiz,
        String(
            empresa.ID_EMPRESA
        )
    );
}


/* =============================================================
   DESCARGAR MAESTROS DE TODAS LAS EMPRESAS ACTIVAS
   ============================================================= */

async function descargarMaestrosDeEmpresas(codigoEmpresa = null) {

    const empresasActivas =
        await obtenerEmpresasParaImportar();

    const codigoEmpresaNormalizado =
        codigoEmpresa == null
            ? ''
            : String(codigoEmpresa).trim();

    const empresas =
        codigoEmpresaNormalizado
            ? empresasActivas.filter(
                empresa =>
                    String(empresa.CODIGO_EMPRESA).trim() ===
                    codigoEmpresaNormalizado
            )
            : empresasActivas;

    if (
        !empresas ||
        empresas.length === 0
    ) {

        throw new Error(
            codigoEmpresaNormalizado
                ? `No existe una empresa activa con configuración FTP ` +
                  `para el código ${codigoEmpresaNormalizado}.`
                : 'No existen empresas activas con configuración FTP de maestros.'
        );
    }


    const archivos =
        obtenerArchivosMaestros();

    if (
        archivos.length === 0
    ) {

        throw new Error(
            'No existen archivos configurados en config/masters.js.'
        );
    }


    const resultados = [];


    for (
        const empresa
        of empresas
    ) {

        const carpetaLocal =
            obtenerCarpetaLocal(
                empresa
            );


        console.log('');
        console.log(
            `Descargando maestros de ` +
            `${empresa.RAZON_SOCIAL} ` +
            `(${empresa.CODIGO_EMPRESA})...`
        );

        console.log(
            `FTP: ${empresa.FTP_RUTA_MAESTROS}`
        );

        console.log(
            `Local: ${carpetaLocal}`
        );


        try {

            const descarga =
                await descargarArchivos(
                    empresa.FTP_RUTA_MAESTROS,
                    archivos,
                    carpetaLocal
                );


            resultados.push({
                idEmpresa:
                    empresa.ID_EMPRESA,

                codigoEmpresa:
                    empresa.CODIGO_EMPRESA,

                empresa:
                    empresa.RAZON_SOCIAL,

                estado:
                    'OK',

                archivos:
                    descarga.cantidad,

                carpetaLocal
            });


        } catch (error) {

            resultados.push({
                idEmpresa:
                    empresa.ID_EMPRESA,

                codigoEmpresa:
                    empresa.CODIGO_EMPRESA,

                empresa:
                    empresa.RAZON_SOCIAL,

                estado:
                    'ERROR',

                archivos:
                    0,

                carpetaLocal,

                error:
                    error.message
            });
        }
    }


    return resultados;
}


module.exports = {
    obtenerEmpresasParaImportar,
    obtenerArchivosMaestros,
    descargarMaestrosDeEmpresas
};
