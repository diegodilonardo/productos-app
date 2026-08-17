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
   MODELOS
   ============================================================ */

async function buscarModelos({
    marca,
    rubro,
    texto
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
    buscarModelos,
    obtenerTallesModulos
};