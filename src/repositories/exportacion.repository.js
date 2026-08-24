const {
    getConnection,
    sql
} = require('../config/database');


/* ============================================================
   OBTENER ALTA PARA EXPORTACION
   ============================================================ */

async function obtenerAltaParaExportacion(
    idAlta
) {

    const pool =
        await getConnection();


    const resultado =
        await pool
            .request()

            .input(
                'ID_ALTA',
                sql.Int,
                idAlta
            )

            .query(`
                SELECT
                    *
                FROM dbo.ALTAS_PRODUCTOS
                WHERE
                    ID_ALTA = @ID_ALTA;
            `);


    return resultado.recordset[0] || null;
}


/* ============================================================
   OBTENER DETALLES PARA EXPORTACION
   ============================================================ */

async function obtenerDetallesParaExportacion(
    idAlta
) {

    const pool =
        await getConnection();


    const resultado =
        await pool
            .request()

            .input(
                'ID_ALTA',
                sql.Int,
                idAlta
            )

            .query(`
                SELECT
                    *
                FROM dbo.ALTAS_PRODUCTOS_DETALLE

                WHERE
                    ID_ALTA = @ID_ALTA

                ORDER BY
                    ID_DETALLE;
            `);


    return resultado.recordset;
}


/* ============================================================
   REGISTRAR EXPORTACION
   ============================================================ */

