const { getConnection, sql } = require("../config/database");

/* ============================================================
   CABECERA - MAESTROS
   ============================================================ */

async function buscarMarca(codigoMarca, idEmpresa) {
  const pool = await getConnection();

  const resultado = await pool
    .request()
    .input("CODIGO_MARCA", sql.VarChar(3), codigoMarca)
    .input("ID_EMPRESA", sql.Int, idEmpresa).query(`
            SELECT TOP 1
                CODIGO_MARCA,
                DETALLE_MARCA
            FROM dbo.MAESTRO_MARCAS
            WHERE
                CODIGO_MARCA = @CODIGO_MARCA
                AND ID_EMPRESA = @ID_EMPRESA
                AND ACTIVO = 1;
        `);

  return resultado.recordset[0] || null;
}

async function buscarRubro(codigoRubro, idEmpresa) {
  const pool = await getConnection();

  const resultado = await pool
    .request()
    .input("CODIGO_RUBRO", sql.VarChar(1), codigoRubro)
    .input("ID_EMPRESA", sql.Int, idEmpresa).query(`
            SELECT TOP 1
                CODIGO_RUBRO,
                DETALLE_RUBRO
            FROM dbo.MAESTRO_RUBROS
            WHERE
                CODIGO_RUBRO = @CODIGO_RUBRO
                AND ID_EMPRESA = @ID_EMPRESA
                AND ACTIVO = 1;
        `);

  return resultado.recordset[0] || null;
}

async function buscarTemporada(codigoTemporada, idEmpresa) {
  const pool = await getConnection();

  const resultado = await pool
    .request()
    .input("CODIGO_TEMPORADA", sql.VarChar(1), codigoTemporada)
    .input("ID_EMPRESA", sql.Int, idEmpresa).query(`
            SELECT TOP 1
                CODIGO_TEMPORADA,
                DETALLE_TEMPORADA
            FROM dbo.MAESTRO_TEMPORADAS
            WHERE
                CODIGO_TEMPORADA = @CODIGO_TEMPORADA
                AND ID_EMPRESA = @ID_EMPRESA
                AND ACTIVO = 1;
        `);

  return resultado.recordset[0] || null;
}

async function buscarAno(codigoAno, idEmpresa) {
  const pool = await getConnection();

  const resultado = await pool
    .request()
    .input("CODIGO_ANO", sql.VarChar(2), codigoAno)
    .input("ID_EMPRESA", sql.Int, idEmpresa).query(`
            SELECT TOP 1
                CODIGO_ANO,
                DETALLE_ANO
            FROM dbo.MAESTRO_ANOS
            WHERE
                CODIGO_ANO = @CODIGO_ANO
                AND ID_EMPRESA = @ID_EMPRESA
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

    .input("ID_EMPRESA", sql.Int, datos.idEmpresa)

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
                ID_EMPRESA,
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
                @ID_EMPRESA,
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

async function listarAltas(idEmpresa) {
  const pool = await getConnection();

  const resultado = await pool.request()
    .input("ID_EMPRESA", sql.Int, idEmpresa)
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

                A.FECHA_ANULACION,
                A.USUARIO_ANULACION,
                A.MOTIVO_ANULACION,

                (
                    SELECT COUNT(*)
                    FROM dbo.ALTAS_PRODUCTOS_DETALLE D
                    WHERE D.ID_ALTA = A.ID_ALTA
                ) AS CANTIDAD_PRODUCTOS

            FROM dbo.ALTAS_PRODUCTOS A
            WHERE A.ID_EMPRESA = @ID_EMPRESA

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

  const [resultadoDetalle, resultadoRelaciones] =
    await Promise.all([
      pool
        .request()
        .input("ID_ALTA", sql.BigInt, idAlta)
        .query(`
          SELECT *
          FROM dbo.ALTAS_PRODUCTOS_DETALLE
          WHERE ID_ALTA = @ID_ALTA
          ORDER BY ID_DETALLE;
        `),

      pool
        .request()
        .input("ID_ALTA", sql.BigInt, idAlta)
        .query(`
          SELECT
            ID_DETALLE_PADRE,
            ID_DETALLE_HIJO
          FROM dbo.ALTAS_PRODUCTOS_FAMILIAS_DETALLE
          WHERE ID_ALTA = @ID_ALTA
          ORDER BY ID_DETALLE_PADRE, ID_DETALLE_HIJO;
        `)
    ]);

  const padresPorHijo = new Map();

  for (const relacion of resultadoRelaciones.recordset) {
    const clave =
      String(relacion.ID_DETALLE_HIJO);

    if (!padresPorHijo.has(clave)) {
      padresPorHijo.set(clave, []);
    }

    padresPorHijo
      .get(clave)
      .push(Number(relacion.ID_DETALLE_PADRE));
  }

  return resultadoDetalle.recordset.map(item => {
    const clave =
      String(item.ID_DETALLE);

    let familiasPadre =
      padresPorHijo.get(clave) || [];

    /*
     * Compatibilidad con registros históricos durante la transición.
     * Una vez ejecutada la migración, normalmente no será necesario.
     */
    if (
      familiasPadre.length === 0 &&
      item.ID_DETALLE_PADRE !== null &&
      item.ID_DETALLE_PADRE !== undefined
    ) {
      familiasPadre = [
        Number(item.ID_DETALLE_PADRE)
      ];
    }

    return {
      ...item,
      FAMILIAS_PADRE: familiasPadre
    };
  });
}

/* ============================================================
   MAESTROS DEL DETALLE
   ============================================================ */

async function buscarModelo(codigoModelo, marca, rubro, idEmpresa) {
  const pool = await getConnection();

  const resultado = await pool
    .request()
    .input("ID_EMPRESA", sql.Int, idEmpresa)

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
        ID_EMPRESA = @ID_EMPRESA
        AND                 ID_EMPRESA = @ID_EMPRESA
                AND                 CODIGO_MODELO = @CODIGO_MODELO
                AND MARCA_MODELO = @MARCA
                AND RUBRO_MODELO = @RUBRO
                AND ACTIVO = 1;
        `);

  return resultado.recordset[0] || null;
}


