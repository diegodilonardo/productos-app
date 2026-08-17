const { getConnection, sql } = require("../config/database");

/* ============================================================
   CABECERA - MAESTROS
   ============================================================ */

async function buscarMarca(codigoMarca) {
  const pool = await getConnection();

  const resultado = await pool
    .request()
    .input("CODIGO_MARCA", sql.VarChar(3), codigoMarca).query(`
            SELECT TOP 1
                CODIGO_MARCA,
                DETALLE_MARCA
            FROM dbo.MAESTRO_MARCAS
            WHERE
                CODIGO_MARCA = @CODIGO_MARCA
                AND ACTIVO = 1;
        `);

  return resultado.recordset[0] || null;
}

async function buscarRubro(codigoRubro) {
  const pool = await getConnection();

  const resultado = await pool
    .request()
    .input("CODIGO_RUBRO", sql.VarChar(1), codigoRubro).query(`
            SELECT TOP 1
                CODIGO_RUBRO,
                DETALLE_RUBRO
            FROM dbo.MAESTRO_RUBROS
            WHERE
                CODIGO_RUBRO = @CODIGO_RUBRO
                AND ACTIVO = 1;
        `);

  return resultado.recordset[0] || null;
}

async function buscarTemporada(codigoTemporada) {
  const pool = await getConnection();

  const resultado = await pool
    .request()
    .input("CODIGO_TEMPORADA", sql.VarChar(1), codigoTemporada).query(`
            SELECT TOP 1
                CODIGO_TEMPORADA,
                DETALLE_TEMPORADA
            FROM dbo.MAESTRO_TEMPORADAS
            WHERE
                CODIGO_TEMPORADA = @CODIGO_TEMPORADA
                AND ACTIVO = 1;
        `);

  return resultado.recordset[0] || null;
}

async function buscarAno(codigoAno) {
  const pool = await getConnection();

  const resultado = await pool
    .request()
    .input("CODIGO_ANO", sql.VarChar(2), codigoAno).query(`
            SELECT TOP 1
                CODIGO_ANO,
                DETALLE_ANO
            FROM dbo.MAESTRO_ANOS
            WHERE
                CODIGO_ANO = @CODIGO_ANO
                AND ACTIVO = 1;
        `);

  return resultado.recordset[0] || null;
}

/* ============================================================
   CREAR CABECERA
   ============================================================ */

async function crearAlta(datos) {
  const pool = await getConnection();

  const resultado = await pool
    .request()

    .input("CODIGO_ALTA", sql.VarChar(50), datos.codigoAlta)

    .input("CODIGO_MARCA", sql.VarChar(3), datos.codigoMarca)

    .input("DETALLE_MARCA", sql.VarChar(30), datos.detalleMarca)

    .input("CODIGO_RUBRO", sql.VarChar(1), datos.codigoRubro)

    .input("DETALLE_RUBRO", sql.VarChar(30), datos.detalleRubro)

    .input("TIPO_PRODUCTO", sql.VarChar(20), datos.tipoProducto)

    .input("CODIGO_TEMPORADA", sql.VarChar(1), datos.codigoTemporada)

    .input("DETALLE_TEMPORADA", sql.VarChar(20), datos.detalleTemporada)

    .input("CODIGO_ANO", sql.VarChar(2), datos.codigoAno)

    .input("USUARIO_CREACION", sql.VarChar(100), datos.usuarioCreacion).query(`
            INSERT INTO dbo.ALTAS_PRODUCTOS
            (
                CODIGO_ALTA,

                CODIGO_MARCA,
                DETALLE_MARCA,

                CODIGO_RUBRO,
                DETALLE_RUBRO,

                TIPO_PRODUCTO,

                CODIGO_TEMPORADA,
                DETALLE_TEMPORADA,

                CODIGO_ANO,

                ESTADO,

                FECHA_CREACION,
                USUARIO_CREACION
            )

            OUTPUT INSERTED.*

            VALUES
            (
                @CODIGO_ALTA,

                @CODIGO_MARCA,
                @DETALLE_MARCA,

                @CODIGO_RUBRO,
                @DETALLE_RUBRO,

                @TIPO_PRODUCTO,

                @CODIGO_TEMPORADA,
                @DETALLE_TEMPORADA,

                @CODIGO_ANO,

                'BORRADOR',

                SYSDATETIME(),
                @USUARIO_CREACION
            );
        `);

  return resultado.recordset[0];
}

