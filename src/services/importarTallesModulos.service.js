const fs = require('fs');
const path = require('path');

const {
    maestros,
    obtenerRutaMaestro
} = require('../config/masters');

const {
    obtenerMetadataArchivo,
    calcularHashArchivo,
    leerArchivoPipe
} = require('../utils/fileParser');

const {
    obtenerUltimoHashOK,
    crearControlImportacion,
    finalizarControlImportacion
} = require('./controlImportaciones.service');

const {
    getConnection,
    sql
} = require('../config/database');


const columnasTalles = [
    'T01','T02','T03','T04','T05','T06','T07','T08',
    'T10','T12','T14','T15','T16','T17','T18','T19',
    'T20','T21','T22','T23','T24','T25','T26','T27','T28','T29',
    'T30','T31','T32','T33','T34','T35','T36','T37','T38','T385','T39','T395',
    'T40','T405','T41','T415','T42','T425','T43','T435','T44','T445','T45','T455',
    'T46','T47','T48','T49','T50',
    'T_XS','T_S','T_L','T_M','T_XL','T_2XL','T_3XL'
];

const columnasArchivo = [
    'CODIGO_MODULO',
    'DETALLE_MODULO',
    ...columnasTalles,
    'PARES'
];


function resolverContextoEmpresa(contextoEmpresa) {
    if (!contextoEmpresa) {
        return {
            idEmpresa: 1,
            codigoEmpresa: '0',
            carpetaLocal: null
        };
    }

    const idEmpresa = Number(
        contextoEmpresa.idEmpresa ??
        contextoEmpresa.ID_EMPRESA
    );

    const codigoEmpresa = String(
        contextoEmpresa.codigoEmpresa ??
        contextoEmpresa.CODIGO_EMPRESA ??
        ''
    ).trim();

    const carpetaLocal =
        contextoEmpresa.carpetaLocal
            ? String(contextoEmpresa.carpetaLocal)
            : null;

    if (!Number.isInteger(idEmpresa) || idEmpresa <= 0) {
        throw new Error('ID_EMPRESA inválido para TALLES_MODULOS.');
    }

    if (!codigoEmpresa) {
        throw new Error('CODIGO_EMPRESA vacío para TALLES_MODULOS.');
    }

    return {
        idEmpresa,
        codigoEmpresa,
        carpetaLocal
    };
}


function convertirCantidad(
    valor,
    nombreCampo,
    numeroLinea
) {
    const texto =
        valor === undefined ||
        valor === null
            ? ''
            : String(valor).trim();

    if (texto === '') {
        return 0;
    }

    if (!/^\d+$/.test(texto)) {
        throw new Error(
            `Valor inválido en ${nombreCampo}, ` +
            `línea ${numeroLinea}: "${texto}".`
        );
    }

    const numero = Number(texto);

    if (!Number.isInteger(numero) || numero < 0) {
        throw new Error(
            `${nombreCampo} debe ser un entero mayor ` +
            `o igual a cero en línea ${numeroLinea}.`
        );
    }

    return numero;
}


async function cargarStagingBulk(
    transaction,
    registros,
    idImportacion,
    idEmpresa
) {

    const table =
        new sql.Table(
            'dbo.STG_MAESTRO_TALLES_MODULOS'
        );

    table.create = false;

    table.columns.add(
        'ID_IMPORTACION',
        sql.BigInt,
        { nullable: false }
    );

    table.columns.add(
        'ID_EMPRESA',
        sql.Int,
        { nullable: false }
    );

    table.columns.add(
        'CODIGO_MODULO',
        sql.VarChar(2),
        { nullable: false }
    );

    table.columns.add(
        'DETALLE_MODULO',
        sql.VarChar(100),
        { nullable: false }
    );

    for (const columna of columnasTalles) {
        table.columns.add(
            columna,
            sql.Int,
            { nullable: false }
        );
    }

    table.columns.add(
        'PARES',
        sql.Int,
        { nullable: false }
    );

    table.columns.add(
        'TOTAL_CALCULADO',
        sql.Int,
        { nullable: false }
    );

    table.columns.add(
        'ES_CONSISTENTE',
        sql.Bit,
        { nullable: false }
    );

    table.columns.add(
        'OBSERVACION',
        sql.VarChar(300),
        { nullable: true }
    );

    for (const registro of registros) {
        const valores = [
            idImportacion,
            idEmpresa,
            registro.CODIGO_MODULO,
            registro.DETALLE_MODULO
        ];

        for (const columna of columnasTalles) {
            valores.push(
                registro[columna]
            );
        }

        valores.push(
            registro.PARES,
            registro.TOTAL_CALCULADO,
            registro.ES_CONSISTENTE,
            registro.OBSERVACION
        );

        table.rows.add(...valores);
    }

    const request =
        new sql.Request(transaction);

    await request.bulk(table);
}