async function buscarProveedor(
  codigo,
  rubro = null,
  idEmpresa,
  codigoMarca
) {
  /*
   * El maestro de proveedores no es por empresa/marca.
   * La habilitación funcional del Alta se determina por:
   *   - CODIGO
   *   - ACTIVO
   *   - RUBRO
   *
   * Conservamos idEmpresa/codigoMarca en la firma para no romper
   * las llamadas multiempresa existentes, pero no se usan como
   * filtro de proveedor.
   */
  const pool = await getConnection();

  const resultado = await pool
    .request()
    .input("CODIGO", sql.VarChar(30), codigo)
    .input("RUBRO", sql.VarChar(100), rubro)
    .query(`
      SELECT TOP 1
        P.CODIGO,
        P.PRESEA,
        P.RUBRO,
        P.NVA_RAZON_SOCIAL
      FROM dbo.MAESTRO_PROVEEDORES P
      WHERE
        P.CODIGO = @CODIGO
        AND P.ACTIVO = 1
        AND
        (
          @RUBRO IS NULL
          OR UPPER(LTRIM(RTRIM(ISNULL(P.RUBRO, '')))) =
             UPPER(LTRIM(RTRIM(@RUBRO)))
        );
    `);

  return resultado.recordset[0] || null;
}

async function buscarGrupo(codigo, idEmpresa) {
  const pool = await getConnection();

  const resultado = await pool.request()
    .input("ID_EMPRESA", sql.Int, idEmpresa).input("CODIGO", sql.VarChar(2), codigo)
    .query(`
            SELECT TOP 1
                CODIGO_GRUPO,
                DETALLE_GRUPO
            FROM dbo.MAESTRO_GRUPOS
            WHERE
        ID_EMPRESA = @ID_EMPRESA
        AND                 ID_EMPRESA = @ID_EMPRESA
                AND                 CODIGO_GRUPO = @CODIGO
                AND ACTIVO = 1;
        `);

  return resultado.recordset[0] || null;
}

async function buscarSubgrupo(codigo, idEmpresa) {
  const pool = await getConnection();

  const resultado = await pool.request()
    .input("ID_EMPRESA", sql.Int, idEmpresa).input("CODIGO", sql.VarChar(2), codigo)
    .query(`
            SELECT TOP 1
                CODIGO_SUBGRUPO,
                DETALLE_SUBGRUPO
            FROM dbo.MAESTRO_SUBGRUPOS
            WHERE
        ID_EMPRESA = @ID_EMPRESA
        AND                 ID_EMPRESA = @ID_EMPRESA
                AND                 CODIGO_SUBGRUPO = @CODIGO
                AND ACTIVO = 1;
        `);

  return resultado.recordset[0] || null;
}