async function registrarExportacion(
    idAlta,
    detalles,
    registrosERP,
    archivo,
    usuario
) {

    const pool =
        await getConnection();


    const transaction =
        new sql.Transaction(
            pool
        );


    await transaction.begin();


    try {

        /* ====================================================
           VALIDAR CANTIDADES
           ==================================================== */

        if (
            !Array.isArray(detalles) ||
            !Array.isArray(registrosERP)
        ) {

            throw new Error(
                'Los detalles y registros ERP deben ser arrays.'
            );
        }


        if (
            detalles.length !==
            registrosERP.length
        ) {

            throw new Error(
                'La cantidad de detalles no coincide ' +
                'con la cantidad de registros exportados.'
            );
        }


        if (
            detalles.length === 0
        ) {

            throw new Error(
                'No existen productos para registrar como exportados.'
            );
        }


        /* ====================================================
           INSERTAR SNAPSHOT DE CADA PRODUCTO EXPORTADO
           ==================================================== */

        for (
            let i = 0;
            i < detalles.length;
            i++
        ) {

            const detalle =
                detalles[i];


            const r =
                registrosERP[i];


            await new sql.Request(
                transaction
            )

                /* =================================================
                   IDENTIFICACION
                   ================================================= */

                .input(
                    'ID_ALTA',
                    sql.Int,
                    idAlta
                )

                .input(
                    'ID_DETALLE',
                    sql.Int,
                    detalle.ID_DETALLE
                )


                /* =================================================
                   DATOS PRINCIPALES
                   ================================================= */

                .input(
                    'DETALLE',
                    sql.VarChar(50),
                    r.DETALLE
                )

                .input(
                    'NIVEL',
                    sql.Int,
                    r.NIVEL
                )

                .input(
                    'FECHA_ALTA',
                    sql.Date,
                    r.FECHA_ALTA
                )

                .input(
                    'COD_ALFA',
                    sql.VarChar(30),
                    r.COD_ALFA
                )


                /* =================================================
                   MARCA
                   ================================================= */

                .input(
                    'MARCA',
                    sql.VarChar(10),
                    String(r.MARCA)
                )

                .input(
                    'DMARCA',
                    sql.VarChar(15),
                    r.DMARCA
                )


                /* =================================================
                   SUBGRUPO
                   ================================================= */

                .input(
                    'COD_SUBG',
                    sql.VarChar(10),
                    r.COD_SUBG
                )

                .input(
                    'DSUBG',
                    sql.VarChar(20),
                    r.DSUBG
                )


                /* =================================================
                   TEMPORADA
                   ================================================= */

                .input(
                    'COD_TEM',
                    sql.VarChar(10),
                    r.COD_TEM
                )

                .input(
                    'DCOD_TEM',
                    sql.VarChar(20),
                    r.DCOD_TEM
                )


                /* =================================================
                   GRUPO
                   ================================================= */

                .input(
                    'COD_GRUPOC',
                    sql.VarChar(10),
                    r.COD_GRUPOC
                )

                .input(
                    'DGRUPO',
                    sql.VarChar(20),
                    r.DGRUPO
                )


                /* =================================================
                   SEXO
                   ================================================= */

                .input(
                    'SEXO',
                    sql.VarChar(3),
                    r.SEXO
                )


                /* =================================================
                   CLASIFICACION
                   ================================================= */

                .input(
                    'CLASIFIC',
                    sql.VarChar(10),
                    r.CLASIFIC
                )

                .input(
                    'DCLASIFIC',
                    sql.VarChar(10),
                    r.DCLASIFIC
                )


                /* =================================================
                   COLOR
                   ================================================= */

                .input(
                    'COLORC',
                    sql.VarChar(10),
                    r.COLORC
                )

                .input(
                    'DCOLORC',
                    sql.VarChar(20),
                    r.DCOLORC
                )


                /* =================================================
                   LINEA
                   ================================================= */

                .input(
                    'LINEA',
                    sql.VarChar(10),
                    r.LINEA
                )

                .input(
                    'DET_LINEA',
                    sql.VarChar(20),
                    r.DET_LINEA
                )


                /* =================================================
                   MODELO
                   ================================================= */

                .input(
                    'MODC',
                    sql.VarChar(20),
                    r.MODC
                )

                .input(
                    'DMODC',
                    sql.VarChar(50),
                    r.DMODC
                )

                .input(
                    'NOMB_ART',
                    sql.VarChar(50),
                    r.NOMB_ART
                )


                /* =================================================
                   ORIGEN
                   ================================================= */

                .input(
                    'ORIG_PRO',
                    sql.VarChar(10),
                    r.ORIG_PRO
                )

                .input(
                    'DET_ORIGEN',
                    sql.VarChar(20),
                    r.DET_ORIGEN
                )


                /* =================================================
                   RUBRO
                   ================================================= */

                .input(
                    'RUBROS',
                    sql.VarChar(1),
                    r.RUBROS
                )

                .input(
                    'RUBRO',
                    sql.VarChar(30),
                    r.RUBRO
                )


                /* =================================================
                   TALLE / MODULO
                   ================================================= */

                .input(
                    'TALLC',
                    sql.VarChar(10),
                    r.TALLC
                )

                .input(
                    'DTALLC',
                    sql.VarChar(40),
                    r.DTALLC
                )

                .input(
                    'PARES',
                    sql.Int,
                    r.PARES
                )


                /* =================================================
                   AÑO
                   ================================================= */

                .input(
                    'COD_ANO',
                    sql.VarChar(10),
                    r.COD_ANO
                )


                /* =================================================
                   EDAD
                   ================================================= */

                .input(
                    'COD_EDAD',
                    sql.VarChar(10),
                    r.COD_EDAD
                )

                .input(
                    'EDAD',
                    sql.VarChar(15),
                    r.EDAD
                )


                /* =================================================
                   RUBRO FACTURACION
                   ================================================= */

                .input(
                    'RUBRO_FACT',
                    sql.VarChar(20),
                    r.RUBRO_FACT
                )


                /* =================================================
                   PAIS
                   ================================================= */

                .input(
                    'PAIS',
                    sql.VarChar(10),
                    String(r.PAIS)
                )


                /* =================================================
                   DISCIPLINA
                   ================================================= */

                .input(
                    'COD_DISCIP',
                    sql.VarChar(10),
                    r.COD_DISCIP
                )

                .input(
                    'DISCIPLINA',
                    sql.VarChar(20),
                    r.DISCIPLINA
                )


                /* =================================================
                   LICENCIA
                   ================================================= */

                .input(
                    'LICENCIAS',
                    sql.VarChar(25),
                    r.LICENCIAS || null
                )


                /* =================================================
                   EXPORTACION
                   ================================================= */

                .input(
                    'ARCHIVO_EXPORTADO',
                    sql.VarChar(255),
                    archivo
                )

                .input(
                    'USUARIO_EXPORTACION',
                    sql.VarChar(100),
                    usuario
                )


                /* =================================================
                   INSERT
                   ================================================= */

                .query(`
                    INSERT INTO dbo.ALTAS_PRODUCTOS_EXPORTADOS
                    (
                        ID_ALTA,
                        ID_DETALLE,

                        DETALLE,
                        NIVEL,
                        FECHA_ALTA,

                        COD_ALFA,

                        MARCA,
                        DMARCA,

                        COD_SUBG,
                        DSUBG,

                        COD_TEM,
                        DCOD_TEM,

                        COD_GRUPOC,
                        DGRUPO,

                        SEXO,

                        CLASIFIC,
                        DCLASIFIC,

                        COLORC,
                        DCOLORC,

                        LINEA,
                        DET_LINEA,

                        MODC,
                        DMODC,

                        NOMB_ART,

                        ORIG_PRO,
                        DET_ORIGEN,

                        RUBROS,
                        RUBRO,

                        TALLC,
                        DTALLC,

                        PARES,

                        COD_ANO,

                        COD_EDAD,
                        EDAD,

                        RUBRO_FACT,

                        PAIS,

                        COD_DISCIP,
                        DISCIPLINA,

                        LICENCIAS,

                        ARCHIVO_EXPORTADO,
                        FECHA_EXPORTACION,
                        USUARIO_EXPORTACION,

                        ESTADO_ERP
                    )

                    VALUES
                    (
                        @ID_ALTA,
                        @ID_DETALLE,

                        @DETALLE,
                        @NIVEL,
                        @FECHA_ALTA,

                        @COD_ALFA,

                        @MARCA,
                        @DMARCA,

                        @COD_SUBG,
                        @DSUBG,

                        @COD_TEM,
                        @DCOD_TEM,

                        @COD_GRUPOC,
                        @DGRUPO,

                        @SEXO,

                        @CLASIFIC,
                        @DCLASIFIC,

                        @COLORC,
                        @DCOLORC,

                        @LINEA,
                        @DET_LINEA,

                        @MODC,
                        @DMODC,

                        @NOMB_ART,

                        @ORIG_PRO,
                        @DET_ORIGEN,

                        @RUBROS,
                        @RUBRO,

                        @TALLC,
                        @DTALLC,

                        @PARES,

                        @COD_ANO,

                        @COD_EDAD,
                        @EDAD,

                        @RUBRO_FACT,

                        @PAIS,

                        @COD_DISCIP,
                        @DISCIPLINA,

                        @LICENCIAS,

                        @ARCHIVO_EXPORTADO,
                        SYSDATETIME(),
                        @USUARIO_EXPORTACION,

                        'PENDIENTE_ERP'
                    );
                `);
        }


        /* ====================================================
           MARCAR DETALLES COMO EXPORTADOS
           ==================================================== */

        await new sql.Request(
            transaction
        )

            .input(
                'ID_ALTA',
                sql.Int,
                idAlta
            )

            .query(`
                UPDATE dbo.ALTAS_PRODUCTOS_DETALLE

                SET
                    ESTADO_VALIDACION =
                        'EXPORTADO'

                WHERE
                    ID_ALTA = @ID_ALTA
                    AND ESTADO_VALIDACION = 'VALIDO';
            `);


        /* ====================================================
           MARCAR CABECERA COMO EXPORTADA
           ==================================================== */

        const resultadoAlta =
            await new sql.Request(
                transaction
            )

                .input(
                    'ID_ALTA',
                    sql.Int,
                    idAlta
                )

                .input(
                    'ARCHIVO_EXPORTADO',
                    sql.VarChar(255),
                    archivo
                )

                .input(
                    'USUARIO_EXPORTACION',
                    sql.VarChar(100),
                    usuario
                )

                .query(`
                    UPDATE dbo.ALTAS_PRODUCTOS

                    SET
                        ESTADO =
                            'EXPORTADO',

                        FECHA_EXPORTACION =
                            SYSDATETIME(),

                        USUARIO_EXPORTACION =
                            @USUARIO_EXPORTACION,

                        ARCHIVO_EXPORTADO =
                            @ARCHIVO_EXPORTADO

                    OUTPUT
                        INSERTED.*

                    WHERE
                        ID_ALTA = @ID_ALTA
                        AND ESTADO = 'VALIDADO';
                `);


        /* ====================================================
           CONTROL DE CAMBIO DE ESTADO
           ==================================================== */

        if (
            resultadoAlta.recordset.length ===
            0
        ) {

            throw new Error(
                'No se pudo marcar el alta como EXPORTADO. ' +
                'Verificá que siga en estado VALIDADO.'
            );
        }


        /* ====================================================
           COMMIT
           ==================================================== */

        await transaction.commit();


        return resultadoAlta.recordset[0];


    } catch (error) {

        /* ====================================================
           ROLLBACK
           ==================================================== */

        try {

            await transaction.rollback();

        } catch (errorRollback) {

            console.error(
                'Error haciendo rollback de exportación:',
                errorRollback
            );
        }


        throw error;
    }
}