/* ============================================================
   LISTAR CABECERAS
   ============================================================ */

async function listarAltas() {
  const pool = await getConnection();

  const resultado = await pool.request().query(`
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

                A.ESTADO,

                A.FECHA_CREACION,
                A.USUARIO_CREACION,

                (
                    SELECT COUNT(*)
                    FROM dbo.ALTAS_PRODUCTOS_DETALLE D
                    WHERE D.ID_ALTA = A.ID_ALTA
                ) AS CANTIDAD_PRODUCTOS

            FROM dbo.ALTAS_PRODUCTOS A

            ORDER BY
                A.ID_ALTA DESC;
        `);

  return resultado.recordset;
}

/* ============================================================
   OBTENER ALTA
   ============================================================ */

async function obtenerAltaPorId(idAlta) {
  const pool = await getConnection();

  const resultado = await pool.request().input("ID_ALTA", sql.BigInt, idAlta)
    .query(`
            SELECT *
            FROM dbo.ALTAS_PRODUCTOS
            WHERE ID_ALTA = @ID_ALTA;
        `);

  return resultado.recordset[0] || null;
}

async function obtenerDetalleAlta(idAlta) {
  const pool = await getConnection();

  const resultado = await pool.request().input("ID_ALTA", sql.BigInt, idAlta)
    .query(`
            SELECT *
            FROM dbo.ALTAS_PRODUCTOS_DETALLE
            WHERE ID_ALTA = @ID_ALTA
            ORDER BY ID_DETALLE;
        `);

  return resultado.recordset;
}

/* ============================================================
   MAESTROS DEL DETALLE
   ============================================================ */

async function buscarModelo(codigoModelo, marca, rubro) {
  const pool = await getConnection();

  const resultado = await pool
    .request()

    .input("CODIGO_MODELO", sql.VarChar(6), codigoModelo)

    .input("MARCA", sql.VarChar(30), marca)

    .input("RUBRO", sql.VarChar(30), rubro).query(`
            SELECT TOP 1
                CODIGO_MODELO,
                RUBRO_MODELO,
                DETALLE_MODELO,
                LICENCIA,
                MARCA_MODELO

            FROM dbo.MAESTRO_MODELOS

            WHERE
                CODIGO_MODELO = @CODIGO_MODELO
                AND MARCA_MODELO = @MARCA
                AND RUBRO_MODELO = @RUBRO
                AND ACTIVO = 1;
        `);

  return resultado.recordset[0] || null;
}

async function buscarGrupo(codigo) {
  const pool = await getConnection();

  const resultado = await pool.request().input("CODIGO", sql.VarChar(2), codigo)
    .query(`
            SELECT TOP 1
                CODIGO_GRUPO,
                DETALLE_GRUPO
            FROM dbo.MAESTRO_GRUPOS
            WHERE
                CODIGO_GRUPO = @CODIGO
                AND ACTIVO = 1;
        `);

  return resultado.recordset[0] || null;
}

async function buscarSubgrupo(codigo) {
  const pool = await getConnection();

  const resultado = await pool.request().input("CODIGO", sql.VarChar(2), codigo)
    .query(`
            SELECT TOP 1
                CODIGO_SUBGRUPO,
                DETALLE_SUBGRUPO
            FROM dbo.MAESTRO_SUBGRUPOS
            WHERE
                CODIGO_SUBGRUPO = @CODIGO
                AND ACTIVO = 1;
        `);

  return resultado.recordset[0] || null;
}

async function buscarLinea(codigo) {
  const pool = await getConnection();

  const resultado = await pool.request().input("CODIGO", sql.VarChar(4), codigo)
    .query(`
            SELECT TOP 1
                CODIGO_LINEA,
                DETALLE_LINEA
            FROM dbo.MAESTRO_LINEA
            WHERE
                CODIGO_LINEA = @CODIGO
                AND ACTIVO = 1;
        `);

  return resultado.recordset[0] || null;
}