async function buscarLinea(codigo, idEmpresa) {
  const pool = await getConnection();

  const resultado = await pool.request()
    .input("ID_EMPRESA", sql.Int, idEmpresa).input("CODIGO", sql.VarChar(4), codigo)
    .query(`
            SELECT TOP 1
                CODIGO_LINEA,
                DETALLE_LINEA
            FROM dbo.MAESTRO_LINEA
            WHERE
        ID_EMPRESA = @ID_EMPRESA
        AND                 ID_EMPRESA = @ID_EMPRESA
                AND                 CODIGO_LINEA = @CODIGO
                AND ACTIVO = 1;
        `);

  return resultado.recordset[0] || null;
}

async function buscarDeporte(codigo, idEmpresa) {
  const pool = await getConnection();

  const resultado = await pool.request()
    .input("ID_EMPRESA", sql.Int, idEmpresa).input("CODIGO", sql.VarChar(3), codigo)
    .query(`
            SELECT TOP 1
                CODIGO_DEPORTE,
                DETALLE_DEPORTE
            FROM dbo.MAESTRO_DEPORTES
            WHERE
        ID_EMPRESA = @ID_EMPRESA
        AND                 ID_EMPRESA = @ID_EMPRESA
                AND                 CODIGO_DEPORTE = @CODIGO
                AND ACTIVO = 1;
        `);

  return resultado.recordset[0] || null;
}

async function buscarEdad(codigo, idEmpresa) {
  const pool = await getConnection();

  const resultado = await pool.request()
    .input("ID_EMPRESA", sql.Int, idEmpresa).input("CODIGO", sql.VarChar(1), codigo)
    .query(`
            SELECT TOP 1
                CODIGO_EDAD,
                DETALLE_EDAD
            FROM dbo.MAESTRO_EDADES
            WHERE
        ID_EMPRESA = @ID_EMPRESA
        AND                 ID_EMPRESA = @ID_EMPRESA
                AND                 CODIGO_EDAD = @CODIGO
                AND ACTIVO = 1;
        `);

  return resultado.recordset[0] || null;
}

async function buscarSexo(sexo, idEmpresa) {
  const pool = await getConnection();

  const resultado = await pool.request()
    .input("ID_EMPRESA", sql.Int, idEmpresa).input("SEXO", sql.VarChar(3), sexo)
    .query(`
            SELECT TOP 1
                SEXO
            FROM dbo.MAESTRO_SEXO
            WHERE
        ID_EMPRESA = @ID_EMPRESA
        AND                 ID_EMPRESA = @ID_EMPRESA
                AND                 SEXO = @SEXO
                AND ACTIVO = 1;
        `);

  return resultado.recordset[0] || null;
}

async function buscarClasificacion(codigo, idEmpresa) {
  const pool = await getConnection();

  const resultado = await pool.request()
    .input("ID_EMPRESA", sql.Int, idEmpresa).input("CODIGO", sql.VarChar(1), codigo)
    .query(`
            SELECT TOP 1
                CODIGO_CLASIFICACION,
                DETALLE_CLASIFICACION
            FROM dbo.MAESTRO_CLASIFICACION
            WHERE
        ID_EMPRESA = @ID_EMPRESA
        AND                 ID_EMPRESA = @ID_EMPRESA
                AND                 CODIGO_CLASIFICACION = @CODIGO
                AND ACTIVO = 1;
        `);

  return resultado.recordset[0] || null;
}

async function buscarColor(codigo, idEmpresa) {
  const pool = await getConnection();

  const resultado = await pool.request()
    .input("ID_EMPRESA", sql.Int, idEmpresa).input("CODIGO", sql.VarChar(2), codigo)
    .query(`
            SELECT TOP 1
                CODIGO_COLOR,
                DETALLE_COLOR
            FROM dbo.MAESTRO_COLORES
            WHERE
        ID_EMPRESA = @ID_EMPRESA
        AND                 ID_EMPRESA = @ID_EMPRESA
                AND                 CODIGO_COLOR = @CODIGO
                AND ACTIVO = 1;
        `);

  return resultado.recordset[0] || null;
}

