const { getConnection, sql } = require('../config/database');

const columnasCantidadesModulo = [
    'T01','T02','T03','T04','T05','T06','T07','T08','T10','T12','T14','T15','T16','T17','T18','T19',
    'T20','T21','T22','T23','T24','T25','T26','T27','T28','T29','T30','T31','T32','T33','T34','T35',
    'T36','T37','T38','T385','T39','T395','T40','T405','T41','T415','T42','T425','T43','T435','T44','T445',
    'T45','T455','T46','T47','T48','T49','T50','T_XS','T_S','T_L','T_M','T_XL','T_2XL','T_3XL'
];


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


/* ============================================================
   PRODUCTOS CONFIRMADOS EN ERP PARA SEGUIMIENTO DE EAN

   Para las Altas generadas se toma la copia conciliada de
   ALTAS_PRODUCTOS_EXPORTADOS. Las Altas SIN_NOVEDADES_ERP no siempre
   generan filas de exportación, por lo que se completan directamente
   desde el maestro PRODUCTOS que ya confirmó su existencia en Presea.
   ============================================================ */
async function listarProductosSeguimientoEan(idEmpresa) {
    const pool = await getConnection();

    const resultado = await pool
        .request()
        .input('ID_EMPRESA', sql.Int, Number(idEmpresa))
        .query(`
            SELECT
                E.ID_ALTA,
                E.ID_EMPRESA,
                E.COD_ALFA,
                E.CODIGO_ERP,
                E.EAN_ERP,
                GE.EAN_GS1,
                GE.FECHA_ENVIO_PRESEA,
                GE.USUARIO_ENVIO_PRESEA,
                E.FECHA_CONFIRMACION_ERP,
                A.CODIGO_ALTA,
                A.CODIGO_MARCA,
                A.DETALLE_MARCA,
                A.CODIGO_RUBRO,
                A.DETALLE_RUBRO,
                A.CODIGO_ANO,
                A.CODIGO_TEMPORADA,
                A.DETALLE_TEMPORADA,
                D.CODIGO_MODELO,
                D.DETALLE_MODELO,
                D.CODIGO_COLOR,
                D.DETALLE_COLOR,
                D.CODIGO_MODULO,
                D.DETALLE_MODULO,
                D.CODIGO_TALLE,
                D.DETALLE_TALLE,
                D.PARES,
                TM.PARES AS PARES_MAESTRO,
                ${columnasCantidadesModulo.map(columna => `TM.${columna} AS TM_${columna}`).join(',\n                ')},
                D.DETALLE_PRODUCTO,
                D.DETALLE_EDAD,
                D.SEXO,
                D.CODIGO_PAIS,
                D.DETALLE_PAIS,
                D.PAIS_EAN,
                D.DETALLE_CLASIFICACION,
                D.TIPO_PRODUCTO_DETALLE,
                D.GENERADO_AUTOMATICO,
                D.FAMILIAS_MODULO,
                D.LICENCIA AS LICENCIA_ALTA,
                G.NOMBRE_IMAGEN AS NOMBRE_IMAGEN_GS1,
                G.URL_IMAGEN AS URL_IMAGEN_GS1,
                G.FECHA_ACTUALIZACION AS FECHA_URL_GS1
            FROM (
                SELECT
                    EX.ID_ALTA,
                    EX.ID_EMPRESA,
                    EX.COD_ALFA,
                    CONVERT(VARCHAR(30), EX.CODIGO_ERP) AS CODIGO_ERP,
                    CONVERT(VARCHAR(20), EX.EAN_ERP) AS EAN_ERP,
                    EX.FECHA_CONFIRMACION_ERP,
                    EX.ESTADO_ERP
                FROM dbo.ALTAS_PRODUCTOS_EXPORTADOS EX
                WHERE EX.ID_EMPRESA = @ID_EMPRESA
                  AND EX.ESTADO_ERP = 'GENERADO_OK_EN_ERP'

                UNION ALL

                SELECT DISTINCT
                    X.ID_ALTA,
                    X.ID_EMPRESA,
                    X.CODIGO_ALFA AS COD_ALFA,
                    COALESCE(
                        CONVERT(VARCHAR(30), PR.CODIGO_ERP),
                        CONVERT(VARCHAR(30), PR.CODIGO)
                    ) AS CODIGO_ERP,
                    COALESCE(
                        CONVERT(VARCHAR(20), PR.CODIGO_EAN),
                        CONVERT(VARCHAR(20), PR.EAN)
                    ) AS EAN_ERP,
                    CAST(NULL AS DATETIME2) AS FECHA_CONFIRMACION_ERP,
                    'SIN_NOVEDADES_ERP' AS ESTADO_ERP
                FROM dbo.ALTAS_PRODUCTOS_DETALLE X
                INNER JOIN dbo.ALTAS_PRODUCTOS A0
                    ON A0.ID_EMPRESA = X.ID_EMPRESA
                   AND A0.ID_ALTA = X.ID_ALTA
                INNER JOIN dbo.PRODUCTOS PR
                    ON PR.ID_EMPRESA = X.ID_EMPRESA
                   AND PR.CODIGO_ALFA = X.CODIGO_ALFA
                   AND ISNULL(PR.ACTIVO, 1) = 1
                WHERE X.ID_EMPRESA = @ID_EMPRESA
                  AND A0.ESTADO = 'SIN_NOVEDADES_ERP'
                  AND NOT EXISTS (
                      SELECT 1
                      FROM dbo.ALTAS_PRODUCTOS_EXPORTADOS EX0
                      WHERE EX0.ID_EMPRESA = X.ID_EMPRESA
                        AND EX0.ID_ALTA = X.ID_ALTA
                        AND EX0.COD_ALFA = X.CODIGO_ALFA
                  )
            ) E
            INNER JOIN dbo.ALTAS_PRODUCTOS A
                ON A.ID_ALTA = E.ID_ALTA
               AND A.ID_EMPRESA = E.ID_EMPRESA
            LEFT JOIN dbo.GS1_PRODUCTOS_URLS G
                ON G.ID_EMPRESA = E.ID_EMPRESA
               AND G.ID_ALTA = E.ID_ALTA
               AND G.COD_ALFA = E.COD_ALFA
            LEFT JOIN dbo.GS1_PRODUCTOS_EAN GE
                ON GE.ID_EMPRESA = E.ID_EMPRESA
               AND GE.ID_ALTA = E.ID_ALTA
               AND GE.COD_ALFA = E.COD_ALFA
            OUTER APPLY (
                SELECT TOP 1
                    X.CODIGO_MODELO,
                    X.DETALLE_MODELO,
                    X.CODIGO_COLOR,
                    X.DETALLE_COLOR,
                    X.CODIGO_MODULO,
                    X.DETALLE_MODULO,
                    X.CODIGO_TALLE,
                    X.DETALLE_TALLE,
                    X.PARES,
                    X.DETALLE_PRODUCTO,
                    X.DETALLE_EDAD,
                    X.SEXO,
                    X.CODIGO_PAIS,
                    X.DETALLE_PAIS,
                    MP.PAIS_EAN,
                    X.DETALLE_CLASIFICACION,
                    X.TIPO_PRODUCTO_DETALLE,
                    X.GENERADO_AUTOMATICO,
                    STUFF((
                        SELECT '|' + CONVERT(VARCHAR(30), P.CODIGO_ALFA)
                        FROM dbo.ALTAS_PRODUCTOS_FAMILIAS_DETALLE R
                        INNER JOIN dbo.ALTAS_PRODUCTOS_DETALLE P
                            ON P.ID_DETALLE = R.ID_DETALLE_PADRE
                        WHERE R.ID_ALTA = X.ID_ALTA
                          AND R.ID_DETALLE_HIJO = X.ID_DETALLE
                        ORDER BY P.ID_DETALLE
                        FOR XML PATH(''), TYPE
                    ).value('.', 'VARCHAR(MAX)'), 1, 1, '') AS FAMILIAS_MODULO,
                    X.LICENCIA
                FROM dbo.ALTAS_PRODUCTOS_DETALLE X
                LEFT JOIN dbo.MAESTRO_PAISES MP
                    ON MP.ID_EMPRESA = X.ID_EMPRESA
                   AND MP.CODIGO_PAIS = X.CODIGO_PAIS
                   AND ISNULL(MP.ACTIVO, 1) = 1
                WHERE X.ID_ALTA = E.ID_ALTA
                  AND X.ID_EMPRESA = E.ID_EMPRESA
                  AND X.CODIGO_ALFA = E.COD_ALFA
                ORDER BY
                    CASE WHEN ISNULL(X.GENERADO_AUTOMATICO, 0) = 0 THEN 0 ELSE 1 END,
                    X.ID_DETALLE
            ) D
            LEFT JOIN dbo.MAESTRO_TALLES_MODULOS TM
                ON TM.ID_EMPRESA = E.ID_EMPRESA
               AND TM.CODIGO_MODULO = D.CODIGO_MODULO
               AND ISNULL(TM.ACTIVO, 1) = 1
               AND ISNULL(TM.ES_CONSISTENTE, 0) = 1
            WHERE E.ID_EMPRESA = @ID_EMPRESA
              AND E.ESTADO_ERP IN ('GENERADO_OK_EN_ERP', 'SIN_NOVEDADES_ERP')
              AND ISNULL(A.ESTADO, '') <> 'ANULADO'
              AND (
                    (
                        UPPER(LTRIM(RTRIM(ISNULL(D.TIPO_PRODUCTO_DETALLE, '')))) = 'MODULO'
                        AND ISNULL(D.GENERADO_AUTOMATICO, 0) = 0
                    )
                    OR UPPER(LTRIM(RTRIM(ISNULL(D.DETALLE_CLASIFICACION, '')))) = 'PRIMERA'
              )
            ORDER BY
                A.ID_ALTA DESC,
                D.DETALLE_MODELO,
                D.DETALLE_COLOR,
                E.COD_ALFA;
        `);

    return resultado.recordset;
}


