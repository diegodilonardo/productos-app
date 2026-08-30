const { getConnection, sql } = require('../config/database');


async function obtenerUltimoHashOK(
    maestro,
    idEmpresa
) {

    const pool = await getConnection();

    const resultado = await pool
        .request()
        .input(
            'MAESTRO',
            sql.VarChar(100),
            maestro
        )
        .input(
            'ID_EMPRESA',
            sql.Int,
            idEmpresa
        )
        .query(`
            SELECT TOP 1
                HASH_ARCHIVO
            FROM dbo.CONTROL_IMPORTACIONES
            WHERE MAESTRO = @MAESTRO
              AND ID_EMPRESA = @ID_EMPRESA
              AND ESTADO IN ('OK', 'SIN_CAMBIOS')
              AND HASH_ARCHIVO IS NOT NULL
            ORDER BY ID_IMPORTACION DESC;
        `);

    if (resultado.recordset.length === 0) {
        return null;
    }

    return resultado.recordset[0].HASH_ARCHIVO;
}


async function crearControlImportacion({
    maestro,
    archivo,
    estado,
    hash,
    tamano,
    fechaArchivo,
    idEmpresa
}) {

    const pool = await getConnection();

    const resultado = await pool
        .request()
        .input(
            'MAESTRO',
            sql.VarChar(100),
            maestro
        )
        .input(
            'ARCHIVO',
            sql.VarChar(255),
            archivo
        )
        .input(
            'ESTADO',
            sql.VarChar(20),
            estado
        )
        .input(
            'HASH_ARCHIVO',
            sql.VarChar(64),
            hash
        )
        .input(
            'TAMANO_ARCHIVO',
            sql.BigInt,
            tamano
        )
        .input(
            'FECHA_ARCHIVO',
            sql.DateTime2,
            fechaArchivo
        )
        .input(
            'ID_EMPRESA',
            sql.Int,
            idEmpresa
        )
        .query(`
            INSERT INTO dbo.CONTROL_IMPORTACIONES
            (
                MAESTRO,
                ARCHIVO,
                FECHA_INICIO,
                ESTADO,
                HASH_ARCHIVO,
                TAMANO_ARCHIVO,
                FECHA_ARCHIVO,
                ID_EMPRESA
            )
            OUTPUT INSERTED.ID_IMPORTACION
            VALUES
            (
                @MAESTRO,
                @ARCHIVO,
                SYSDATETIME(),
                @ESTADO,
                @HASH_ARCHIVO,
                @TAMANO_ARCHIVO,
                @FECHA_ARCHIVO,
                @ID_EMPRESA
            );
        `);

    return resultado.recordset[0].ID_IMPORTACION;
}


async function finalizarControlImportacion(
    idImportacion,
    datos
) {

    const pool = await getConnection();

    await pool
        .request()
        .input(
            'ID_IMPORTACION',
            sql.BigInt,
            idImportacion
        )
        .input(
            'ESTADO',
            sql.VarChar(20),
            datos.estado
        )
        .input(
            'REGISTROS_ARCHIVO',
            sql.Int,
            datos.registrosArchivo || 0
        )
        .input(
            'REGISTROS_NUEVOS',
            sql.Int,
            datos.nuevos || 0
        )
        .input(
            'REGISTROS_MODIFICADOS',
            sql.Int,
            datos.modificados || 0
        )
        .input(
            'REGISTROS_INACTIVOS',
            sql.Int,
            datos.inactivos || 0
        )
        .input(
            'REGISTROS_ERROR',
            sql.Int,
            datos.errores || 0
        )
        .input(
            'MENSAJE',
            sql.VarChar(1000),
            datos.mensaje || null
        )
        .query(`
            UPDATE dbo.CONTROL_IMPORTACIONES
            SET
                FECHA_FIN = SYSDATETIME(),
                ESTADO = @ESTADO,
                REGISTROS_ARCHIVO = @REGISTROS_ARCHIVO,
                REGISTROS_NUEVOS = @REGISTROS_NUEVOS,
                REGISTROS_MODIFICADOS = @REGISTROS_MODIFICADOS,
                REGISTROS_INACTIVOS = @REGISTROS_INACTIVOS,
                REGISTROS_ERROR = @REGISTROS_ERROR,
                MENSAJE = @MENSAJE
            WHERE ID_IMPORTACION = @ID_IMPORTACION;
        `);
}


module.exports = {
    obtenerUltimoHashOK,
    crearControlImportacion,
    finalizarControlImportacion
};