async function buscarPais(codigo, idEmpresa) {
  const pool = await getConnection();

  const resultado = await pool.request()
    .input("ID_EMPRESA", sql.Int, idEmpresa).input("CODIGO", sql.VarChar(3), codigo)
    .query(`
            SELECT TOP 1
                CODIGO_PAIS,
                DETALLE_PAIS
            FROM dbo.MAESTRO_PAISES
            WHERE
        ID_EMPRESA = @ID_EMPRESA
        AND                 ID_EMPRESA = @ID_EMPRESA
                AND                 CODIGO_PAIS = @CODIGO
                AND ACTIVO = 1;
        `);

  return resultado.recordset[0] || null;
}

async function buscarOrigen(codigo, idEmpresa) {
  const pool = await getConnection();

  const resultado = await pool.request()
    .input("ID_EMPRESA", sql.Int, idEmpresa).input("CODIGO", sql.VarChar(1), codigo)
    .query(`
            SELECT TOP 1
                CODIGO_ORIGEN,
                DETALLE_ORIGEN
            FROM dbo.MAESTRO_ORIGENES
            WHERE
        ID_EMPRESA = @ID_EMPRESA
        AND                 ID_EMPRESA = @ID_EMPRESA
                AND                 CODIGO_ORIGEN = @CODIGO
                AND ACTIVO = 1;
        `);

  return resultado.recordset[0] || null;
}

async function buscarTalle(codigo, idEmpresa) {
  const pool = await getConnection();

  const resultado = await pool
    .request()
    .input("ID_EMPRESA", sql.Int, idEmpresa)
    .input("CODIGO", sql.VarChar(10), codigo).query(`
            SELECT TOP 1
                CODIGO_TALLE,
                DETALLE_TALLE
            FROM dbo.MAESTRO_TALLES
            WHERE
        ID_EMPRESA = @ID_EMPRESA
        AND                 ID_EMPRESA = @ID_EMPRESA
                AND                 CODIGO_TALLE = @CODIGO
                AND ACTIVO = 1;
        `);

  return resultado.recordset[0] || null;
}

async function buscarModulo(codigo, idEmpresa) {
  const pool = await getConnection();

  const resultado = await pool.request()
    .input("ID_EMPRESA", sql.Int, idEmpresa).input("CODIGO", sql.VarChar(2), codigo)
    .query(`
            SELECT TOP 1
                *
            FROM dbo.MAESTRO_TALLES_MODULOS
            WHERE
        ID_EMPRESA = @ID_EMPRESA
        AND                 ID_EMPRESA = @ID_EMPRESA
                AND                 CODIGO_MODULO = @CODIGO
                AND ACTIVO = 1
                AND ES_CONSISTENTE = 1;
        `);

  return resultado.recordset[0] || null;
}

/* ============================================================
   RUBRO FACTURACION
   ============================================================ */

async function buscarRubroFacturacion(marcaEmpresa, rubroFacturacion, idEmpresa) {
  const pool = await getConnection();

  const resultado = await pool
    .request()
    .input("ID_EMPRESA", sql.Int, idEmpresa)

    .input("MARCA_EMPRESA", sql.VarChar(30), marcaEmpresa)

    .input("RUBRO_FACTURACION", sql.VarChar(30), rubroFacturacion).query(`
            SELECT TOP 1
                CODIGO_EMPRESA,
                NOMBRE_EMPRESA,
                MARCA_EMPRESA,
                RUBRO_FACTURACION

            FROM dbo.MAESTRO_RUBRO_FACT

            WHERE
        ID_EMPRESA = @ID_EMPRESA
        AND                 ID_EMPRESA = @ID_EMPRESA
                AND                 MARCA_EMPRESA = @MARCA_EMPRESA
                AND RUBRO_FACTURACION =
                    @RUBRO_FACTURACION
                AND ACTIVO = 1;
        `);

  return resultado.recordset[0] || null;
}

/* ============================================================
   VALIDAR EXISTENCIA ERP
   ============================================================ */