async function guardarUrlsProductosGs1({ idEmpresa, asociaciones, usuario }) {
    const pool = await getConnection();
    const transaction = new sql.Transaction(pool);
    await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
    try {
        let insertadas = 0;
        let actualizadas = 0;
        for (const asociacion of asociaciones) {
            const request = new sql.Request(transaction)
                .input('ID_EMPRESA', sql.Int, Number(idEmpresa))
                .input('ID_ALTA', sql.Int, Number(asociacion.idAlta))
                .input('COD_ALFA', sql.VarChar(30), asociacion.codigoAlfa)
                .input('NOMBRE_IMAGEN', sql.VarChar(260), asociacion.nombreImagen)
                .input('URL_IMAGEN', sql.VarChar(2000), asociacion.urlImagen)
                .input('USUARIO', sql.VarChar(100), usuario);
            const resultado = await request.query(`
                MERGE dbo.GS1_PRODUCTOS_URLS WITH (HOLDLOCK) AS destino
                USING (
                    SELECT @ID_EMPRESA AS ID_EMPRESA, @ID_ALTA AS ID_ALTA, @COD_ALFA AS COD_ALFA
                ) AS origen
                   ON destino.ID_EMPRESA = origen.ID_EMPRESA
                  AND destino.ID_ALTA = origen.ID_ALTA
                  AND destino.COD_ALFA = origen.COD_ALFA
                WHEN MATCHED THEN
                    UPDATE SET
                        NOMBRE_IMAGEN = @NOMBRE_IMAGEN,
                        URL_IMAGEN = @URL_IMAGEN,
                        USUARIO_ACTUALIZACION = @USUARIO,
                        FECHA_ACTUALIZACION = SYSDATETIME()
                WHEN NOT MATCHED THEN
                    INSERT (ID_EMPRESA, ID_ALTA, COD_ALFA, NOMBRE_IMAGEN, URL_IMAGEN, USUARIO_CREACION)
                    VALUES (@ID_EMPRESA, @ID_ALTA, @COD_ALFA, @NOMBRE_IMAGEN, @URL_IMAGEN, @USUARIO)
                OUTPUT $action AS ACCION;
            `);
            const accion = String(resultado.recordset[0]?.ACCION || '').toUpperCase();
            if (accion === 'INSERT') insertadas += 1;
            if (accion === 'UPDATE') actualizadas += 1;
        }
        await transaction.commit();
        return { insertadas, actualizadas };
    } catch (error) {
        try { await transaction.rollback(); } catch (_) {}
        throw error;
    }
}