async function importarTallesModulos(
    contextoEmpresa = null
) {

    const maestro = maestros.TALLES_MODULOS;

    if (!maestro) {
        throw new Error(
            'No está configurado TALLES_MODULOS en masters.js'
        );
    }

    const empresa =
        resolverContextoEmpresa(
            contextoEmpresa
        );

    const rutaArchivo =
        empresa.carpetaLocal
            ? path.join(
                empresa.carpetaLocal,
                maestro.archivo
            )
            : obtenerRutaMaestro(
                maestro
            );

    let idImportacion = null;

    try {
        if (!fs.existsSync(rutaArchivo)) {
            throw new Error(
                `No se encontró el archivo: ${rutaArchivo}`
            );
        }

        const metadata =
            await obtenerMetadataArchivo(
                rutaArchivo
            );

        const hash =
            await calcularHashArchivo(
                rutaArchivo
            );

        const ultimoHash =
            await obtenerUltimoHashOK(
                maestro.nombre,
                empresa.idEmpresa
            );

        if (ultimoHash === hash) {
            idImportacion =
                await crearControlImportacion({
                    maestro: maestro.nombre,
                    archivo: maestro.archivo,
                    estado: 'SIN_CAMBIOS',
                    hash,
                    tamano: metadata.tamano,
                    fechaArchivo: metadata.fechaModificacion,
                    idEmpresa: empresa.idEmpresa
                });

            await finalizarControlImportacion(
                idImportacion,
                {
                    estado: 'SIN_CAMBIOS',
                    mensaje:
                        `El archivo no presenta cambios. ` +
                        `Empresa: ${empresa.codigoEmpresa}.`
                }
            );

            return {
                maestro: maestro.nombre,
                empresa: empresa.codigoEmpresa,
                estado: 'SIN_CAMBIOS'
            };
        }

        idImportacion =
            await crearControlImportacion({
                maestro: maestro.nombre,
                archivo: maestro.archivo,
                estado: 'EJECUTANDO',
                hash,
                tamano: metadata.tamano,
                fechaArchivo: metadata.fechaModificacion,
                idEmpresa: empresa.idEmpresa
            });

        /*
         * Estructura histórica + CODIGO_EMPRESA al final.
         */
        const filas =
            await leerArchivoPipe(
                rutaArchivo,
                columnasArchivo.length + 1
            );

        const registros = [];
        const codigos = new Set();

        for (
            let i = 0;
            i < filas.length;
            i++
        ) {
            const numeroLinea = i + 1;
            const fila = filas[i];

            const codigo =
                String(
                    fila[0] || ''
                ).trim();

            if (!codigo) {
                throw new Error(
                    `CODIGO_MODULO vacío en línea ${numeroLinea}.`
                );
            }

            if (codigo.length > 2) {
                throw new Error(
                    `CODIGO_MODULO "${codigo}" supera los 2 caracteres ` +
                    `en línea ${numeroLinea}.`
                );
            }

            if (codigos.has(codigo)) {
                throw new Error(
                    `CODIGO_MODULO duplicado "${codigo}" ` +
                    `en línea ${numeroLinea}.`
                );
            }

            codigos.add(codigo);

            const detalle =
                String(
                    fila[1] || ''
                ).trim();

            if (!detalle) {
                throw new Error(
                    `DETALLE_MODULO vacío para el módulo ${codigo}.`
                );
            }

            if (detalle.length > 100) {
                throw new Error(
                    `DETALLE_MODULO del módulo ${codigo} ` +
                    `supera 100 caracteres.`
                );
            }

            const registro = {
                CODIGO_MODULO: codigo,
                DETALLE_MODULO: detalle
            };

            let totalCalculado = 0;
            let indiceArchivo = 2;

            for (const columna of columnasTalles) {
                const cantidad =
                    convertirCantidad(
                        fila[indiceArchivo],
                        columna,
                        numeroLinea
                    );

                registro[columna] =
                    cantidad;

                totalCalculado +=
                    cantidad;

                indiceArchivo++;
            }

            const textoPares =
                String(
                    fila[indiceArchivo] || ''
                ).trim();

            if (!/^\d+$/.test(textoPares)) {
                throw new Error(
                    `PARES inválido para el módulo ${codigo}, ` +
                    `línea ${numeroLinea}: "${textoPares}".`
                );
            }

            const pares =
                Number(textoPares);

            if (!Number.isInteger(pares) || pares <= 0) {
                throw new Error(
                    `PARES debe ser mayor a cero ` +
                    `para el módulo ${codigo}.`
                );
            }

            registro.PARES = pares;
            registro.TOTAL_CALCULADO =
                totalCalculado;

            let observacion = null;

            if (totalCalculado === 0) {
                observacion =
                    'La curva no contiene cantidades por talle.';
            }

            if (totalCalculado !== pares) {
                const mensaje =
                    `PARES=${pares}, ` +
                    `TOTAL_CALCULADO=${totalCalculado}.`;

                observacion =
                    observacion
                        ? `${observacion} ${mensaje}`
                        : mensaje;
            }

            registro.ES_CONSISTENTE =
                totalCalculado > 0 &&
                totalCalculado === pares
                    ? 1
                    : 0;

            registro.OBSERVACION =
                observacion;

            /*
             * El índice actual apunta a PARES.
             * CODIGO_EMPRESA está inmediatamente después.
             */
            const codigoEmpresaArchivo =
                String(
                    fila[indiceArchivo + 1] ?? ''
                ).trim();

            if (!codigoEmpresaArchivo) {
                throw new Error(
                    `CODIGO_EMPRESA vacío en línea ${numeroLinea} ` +
                    `de TBL_TALLES_MODULOS.`
                );
            }

            if (
                codigoEmpresaArchivo !==
                empresa.codigoEmpresa
            ) {
                throw new Error(
                    `Empresa incorrecta en TBL_TALLES_MODULOS, ` +
                    `línea ${numeroLinea}. ` +
                    `Esperada: ${empresa.codigoEmpresa}. ` +
                    `Archivo: ${codigoEmpresaArchivo}.`
                );
            }

            registros.push(
                registro
            );
        }

        if (registros.length === 0) {
            throw new Error(
                'TBL_TALLES_MODULOS está vacío.'
            );
        }

        const pool =
            await getConnection();

        const transaction =
            new sql.Transaction(
                pool
            );

        await transaction.begin();

        try {
            const requestBase = () =>
                new sql.Request(transaction)
                    .input(
                        'ID_IMPORTACION',
                        sql.BigInt,
                        idImportacion
                    )
                    .input(
                        'ID_EMPRESA',
                        sql.Int,
                        empresa.idEmpresa
                    );

            await requestBase().query(`
                DELETE
                FROM dbo.STG_MAESTRO_TALLES_MODULOS
                WHERE ID_IMPORTACION = @ID_IMPORTACION
                  AND ID_EMPRESA = @ID_EMPRESA;
            `);

            console.log(
                `${maestro.nombre} / ${empresa.codigoEmpresa}: ` +
                `cargando ${registros.length} curvas al staging...`
            );

            const inicioBulk =
                Date.now();

            await cargarStagingBulk(
                transaction,
                registros,
                idImportacion,
                empresa.idEmpresa
            );

            const bulkMs =
                Date.now() -
                inicioBulk;

            const comparacionesTalles =
                columnasTalles
                    .map(
                        columna =>
                            `ISNULL(M.${columna}, 0) <> ` +
                            `ISNULL(T.${columna}, 0)`
                    )
                    .join(' OR ');

            const condicionCambio = `
                ISNULL(M.DETALLE_MODULO, '')
                    <> ISNULL(T.DETALLE_MODULO, '')
                OR ${comparacionesTalles}
                OR ISNULL(M.PARES, 0)
                    <> ISNULL(T.PARES, 0)
                OR ISNULL(M.TOTAL_CALCULADO, 0)
                    <> ISNULL(T.TOTAL_CALCULADO, 0)
                OR ISNULL(M.ES_CONSISTENTE, 0)
                    <> ISNULL(T.ES_CONSISTENTE, 0)
                OR ISNULL(M.OBSERVACION, '')
                    <> ISNULL(T.OBSERVACION, '')
                OR M.ACTIVO = 0
            `;

            const joinEmpresaModulo = `
                M.ID_EMPRESA = T.ID_EMPRESA
                AND M.CODIGO_MODULO = T.CODIGO_MODULO
            `;

            const nuevosResult =
                await requestBase().query(`
                    SELECT COUNT(*) AS CANTIDAD
                    FROM dbo.STG_MAESTRO_TALLES_MODULOS T
                    LEFT JOIN dbo.MAESTRO_TALLES_MODULOS M
                        ON ${joinEmpresaModulo}
                    WHERE T.ID_IMPORTACION = @ID_IMPORTACION
                      AND T.ID_EMPRESA = @ID_EMPRESA
                      AND M.CODIGO_MODULO IS NULL;
                `);

            const nuevos =
                nuevosResult.recordset[0].CANTIDAD;

            const modificadosResult =
                await requestBase().query(`
                    SELECT COUNT(*) AS CANTIDAD
                    FROM dbo.STG_MAESTRO_TALLES_MODULOS T
                    INNER JOIN dbo.MAESTRO_TALLES_MODULOS M
                        ON ${joinEmpresaModulo}
                    WHERE T.ID_IMPORTACION = @ID_IMPORTACION
                      AND T.ID_EMPRESA = @ID_EMPRESA
                      AND (${condicionCambio});
                `);

            const modificados =
                modificadosResult.recordset[0].CANTIDAD;

            const inactivosResult =
                await requestBase().query(`
                    SELECT COUNT(*) AS CANTIDAD
                    FROM dbo.MAESTRO_TALLES_MODULOS M
                    LEFT JOIN dbo.STG_MAESTRO_TALLES_MODULOS T
                        ON ${joinEmpresaModulo}
                       AND T.ID_IMPORTACION = @ID_IMPORTACION
                       AND T.ID_EMPRESA = @ID_EMPRESA
                    WHERE M.ID_EMPRESA = @ID_EMPRESA
                      AND T.CODIGO_MODULO IS NULL
                      AND M.ACTIVO = 1;
                `);

            const inactivos =
                inactivosResult.recordset[0].CANTIDAD;

            const setsTalles =
                columnasTalles
                    .map(
                        columna =>
                            `M.${columna} = T.${columna}`
                    )
                    .join(',\n');

            await requestBase().query(`
                UPDATE M
                SET
                    M.DETALLE_MODULO = T.DETALLE_MODULO,
                    ${setsTalles},
                    M.PARES = T.PARES,
                    M.TOTAL_CALCULADO = T.TOTAL_CALCULADO,
                    M.ES_CONSISTENTE = T.ES_CONSISTENTE,
                    M.OBSERVACION = T.OBSERVACION,
                    M.ACTIVO = 1,
                    M.FECHA_ACTUALIZACION = SYSDATETIME()
                FROM dbo.MAESTRO_TALLES_MODULOS M
                INNER JOIN dbo.STG_MAESTRO_TALLES_MODULOS T
                    ON ${joinEmpresaModulo}
                WHERE T.ID_IMPORTACION = @ID_IMPORTACION
                  AND T.ID_EMPRESA = @ID_EMPRESA
                  AND (${condicionCambio});
            `);

            const columnasInsert =
                columnasTalles.join(', ');

            const columnasSelect =
                columnasTalles
                    .map(
                        columna =>
                            `T.${columna}`
                    )
                    .join(', ');

            await requestBase().query(`
                INSERT INTO dbo.MAESTRO_TALLES_MODULOS
                (
                    ID_EMPRESA,
                    CODIGO_MODULO,
                    DETALLE_MODULO,
                    ${columnasInsert},
                    PARES,
                    TOTAL_CALCULADO,
                    ES_CONSISTENTE,
                    OBSERVACION,
                    ACTIVO,
                    FECHA_ACTUALIZACION
                )
                SELECT
                    T.ID_EMPRESA,
                    T.CODIGO_MODULO,
                    T.DETALLE_MODULO,
                    ${columnasSelect},
                    T.PARES,
                    T.TOTAL_CALCULADO,
                    T.ES_CONSISTENTE,
                    T.OBSERVACION,
                    1,
                    SYSDATETIME()
                FROM dbo.STG_MAESTRO_TALLES_MODULOS T
                LEFT JOIN dbo.MAESTRO_TALLES_MODULOS M
                    ON ${joinEmpresaModulo}
                WHERE T.ID_IMPORTACION = @ID_IMPORTACION
                  AND T.ID_EMPRESA = @ID_EMPRESA
                  AND M.CODIGO_MODULO IS NULL;
            `);

            await requestBase().query(`
                UPDATE M
                SET
                    M.ACTIVO = 0,
                    M.FECHA_ACTUALIZACION = SYSDATETIME()
                FROM dbo.MAESTRO_TALLES_MODULOS M
                LEFT JOIN dbo.STG_MAESTRO_TALLES_MODULOS T
                    ON ${joinEmpresaModulo}
                   AND T.ID_IMPORTACION = @ID_IMPORTACION
                   AND T.ID_EMPRESA = @ID_EMPRESA
                WHERE M.ID_EMPRESA = @ID_EMPRESA
                  AND T.CODIGO_MODULO IS NULL
                  AND M.ACTIVO = 1;
            `);

            const inconsistentesResult =
                await requestBase().query(`
                    SELECT COUNT(*) AS CANTIDAD
                    FROM dbo.STG_MAESTRO_TALLES_MODULOS
                    WHERE ID_IMPORTACION = @ID_IMPORTACION
                      AND ID_EMPRESA = @ID_EMPRESA
                      AND ES_CONSISTENTE = 0;
                `);

            const inconsistentes =
                inconsistentesResult.recordset[0].CANTIDAD;

            await requestBase().query(`
                DELETE
                FROM dbo.STG_MAESTRO_TALLES_MODULOS
                WHERE ID_IMPORTACION = @ID_IMPORTACION
                  AND ID_EMPRESA = @ID_EMPRESA;
            `);

            await transaction.commit();

            const mensaje =
                inconsistentes === 0
                    ? `Importación correcta. Empresa ${empresa.codigoEmpresa}. ` +
                      `Todas las curvas son consistentes. Bulk: ${bulkMs} ms.`
                    : `Importación correcta. Empresa ${empresa.codigoEmpresa}. ` +
                      `${inconsistentes} curva(s) inconsistente(s). ` +
                      `Bulk: ${bulkMs} ms.`;

            await finalizarControlImportacion(
                idImportacion,
                {
                    estado: 'OK',
                    registrosArchivo: registros.length,
                    nuevos,
                    modificados,
                    inactivos,
                    errores: 0,
                    mensaje
                }
            );

            return {
                maestro: maestro.nombre,
                empresa: empresa.codigoEmpresa,
                estado: 'OK',
                registros: registros.length,
                nuevos,
                modificados,
                inactivos,
                inconsistentes,
                bulkMs
            };

        } catch (error) {
            try {
                await transaction.rollback();
            } catch (_) {}

            throw error;
        }

    } catch (error) {
        console.error(
            `Error importando ${maestro.nombre} ` +
            `[empresa ${empresa.codigoEmpresa}]:`,
            error.message
        );

        if (idImportacion) {
            try {
                await finalizarControlImportacion(
                    idImportacion,
                    {
                        estado: 'ERROR',
                        errores: 1,
                        mensaje:
                            error.message.substring(
                                0,
                                1000
                            )
                    }
                );
            } catch (errorControl) {
                console.error(
                    'No se pudo actualizar CONTROL_IMPORTACIONES:',
                    errorControl.message
                );
            }
        }

        throw error;
    }
}


module.exports = {
    importarTallesModulos,
    columnasTalles
};
