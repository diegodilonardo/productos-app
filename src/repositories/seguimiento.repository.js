const { getConnection, sql } = require('../config/database');


async function obtenerResumen() {

    const pool = await getConnection();

    const resultado = await pool.request().query(`
        SELECT
            COUNT(*) AS TOTAL_ALTAS,

            SUM(CASE
                WHEN ESTADO = 'BORRADOR'
                THEN 1 ELSE 0
            END) AS BORRADOR,

            SUM(CASE
                WHEN ESTADO = 'VALIDADO'
                THEN 1 ELSE 0
            END) AS VALIDADO,

            SUM(CASE
                WHEN ESTADO = 'EXPORTADO'
                THEN 1 ELSE 0
            END) AS EXPORTADO,

            SUM(CASE
                WHEN ESTADO = 'PARCIAL_ERP'
                THEN 1 ELSE 0
            END) AS PARCIAL_ERP,

            SUM(CASE
                WHEN ESTADO = 'GENERADO_OK_EN_ERP'
                THEN 1 ELSE 0
            END) AS GENERADO_OK_EN_ERP,

            SUM(CASE
                WHEN ESTADO = 'ANULADO'
                THEN 1 ELSE 0
            END) AS ANULADO

        FROM dbo.ALTAS_PRODUCTOS;
    `);

    const altas = resultado.recordset[0] || {};

    const erp = await pool.request().query(`
        SELECT
            COUNT(*) AS TOTAL_EXPORTADOS,

            SUM(CASE
                WHEN ESTADO_ERP = 'PENDIENTE_ERP'
                THEN 1 ELSE 0
            END) AS PENDIENTES_ERP,

            SUM(CASE
                WHEN ESTADO_ERP = 'GENERADO_OK_EN_ERP'
                THEN 1 ELSE 0
            END) AS CONFIRMADOS_ERP,

            SUM(CASE
                WHEN ESTADO_ERP = 'ERROR_ERP'
                THEN 1 ELSE 0
            END) AS ERROR_ERP

        FROM dbo.ALTAS_PRODUCTOS_EXPORTADOS;
    `);

    return {
        altas,
        erp: erp.recordset[0] || {},
    };
}


async function listarAltasSeguimiento(estado = null) {

    const pool = await getConnection();

    const request = pool.request();

    let filtro = '';

    if (estado) {
        request.input(
            'ESTADO',
            sql.VarChar(30),
            estado
        );

        filtro = `
            WHERE A.ESTADO = @ESTADO
        `;
    }

    const resultado = await request.query(`
        SELECT
            A.ID_ALTA,
            A.CODIGO_ALTA,
            A.CODIGO_MARCA,
            A.DETALLE_MARCA,
            A.CODIGO_RUBRO,
            A.DETALLE_RUBRO,
            A.TIPO_PRODUCTO,
            A.CODIGO_TEMPORADA,
            A.DETALLE_TEMPORADA,
            A.CODIGO_ANO,

            (
                SELECT TOP 1
                    MA.DETALLE_ANO
                FROM dbo.MAESTRO_ANOS MA
                WHERE
                    MA.CODIGO_ANO = A.CODIGO_ANO
                    AND MA.ACTIVO = 1
            ) AS DETALLE_ANO,

            (
                SELECT TOP 1
                    CASE
                        WHEN NULLIF(
                            LTRIM(RTRIM(DL.LICENCIA)),
                            ''
                        ) IS NULL
                        THEN 'SIN LICENCIA'
                        ELSE LTRIM(RTRIM(DL.LICENCIA))
                    END
                FROM dbo.ALTAS_PRODUCTOS_DETALLE DL
                WHERE DL.ID_ALTA = A.ID_ALTA
                ORDER BY DL.ID_DETALLE
            ) AS LICENCIA_ALTA,

            A.ESTADO,
            A.FECHA_CREACION,
            A.USUARIO_CREACION,
            A.FECHA_VALIDACION,
            A.USUARIO_VALIDACION,
            A.FECHA_EXPORTACION,
            A.USUARIO_EXPORTACION,
            A.ARCHIVO_EXPORTADO,
            A.FECHA_ANULACION,
            A.USUARIO_ANULACION,
            A.MOTIVO_ANULACION,

            COUNT(E.ID_ALTA) AS CANTIDAD_EXPORTADOS,

            SUM(CASE
                WHEN E.ESTADO_ERP = 'GENERADO_OK_EN_ERP'
                THEN 1 ELSE 0
            END) AS CANTIDAD_CONFIRMADOS_ERP,

            SUM(CASE
                WHEN E.ESTADO_ERP = 'PENDIENTE_ERP'
                THEN 1 ELSE 0
            END) AS CANTIDAD_PENDIENTES_ERP,

            SUM(CASE
                WHEN E.ESTADO_ERP = 'ERROR_ERP'
                THEN 1 ELSE 0
            END) AS CANTIDAD_ERROR_ERP

        FROM dbo.ALTAS_PRODUCTOS A

        LEFT JOIN dbo.ALTAS_PRODUCTOS_EXPORTADOS E
            ON E.ID_ALTA = A.ID_ALTA

        ${filtro}

        GROUP BY
            A.ID_ALTA,
            A.CODIGO_ALTA,
            A.CODIGO_MARCA,
            A.DETALLE_MARCA,
            A.CODIGO_RUBRO,
            A.DETALLE_RUBRO,
            A.TIPO_PRODUCTO,
            A.CODIGO_TEMPORADA,
            A.DETALLE_TEMPORADA,
            A.CODIGO_ANO,
            A.ESTADO,
            A.FECHA_CREACION,
            A.USUARIO_CREACION,
            A.FECHA_VALIDACION,
            A.USUARIO_VALIDACION,
            A.FECHA_EXPORTACION,
            A.USUARIO_EXPORTACION,
            A.ARCHIVO_EXPORTADO,
            A.FECHA_ANULACION,
            A.USUARIO_ANULACION,
            A.MOTIVO_ANULACION

        ORDER BY
            A.ID_ALTA DESC;
    `);

    return resultado.recordset;
}


