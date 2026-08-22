const {
    getConnection,
    sql
} = require('../config/database');


async function obtenerMaestroSimple({
    tabla,
    columnas,
    orden
}) {

    const pool =
        await getConnection();


    const resultado =
        await pool.request().query(`
            SELECT
                ${columnas.join(', ')}
            FROM dbo.${tabla}
            WHERE ACTIVO = 1
            ORDER BY ${orden};
        `);


    return resultado.recordset;
}


/* ============================================================
   PROVEEDORES
   ============================================================ */

async function buscarProveedores({
    rubro
} = {}) {

    const pool =
        await getConnection();

    const request =
        pool.request();

    let where = `
        WHERE ACTIVO = 1
    `;

    if (rubro) {

        request.input(
            'RUBRO',
            sql.VarChar(100),
            String(rubro).trim()
        );

        where += `
            AND UPPER(
                LTRIM(RTRIM(ISNULL(RUBRO, '')))
            ) =
            UPPER(
                LTRIM(RTRIM(@RUBRO))
            )
        `;
    }

    const resultado =
        await request.query(`
            SELECT
                CODIGO,
                PRESEA,
                RUBRO,
                NVA_RAZON_SOCIAL
            FROM dbo.MAESTRO_PROVEEDORES
            ${where}
            ORDER BY
                NVA_RAZON_SOCIAL,
                CODIGO;
        `);

    return resultado.recordset;
}


/* ============================================================
   MODELOS
   ============================================================ */

async function buscarModelos({
    marca,
    rubro,
    texto,
    licencia
}) {

    const pool =
        await getConnection();


    const request =
        pool.request();


    let where = `
        WHERE ACTIVO = 1
    `;


    if (marca) {

        request.input(
            'MARCA',
            sql.VarChar(30),
            marca
        );

        where += `
            AND MARCA_MODELO = @MARCA
        `;
    }


    if (rubro) {

        request.input(
            'RUBRO',
            sql.VarChar(20),
            rubro
        );

        where += `
            AND RUBRO_MODELO = @RUBRO
        `;
    }


    if (licencia) {

        if (licencia === '__SIN_LICENCIA__') {

            where += `
                AND
                (
                    LICENCIA IS NULL
                    OR LTRIM(RTRIM(LICENCIA)) = ''
                )
            `;

        } else {

            request.input(
                'LICENCIA',
                sql.VarChar(100),
                licencia
            );

            where += `
                AND LTRIM(RTRIM(LICENCIA)) = @LICENCIA
            `;
        }
    }


    if (texto) {

        request.input(
            'TEXTO',
            sql.VarChar(100),
            `%${texto}%`
        );

        where += `
            AND
            (
                CODIGO_MODELO LIKE @TEXTO
                OR DETALLE_MODELO LIKE @TEXTO
                OR LICENCIA LIKE @TEXTO
            )
        `;
    }


    const resultado =
        await request.query(`
            SELECT TOP 200
                CODIGO_MODELO,
                RUBRO_MODELO,
                DETALLE_MODELO,
                LICENCIA,
                MARCA_MODELO
            FROM dbo.MAESTRO_MODELOS

            ${where}

            ORDER BY
                DETALLE_MODELO,
                CODIGO_MODELO;
        `);


    return resultado.recordset;
}


/* ============================================================
   LICENCIAS DE MODELOS
   ============================================================ */

async function buscarLicenciasModelos({
    marca,
    rubro
}) {

    const pool =
        await getConnection();

    const request =
        pool.request();

    let where = `
        WHERE ACTIVO = 1
    `;

    if (marca) {

        request.input(
            'MARCA',
            sql.VarChar(30),
            marca
        );

        where += `
            AND MARCA_MODELO = @MARCA
        `;
    }

    if (rubro) {

        request.input(
            'RUBRO',
            sql.VarChar(20),
            rubro
        );

        where += `
            AND RUBRO_MODELO = @RUBRO
        `;
    }

    const resultado =
        await request.query(`
            SELECT
                CODIGO_LICENCIA,
                DETALLE_LICENCIA
            FROM
            (
                SELECT DISTINCT
                    LTRIM(RTRIM(LICENCIA))
                        AS CODIGO_LICENCIA,
                    LTRIM(RTRIM(LICENCIA))
                        AS DETALLE_LICENCIA
                FROM dbo.MAESTRO_MODELOS
                ${where}
                AND NULLIF(
                    LTRIM(RTRIM(LICENCIA)),
                    ''
                ) IS NOT NULL

                UNION ALL

                SELECT
                    '__SIN_LICENCIA__'
                        AS CODIGO_LICENCIA,
                    'Sin licencia'
                        AS DETALLE_LICENCIA
                WHERE EXISTS
                (
                    SELECT 1
                    FROM dbo.MAESTRO_MODELOS
                    ${where}
                    AND
                    (
                        LICENCIA IS NULL
                        OR LTRIM(RTRIM(LICENCIA)) = ''
                    )
                )
            ) AS L

            ORDER BY
                CASE
                    WHEN CODIGO_LICENCIA =
                        '__SIN_LICENCIA__'
                    THEN 0
                    ELSE 1
                END,
                DETALLE_LICENCIA;
        `);

    return resultado.recordset;
}


/* ============================================================
   TALLES MODULOS
   ============================================================ */

async function obtenerTallesModulos() {

    const pool =
        await getConnection();


    const resultado =
        await pool.request().query(`
            SELECT *
            FROM dbo.MAESTRO_TALLES_MODULOS
            WHERE
                ACTIVO = 1
                AND ES_CONSISTENTE = 1
            ORDER BY CODIGO_MODULO;
        `);


    return resultado.recordset;
}


module.exports = {
    obtenerMaestroSimple,
    buscarProveedores,
    buscarModelos,
    buscarLicenciasModelos,
    obtenerTallesModulos
};