async function guardarCodigosEanGs1({ idEmpresa, productos, usuario, archivoOrigen }) {
    const pool = await getConnection();
    const transaction = new sql.Transaction(pool);
    await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
    try {
        let insertados = 0, actualizados = 0;
        for (const producto of productos) {
            const resultado = await new sql.Request(transaction)
                .input('ID_EMPRESA', sql.Int, Number(idEmpresa))
                .input('ID_ALTA', sql.Int, Number(producto.idAlta))
                .input('COD_ALFA', sql.VarChar(30), producto.codigoAlfa)
                .input('EAN_GS1', sql.VarChar(14), producto.ean)
                .input('ARCHIVO', sql.VarChar(260), archivoOrigen)
                .input('URL', sql.VarChar(2000), producto.urlImagen || null)
                .input('NOMBRE_IMAGEN', sql.VarChar(260), producto.nombreImagen || producto.codigoAlfa)
                .input('USUARIO', sql.VarChar(100), usuario)
                .query(`
                    MERGE dbo.GS1_PRODUCTOS_EAN WITH (HOLDLOCK) AS D
                    USING (SELECT @ID_EMPRESA ID_EMPRESA, @ID_ALTA ID_ALTA, @COD_ALFA COD_ALFA) O
                       ON D.ID_EMPRESA=O.ID_EMPRESA AND D.ID_ALTA=O.ID_ALTA AND D.COD_ALFA=O.COD_ALFA
                    WHEN MATCHED THEN UPDATE SET EAN_GS1=@EAN_GS1, ARCHIVO_ORIGEN=@ARCHIVO,
                        USUARIO_ACTUALIZACION=@USUARIO, FECHA_ACTUALIZACION=SYSDATETIME()
                    WHEN NOT MATCHED THEN INSERT
                        (ID_EMPRESA,ID_ALTA,COD_ALFA,EAN_GS1,ARCHIVO_ORIGEN,USUARIO_CREACION)
                        VALUES (@ID_EMPRESA,@ID_ALTA,@COD_ALFA,@EAN_GS1,@ARCHIVO,@USUARIO)
                    OUTPUT $action ACCION;
                    IF @URL IS NOT NULL
                    BEGIN
                        MERGE dbo.GS1_PRODUCTOS_URLS WITH (HOLDLOCK) AS U
                        USING (
                            SELECT @ID_EMPRESA ID_EMPRESA, @ID_ALTA ID_ALTA, @COD_ALFA COD_ALFA
                        ) O
                           ON U.ID_EMPRESA=O.ID_EMPRESA
                          AND U.ID_ALTA=O.ID_ALTA
                          AND U.COD_ALFA=O.COD_ALFA
                        WHEN MATCHED THEN UPDATE SET
                            NOMBRE_IMAGEN=@NOMBRE_IMAGEN,
                            URL_IMAGEN=@URL,
                            USUARIO_ACTUALIZACION=@USUARIO,
                            FECHA_ACTUALIZACION=SYSDATETIME()
                        WHEN NOT MATCHED THEN INSERT
                            (ID_EMPRESA,ID_ALTA,COD_ALFA,NOMBRE_IMAGEN,URL_IMAGEN,USUARIO_CREACION)
                            VALUES
                            (@ID_EMPRESA,@ID_ALTA,@COD_ALFA,@NOMBRE_IMAGEN,@URL,@USUARIO);
                    END
                `);
            const accion = String(resultado.recordsets?.[0]?.[0]?.ACCION || resultado.recordset?.[0]?.ACCION || '').toUpperCase();
            if (accion === 'INSERT') insertados += 1; else actualizados += 1;
        }
        await transaction.commit();
        return { insertados, actualizados };
    } catch (error) { try { await transaction.rollback(); } catch (_) {} throw error; }
}