async function buscarDeporte(codigo) {
  const pool = await getConnection();

  const resultado = await pool.request().input("CODIGO", sql.VarChar(3), codigo)
    .query(`
            SELECT TOP 1
                CODIGO_DEPORTE,
                DETALLE_DEPORTE
            FROM dbo.MAESTRO_DEPORTES
            WHERE
                CODIGO_DEPORTE = @CODIGO
                AND ACTIVO = 1;
        `);

  return resultado.recordset[0] || null;
}

async function buscarEdad(codigo) {
  const pool = await getConnection();

  const resultado = await pool.request().input("CODIGO", sql.VarChar(1), codigo)
    .query(`
            SELECT TOP 1
                CODIGO_EDAD,
                DETALLE_EDAD
            FROM dbo.MAESTRO_EDADES
            WHERE
                CODIGO_EDAD = @CODIGO
                AND ACTIVO = 1;
        `);

  return resultado.recordset[0] || null;
}

async function buscarSexo(sexo) {
  const pool = await getConnection();

  const resultado = await pool.request().input("SEXO", sql.VarChar(3), sexo)
    .query(`
            SELECT TOP 1
                SEXO
            FROM dbo.MAESTRO_SEXO
            WHERE
                SEXO = @SEXO
                AND ACTIVO = 1;
        `);

  return resultado.recordset[0] || null;
}

async function buscarClasificacion(codigo) {
  const pool = await getConnection();

  const resultado = await pool.request().input("CODIGO", sql.VarChar(1), codigo)
    .query(`
            SELECT TOP 1
                CODIGO_CLASIFICACION,
                DETALLE_CLASIFICACION
            FROM dbo.MAESTRO_CLASIFICACION
            WHERE
                CODIGO_CLASIFICACION = @CODIGO
                AND ACTIVO = 1;
        `);

  return resultado.recordset[0] || null;
}

async function buscarColor(codigo) {
  const pool = await getConnection();

  const resultado = await pool.request().input("CODIGO", sql.VarChar(2), codigo)
    .query(`
            SELECT TOP 1
                CODIGO_COLOR,
                DETALLE_COLOR
            FROM dbo.MAESTRO_COLORES
            WHERE
                CODIGO_COLOR = @CODIGO
                AND ACTIVO = 1;
        `);

  return resultado.recordset[0] || null;
}

async function buscarPais(codigo) {
  const pool = await getConnection();

  const resultado = await pool.request().input("CODIGO", sql.VarChar(3), codigo)
    .query(`
            SELECT TOP 1
                CODIGO_PAIS,
                DETALLE_PAIS
            FROM dbo.MAESTRO_PAISES
            WHERE
                CODIGO_PAIS = @CODIGO
                AND ACTIVO = 1;
        `);

  return resultado.recordset[0] || null;
}

async function buscarOrigen(codigo) {
  const pool = await getConnection();

  const resultado = await pool.request().input("CODIGO", sql.VarChar(1), codigo)
    .query(`
            SELECT TOP 1
                CODIGO_ORIGEN,
                DETALLE_ORIGEN
            FROM dbo.MAESTRO_ORIGENES
            WHERE
                CODIGO_ORIGEN = @CODIGO
                AND ACTIVO = 1;
        `);

  return resultado.recordset[0] || null;
}

async function buscarTalle(codigo) {
  const pool = await getConnection();

  const resultado = await pool
    .request()
    .input("CODIGO", sql.VarChar(10), codigo).query(`
            SELECT TOP 1
                CODIGO_TALLE,
                DETALLE_TALLE
            FROM dbo.MAESTRO_TALLES
            WHERE
                CODIGO_TALLE = @CODIGO
                AND ACTIVO = 1;
        `);

  return resultado.recordset[0] || null;
}

async function buscarModulo(codigo) {
  const pool = await getConnection();

  const resultado = await pool.request().input("CODIGO", sql.VarChar(2), codigo)
    .query(`
            SELECT TOP 1
                *
            FROM dbo.MAESTRO_TALLES_MODULOS
            WHERE
                CODIGO_MODULO = @CODIGO
                AND ACTIVO = 1
                AND ES_CONSISTENTE = 1;
        `);

  return resultado.recordset[0] || null;
}

/* ============================================================
   RUBRO FACTURACION
   ============================================================ */