async function buscarProductoERP(tipoProducto, codigoAlfa, idEmpresa) {
  const pool = await getConnection();

  /*
   * En la réplica de Presea la identidad confiable del producto
   * es CODIGO_ALFA.
   *
   * La comparación se normaliza con TRIM + UPPER para evitar que
   * espacios o diferencias de mayúsculas/minúsculas provenientes de
   * la réplica de Presea hagan aparecer un producto existente como NUEVO.
   *
   * No filtramos por TIPO_PRODUCTO porque existen registros del ERP
   * cuyo tipo no representa correctamente la naturaleza del producto.
   * Ejemplo real detectado:
   *
   *   CODIGO_ALFA 2721131596015R9
   *   TIPO_PRODUCTO = PAR_SUELTO
   *
   * aunque el CODIGO_ALFA corresponde al módulo principal.
   *
   * Si filtráramos además por MODULO, la aplicación lo consideraría
   * erróneamente NUEVO y podría volver a exportarlo.
   *
   * Conservamos tipoProducto en la firma para no modificar todas las
   * llamadas existentes del service.
   */
  const resultado = await pool
    .request()
    .input("ID_EMPRESA", sql.Int, idEmpresa)
    .input(
      "CODIGO_ALFA",
      sql.VarChar(30),
      codigoAlfa
    )
    .query(`
      SELECT TOP 1
        ID_PRODUCTO,
        TIPO_PRODUCTO,
        CODIGO_ALFA,
        CODIGO,
        CODIGO_EAN,
        ACTIVO

      FROM dbo.PRODUCTOS

      WHERE
        ID_EMPRESA = @ID_EMPRESA
        AND         UPPER(
          LTRIM(
            RTRIM(
              ISNULL(CODIGO_ALFA, '')
            )
          )
        ) =
        UPPER(
          LTRIM(
            RTRIM(
              @CODIGO_ALFA
            )
          )
        )

      ORDER BY
        CASE WHEN ISNULL(ACTIVO, 0) = 1 THEN 0 ELSE 1 END,
        ID_PRODUCTO DESC;
    `);

  return resultado.recordset[0] || null;
}

/* ============================================================
   RECONCILIAR EXISTENCIA ERP DEL ALTA

   Importante:
   - CODIGO_ALFA es la identidad confiable frente a Presea.
   - Solamente promovemos VALIDO -> EXISTE_ERP.
   - No hacemos el camino inverso aquí; si un EXISTE_ERP dejó de
     existir en la réplica, validarAlta() lo detectará y bloqueará.
   ============================================================ */