async function obtenerSeguimientoAlta(idAlta) {

    const pool = await getConnection();

    const cabecera = await pool
        .request()
        .input(
            'ID_ALTA',
            sql.Int,
            idAlta
        )
        .query(`
            SELECT
                A.ID_ALTA,
                A.CODIGO_ALTA,
                A.CODIGO_MARCA,
                A.DETALLE_MARCA,
                A.CODIGO_RUBRO,
                A.DETALLE_RUBRO,
                A.TIPO_PRODUCTO,
                A.CODIGO_TEMPORADA,
                A.DETALLE_TEMPORADA,
                A.CODIGO_ANO,

                (
                    SELECT TOP 1
                        MA.DETALLE_ANO
                    FROM dbo.MAESTRO_ANOS MA
                    WHERE
                        MA.CODIGO_ANO = A.CODIGO_ANO
                        AND MA.ACTIVO = 1
                ) AS DETALLE_ANO,

                (
                    SELECT TOP 1
                        CASE
                            WHEN NULLIF(
                                LTRIM(RTRIM(DL.LICENCIA)),
                                ''
                            ) IS NULL
                            THEN 'SIN LICENCIA'
                            ELSE LTRIM(RTRIM(DL.LICENCIA))
                        END
                    FROM dbo.ALTAS_PRODUCTOS_DETALLE DL
                    WHERE DL.ID_ALTA = A.ID_ALTA
                    ORDER BY DL.ID_DETALLE
                ) AS LICENCIA_ALTA,

                A.ESTADO,
                A.FECHA_CREACION,
                A.USUARIO_CREACION,
                A.FECHA_VALIDACION,
                A.USUARIO_VALIDACION,
                A.FECHA_EXPORTACION,
                A.USUARIO_EXPORTACION,
                A.ARCHIVO_EXPORTADO,
                A.FECHA_ANULACION,
                A.USUARIO_ANULACION,
                A.MOTIVO_ANULACION

            FROM dbo.ALTAS_PRODUCTOS A

            WHERE A.ID_ALTA = @ID_ALTA;
        `);

    if (!cabecera.recordset.length) {
        return null;
    }

    const resumen = await pool
        .request()
        .input(
            'ID_ALTA',
            sql.Int,
            idAlta
        )
        .query(`
            SELECT
                COUNT(*) AS TOTAL,

                SUM(CASE
                    WHEN ESTADO_ERP = 'GENERADO_OK_EN_ERP'
                    THEN 1 ELSE 0
                END) AS CONFIRMADOS,

                SUM(CASE
                    WHEN ESTADO_ERP = 'PENDIENTE_ERP'
                    THEN 1 ELSE 0
                END) AS PENDIENTES,

                SUM(CASE
                    WHEN ESTADO_ERP = 'ERROR_ERP'
                    THEN 1 ELSE 0
                END) AS ERRORES

            FROM dbo.ALTAS_PRODUCTOS_EXPORTADOS

            WHERE ID_ALTA = @ID_ALTA;
        `);

    const productos = await pool
        .request()
        .input(
            'ID_ALTA',
            sql.Int,
            idAlta
        )
        .query(`
            SELECT
                ID_ALTA,
                COD_ALFA,
                CODIGO_ERP,
                EAN_ERP,
                ESTADO_ERP,
                FECHA_CONFIRMACION_ERP,
                ARCHIVO_EXPORTADO,
                FECHA_EXPORTACION,
                USUARIO_EXPORTACION

            FROM dbo.ALTAS_PRODUCTOS_EXPORTADOS

            WHERE ID_ALTA = @ID_ALTA

            ORDER BY COD_ALFA;
        `);

    return {
        alta: cabecera.recordset[0],
        resumenErp: resumen.recordset[0] || {
            TOTAL: 0,
            CONFIRMADOS: 0,
            PENDIENTES: 0,
            ERRORES: 0,
        },
        productos: productos.recordset,
    };
}


module.exports = {
    obtenerResumen,
    listarAltasSeguimiento,
    obtenerSeguimientoAlta,
};
