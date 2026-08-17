const fs = require('fs');

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


async function importarColores() {

    const maestro = maestros.COLORES;
    const rutaArchivo = obtenerRutaMaestro(maestro);

    let idImportacion = null;


    try {

        /* =====================================================
           1. VERIFICAR ARCHIVO
           ===================================================== */

        if (!fs.existsSync(rutaArchivo)) {

            throw new Error(
                `No se encontró el archivo: ${rutaArchivo}`
            );
        }


        /* =====================================================
           2. METADATA + HASH
           ===================================================== */

        const metadata =
            await obtenerMetadataArchivo(rutaArchivo);

        const hash =
            await calcularHashArchivo(rutaArchivo);


        /* =====================================================
           3. VERIFICAR SI CAMBIÓ
           ===================================================== */

        const ultimoHash =
            await obtenerUltimoHashOK(maestro.nombre);

        if (ultimoHash === hash) {

            idImportacion =
                await crearControlImportacion({
                    maestro: maestro.nombre,
                    archivo: maestro.archivo,
                    estado: 'SIN_CAMBIOS',
                    hash,
                    tamano: metadata.tamano,
                    fechaArchivo:
                        metadata.fechaModificacion
                });

            await finalizarControlImportacion(
                idImportacion,
                {
                    estado: 'SIN_CAMBIOS',
                    mensaje:
                        'El archivo no presenta cambios.'
                }
            );

            return {
                maestro: maestro.nombre,
                estado: 'SIN_CAMBIOS'
            };
        }


        /* =====================================================
           4. CREAR CONTROL
           ===================================================== */

        idImportacion =
            await crearControlImportacion({
                maestro: maestro.nombre,
                archivo: maestro.archivo,
                estado: 'EJECUTANDO',
                hash,
                tamano: metadata.tamano,
                fechaArchivo:
                    metadata.fechaModificacion
            });


        /* =====================================================
           5. LEER ARCHIVO
           ===================================================== */

        const filas =
            await leerArchivoPipe(
                rutaArchivo,
                maestro.columnasEsperadas
            );


        /* =====================================================
           6. VALIDACIONES
           ===================================================== */

        const registros = [];
        const codigos = new Set();

        for (let i = 0; i < filas.length; i++) {

            const codigo = filas[i][0];
            const detalle = filas[i][1];


            if (!codigo) {

                throw new Error(
                    `Código de color vacío en línea ${i + 1}.`
                );
            }


            if (!detalle) {

                throw new Error(
                    `Detalle de color vacío en línea ${i + 1}.`
                );
            }


            if (codigo.length > 2) {

                throw new Error(
                    `Código de color inválido "${codigo}" ` +
                    `en línea ${i + 1}.`
                );
            }


            if (detalle.length > 30) {

                throw new Error(
                    `Detalle de color demasiado largo "${detalle}" ` +
                    `en línea ${i + 1}.`
                );
            }


            if (codigos.has(codigo)) {

                throw new Error(
                    `Código duplicado "${codigo}" ` +
                    `en TBL_COLORES.`
                );
            }


            codigos.add(codigo);


            registros.push({
                codigo,
                detalle
            });
        }


        /* =====================================================
           7. CONEXIÓN / TRANSACCIÓN
           ===================================================== */

        const pool = await getConnection();

        const transaction =
            new sql.Transaction(pool);

        await transaction.begin();


        try {

            /* =================================================
               8. LIMPIAR STAGING
               ================================================= */

            await new sql.Request(transaction)
                .input(
                    'ID_IMPORTACION',
                    sql.BigInt,
                    idImportacion
                )
                .query(`
                    DELETE FROM dbo.STG_MAESTRO_COLORES
                    WHERE ID_IMPORTACION = @ID_IMPORTACION;
                `);


            /* =================================================
               9. CARGAR STAGING
               ================================================= */

            for (const registro of registros) {

                await new sql.Request(transaction)
                    .input(
                        'ID_IMPORTACION',
                        sql.BigInt,
                        idImportacion
                    )
                    .input(
                        'CODIGO_COLOR',
                        sql.VarChar(2),
                        registro.codigo
                    )
                    .input(
                        'DETALLE_COLOR',
                        sql.VarChar(30),
                        registro.detalle
                    )
                    .query(`
                        INSERT INTO dbo.STG_MAESTRO_COLORES
                        (
                            ID_IMPORTACION,
                            CODIGO_COLOR,
                            DETALLE_COLOR
                        )
                        VALUES
                        (
                            @ID_IMPORTACION,
                            @CODIGO_COLOR,
                            @DETALLE_COLOR
                        );
                    `);
            }


            /* =================================================
               10. CONTAR NUEVOS
               ================================================= */

            const nuevosResult =
                await new sql.Request(transaction)
                    .input(
                        'ID_IMPORTACION',
                        sql.BigInt,
                        idImportacion
                    )
                    .query(`
                        SELECT
                            COUNT(*) AS CANTIDAD

                        FROM dbo.STG_MAESTRO_COLORES T

                        LEFT JOIN dbo.MAESTRO_COLORES M
                            ON M.CODIGO_COLOR =
                               T.CODIGO_COLOR

                        WHERE
                            T.ID_IMPORTACION =
                                @ID_IMPORTACION

                            AND M.CODIGO_COLOR IS NULL;
                    `);


            const nuevos =
                nuevosResult.recordset[0].CANTIDAD;


            /* =================================================
               11. CONTAR MODIFICADOS
               ================================================= */

            const modificadosResult =
                await new sql.Request(transaction)
                    .input(
                        'ID_IMPORTACION',
                        sql.BigInt,
                        idImportacion
                    )
                    .query(`
                        SELECT
                            COUNT(*) AS CANTIDAD

                        FROM dbo.STG_MAESTRO_COLORES T

                        INNER JOIN dbo.MAESTRO_COLORES M
                            ON M.CODIGO_COLOR =
                               T.CODIGO_COLOR

                        WHERE
                            T.ID_IMPORTACION =
                                @ID_IMPORTACION

                            AND
                            (
                                M.DETALLE_COLOR <>
                                    T.DETALLE_COLOR

                                OR M.ACTIVO = 0
                            );
                    `);


            const modificados =
                modificadosResult.recordset[0].CANTIDAD;


            /* =================================================
               12. CONTAR INACTIVOS
               ================================================= */

            const inactivosResult =
                await new sql.Request(transaction)
                    .input(
                        'ID_IMPORTACION',
                        sql.BigInt,
                        idImportacion
                    )
                    .query(`
                        SELECT
                            COUNT(*) AS CANTIDAD

                        FROM dbo.MAESTRO_COLORES M

                        LEFT JOIN dbo.STG_MAESTRO_COLORES T
                            ON T.CODIGO_COLOR =
                               M.CODIGO_COLOR

                            AND T.ID_IMPORTACION =
                                @ID_IMPORTACION

                        WHERE
                            T.CODIGO_COLOR IS NULL

                            AND M.ACTIVO = 1;
                    `);


            const inactivos =
                inactivosResult.recordset[0].CANTIDAD;


            /* =================================================
               13. UPDATE
               ================================================= */

            await new sql.Request(transaction)
                .input(
                    'ID_IMPORTACION',
                    sql.BigInt,
                    idImportacion
                )
                .query(`
                    UPDATE M

                    SET
                        M.DETALLE_COLOR =
                            T.DETALLE_COLOR,

                        M.ACTIVO = 1,

                        M.FECHA_ACTUALIZACION =
                            SYSDATETIME()

                    FROM dbo.MAESTRO_COLORES M

                    INNER JOIN dbo.STG_MAESTRO_COLORES T
                        ON T.CODIGO_COLOR =
                           M.CODIGO_COLOR

                    WHERE
                        T.ID_IMPORTACION =
                            @ID_IMPORTACION

                        AND
                        (
                            M.DETALLE_COLOR <>
                                T.DETALLE_COLOR

                            OR M.ACTIVO = 0
                        );
                `);


            /* =================================================
               14. INSERT NUEVOS
               ================================================= */

            await new sql.Request(transaction)
                .input(
                    'ID_IMPORTACION',
                    sql.BigInt,
                    idImportacion
                )
                .query(`
                    INSERT INTO dbo.MAESTRO_COLORES
                    (
                        CODIGO_COLOR,
                        DETALLE_COLOR,
                        ACTIVO,
                        FECHA_ACTUALIZACION
                    )

                    SELECT
                        T.CODIGO_COLOR,
                        T.DETALLE_COLOR,
                        1,
                        SYSDATETIME()

                    FROM dbo.STG_MAESTRO_COLORES T

                    LEFT JOIN dbo.MAESTRO_COLORES M
                        ON M.CODIGO_COLOR =
                           T.CODIGO_COLOR

                    WHERE
                        T.ID_IMPORTACION =
                            @ID_IMPORTACION

                        AND M.CODIGO_COLOR IS NULL;
                `);


            /* =================================================
               15. INACTIVAR AUSENTES
               ================================================= */

            await new sql.Request(transaction)
                .input(
                    'ID_IMPORTACION',
                    sql.BigInt,
                    idImportacion
                )
                .query(`
                    UPDATE M

                    SET
                        M.ACTIVO = 0,

                        M.FECHA_ACTUALIZACION =
                            SYSDATETIME()

                    FROM dbo.MAESTRO_COLORES M

                    LEFT JOIN dbo.STG_MAESTRO_COLORES T
                        ON T.CODIGO_COLOR =
                           M.CODIGO_COLOR

                        AND T.ID_IMPORTACION =
                            @ID_IMPORTACION

                    WHERE
                        T.CODIGO_COLOR IS NULL

                        AND M.ACTIVO = 1;
                `);


            /* =================================================
               16. LIMPIAR STAGING
               ================================================= */

            await new sql.Request(transaction)
                .input(
                    'ID_IMPORTACION',
                    sql.BigInt,
                    idImportacion
                )
                .query(`
                    DELETE FROM dbo.STG_MAESTRO_COLORES
                    WHERE ID_IMPORTACION =
                        @ID_IMPORTACION;
                `);


            /* =================================================
               17. COMMIT
               ================================================= */

            await transaction.commit();


            /* =================================================
               18. CONTROL OK
               ================================================= */

            await finalizarControlImportacion(
                idImportacion,
                {
                    estado: 'OK',
                    registrosArchivo:
                        registros.length,
                    nuevos,
                    modificados,
                    inactivos,
                    errores: 0,
                    mensaje:
                        'Importación finalizada correctamente.'
                }
            );


            return {

                maestro: maestro.nombre,

                estado: 'OK',

                registros:
                    registros.length,

                nuevos,

                modificados,

                inactivos
            };


        } catch (error) {

            try {
                await transaction.rollback();
            } catch (_) {
            }

            throw error;
        }


    } catch (error) {

        console.error(
            `Error importando ${maestro.nombre}:`,
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
                            error.message.substring(0, 1000)
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
    importarColores
};