/* ============================================================
   OBTENER RELACIONES MODULO -> PAR SUELTO PRIMERA

   Se usa para generar RELACION.DBI.
   - El padre debe ser un MODULO nuevo/exportable (VALIDO).
   - El hijo debe ser PAR_SUELTO clasificación 1 - PRIMERA.
   - El hijo puede ser VALIDO o EXISTE_ERP.
   - La relación sale de ALTAS_PRODUCTOS_FAMILIAS_DETALLE,
     por lo que respeta familias muchos-a-muchos.
   ============================================================ */

async function obtenerRelacionesModuloPrimera(
    idAlta
) {

    const pool =
        await getConnection();


    const resultado =
        await pool
            .request()

            .input(
                'ID_ALTA',
                sql.Int,
                idAlta
            )

            .query(`
                SELECT
                    P.ID_DETALLE AS ID_MODULO,
                    P.CODIGO_ALFA AS COD_ALFA_MODULO,
                    P.DETALLE_PRODUCTO AS DETALLE_PRODUCTO_MODULO,
                    P.CODIGO_MODULO,

                    H.ID_DETALLE AS ID_INSUMO,
                    H.CODIGO_ALFA AS COD_ALFA_INSUMO,
                    H.DETALLE_PRODUCTO AS DETALLE_PRODUCTO_INSUMO,
                    H.CODIGO_TALLE AS CODIGO_TALLE_INSUMO,
                    H.DETALLE_TALLE AS DETALLE_TALLE_INSUMO,
                    H.ESTADO_VALIDACION AS ESTADO_INSUMO,

                    M.*

                FROM dbo.ALTAS_PRODUCTOS_FAMILIAS_DETALLE R

                INNER JOIN dbo.ALTAS_PRODUCTOS_DETALLE P
                    ON P.ID_DETALLE = R.ID_DETALLE_PADRE
                    AND P.ID_ALTA = R.ID_ALTA

                INNER JOIN dbo.ALTAS_PRODUCTOS_DETALLE H
                    ON H.ID_DETALLE = R.ID_DETALLE_HIJO
                    AND H.ID_ALTA = R.ID_ALTA

                INNER JOIN dbo.MAESTRO_TALLES_MODULOS M
                    ON M.CODIGO_MODULO = P.CODIGO_MODULO

                WHERE
                    R.ID_ALTA = @ID_ALTA

                    AND UPPER(
                        REPLACE(
                            REPLACE(
                                ISNULL(
                                    P.TIPO_PRODUCTO_DETALLE,
                                    ''
                                ),
                                ' ',
                                '_'
                            ),
                            '-',
                            '_'
                        )
                    ) = 'MODULO'

                    AND P.ESTADO_VALIDACION = 'VALIDO'

                    AND UPPER(
                        REPLACE(
                            REPLACE(
                                ISNULL(
                                    H.TIPO_PRODUCTO_DETALLE,
                                    ''
                                ),
                                ' ',
                                '_'
                            ),
                            '-',
                            '_'
                        )
                    ) = 'PAR_SUELTO'

                    AND H.CODIGO_CLASIFICACION = '1'

                    AND H.ESTADO_VALIDACION IN (
                        'VALIDO',
                        'EXISTE_ERP'
                    )

                ORDER BY
                    P.ID_DETALLE,
                    H.ID_DETALLE;
            `);


    return resultado.recordset;
}