async function buscarRubroFacturacion(marcaEmpresa, rubroFacturacion) {
  const pool = await getConnection();

  const resultado = await pool
    .request()

    .input("MARCA_EMPRESA", sql.VarChar(30), marcaEmpresa)

    .input("RUBRO_FACTURACION", sql.VarChar(30), rubroFacturacion).query(`
            SELECT TOP 1
                CODIGO_EMPRESA,
                NOMBRE_EMPRESA,
                MARCA_EMPRESA,
                RUBRO_FACTURACION

            FROM dbo.MAESTRO_RUBRO_FACT

            WHERE
                MARCA_EMPRESA = @MARCA_EMPRESA
                AND RUBRO_FACTURACION =
                    @RUBRO_FACTURACION
                AND ACTIVO = 1;
        `);

  return resultado.recordset[0] || null;
}

/* ============================================================
   VALIDAR EXISTENCIA ERP
   ============================================================ */

async function buscarProductoERP(tipoProducto, codigoAlfa) {
  const pool = await getConnection();

  const resultado = await pool
    .request()

    .input("TIPO_PRODUCTO", sql.VarChar(20), tipoProducto)

    .input("CODIGO_ALFA", sql.VarChar(30), codigoAlfa).query(`
            SELECT TOP 1
                ID_PRODUCTO,
                TIPO_PRODUCTO,
                CODIGO_ALFA,
                CODIGO,
                CODIGO_EAN,
                ACTIVO

            FROM dbo.PRODUCTOS

            WHERE
                TIPO_PRODUCTO = @TIPO_PRODUCTO
                AND CODIGO_ALFA = @CODIGO_ALFA;
        `);

  return resultado.recordset[0] || null;
}

/* ============================================================
   VALIDAR DUPLICADO DEL LOTE
   ============================================================ */

async function buscarDetallePorCodigoAlfa(idAlta, codigoAlfa) {
  const pool = await getConnection();

  const resultado = await pool
    .request()

    .input("ID_ALTA", sql.BigInt, idAlta)

    .input("CODIGO_ALFA", sql.VarChar(30), codigoAlfa).query(`
            SELECT TOP 1
                ID_DETALLE,
                CODIGO_ALFA,
                ESTADO_VALIDACION

            FROM dbo.ALTAS_PRODUCTOS_DETALLE

            WHERE
                ID_ALTA = @ID_ALTA
                AND CODIGO_ALFA = @CODIGO_ALFA;
        `);

  return resultado.recordset[0] || null;
}


/* ============================================================
   BUSCAR CODIGO ALFA EN OTRAS ALTAS ACTIVAS
   ============================================================ */

async function buscarCodigoAlfaEnOtraAlta(idAltaActual, codigoAlfa) {
  const pool = await getConnection();

  const resultado = await pool
    .request()

    .input("ID_ALTA_ACTUAL", sql.BigInt, idAltaActual)

    .input("CODIGO_ALFA", sql.VarChar(30), codigoAlfa).query(`
            SELECT TOP 1
                D.ID_DETALLE,
                D.ID_ALTA,
                D.CODIGO_ALFA,
                D.TIPO_PRODUCTO_DETALLE,
                D.GENERADO_AUTOMATICO,
                D.ESTADO_VALIDACION,

                A.CODIGO_ALTA,
                A.ESTADO AS ESTADO_ALTA

            FROM dbo.ALTAS_PRODUCTOS_DETALLE D

            INNER JOIN dbo.ALTAS_PRODUCTOS A
                ON A.ID_ALTA = D.ID_ALTA

            WHERE
                D.CODIGO_ALFA = @CODIGO_ALFA
                AND D.ID_ALTA <> @ID_ALTA_ACTUAL
                AND ISNULL(A.ESTADO, '') <> 'ANULADO'

            ORDER BY
                D.ID_ALTA DESC,
                D.ID_DETALLE DESC;
        `);

  return resultado.recordset[0] || null;
}

/* ============================================================
   INSERTAR DETALLES EN TRANSACCION

   Soporta relaciones padre/hijo mediante:
   - CLAVE_TEMPORAL
   - PADRE_TEMPORAL
   ============================================================ */

