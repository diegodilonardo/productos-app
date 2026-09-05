const { getConnection, sql } = require('../config/database');


/* ============================================================
   LISTADO BASE DE ALTAS PARA DASHBOARD / SEGUIMIENTO

   IMPORTANTE:
   - La empresa se filtra SIEMPRE en SQL.
   - ALTAS_PRODUCTOS_EXPORTADOS es LEFT JOIN: una Alta VALIDADA
     debe aparecer aunque todavía no haya podido exportarse.
   - LICENCIA_ALTA se obtiene del detalle. El Alta trabaja con una
     sola licencia; si el valor está vacío se normaliza luego como
     SIN LICENCIA en el service.
   ============================================================ */
async function listarAltasSeguimiento({
    estado = null,
    idEmpresa
} = {}) {

    const pool = await getConnection();

    const request = pool
        .request()
        .input('ID_EMPRESA', sql.Int, Number(idEmpresa));

    let filtroEstado = '';

    if (estado) {
        request.input(
            'ESTADO',
            sql.VarChar(30),
            estado
        );

        filtroEstado = `
            AND A.ESTADO = @ESTADO
        `;
    }

    const resultado = await request.query(`
        SELECT
            A.ID_ALTA,
            A.ID_EMPRESA,
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
            A.MOTIVO_ANULACION,

            L.LICENCIA_ALTA,

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

        OUTER APPLY (
            SELECT TOP 1
                NULLIF(LTRIM(RTRIM(D.LICENCIA)), '') AS LICENCIA_ALTA
            FROM dbo.ALTAS_PRODUCTOS_DETALLE D
            WHERE D.ID_ALTA = A.ID_ALTA
              AND D.ID_EMPRESA = A.ID_EMPRESA
            ORDER BY
                CASE WHEN ISNULL(D.GENERADO_AUTOMATICO, 0) = 0 THEN 0 ELSE 1 END,
                D.ID_DETALLE
        ) L

        LEFT JOIN dbo.ALTAS_PRODUCTOS_EXPORTADOS E
            ON E.ID_ALTA = A.ID_ALTA
           AND E.ID_EMPRESA = A.ID_EMPRESA

        WHERE A.ID_EMPRESA = @ID_EMPRESA
        ${filtroEstado}

        GROUP BY
            A.ID_ALTA,
            A.ID_EMPRESA,
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
            A.MOTIVO_ANULACION,
            L.LICENCIA_ALTA

        ORDER BY A.ID_ALTA DESC;
    `);

    return resultado.recordset;
}


/* ============================================================
   DETALLE DE UNA ALTA EN SEGUIMIENTO
   ============================================================ */
async function obtenerSeguimientoAlta(idAlta, idEmpresa) {

    const pool = await getConnection();

    const cabecera = await pool
        .request()
        .input('ID_ALTA', sql.Int, idAlta)
        .input('ID_EMPRESA', sql.Int, idEmpresa)
        .query(`
            SELECT
                A.ID_ALTA,
                A.ID_EMPRESA,
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
                A.MOTIVO_ANULACION,
                L.LICENCIA_ALTA

            FROM dbo.ALTAS_PRODUCTOS A

            OUTER APPLY (
                SELECT TOP 1
                    NULLIF(LTRIM(RTRIM(D.LICENCIA)), '') AS LICENCIA_ALTA
                FROM dbo.ALTAS_PRODUCTOS_DETALLE D
                WHERE D.ID_ALTA = A.ID_ALTA
                  AND D.ID_EMPRESA = A.ID_EMPRESA
                ORDER BY
                    CASE WHEN ISNULL(D.GENERADO_AUTOMATICO, 0) = 0 THEN 0 ELSE 1 END,
                    D.ID_DETALLE
            ) L

            WHERE A.ID_ALTA = @ID_ALTA
              AND A.ID_EMPRESA = @ID_EMPRESA;
        `);

    if (!cabecera.recordset.length) {
        return null;
    }

    const resumen = await pool
        .request()
        .input('ID_ALTA', sql.Int, idAlta)
        .input('ID_EMPRESA', sql.Int, idEmpresa)
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
            WHERE ID_ALTA = @ID_ALTA
              AND ID_EMPRESA = @ID_EMPRESA;
        `);

    const productos = await pool
        .request()
        .input('ID_ALTA', sql.Int, idAlta)
        .input('ID_EMPRESA', sql.Int, idEmpresa)
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
              AND ID_EMPRESA = @ID_EMPRESA
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
    listarAltasSeguimiento,
    obtenerSeguimientoAlta,
};