/* ============================================================
   PRUEBA SIN IMPACTO:
   OBTENER RELACIONES MODULO -> PRIMERA SIN EXIGIR ESTADO VALIDO

   Solo lectura. Se usa por scripts/probar-exportacion-id.js
   para poder probar lotes ya exportados.
   ============================================================ */

async function obtenerRelacionesModuloPrimeraPrueba(
    idAlta
) {

    const pool =
        await getConnection();


    const resultado =
        await pool
            .request()

            .input(
                'ID_ALTA',
                sql.Int,
                idAlta
            )

            .query(`
                SELECT
                    P.ID_DETALLE AS ID_MODULO,
                    P.CODIGO_ALFA AS COD_ALFA_MODULO,
                    P.DETALLE_PRODUCTO AS DETALLE_PRODUCTO_MODULO,
                    P.CODIGO_MODULO,

                    H.ID_DETALLE AS ID_INSUMO,
                    H.CODIGO_ALFA AS COD_ALFA_INSUMO,
                    H.DETALLE_PRODUCTO AS DETALLE_PRODUCTO_INSUMO,
                    H.CODIGO_TALLE AS CODIGO_TALLE_INSUMO,
                    H.DETALLE_TALLE AS DETALLE_TALLE_INSUMO,
                    H.ESTADO_VALIDACION AS ESTADO_INSUMO,

                    M.*

                FROM dbo.ALTAS_PRODUCTOS_FAMILIAS_DETALLE R

                INNER JOIN dbo.ALTAS_PRODUCTOS_DETALLE P
                    ON P.ID_DETALLE = R.ID_DETALLE_PADRE
                    AND P.ID_ALTA = R.ID_ALTA

                INNER JOIN dbo.ALTAS_PRODUCTOS_DETALLE H
                    ON H.ID_DETALLE = R.ID_DETALLE_HIJO
                    AND H.ID_ALTA = R.ID_ALTA

                INNER JOIN dbo.MAESTRO_TALLES_MODULOS M
                    ON M.CODIGO_MODULO = P.CODIGO_MODULO

                WHERE
                    R.ID_ALTA = @ID_ALTA

                    AND UPPER(
                        REPLACE(
                            REPLACE(
                                ISNULL(P.TIPO_PRODUCTO_DETALLE, ''),
                                ' ',
                                '_'
                            ),
                            '-',
                            '_'
                        )
                    ) = 'MODULO'

                    AND UPPER(
                        REPLACE(
                            REPLACE(
                                ISNULL(H.TIPO_PRODUCTO_DETALLE, ''),
                                ' ',
                                '_'
                            ),
                            '-',
                            '_'
                        )
                    ) = 'PAR_SUELTO'

                    AND H.CODIGO_CLASIFICACION = '1'

                ORDER BY
                    P.ID_DETALLE,
                    H.ID_DETALLE;
            `);


    return resultado.recordset;
}


/* ============================================================
   EXPORTS
   ============================================================ */

module.exports = {

    obtenerAltaParaExportacion,

    obtenerDetallesParaExportacion,


    obtenerRelacionesModuloPrimera,

    obtenerRelacionesModuloPrimeraPrueba,

    registrarExportacion
};