async function marcarCodigosEanEnviadosPresea({ idEmpresa, claves, usuario }) {
    const pool = await getConnection();
    let actualizados = 0;
    for (const clave of claves) {
        const [idAlta, ...codigoPartes] = String(clave).split('|');
        const codigoAlfa = codigoPartes.join('|');
        const resultado = await pool.request()
            .input('ID_EMPRESA', sql.Int, Number(idEmpresa))
            .input('ID_ALTA', sql.Int, Number(idAlta))
            .input('COD_ALFA', sql.VarChar(30), codigoAlfa)
            .input('USUARIO', sql.VarChar(100), usuario)
            .query(`UPDATE dbo.GS1_PRODUCTOS_EAN SET FECHA_ENVIO_PRESEA=SYSDATETIME(),
                USUARIO_ENVIO_PRESEA=@USUARIO WHERE ID_EMPRESA=@ID_EMPRESA
                AND ID_ALTA=@ID_ALTA AND COD_ALFA=@COD_ALFA; SELECT @@ROWCOUNT CANTIDAD;`);
        actualizados += Number(resultado.recordset[0]?.CANTIDAD || 0);
    }
    return actualizados;
}


module.exports = {
    listarAltasSeguimiento,
    obtenerSeguimientoAlta,
    listarProductosSeguimientoEan,
    guardarUrlsProductosGs1,
    guardarCodigosEanGs1,
    marcarCodigosEanEnviadosPresea,
};