async function crearDetalles(idAlta, detalles, usuario) {
  const pool = await getConnection();
  const transaction = new sql.Transaction(pool);

  await transaction.begin();

  try {
    const creados = [];
    const idsTemporales = new Map();

    for (const d of detalles) {
      let idDetallePadre = null;

      if (d.PADRE_TEMPORAL) {
        idDetallePadre = idsTemporales.get(d.PADRE_TEMPORAL) || null;

        if (!idDetallePadre) {
          throw new Error(
            `No se pudo resolver el detalle padre temporal "${d.PADRE_TEMPORAL}".`
          );
        }
      }

      const resultado = await new sql.Request(transaction)
        .input("ID_ALTA", sql.BigInt, idAlta)
        .input("CODIGO_MODELO", sql.VarChar(6), d.CODIGO_MODELO)
        .input("DETALLE_MODELO", sql.VarChar(60), d.DETALLE_MODELO)
        .input("LICENCIA", sql.VarChar(30), d.LICENCIA)
        .input("CODIGO_GRUPO", sql.VarChar(2), d.CODIGO_GRUPO)
        .input("DETALLE_GRUPO", sql.VarChar(30), d.DETALLE_GRUPO)
        .input("CODIGO_SUBGRUPO", sql.VarChar(2), d.CODIGO_SUBGRUPO)
        .input("DETALLE_SUBGRUPO", sql.VarChar(30), d.DETALLE_SUBGRUPO)
        .input("CODIGO_LINEA", sql.VarChar(4), d.CODIGO_LINEA)
        .input("DETALLE_LINEA", sql.VarChar(30), d.DETALLE_LINEA)
        .input("CODIGO_DEPORTE", sql.VarChar(3), d.CODIGO_DEPORTE)
        .input("DETALLE_DEPORTE", sql.VarChar(30), d.DETALLE_DEPORTE)
        .input("CODIGO_COLOR", sql.VarChar(2), d.CODIGO_COLOR)
        .input("DETALLE_COLOR", sql.VarChar(30), d.DETALLE_COLOR)
        .input("CODIGO_EDAD", sql.VarChar(1), d.CODIGO_EDAD)
        .input("DETALLE_EDAD", sql.VarChar(20), d.DETALLE_EDAD)
        .input("SEXO", sql.VarChar(3), d.SEXO)
        .input("CODIGO_CLASIFICACION", sql.VarChar(1), d.CODIGO_CLASIFICACION)
        .input("DETALLE_CLASIFICACION", sql.VarChar(20), d.DETALLE_CLASIFICACION)
        .input("CODIGO_MODULO", sql.VarChar(2), d.CODIGO_MODULO)
        .input("DETALLE_MODULO", sql.VarChar(100), d.DETALLE_MODULO)
        .input("CODIGO_TALLE", sql.VarChar(10), d.CODIGO_TALLE)
        .input("DETALLE_TALLE", sql.VarChar(10), d.DETALLE_TALLE)
        .input("PARES", sql.Int, d.PARES)
        .input("CODIGO_PAIS", sql.VarChar(3), d.CODIGO_PAIS)
        .input("DETALLE_PAIS", sql.VarChar(30), d.DETALLE_PAIS)
        .input("CODIGO_ORIGEN", sql.VarChar(1), d.CODIGO_ORIGEN)
        .input("DETALLE_ORIGEN", sql.VarChar(20), d.DETALLE_ORIGEN)
        .input("RUBRO_FACT", sql.VarChar(30), d.RUBRO_FACT)
        .input("CODIGO_ALFA", sql.VarChar(30), d.CODIGO_ALFA)
        .input("DETALLE_PRODUCTO", sql.VarChar(50), d.DETALLE_PRODUCTO)
        .input("NIVEL", sql.Int, d.NIVEL)
        .input("TIPO_PRODUCTO_DETALLE", sql.VarChar(20), d.TIPO_PRODUCTO_DETALLE)
        .input("ID_DETALLE_PADRE", sql.Int, idDetallePadre)
        .input("GENERADO_AUTOMATICO", sql.Bit, d.GENERADO_AUTOMATICO ? 1 : 0)
        .input(
          "ESTADO_VALIDACION",
          sql.VarChar(30),
          d.ESTADO_VALIDACION || 'VALIDO'
        )
        .input(
          "OBSERVACION_VALIDACION",
          sql.VarChar(255),
          d.OBSERVACION_VALIDACION || null
        )
        .input("USUARIO_CREACION", sql.VarChar(100), usuario)
        .query(`
          INSERT INTO dbo.ALTAS_PRODUCTOS_DETALLE
          (
            ID_ALTA,
            CODIGO_MODELO,
            DETALLE_MODELO,
            LICENCIA,
            CODIGO_GRUPO,
            DETALLE_GRUPO,
            CODIGO_SUBGRUPO,
            DETALLE_SUBGRUPO,
            CODIGO_LINEA,
            DETALLE_LINEA,
            CODIGO_DEPORTE,
            DETALLE_DEPORTE,
            CODIGO_COLOR,
            DETALLE_COLOR,
            CODIGO_EDAD,
            DETALLE_EDAD,
            SEXO,
            CODIGO_CLASIFICACION,
            DETALLE_CLASIFICACION,
            CODIGO_MODULO,
            DETALLE_MODULO,
            CODIGO_TALLE,
            DETALLE_TALLE,
            PARES,
            CODIGO_PAIS,
            DETALLE_PAIS,
            CODIGO_ORIGEN,
            DETALLE_ORIGEN,
            RUBRO_FACT,
            CODIGO_ALFA,
            DETALLE_PRODUCTO,
            NIVEL,
            TIPO_PRODUCTO_DETALLE,
            ID_DETALLE_PADRE,
            GENERADO_AUTOMATICO,
            ESTADO_VALIDACION,
            OBSERVACION_VALIDACION,
            FECHA_CREACION,
            USUARIO_CREACION
          )
          OUTPUT INSERTED.*
          VALUES
          (
            @ID_ALTA,
            @CODIGO_MODELO,
            @DETALLE_MODELO,
            @LICENCIA,
            @CODIGO_GRUPO,
            @DETALLE_GRUPO,
            @CODIGO_SUBGRUPO,
            @DETALLE_SUBGRUPO,
            @CODIGO_LINEA,
            @DETALLE_LINEA,
            @CODIGO_DEPORTE,
            @DETALLE_DEPORTE,
            @CODIGO_COLOR,
            @DETALLE_COLOR,
            @CODIGO_EDAD,
            @DETALLE_EDAD,
            @SEXO,
            @CODIGO_CLASIFICACION,
            @DETALLE_CLASIFICACION,
            @CODIGO_MODULO,
            @DETALLE_MODULO,
            @CODIGO_TALLE,
            @DETALLE_TALLE,
            @PARES,
            @CODIGO_PAIS,
            @DETALLE_PAIS,
            @CODIGO_ORIGEN,
            @DETALLE_ORIGEN,
            @RUBRO_FACT,
            @CODIGO_ALFA,
            @DETALLE_PRODUCTO,
            @NIVEL,
            @TIPO_PRODUCTO_DETALLE,
            @ID_DETALLE_PADRE,
            @GENERADO_AUTOMATICO,
            @ESTADO_VALIDACION,
            @OBSERVACION_VALIDACION,
            SYSDATETIME(),
            @USUARIO_CREACION
          );
        `);

      const creado = resultado.recordset[0];
      creados.push(creado);

      if (d.CLAVE_TEMPORAL) {
        idsTemporales.set(d.CLAVE_TEMPORAL, creado.ID_DETALLE);
      }
    }

    await transaction.commit();
    return creados;
  } catch (error) {
    try {
      await transaction.rollback();
    } catch (_) {}

    throw error;
  }
}