async function reconciliarExistenciaERPAlta(idAlta) {
  const pool = await getConnection();

  const resultado = await pool
    .request()
    .input("ID_ALTA", sql.Int, idAlta)
    .query(`
      UPDATE D
      SET
        D.ESTADO_VALIDACION = 'EXISTE_ERP',
        D.OBSERVACION_VALIDACION =
          CASE
            WHEN P.CODIGO IS NOT NULL AND P.CODIGO_EAN IS NOT NULL
              THEN CONCAT(
                'Ya existe en Presea - Código ERP: ',
                P.CODIGO,
                ' - EAN: ',
                P.CODIGO_EAN
              )
            WHEN P.CODIGO IS NOT NULL
              THEN CONCAT(
                'Ya existe en Presea - Código ERP: ',
                P.CODIGO
              )
            WHEN P.CODIGO_EAN IS NOT NULL
              THEN CONCAT(
                'Ya existe en Presea - EAN: ',
                P.CODIGO_EAN
              )
            ELSE 'Ya existe en Presea'
          END
      OUTPUT
        INSERTED.ID_DETALLE,
        INSERTED.CODIGO_ALFA,
        INSERTED.ESTADO_VALIDACION
      FROM dbo.ALTAS_PRODUCTOS_DETALLE AS D
      CROSS APPLY
      (
        SELECT TOP 1
          P0.CODIGO,
          P0.CODIGO_EAN
        FROM dbo.PRODUCTOS AS P0
        WHERE
          P0.ID_EMPRESA = D.ID_EMPRESA
          AND           UPPER(
            LTRIM(
              RTRIM(
                ISNULL(P0.CODIGO_ALFA, '')
              )
            )
          ) =
          UPPER(
            LTRIM(
              RTRIM(
                ISNULL(D.CODIGO_ALFA, '')
              )
            )
          )
        ORDER BY
          CASE WHEN ISNULL(P0.ACTIVO, 0) = 1 THEN 0 ELSE 1 END,
          P0.ID_PRODUCTO DESC
      ) AS P
      WHERE
        D.ID_ALTA = @ID_ALTA
        AND ISNULL(D.ESTADO_VALIDACION, 'VALIDO') <> 'EXISTE_ERP';
    `);

  return resultado.recordset || [];
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
                D.ID_EMPRESA = (
                  SELECT ID_EMPRESA
                  FROM dbo.ALTAS_PRODUCTOS
                  WHERE ID_ALTA = @ID_ALTA_ACTUAL
                )
                AND D.CODIGO_ALFA = @CODIGO_ALFA
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

async function crearDetalles(idAlta, detalles, usuario, relacionesFamilia = []) {
  const pool = await getConnection();
  const transaction = new sql.Transaction(pool);

  await transaction.begin();

  try {
    const empresaAltaResultado =
      await new sql.Request(transaction)
        .input("ID_ALTA_EMPRESA", sql.Int, idAlta)
        .query(`
          SELECT TOP 1 ID_EMPRESA
          FROM dbo.ALTAS_PRODUCTOS
          WHERE ID_ALTA = @ID_ALTA_EMPRESA;
        `);

    const idEmpresa =
      empresaAltaResultado.recordset?.[0]?.ID_EMPRESA;

    if (!idEmpresa) {
      throw new Error(
        'No se pudo resolver la empresa del alta.'
      );
    }

    const creados = [];
    const idsTemporales = new Map();

    for (const d of detalles) {
      let idDetallePadre = null;

      if (d.PADRE_TEMPORAL) {
        idDetallePadre = idsTemporales.get(d.PADRE_TEMPORAL) || null;

        if (!idDetallePadre) {
          throw new Error(
            `No se pudo resolver el detalle padre temporal "${d.PADRE_TEMPORAL}".`,
          );
        }
      }

      const resultado = await new sql.Request(transaction)
        .input("ID_ALTA", sql.BigInt, idAlta)
        .input("ID_EMPRESA", sql.Int, idEmpresa)
        .input("CODIGO_MODELO", sql.VarChar(6), d.CODIGO_MODELO)
        .input("DETALLE_MODELO", sql.VarChar(60), d.DETALLE_MODELO)
        .input("LICENCIA", sql.VarChar(30), d.LICENCIA)
        .input("CODIGO_PROVEEDOR", sql.VarChar(30), d.CODIGO_PROVEEDOR)
        .input("PRESEA_PROVEEDOR", sql.VarChar(30), d.PRESEA_PROVEEDOR)
        .input("RUBRO_PROVEEDOR", sql.VarChar(100), d.RUBRO_PROVEEDOR)
        .input("DETALLE_PROVEEDOR", sql.VarChar(200), d.DETALLE_PROVEEDOR)
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
        .input(
          "DETALLE_CLASIFICACION",
          sql.VarChar(20),
          d.DETALLE_CLASIFICACION,
        )
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
        .input(
          "TIPO_PRODUCTO_DETALLE",
          sql.VarChar(20),
          d.TIPO_PRODUCTO_DETALLE,
        )
        .input("ID_DETALLE_PADRE", sql.Int, idDetallePadre)
        .input("GENERADO_AUTOMATICO", sql.Bit, d.GENERADO_AUTOMATICO ? 1 : 0)
        .input(
          "ESTADO_VALIDACION",
          sql.VarChar(30),
          d.ESTADO_VALIDACION || "VALIDO",
        )
        .input(
          "OBSERVACION_VALIDACION",
          sql.VarChar(255),
          d.OBSERVACION_VALIDACION || null,
        )
        .input("USUARIO_CREACION", sql.VarChar(100), usuario).query(`
          INSERT INTO dbo.ALTAS_PRODUCTOS_DETALLE
          (
            ID_ALTA,
            ID_EMPRESA,
            CODIGO_MODELO,
            DETALLE_MODELO,
            LICENCIA,
            CODIGO_PROVEEDOR,
            PRESEA_PROVEEDOR,
            RUBRO_PROVEEDOR,
            DETALLE_PROVEEDOR,
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
            @ID_EMPRESA,
            @CODIGO_MODELO,
            @DETALLE_MODELO,
            @LICENCIA,
            @CODIGO_PROVEEDOR,
            @PRESEA_PROVEEDOR,
            @RUBRO_PROVEEDOR,
            @DETALLE_PROVEEDOR,
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

    /*
     * Registrar relaciones muchos-a-muchos entre principal y automáticos.
     * El hijo se resuelve por CODIGO_ALFA después de insertar todos los
     * detalles, por lo que funciona tanto para hijos nuevos como para
     * productos automáticos que ya existían dentro del Alta.
     */
    for (const relacion of (
      Array.isArray(relacionesFamilia)
        ? relacionesFamilia
        : []
    )) {
      const idPadre =
        idsTemporales.get(
          relacion.padreTemporal
        );

      if (!idPadre) {
        throw new Error(
          `No se pudo resolver el padre temporal ` +
          `"${relacion.padreTemporal}" para una relación de familia.`
        );
      }

      const codigoAlfaHijo =
        String(
          relacion.codigoAlfaHijo || ""
        ).trim();

      if (!codigoAlfaHijo) {
        continue;
      }

      const hijoResultado =
        await new sql.Request(transaction)
          .input("ID_ALTA", sql.BigInt, idAlta)
          .input(
            "CODIGO_ALFA_HIJO",
            sql.VarChar(30),
            codigoAlfaHijo
          )
          .query(`
            SELECT TOP 1
              ID_DETALLE
            FROM dbo.ALTAS_PRODUCTOS_DETALLE
            WHERE
              ID_ALTA = @ID_ALTA
              AND CODIGO_ALFA = @CODIGO_ALFA_HIJO;
          `);

      const idHijo =
        hijoResultado.recordset?.[0]?.ID_DETALLE;

      if (!idHijo) {
        throw new Error(
          `No se encontró el hijo ${codigoAlfaHijo} ` +
          `para registrar la relación de familia.`
        );
      }

      await new sql.Request(transaction)
        .input("ID_ALTA", sql.BigInt, idAlta)
        .input("ID_DETALLE_PADRE", sql.BigInt, idPadre)
        .input("ID_DETALLE_HIJO", sql.BigInt, idHijo)
        .query(`
          IF NOT EXISTS
          (
            SELECT 1
            FROM dbo.ALTAS_PRODUCTOS_FAMILIAS_DETALLE
            WHERE
              ID_ALTA = @ID_ALTA
              AND ID_DETALLE_PADRE = @ID_DETALLE_PADRE
              AND ID_DETALLE_HIJO = @ID_DETALLE_HIJO
          )
          BEGIN
            INSERT INTO dbo.ALTAS_PRODUCTOS_FAMILIAS_DETALLE
            (
              ID_ALTA,
              ID_DETALLE_PADRE,
              ID_DETALLE_HIJO,
              FECHA_CREACION
            )
            VALUES
            (
              @ID_ALTA,
              @ID_DETALLE_PADRE,
              @ID_DETALLE_HIJO,
              SYSDATETIME()
            );
          END;
        `);
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
    const buscar =
      await new sql.Request(transaction)
        .input("ID_ALTA", sql.BigInt, idAlta)
        .input("ID_DETALLE", sql.BigInt, idDetalle)
        .query(`
          SELECT TOP 1 *
          FROM dbo.ALTAS_PRODUCTOS_DETALLE
          WHERE
            ID_ALTA = @ID_ALTA
            AND ID_DETALLE = @ID_DETALLE;
        `);

    const detalle =
      buscar.recordset[0] || null;

    if (!detalle) {
      await transaction.rollback();
      return null;
    }

    /*
     * 1. Eliminamos solamente las relaciones de ESTA familia.
     */
    await new sql.Request(transaction)
      .input("ID_ALTA", sql.BigInt, idAlta)
      .input("ID_DETALLE_PADRE", sql.BigInt, idDetalle)
      .query(`
        DELETE FROM dbo.ALTAS_PRODUCTOS_FAMILIAS_DETALLE
        WHERE
          ID_ALTA = @ID_ALTA
          AND ID_DETALLE_PADRE = @ID_DETALLE_PADRE;
      `);

    /*
     * 2. Compatibilidad del campo legado ID_DETALLE_PADRE:
     *    si un hijo todavía pertenece a otra familia, apuntamos
     *    ese campo a uno de sus padres restantes.
     */
    await new sql.Request(transaction)
      .input("ID_ALTA", sql.BigInt, idAlta)
      .input("ID_DETALLE_PADRE", sql.BigInt, idDetalle)
      .query(`
        UPDATE H
        SET
          H.ID_DETALLE_PADRE =
          (
            SELECT MIN(R.ID_DETALLE_PADRE)
            FROM dbo.ALTAS_PRODUCTOS_FAMILIAS_DETALLE AS R
            WHERE
              R.ID_ALTA = H.ID_ALTA
              AND R.ID_DETALLE_HIJO = H.ID_DETALLE
          )
        FROM dbo.ALTAS_PRODUCTOS_DETALLE AS H
        WHERE
          H.ID_ALTA = @ID_ALTA
          AND H.ID_DETALLE_PADRE = @ID_DETALLE_PADRE
          AND EXISTS
          (
            SELECT 1
            FROM dbo.ALTAS_PRODUCTOS_FAMILIAS_DETALLE AS R
            WHERE
              R.ID_ALTA = H.ID_ALTA
              AND R.ID_DETALLE_HIJO = H.ID_DETALLE
          );
      `);

    /*
     * 3. Eliminamos automáticos que ya no pertenecen a ninguna familia.
     */
    const huerfanos =
      await new sql.Request(transaction)
        .input("ID_ALTA", sql.BigInt, idAlta)
        .query(`
          DELETE H
          OUTPUT
            DELETED.ID_DETALLE,
            DELETED.CODIGO_ALFA
          FROM dbo.ALTAS_PRODUCTOS_DETALLE AS H
          WHERE
            H.ID_ALTA = @ID_ALTA
            AND ISNULL(H.GENERADO_AUTOMATICO, 0) = 1
            AND NOT EXISTS
            (
              SELECT 1
              FROM dbo.ALTAS_PRODUCTOS_FAMILIAS_DETALLE AS R
              WHERE
                R.ID_ALTA = H.ID_ALTA
                AND R.ID_DETALLE_HIJO = H.ID_DETALLE
            );
        `);

    /*
     * 4. Finalmente eliminamos el principal solicitado.
     */
    const resultado =
      await new sql.Request(transaction)
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
          WHERE
            ID_ALTA = @ID_ALTA
            AND ID_DETALLE = @ID_DETALLE;
        `);

    await transaction.commit();

    const eliminado =
      resultado.recordset[0] || null;

    return eliminado
      ? {
          ...eliminado,
          AUTOMATICOS_ELIMINADOS:
            huerfanos.recordset.length
        }
      : null;

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


/* ============================================================
   CERRAR ALTA SIN NOVEDADES ERP

   Se usa cuando, al validar, TODOS los productos ya existen
   en Presea. No se genera exportación ni queda pendiente ERP.
   ============================================================ */
async function marcarAltaSinNovedadesERP(idAlta, usuario) {
  const pool = await getConnection();

  const resultado = await pool
    .request()
    .input("ID_ALTA", sql.BigInt, idAlta)
    .input("USUARIO_VALIDACION", sql.VarChar(100), usuario)
    .query(`
      UPDATE dbo.ALTAS_PRODUCTOS
      SET
        ESTADO = 'SIN_NOVEDADES_ERP',
        FECHA_VALIDACION = SYSDATETIME(),
        USUARIO_VALIDACION = @USUARIO_VALIDACION,
        FECHA_EXPORTACION = NULL,
        USUARIO_EXPORTACION = NULL,
        ARCHIVO_EXPORTADO = NULL
      OUTPUT INSERTED.*
      WHERE
        ID_ALTA = @ID_ALTA
        AND ESTADO = 'BORRADOR';
    `);

  return resultado.recordset[0] || null;
}


/* ============================================================
   MARCAR ALTA COMO ANULADA
   ============================================================ */

async function marcarAltaAnulada(
  idAlta,
  usuario,
  motivo
) {
  const pool = await getConnection();

  const resultado = await pool
    .request()
    .input("ID_ALTA", sql.Int, idAlta)
    .input("USUARIO_ANULACION", sql.VarChar(100), usuario)
    .input("MOTIVO_ANULACION", sql.VarChar(500), motivo)
    .query(`
      UPDATE dbo.ALTAS_PRODUCTOS
      SET
        ESTADO = 'ANULADO',
        FECHA_ANULACION = SYSDATETIME(),
        USUARIO_ANULACION = @USUARIO_ANULACION,
        MOTIVO_ANULACION = @MOTIVO_ANULACION
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
  buscarProveedor,
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
  reconciliarExistenciaERPAlta,
  buscarDetallePorCodigoAlfa,
  buscarCodigoAlfaEnOtraAlta,

  crearDetalles,
  obtenerDetallePorId,
  eliminarDetalle,
  buscarDuplicadosAlta,
  marcarAltaValidada,
  marcarAltaSinNovedadesERP,
  marcarAltaAnulada,
};