/* ============================================================
   OBTENER DETALLE POR ID
   ============================================================ */

async function obtenerDetallePorId(idAlta, idDetalle) {
  const pool = await getConnection();

  const resultado = await pool
    .request()

    .input("ID_ALTA", sql.BigInt, idAlta)

    .input("ID_DETALLE", sql.BigInt, idDetalle).query(`
                SELECT
                    *
                FROM dbo.ALTAS_PRODUCTOS_DETALLE
                WHERE
                    ID_ALTA = @ID_ALTA
                    AND ID_DETALLE = @ID_DETALLE;
            `);

  return resultado.recordset[0] || null;
}

/* ============================================================
   ELIMINAR DETALLE Y SUS HIJOS
   ============================================================ */

async function eliminarDetalle(idAlta, idDetalle) {
  const pool = await getConnection();
  const transaction = new sql.Transaction(pool);

  await transaction.begin();

  try {
    const buscar = await new sql.Request(transaction)
      .input("ID_ALTA", sql.BigInt, idAlta)
      .input("ID_DETALLE", sql.BigInt, idDetalle)
      .query(`
        SELECT TOP 1 *
        FROM dbo.ALTAS_PRODUCTOS_DETALLE
        WHERE ID_ALTA = @ID_ALTA
          AND ID_DETALLE = @ID_DETALLE;
      `);

    const detalle = buscar.recordset[0] || null;

    if (!detalle) {
      await transaction.rollback();
      return null;
    }

    /* Primero eliminamos los hijos directos. En el modelo actual
       las familias tienen como máximo un nivel de descendencia. */
    await new sql.Request(transaction)
      .input("ID_ALTA", sql.BigInt, idAlta)
      .input("ID_DETALLE", sql.BigInt, idDetalle)
      .query(`
        DELETE FROM dbo.ALTAS_PRODUCTOS_DETALLE
        WHERE ID_ALTA = @ID_ALTA
          AND ID_DETALLE_PADRE = @ID_DETALLE;
      `);

    const resultado = await new sql.Request(transaction)
      .input("ID_ALTA", sql.BigInt, idAlta)
      .input("ID_DETALLE", sql.BigInt, idDetalle)
      .query(`
        DELETE FROM dbo.ALTAS_PRODUCTOS_DETALLE
        OUTPUT
          DELETED.ID_DETALLE,
          DELETED.ID_ALTA,
          DELETED.CODIGO_ALFA,
          DELETED.DETALLE_PRODUCTO,
          DELETED.TIPO_PRODUCTO_DETALLE,
          DELETED.GENERADO_AUTOMATICO
        WHERE ID_ALTA = @ID_ALTA
          AND ID_DETALLE = @ID_DETALLE;
      `);

    await transaction.commit();
    return resultado.recordset[0] || null;
  } catch (error) {
    try {
      await transaction.rollback();
    } catch (_) {}

    throw error;
  }
}

/* ============================================================
   BUSCAR DUPLICADOS DEL LOTE
   ============================================================ */

async function buscarDuplicadosAlta(idAlta) {
  const pool = await getConnection();

  const resultado = await pool
    .request()

    .input("ID_ALTA", sql.BigInt, idAlta).query(`
                SELECT
                    CODIGO_ALFA,
                    COUNT(*) AS CANTIDAD

                FROM dbo.ALTAS_PRODUCTOS_DETALLE

                WHERE
                    ID_ALTA = @ID_ALTA

                GROUP BY
                    CODIGO_ALFA

                HAVING
                    COUNT(*) > 1;
            `);

  return resultado.recordset;
}

/* ============================================================
   MARCAR ALTA COMO VALIDADA
   ============================================================ */

async function marcarAltaValidada(idAlta, usuario) {
  const pool = await getConnection();

  const resultado = await pool
    .request()

    .input("ID_ALTA", sql.BigInt, idAlta)

    .input("USUARIO_VALIDACION", sql.VarChar(100), usuario).query(`
                UPDATE dbo.ALTAS_PRODUCTOS

                SET
                    ESTADO = 'VALIDADO',
                    FECHA_VALIDACION = SYSDATETIME(),
                    USUARIO_VALIDACION =
                        @USUARIO_VALIDACION

                OUTPUT INSERTED.*

                WHERE
                    ID_ALTA = @ID_ALTA
                    AND ESTADO = 'BORRADOR';
            `);

  return resultado.recordset[0] || null;
}

module.exports = {
  buscarMarca,
  buscarRubro,
  buscarTemporada,
  buscarAno,

  crearAlta,
  listarAltas,
  obtenerAltaPorId,
  obtenerDetalleAlta,

  buscarModelo,
  buscarGrupo,
  buscarSubgrupo,
  buscarLinea,
  buscarDeporte,
  buscarEdad,
  buscarSexo,
  buscarClasificacion,
  buscarColor,
  buscarPais,
  buscarOrigen,
  buscarTalle,
  buscarModulo,

  buscarRubroFacturacion,

  buscarProductoERP,
  buscarDetallePorCodigoAlfa,
  buscarCodigoAlfaEnOtraAlta,

  crearDetalles,
  obtenerDetallePorId,
  eliminarDetalle,
  buscarDuplicadosAlta,
  marcarAltaValidada,
};
