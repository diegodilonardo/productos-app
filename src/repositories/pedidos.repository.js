const { getConnection, sql } = require('../config/database');

/* ============================================================
   ALTAS DISPONIBLES PARA PEDIDOS
   - Solo altas completamente generadas en ERP.
   ============================================================ */
async function obtenerAltasDisponibles() {
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
      (
        SELECT TOP 1
          CASE
            WHEN NULLIF(LTRIM(RTRIM(DL.LICENCIA)), '') IS NULL
              THEN 'SIN LICENCIA'
            ELSE LTRIM(RTRIM(DL.LICENCIA))
          END
        FROM dbo.ALTAS_PRODUCTOS_DETALLE DL
        WHERE DL.ID_ALTA = A.ID_ALTA
        ORDER BY DL.ID_DETALLE
      ) AS LICENCIA_ALTA,
      A.ESTADO,
      A.FECHA_CREACION
    FROM dbo.ALTAS_PRODUCTOS A
    WHERE A.ESTADO = 'GENERADO_OK_EN_ERP'
    ORDER BY A.ID_ALTA DESC;
  `);

  return resultado.recordset;
}

/* ============================================================
   OBTENER ALTA DISPONIBLE POR ID
   - Se usa para validar que el Alta pueda originar un Pedido.
   ============================================================ */
async function obtenerAltaDisponiblePorId(idAlta) {
  const pool = await getConnection();

  const resultado = await pool
    .request()
    .input('ID_ALTA', sql.Int, idAlta)
    .query(`
      SELECT TOP 1
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
            WHEN NULLIF(LTRIM(RTRIM(DL.LICENCIA)), '') IS NULL
              THEN 'SIN LICENCIA'
            ELSE LTRIM(RTRIM(DL.LICENCIA))
          END
        FROM dbo.ALTAS_PRODUCTOS_DETALLE DL
        WHERE DL.ID_ALTA = A.ID_ALTA
        ORDER BY DL.ID_DETALLE
      ) AS LICENCIA_ALTA,
        A.ESTADO
      FROM dbo.ALTAS_PRODUCTOS A
      WHERE
        A.ID_ALTA = @ID_ALTA
        AND A.ESTADO = 'GENERADO_OK_EN_ERP';
    `);

  return resultado.recordset[0] || null;
}

/* ============================================================
   PROVEEDORES PRESENTES EN UN ALTA
   - El usuario selecciona la razón social / detalle.
   - Internamente se conserva CODIGO_PROVEEDOR.
   - Solo se muestran proveedores que tengan al menos un producto
     confirmado y activo en PRODUCTOS.
   ============================================================ */
async function obtenerProveedoresPorAlta(idAlta) {
  const pool = await getConnection();

  const resultado = await pool
    .request()
    .input('ID_ALTA', sql.Int, idAlta)
    .query(`
      SELECT DISTINCT
        D.CODIGO_PROVEEDOR,
        D.DETALLE_PROVEEDOR
      FROM dbo.ALTAS_PRODUCTOS_DETALLE D
      INNER JOIN dbo.ALTAS_PRODUCTOS A
        ON A.ID_ALTA = D.ID_ALTA
      INNER JOIN dbo.PRODUCTOS P
        ON P.CODIGO_ALFA = D.CODIGO_ALFA
      WHERE
        D.ID_ALTA = @ID_ALTA
        AND A.ESTADO = 'GENERADO_OK_EN_ERP'
        AND P.ACTIVO = 1
        AND NULLIF(LTRIM(RTRIM(D.CODIGO_PROVEEDOR)), '') IS NOT NULL
        AND NULLIF(LTRIM(RTRIM(D.DETALLE_PROVEEDOR)), '') IS NOT NULL
        AND
        (
          (
            A.TIPO_PRODUCTO = 'MODULO'
            AND D.TIPO_PRODUCTO_DETALLE = 'MODULO'
          )
          OR
          (
            A.TIPO_PRODUCTO = 'PAR_SUELTO'
            AND D.TIPO_PRODUCTO_DETALLE = 'PAR_SUELTO'
            AND D.CODIGO_CLASIFICACION = '1'
          )
        )
      ORDER BY D.DETALLE_PROVEEDOR;
    `);

  return resultado.recordset;
}

/* ============================================================
   PRODUCTOS DISPONIBLES POR ALTA + PROVEEDOR

   REGLAS:
   - Alta MODULO      -> solo detalle MODULO.
   - Alta PAR_SUELTO  -> solo PAR_SUELTO clasificación 1 (PRIMERA).
   - Producto debe existir en PRODUCTOS y estar ACTIVO.
   - CODIGO_ALFA es la identidad utilizada para enlazar con ERP.
   ============================================================ */
async function obtenerProductosDisponibles(idAlta, codigoProveedor) {
  const pool = await getConnection();

  const resultado = await pool
    .request()
    .input('ID_ALTA', sql.Int, idAlta)
    .input('CODIGO_PROVEEDOR', sql.VarChar(30), codigoProveedor)
    .query(`
      SELECT
        P.ID_PRODUCTO,
        P.CODIGO_ALFA,
        P.CODIGO_ERP,
        COALESCE(P.CODIGO_EAN, P.EAN) AS CODIGO_EAN,
        P.ACTIVO,

        A.ID_ALTA,
        A.CODIGO_ALTA,
        A.TIPO_PRODUCTO AS TIPO_PRODUCTO_ALTA,
        A.CODIGO_ANO,
        A.CODIGO_TEMPORADA,

        D.ID_DETALLE,
        D.TIPO_PRODUCTO_DETALLE,

        D.CODIGO_MODELO,
        D.DETALLE_MODELO,

        D.CODIGO_COLOR,
        D.DETALLE_COLOR,

        D.DETALLE_PRODUCTO,

        D.CODIGO_TALLE,
        D.DETALLE_TALLE,

        D.CODIGO_MODULO,
        D.DETALLE_MODULO,

        D.PARES,

        D.CODIGO_EDAD,
        D.DETALLE_EDAD,

        D.CODIGO_CLASIFICACION,
        D.DETALLE_CLASIFICACION,

        D.CODIGO_PROVEEDOR,
        D.DETALLE_PROVEEDOR

      FROM dbo.ALTAS_PRODUCTOS_DETALLE D

      INNER JOIN dbo.ALTAS_PRODUCTOS A
        ON A.ID_ALTA = D.ID_ALTA

      INNER JOIN dbo.PRODUCTOS P
        ON P.CODIGO_ALFA = D.CODIGO_ALFA

      WHERE
        D.ID_ALTA = @ID_ALTA
        AND D.CODIGO_PROVEEDOR = @CODIGO_PROVEEDOR
        AND A.ESTADO = 'GENERADO_OK_EN_ERP'
        AND P.ACTIVO = 1
        AND
        (
          (
            A.TIPO_PRODUCTO = 'MODULO'
            AND D.TIPO_PRODUCTO_DETALLE = 'MODULO'
          )
          OR
          (
            A.TIPO_PRODUCTO = 'PAR_SUELTO'
            AND D.TIPO_PRODUCTO_DETALLE = 'PAR_SUELTO'
            AND D.CODIGO_CLASIFICACION = '1'
          )
        )

      ORDER BY
        D.DETALLE_MODELO,
        D.DETALLE_COLOR,
        D.DETALLE_MODULO,
        D.DETALLE_TALLE,
        P.CODIGO_ALFA;
    `);

  return resultado.recordset;
}

/* ============================================================
   BUSCAR PEDIDO ACTIVO DUPLICADO
   - La combinación Alta + Proveedor + Número de Orden debe ser
     única mientras el pedido no esté ANULADO.
   - Un pedido ANULADO no bloquea una nueva creación posterior.
   ============================================================ */
async function buscarPedidoDuplicadoActivo(idAlta, codigoProveedor, numeroOrden) {
  const pool = await getConnection();

  const resultado = await pool
    .request()
    .input('ID_ALTA', sql.Int, idAlta)
    .input('CODIGO_PROVEEDOR', sql.VarChar(30), codigoProveedor)
    .input('NUMERO_ORDEN', sql.VarChar(50), numeroOrden)
    .query(`
      SELECT TOP 1
        ID_PEDIDO,
        CODIGO_PEDIDO,
        ESTADO,
        NUMERO_ORDEN,
        CODIGO_PROVEEDOR
      FROM dbo.PEDIDOS
      WHERE
        ID_ALTA = @ID_ALTA
        AND CODIGO_PROVEEDOR = @CODIGO_PROVEEDOR
        AND NUMERO_ORDEN = @NUMERO_ORDEN
        AND ESTADO <> 'ANULADO'
      ORDER BY ID_PEDIDO DESC;
    `);

  return resultado.recordset[0] || null;
}


/* ============================================================
   CREAR CABECERA DE PEDIDO
   - Operación transaccional.
   - Inserta primero para obtener ID_PEDIDO IDENTITY.
   - Luego genera CODIGO_PEDIDO mediante la función recibida.
   - Si algo falla, hace ROLLBACK completo.
   ============================================================ */
async function crearPedido(datos, generarCodigoPedido) {
  if (typeof generarCodigoPedido !== 'function') {
    throw new Error('No se recibió el generador de CODIGO_PEDIDO.');
  }

  const pool = await getConnection();
  const transaction = new sql.Transaction(pool);

  try {
    await transaction.begin();

    /*
     * Segunda validación dentro de la transacción.
     * Evita que dos solicitudes simultáneas creen el mismo pedido.
     */
    const duplicadoResult = await new sql.Request(transaction)
      .input('ID_ALTA_DUP', sql.Int, datos.ID_ALTA)
      .input('CODIGO_PROVEEDOR_DUP', sql.VarChar(30), datos.CODIGO_PROVEEDOR)
      .input('NUMERO_ORDEN_DUP', sql.VarChar(50), datos.NUMERO_ORDEN)
      .query(`
        SELECT TOP 1
          ID_PEDIDO,
          CODIGO_PEDIDO,
          ESTADO
        FROM dbo.PEDIDOS WITH (UPDLOCK, HOLDLOCK)
        WHERE
          ID_ALTA = @ID_ALTA_DUP
          AND CODIGO_PROVEEDOR = @CODIGO_PROVEEDOR_DUP
          AND NUMERO_ORDEN = @NUMERO_ORDEN_DUP
          AND ESTADO <> 'ANULADO';
      `);

    const duplicado = duplicadoResult.recordset[0] || null;

    if (duplicado) {
      const referencia = duplicado.CODIGO_PEDIDO || `ID ${duplicado.ID_PEDIDO}`;
      throw new Error(
        `Ya existe un pedido activo para esta Alta, proveedor y número de orden (${referencia}).`
      );
    }

    const insertado = await new sql.Request(transaction)
      .input('ID_ALTA', sql.Int, datos.ID_ALTA)
      .input('CODIGO_PROVEEDOR', sql.VarChar(30), datos.CODIGO_PROVEEDOR)
      .input('DETALLE_PROVEEDOR', sql.VarChar(150), datos.DETALLE_PROVEEDOR)
      .input('NUMERO_ORDEN', sql.VarChar(50), datos.NUMERO_ORDEN)
      .input('MONEDA', sql.VarChar(10), datos.MONEDA)
      .input('OBSERVACIONES', sql.VarChar(500), datos.OBSERVACIONES)
      .input('USUARIO_CREACION', sql.VarChar(100), datos.USUARIO_CREACION)
      .query(`
        INSERT INTO dbo.PEDIDOS
        (
          CODIGO_PEDIDO,
          ID_ALTA,
          CODIGO_PROVEEDOR,
          DETALLE_PROVEEDOR,
          NUMERO_ORDEN,
          MONEDA,
          ESTADO,
          OBSERVACIONES,
          FECHA_CREACION,
          USUARIO_CREACION,
          FECHA_ACTUALIZACION
        )
        OUTPUT INSERTED.ID_PEDIDO
        VALUES
        (
          NULL,
          @ID_ALTA,
          @CODIGO_PROVEEDOR,
          @DETALLE_PROVEEDOR,
          @NUMERO_ORDEN,
          @MONEDA,
          'BORRADOR',
          @OBSERVACIONES,
          SYSDATETIME(),
          @USUARIO_CREACION,
          SYSDATETIME()
        );
      `);

    const idPedido = Number(insertado.recordset[0]?.ID_PEDIDO);

    if (!Number.isInteger(idPedido) || idPedido <= 0) {
      throw new Error('SQL Server no devolvió un ID_PEDIDO válido.');
    }

    const codigoPedido = generarCodigoPedido({
      idPedido,
      codigoProveedor: datos.CODIGO_PROVEEDOR,
      numeroOrden: datos.NUMERO_ORDEN,
      codigoAlta: datos.CODIGO_ALTA,
    });

    const actualizado = await new sql.Request(transaction)
      .input('ID_PEDIDO', sql.BigInt, idPedido)
      .input('CODIGO_PEDIDO', sql.VarChar(100), codigoPedido)
      .query(`
        UPDATE dbo.PEDIDOS
        SET
          CODIGO_PEDIDO = @CODIGO_PEDIDO,
          FECHA_ACTUALIZACION = SYSDATETIME()
        OUTPUT INSERTED.*
        WHERE
          ID_PEDIDO = @ID_PEDIDO
          AND ESTADO = 'BORRADOR';
      `);

    const pedido = actualizado.recordset[0] || null;

    if (!pedido) {
      throw new Error('No se pudo completar CODIGO_PEDIDO.');
    }

    await transaction.commit();
    return pedido;
  } catch (error) {
    try {
      await transaction.rollback();
    } catch (_) {
      // Conservamos el error original.
    }

    if (error?.number === 2601 || error?.number === 2627) {
      if (String(error.message || '').includes('UX_PEDIDOS_ALTA_PROVEEDOR_ORDEN_ACTIVO')) {
        throw new Error(
          'Ya existe un pedido activo para esta Alta, proveedor y número de orden.'
        );
      }
    }

    throw error;
  }
}




/* ============================================================
   LISTAR PEDIDOS
   - Incluye Alta y totales calculados del detalle.
   ============================================================ */
async function listarPedidos() {
  const pool = await getConnection();

  const resultado = await pool.request().query(`
    SELECT
      P.ID_PEDIDO,
      P.CODIGO_PEDIDO,
      P.ID_ALTA,
      A.CODIGO_ALTA,
      A.TIPO_PRODUCTO AS TIPO_PRODUCTO_ALTA,
      A.DETALLE_MARCA,
      A.DETALLE_RUBRO,
      A.CODIGO_TEMPORADA,
      A.DETALLE_TEMPORADA,
      A.CODIGO_ANO,
      P.CODIGO_PROVEEDOR,
      P.DETALLE_PROVEEDOR,
      P.NUMERO_ORDEN,
      P.MONEDA,
      P.ESTADO,
      P.OBSERVACIONES,
      P.FECHA_CREACION,
      P.USUARIO_CREACION,
      P.FECHA_VALIDACION,
      P.USUARIO_VALIDACION,
      P.FECHA_SINCRONIZACION,
      P.FECHA_ANULACION,
      P.USUARIO_ANULACION,
      P.MOTIVO_ANULACION,
      COUNT(D.ID_PEDIDO_DETALLE) AS CANTIDAD_PRODUCTOS,
      COALESCE(SUM(CAST(D.CANTIDAD_PARES AS BIGINT)), 0) AS TOTAL_PARES,
      COALESCE(SUM(D.TOTAL_FOB), 0) AS TOTAL_FOB,
      COALESCE(SUM(CAST(D.CANTIDAD_PARES AS DECIMAL(18,4)) * D.ADICIONAL), 0) AS TOTAL_ADICIONALES,
      COALESCE(SUM(D.TOTAL_PRODUCTO), 0) AS TOTAL_PEDIDO,

      COALESCE(EXP.CANTIDAD_EXPORTACIONES, 0) AS CANTIDAD_EXPORTACIONES,
      COALESCE(EXP.TIENE_PEDIDO_EXCEL, 0) AS TIENE_PEDIDO_EXCEL,
      COALESCE(EXP.TIENE_MASTER_DATA_APP, 0) AS TIENE_MASTER_DATA_APP,
      COALESCE(EXP.TIENE_PREC_FOB, 0) AS TIENE_PREC_FOB,

      CASE
        WHEN COALESCE(EXP.CANTIDAD_EXPORTACIONES, 0) = 0 THEN 'NO_EXPORTADO'
        WHEN COALESCE(EXP.TIENE_PEDIDO_EXCEL, 0) = 1
         AND COALESCE(EXP.TIENE_MASTER_DATA_APP, 0) = 1
         AND COALESCE(EXP.TIENE_PREC_FOB, 0) = 1 THEN 'COMPLETO'
        ELSE 'PARCIAL'
      END AS ESTADO_EXPORTACION

    FROM dbo.PEDIDOS P
    INNER JOIN dbo.ALTAS_PRODUCTOS A
      ON A.ID_ALTA = P.ID_ALTA
    LEFT JOIN dbo.PEDIDOS_DETALLE D
      ON D.ID_PEDIDO = P.ID_PEDIDO

    OUTER APPLY
    (
      SELECT
        COUNT(*) AS CANTIDAD_EXPORTACIONES,
        MAX(CASE WHEN E.TIPO_EXPORTACION = 'PEDIDO_EXCEL' THEN 1 ELSE 0 END) AS TIENE_PEDIDO_EXCEL,
        MAX(CASE WHEN E.TIPO_EXPORTACION = 'MASTER_DATA_APP' THEN 1 ELSE 0 END) AS TIENE_MASTER_DATA_APP,
        MAX(CASE WHEN E.TIPO_EXPORTACION = 'PREC_FOB' THEN 1 ELSE 0 END) AS TIENE_PREC_FOB
      FROM dbo.PEDIDOS_EXPORTACIONES E
      WHERE
        E.ID_PEDIDO = P.ID_PEDIDO
        AND E.ESTADO = 'OK'
    ) EXP

    GROUP BY
      P.ID_PEDIDO, P.CODIGO_PEDIDO, P.ID_ALTA,
      A.CODIGO_ALTA, A.TIPO_PRODUCTO,
      A.DETALLE_MARCA, A.DETALLE_RUBRO,
      A.CODIGO_TEMPORADA, A.DETALLE_TEMPORADA, A.CODIGO_ANO,
      P.CODIGO_PROVEEDOR, P.DETALLE_PROVEEDOR,
      P.NUMERO_ORDEN, P.MONEDA, P.ESTADO,
      P.OBSERVACIONES, P.FECHA_CREACION, P.USUARIO_CREACION,
      P.FECHA_VALIDACION, P.USUARIO_VALIDACION,
      P.FECHA_SINCRONIZACION, P.FECHA_ANULACION,
      P.USUARIO_ANULACION, P.MOTIVO_ANULACION,
      EXP.CANTIDAD_EXPORTACIONES,
      EXP.TIENE_PEDIDO_EXCEL,
      EXP.TIENE_MASTER_DATA_APP,
      EXP.TIENE_PREC_FOB
    ORDER BY P.ID_PEDIDO DESC;
  `);

  return resultado.recordset;
}

/* ============================================================
   OBTENER PEDIDO POR ID
   - Incluye datos básicos del Alta para validar el detalle.
   ============================================================ */
async function obtenerPedidoPorId(idPedido) {
  const pool = await getConnection();

  const resultado = await pool
    .request()
    .input('ID_PEDIDO', sql.BigInt, idPedido)
    .query(`
      SELECT TOP 1
        P.*,
        A.CODIGO_ALTA,
        A.TIPO_PRODUCTO AS TIPO_PRODUCTO_ALTA,
        A.ESTADO AS ESTADO_ALTA
      FROM dbo.PEDIDOS P
      INNER JOIN dbo.ALTAS_PRODUCTOS A
        ON A.ID_ALTA = P.ID_ALTA
      WHERE P.ID_PEDIDO = @ID_PEDIDO;
    `);

  return resultado.recordset[0] || null;
}

/* ============================================================
   BUSCAR PRODUCTO DENTRO DEL PEDIDO
   ============================================================ */
async function buscarProductoEnPedido(idPedido, idProducto) {
  const pool = await getConnection();

  const resultado = await pool
    .request()
    .input('ID_PEDIDO', sql.BigInt, idPedido)
    .input('ID_PRODUCTO', sql.BigInt, idProducto)
    .query(`
      SELECT TOP 1 *
      FROM dbo.PEDIDOS_DETALLE
      WHERE
        ID_PEDIDO = @ID_PEDIDO
        AND ID_PRODUCTO = @ID_PRODUCTO;
    `);

  return resultado.recordset[0] || null;
}

/* ============================================================
   AGREGAR PRODUCTO AL PEDIDO
   - Solo permite insertar si la cabecera continúa BORRADOR.
   - SQL conserva además el UNIQUE(ID_PEDIDO, ID_PRODUCTO).
   ============================================================ */
async function agregarProductoPedido(datos) {
  const pool = await getConnection();
  const transaction = new sql.Transaction(pool);

  try {
    await transaction.begin();

    const pedidoResult = await new sql.Request(transaction)
      .input('ID_PEDIDO', sql.BigInt, datos.ID_PEDIDO)
      .query(`
        SELECT TOP 1
          ID_PEDIDO,
          ID_ALTA,
          CODIGO_PROVEEDOR,
          ESTADO
        FROM dbo.PEDIDOS WITH (UPDLOCK, HOLDLOCK)
        WHERE ID_PEDIDO = @ID_PEDIDO;
      `);

    const pedido = pedidoResult.recordset[0] || null;

    if (!pedido) {
      throw new Error('Pedido no encontrado.');
    }

    if (pedido.ESTADO !== 'BORRADOR') {
      throw new Error(
        `No se pueden agregar productos porque el pedido está en estado ${pedido.ESTADO}.`
      );
    }

    const existente = await new sql.Request(transaction)
      .input('ID_PEDIDO', sql.BigInt, datos.ID_PEDIDO)
      .input('ID_PRODUCTO', sql.BigInt, datos.ID_PRODUCTO)
      .query(`
        SELECT TOP 1 ID_PEDIDO_DETALLE
        FROM dbo.PEDIDOS_DETALLE
        WHERE
          ID_PEDIDO = @ID_PEDIDO
          AND ID_PRODUCTO = @ID_PRODUCTO;
      `);

    if (existente.recordset.length > 0) {
      throw new Error('El producto ya fue agregado a este pedido.');
    }

    const insertado = await new sql.Request(transaction)
      .input('ID_PEDIDO', sql.BigInt, datos.ID_PEDIDO)
      .input('ID_PRODUCTO', sql.BigInt, datos.ID_PRODUCTO)
      .input('TIPO_PRODUCTO', sql.VarChar(15), datos.TIPO_PRODUCTO)
      .input('CODIGO_ALFA', sql.VarChar(30), datos.CODIGO_ALFA)
      .input('CODIGO_ERP', sql.VarChar(30), datos.CODIGO_ERP)
      .input('CODIGO_EAN', sql.VarChar(20), datos.CODIGO_EAN)
      .input('CODIGO_MODELO', sql.VarChar(30), datos.CODIGO_MODELO)
      .input('DETALLE_MODELO', sql.VarChar(100), datos.DETALLE_MODELO)
      .input('CODIGO_COLOR', sql.VarChar(20), datos.CODIGO_COLOR)
      .input('DETALLE_COLOR', sql.VarChar(100), datos.DETALLE_COLOR)
      .input('DETALLE_PRODUCTO', sql.VarChar(150), datos.DETALLE_PRODUCTO)
      .input('CODIGO_TALLE', sql.VarChar(20), datos.CODIGO_TALLE)
      .input('DETALLE_TALLE', sql.VarChar(50), datos.DETALLE_TALLE)
      .input('CODIGO_MODULO', sql.VarChar(20), datos.CODIGO_MODULO)
      .input('DETALLE_MODULO', sql.VarChar(100), datos.DETALLE_MODULO)
      .input('DETALLE_EDAD', sql.VarChar(50), datos.DETALLE_EDAD)
      .input('PARES_MODULO', sql.Int, datos.PARES_MODULO)
      .input('CANTIDAD_PARES', sql.Int, datos.CANTIDAD_PARES)
      .input('CANTIDAD_MODULOS', sql.Int, datos.CANTIDAD_MODULOS)
      .input('PRECIO_FOB_PAR', sql.Decimal(18, 4), datos.PRECIO_FOB_PAR)
      .input('TOTAL_FOB', sql.Decimal(18, 4), datos.TOTAL_FOB)
      .input('ADICIONAL', sql.Decimal(18, 4), datos.ADICIONAL)
      .input('TOTAL_PRODUCTO', sql.Decimal(18, 4), datos.TOTAL_PRODUCTO)
      .input('OBSERVACIONES', sql.VarChar(500), datos.OBSERVACIONES)
      .query(`
        INSERT INTO dbo.PEDIDOS_DETALLE
        (
          ID_PEDIDO,
          ID_PRODUCTO,
          TIPO_PRODUCTO,
          CODIGO_ALFA,
          CODIGO_ERP,
          CODIGO_EAN,
          CODIGO_MODELO,
          DETALLE_MODELO,
          CODIGO_COLOR,
          DETALLE_COLOR,
          DETALLE_PRODUCTO,
          CODIGO_TALLE,
          DETALLE_TALLE,
          CODIGO_MODULO,
          DETALLE_MODULO,
          DETALLE_EDAD,
          PARES_MODULO,
          CANTIDAD_PARES,
          CANTIDAD_MODULOS,
          PRECIO_FOB_PAR,
          TOTAL_FOB,
          ADICIONAL,
          TOTAL_PRODUCTO,
          OBSERVACIONES,
          FECHA_CREACION,
          FECHA_ACTUALIZACION
        )
        OUTPUT INSERTED.*
        VALUES
        (
          @ID_PEDIDO,
          @ID_PRODUCTO,
          @TIPO_PRODUCTO,
          @CODIGO_ALFA,
          @CODIGO_ERP,
          @CODIGO_EAN,
          @CODIGO_MODELO,
          @DETALLE_MODELO,
          @CODIGO_COLOR,
          @DETALLE_COLOR,
          @DETALLE_PRODUCTO,
          @CODIGO_TALLE,
          @DETALLE_TALLE,
          @CODIGO_MODULO,
          @DETALLE_MODULO,
          @DETALLE_EDAD,
          @PARES_MODULO,
          @CANTIDAD_PARES,
          @CANTIDAD_MODULOS,
          @PRECIO_FOB_PAR,
          @TOTAL_FOB,
          @ADICIONAL,
          @TOTAL_PRODUCTO,
          @OBSERVACIONES,
          SYSDATETIME(),
          SYSDATETIME()
        );
      `);

    await new sql.Request(transaction)
      .input('ID_PEDIDO', sql.BigInt, datos.ID_PEDIDO)
      .query(`
        UPDATE dbo.PEDIDOS
        SET FECHA_ACTUALIZACION = SYSDATETIME()
        WHERE ID_PEDIDO = @ID_PEDIDO;
      `);

    await transaction.commit();
    return insertado.recordset[0] || null;
  } catch (error) {
    try {
      await transaction.rollback();
    } catch (_) {
      // Conservamos el error original.
    }

    throw error;
  }
}



/* ============================================================
   LISTAR DETALLE DEL PEDIDO
   ============================================================ */
async function listarDetallePedido(idPedido) {
  const pool = await getConnection();

  const resultado = await pool
    .request()
    .input('ID_PEDIDO', sql.BigInt, idPedido)
    .query(`
      SELECT
        D.*
      FROM dbo.PEDIDOS_DETALLE D
      WHERE D.ID_PEDIDO = @ID_PEDIDO
      ORDER BY
        D.DETALLE_MODELO,
        D.DETALLE_COLOR,
        D.DETALLE_MODULO,
        D.DETALLE_TALLE,
        D.ID_PEDIDO_DETALLE;
    `);

  return resultado.recordset;
}

/* ============================================================
   OBTENER UN RENGLON DEL PEDIDO
   ============================================================ */
async function obtenerDetallePedidoPorId(idPedido, idPedidoDetalle) {
  const pool = await getConnection();

  const resultado = await pool
    .request()
    .input('ID_PEDIDO', sql.BigInt, idPedido)
    .input('ID_PEDIDO_DETALLE', sql.BigInt, idPedidoDetalle)
    .query(`
      SELECT TOP 1 *
      FROM dbo.PEDIDOS_DETALLE
      WHERE
        ID_PEDIDO = @ID_PEDIDO
        AND ID_PEDIDO_DETALLE = @ID_PEDIDO_DETALLE;
    `);

  return resultado.recordset[0] || null;
}

/* ============================================================
   ACTUALIZAR RENGLON DEL PEDIDO
   - Solo modifica valores comerciales/cantidades.
   - El snapshot del producto no se altera.
   - Bloquea la cabecera para garantizar BORRADOR.
   ============================================================ */
async function actualizarDetallePedido(datos) {
  const pool = await getConnection();
  const transaction = new sql.Transaction(pool);

  try {
    await transaction.begin();

    const pedidoResult = await new sql.Request(transaction)
      .input('ID_PEDIDO', sql.BigInt, datos.ID_PEDIDO)
      .query(`
        SELECT TOP 1 ID_PEDIDO, ESTADO
        FROM dbo.PEDIDOS WITH (UPDLOCK, HOLDLOCK)
        WHERE ID_PEDIDO = @ID_PEDIDO;
      `);

    const pedido = pedidoResult.recordset[0] || null;

    if (!pedido) {
      throw new Error('Pedido no encontrado.');
    }

    if (pedido.ESTADO !== 'BORRADOR') {
      throw new Error(
        `No se puede modificar el producto porque el pedido está en estado ${pedido.ESTADO}.`
      );
    }

    const actualizado = await new sql.Request(transaction)
      .input('ID_PEDIDO', sql.BigInt, datos.ID_PEDIDO)
      .input('ID_PEDIDO_DETALLE', sql.BigInt, datos.ID_PEDIDO_DETALLE)
      .input('PARES_MODULO', sql.Int, datos.PARES_MODULO)
      .input('CANTIDAD_PARES', sql.Int, datos.CANTIDAD_PARES)
      .input('CANTIDAD_MODULOS', sql.Int, datos.CANTIDAD_MODULOS)
      .input('PRECIO_FOB_PAR', sql.Decimal(18, 4), datos.PRECIO_FOB_PAR)
      .input('TOTAL_FOB', sql.Decimal(18, 4), datos.TOTAL_FOB)
      .input('ADICIONAL', sql.Decimal(18, 4), datos.ADICIONAL)
      .input('TOTAL_PRODUCTO', sql.Decimal(18, 4), datos.TOTAL_PRODUCTO)
      .input('OBSERVACIONES', sql.VarChar(500), datos.OBSERVACIONES)
      .query(`
        UPDATE dbo.PEDIDOS_DETALLE
        SET
          PARES_MODULO = @PARES_MODULO,
          CANTIDAD_PARES = @CANTIDAD_PARES,
          CANTIDAD_MODULOS = @CANTIDAD_MODULOS,
          PRECIO_FOB_PAR = @PRECIO_FOB_PAR,
          TOTAL_FOB = @TOTAL_FOB,
          ADICIONAL = @ADICIONAL,
          TOTAL_PRODUCTO = @TOTAL_PRODUCTO,
          OBSERVACIONES = @OBSERVACIONES,
          FECHA_ACTUALIZACION = SYSDATETIME()
        OUTPUT INSERTED.*
        WHERE
          ID_PEDIDO = @ID_PEDIDO
          AND ID_PEDIDO_DETALLE = @ID_PEDIDO_DETALLE;
      `);

    const detalle = actualizado.recordset[0] || null;

    if (!detalle) {
      throw new Error('El producto no existe dentro del pedido.');
    }

    await new sql.Request(transaction)
      .input('ID_PEDIDO', sql.BigInt, datos.ID_PEDIDO)
      .query(`
        UPDATE dbo.PEDIDOS
        SET FECHA_ACTUALIZACION = SYSDATETIME()
        WHERE ID_PEDIDO = @ID_PEDIDO;
      `);

    await transaction.commit();
    return detalle;
  } catch (error) {
    try {
      await transaction.rollback();
    } catch (_) {
      // Conservamos el error original.
    }

    throw error;
  }
}

/* ============================================================
   ELIMINAR RENGLON DEL PEDIDO
   - Solo BORRADOR.
   ============================================================ */
async function eliminarDetallePedido(idPedido, idPedidoDetalle) {
  const pool = await getConnection();
  const transaction = new sql.Transaction(pool);

  try {
    await transaction.begin();

    const pedidoResult = await new sql.Request(transaction)
      .input('ID_PEDIDO', sql.BigInt, idPedido)
      .query(`
        SELECT TOP 1 ID_PEDIDO, ESTADO
        FROM dbo.PEDIDOS WITH (UPDLOCK, HOLDLOCK)
        WHERE ID_PEDIDO = @ID_PEDIDO;
      `);

    const pedido = pedidoResult.recordset[0] || null;

    if (!pedido) {
      throw new Error('Pedido no encontrado.');
    }

    if (pedido.ESTADO !== 'BORRADOR') {
      throw new Error(
        `No se puede eliminar el producto porque el pedido está en estado ${pedido.ESTADO}.`
      );
    }

    const eliminado = await new sql.Request(transaction)
      .input('ID_PEDIDO', sql.BigInt, idPedido)
      .input('ID_PEDIDO_DETALLE', sql.BigInt, idPedidoDetalle)
      .query(`
        DELETE FROM dbo.PEDIDOS_DETALLE
        OUTPUT DELETED.*
        WHERE
          ID_PEDIDO = @ID_PEDIDO
          AND ID_PEDIDO_DETALLE = @ID_PEDIDO_DETALLE;
      `);

    const detalle = eliminado.recordset[0] || null;

    if (!detalle) {
      throw new Error('El producto no existe dentro del pedido.');
    }

    await new sql.Request(transaction)
      .input('ID_PEDIDO', sql.BigInt, idPedido)
      .query(`
        UPDATE dbo.PEDIDOS
        SET FECHA_ACTUALIZACION = SYSDATETIME()
        WHERE ID_PEDIDO = @ID_PEDIDO;
      `);

    await transaction.commit();
    return detalle;
  } catch (error) {
    try {
      await transaction.rollback();
    } catch (_) {
      // Conservamos el error original.
    }

    throw error;
  }
}


/* ============================================================
   VALIDAR PEDIDO
   - Última comprobación dentro de una transacción.
   - Bloquea la cabecera mientras valida y cambia el estado.
   - Un pedido sin detalle o con datos comerciales inválidos
     nunca puede pasar a VALIDADO.
   ============================================================ */
async function marcarPedidoValidado(idPedido, usuarioValidacion) {
  const pool = await getConnection();
  const transaction = new sql.Transaction(pool);

  try {
    await transaction.begin();

    const pedidoResult = await new sql.Request(transaction)
      .input('ID_PEDIDO', sql.BigInt, idPedido)
      .query(`
        SELECT TOP 1
          ID_PEDIDO,
          ID_ALTA,
          CODIGO_PROVEEDOR,
          NUMERO_ORDEN,
          MONEDA,
          ESTADO
        FROM dbo.PEDIDOS WITH (UPDLOCK, HOLDLOCK)
        WHERE ID_PEDIDO = @ID_PEDIDO;
      `);

    const pedido = pedidoResult.recordset[0] || null;

    if (!pedido) {
      throw new Error('Pedido no encontrado.');
    }

    if (pedido.ESTADO !== 'BORRADOR') {
      throw new Error(
        `El pedido está en estado ${pedido.ESTADO}. Solamente se pueden validar pedidos BORRADOR.`
      );
    }

    if (!pedido.ID_ALTA) {
      throw new Error('La cabecera del pedido no posee un Alta válida.');
    }

    if (!String(pedido.CODIGO_PROVEEDOR || '').trim()) {
      throw new Error('La cabecera del pedido no posee proveedor.');
    }

    if (!String(pedido.NUMERO_ORDEN || '').trim()) {
      throw new Error('La cabecera del pedido no posee número de orden.');
    }

    if (!String(pedido.MONEDA || '').trim()) {
      throw new Error('La cabecera del pedido no posee moneda.');
    }

    const detalleResult = await new sql.Request(transaction)
      .input('ID_PEDIDO', sql.BigInt, idPedido)
      .query(`
        SELECT
          PD.ID_PEDIDO_DETALLE,
          PD.ID_PRODUCTO,
          PD.CODIGO_ALFA,
          PD.DETALLE_PRODUCTO,
          PD.TIPO_PRODUCTO,
          PD.PARES_MODULO,
          PD.CANTIDAD_PARES,
          PD.CANTIDAD_MODULOS,
          PD.PRECIO_FOB_PAR,
          PD.TOTAL_FOB,
          PD.ADICIONAL,
          PD.TOTAL_PRODUCTO,
          PR.ID_PRODUCTO AS ID_PRODUCTO_ERP,
          PR.ACTIVO AS PRODUCTO_ACTIVO
        FROM dbo.PEDIDOS_DETALLE PD WITH (HOLDLOCK)
        LEFT JOIN dbo.PRODUCTOS PR
          ON PR.ID_PRODUCTO = PD.ID_PRODUCTO
        WHERE PD.ID_PEDIDO = @ID_PEDIDO
        ORDER BY ID_PEDIDO_DETALLE;
      `);

    const detalles = detalleResult.recordset || [];

    if (detalles.length === 0) {
      throw new Error('El pedido no contiene productos para validar.');
    }

    for (const detalle of detalles) {
      const tipo = String(detalle.TIPO_PRODUCTO || '').trim().toUpperCase();
      const codigoAlfa = String(detalle.CODIGO_ALFA || '').trim();
      const detalleProducto = String(detalle.DETALLE_PRODUCTO || '').trim();
      const cantidadPares = Number(detalle.CANTIDAD_PARES);
      const precioFobPar = Number(detalle.PRECIO_FOB_PAR);
      const adicional = Number(detalle.ADICIONAL);
      const totalFob = Number(detalle.TOTAL_FOB);
      const totalProducto = Number(detalle.TOTAL_PRODUCTO);

      if (!detalle.ID_PRODUCTO_ERP) {
        throw new Error(
          `El producto ${codigoAlfa || detalle.ID_PRODUCTO} ya no existe en PRODUCTOS.`
        );
      }

      if (Number(detalle.PRODUCTO_ACTIVO) !== 1) {
        throw new Error(
          `El producto ${codigoAlfa || detalle.ID_PRODUCTO} está inactivo y no puede validarse.`
        );
      }

      if (!codigoAlfa) {
        throw new Error(`El detalle ${detalle.ID_PEDIDO_DETALLE} no posee CODIGO_ALFA.`);
      }

      if (!detalleProducto) {
        throw new Error(`El producto ${codigoAlfa} no posee descripción.`);
      }

      if (!Number.isInteger(cantidadPares) || cantidadPares <= 0) {
        throw new Error(
          `El detalle ${detalle.ID_PEDIDO_DETALLE} posee una cantidad de pares inválida.`
        );
      }

      if (!Number.isFinite(precioFobPar) || precioFobPar <= 0) {
        throw new Error(
          `El detalle ${detalle.ID_PEDIDO_DETALLE} debe tener un precio FOB por par mayor a cero.`
        );
      }

      if (!Number.isFinite(adicional) || adicional < 0) {
        throw new Error(
          `El detalle ${detalle.ID_PEDIDO_DETALLE} posee un adicional inválido.`
        );
      }

      if (tipo === 'MODULO') {
        const paresModulo = Number(detalle.PARES_MODULO);
        const cantidadModulos = Number(detalle.CANTIDAD_MODULOS);

        if (!Number.isInteger(paresModulo) || paresModulo <= 0) {
          throw new Error(
            `El detalle ${detalle.ID_PEDIDO_DETALLE} posee PARES_MODULO inválido.`
          );
        }

        if (!Number.isInteger(cantidadModulos) || cantidadModulos <= 0) {
          throw new Error(
            `El detalle ${detalle.ID_PEDIDO_DETALLE} posee CANTIDAD_MODULOS inválida.`
          );
        }

        if (cantidadPares !== cantidadModulos * paresModulo) {
          throw new Error(
            `El detalle ${detalle.ID_PEDIDO_DETALLE} no respeta la relación pares/módulos.`
          );
        }
      } else if (tipo === 'PAR_SUELTO') {
        if (detalle.CANTIDAD_MODULOS !== null) {
          throw new Error(
            `El detalle ${detalle.ID_PEDIDO_DETALLE} es PAR_SUELTO y no debe tener CANTIDAD_MODULOS.`
          );
        }
      } else {
        throw new Error(
          `El detalle ${detalle.ID_PEDIDO_DETALLE} posee un tipo de producto inválido.`
        );
      }

      const esperadoFob = Math.round((cantidadPares * precioFobPar + Number.EPSILON) * 10000) / 10000;
      const esperadoAdicional = Math.round((cantidadPares * adicional + Number.EPSILON) * 10000) / 10000;
      const esperadoTotal = Math.round((esperadoFob + esperadoAdicional + Number.EPSILON) * 10000) / 10000;

      if (Math.abs(totalFob - esperadoFob) > 0.0001) {
        throw new Error(
          `El TOTAL_FOB del detalle ${detalle.ID_PEDIDO_DETALLE} no coincide con cantidad × FOB.`
        );
      }

      if (Math.abs(totalProducto - esperadoTotal) > 0.0001) {
        throw new Error(
          `El TOTAL_PRODUCTO del detalle ${detalle.ID_PEDIDO_DETALLE} no coincide con FOB + (cantidad × adicional por par).`
        );
      }
    }

    const actualizado = await new sql.Request(transaction)
      .input('ID_PEDIDO', sql.BigInt, idPedido)
      .input('USUARIO_VALIDACION', sql.VarChar(100), usuarioValidacion)
      .query(`
        UPDATE dbo.PEDIDOS
        SET
          ESTADO = 'VALIDADO',
          FECHA_VALIDACION = SYSDATETIME(),
          USUARIO_VALIDACION = @USUARIO_VALIDACION,
          FECHA_ACTUALIZACION = SYSDATETIME()
        OUTPUT INSERTED.*
        WHERE
          ID_PEDIDO = @ID_PEDIDO
          AND ESTADO = 'BORRADOR';
      `);

    const pedidoValidado = actualizado.recordset[0] || null;

    if (!pedidoValidado) {
      throw new Error('No se pudo validar el pedido.');
    }

    await transaction.commit();
    return pedidoValidado;
  } catch (error) {
    try {
      await transaction.rollback();
    } catch (_) {
      // Conservamos el error original.
    }

    throw error;
  }
}


/* ============================================================
   ANULAR PEDIDO
   - Permitido desde BORRADOR o VALIDADO.
   - SINCRONIZADO no puede anularse.
   - ANULADO no puede volver a anularse.
   - El motivo es obligatorio y se persiste junto con auditoría.
   ============================================================ */
async function marcarPedidoAnulado(
  idPedido,
  usuarioAnulacion,
  motivoAnulacion
) {
  const pool = await getConnection();
  const transaction = new sql.Transaction(pool);

  try {
    await transaction.begin();

    const pedidoResult = await new sql.Request(transaction)
      .input('ID_PEDIDO', sql.BigInt, idPedido)
      .query(`
        SELECT TOP 1
          ID_PEDIDO,
          ID_ALTA,
          CODIGO_PROVEEDOR,
          NUMERO_ORDEN,
          MONEDA,
          ESTADO
        FROM dbo.PEDIDOS WITH (UPDLOCK, HOLDLOCK)
        WHERE ID_PEDIDO = @ID_PEDIDO;
      `);

    const pedido = pedidoResult.recordset[0] || null;

    if (!pedido) {
      throw new Error('Pedido no encontrado.');
    }

    if (pedido.ESTADO === 'SINCRONIZADO') {
      throw new Error('Un pedido SINCRONIZADO no puede ser anulado.');
    }

    if (pedido.ESTADO === 'ANULADO') {
      throw new Error('El pedido ya se encuentra ANULADO.');
    }

    if (!['BORRADOR', 'VALIDADO'].includes(pedido.ESTADO)) {
      throw new Error(
        `El pedido está en estado ${pedido.ESTADO} y no puede ser anulado.`
      );
    }

    const actualizado = await new sql.Request(transaction)
      .input('ID_PEDIDO', sql.BigInt, idPedido)
      .input('USUARIO_ANULACION', sql.VarChar(100), usuarioAnulacion)
      .input('MOTIVO_ANULACION', sql.VarChar(500), motivoAnulacion)
      .query(`
        UPDATE dbo.PEDIDOS
        SET
          ESTADO = 'ANULADO',
          FECHA_ANULACION = SYSDATETIME(),
          USUARIO_ANULACION = @USUARIO_ANULACION,
          MOTIVO_ANULACION = @MOTIVO_ANULACION,
          FECHA_ACTUALIZACION = SYSDATETIME()
        OUTPUT INSERTED.*
        WHERE
          ID_PEDIDO = @ID_PEDIDO
          AND ESTADO IN ('BORRADOR', 'VALIDADO');
      `);

    const pedidoAnulado = actualizado.recordset[0] || null;

    if (!pedidoAnulado) {
      throw new Error('No se pudo anular el pedido.');
    }

    await transaction.commit();
    return pedidoAnulado;
  } catch (error) {
    try {
      await transaction.rollback();
    } catch (_) {
      // Conservamos el error original.
    }

    throw error;
  }
}


/* ============================================================
   DATOS MASTER_DATA_APP DEL PEDIDO
   - Devuelve solo los productos incluidos en el pedido.
   - Recupera snapshots del Alta + datos ERP + curva maestra.
   ============================================================ */
async function obtenerDatosMasterPedido(idPedido) {
  const pool = await getConnection();

  const resultado = await pool
    .request()
    .input('ID_PEDIDO', sql.BigInt, idPedido)
    .query(`
      SELECT
        PD.ID_PEDIDO_DETALLE,
        PD.TIPO_PRODUCTO,
        PD.CODIGO_ALFA,
        PD.CODIGO_ERP AS CODIGO_ERP_PEDIDO,
        PD.CODIGO_MODELO,
        PD.DETALLE_MODELO,
        PD.CODIGO_COLOR,
        PD.DETALLE_COLOR,
        PD.DETALLE_PRODUCTO,
        PD.CODIGO_TALLE,
        PD.DETALLE_TALLE,
        PD.CODIGO_MODULO AS CODIGO_MODULO_PEDIDO,
        PD.DETALLE_MODULO AS DETALLE_MODULO_PEDIDO,
        PD.DETALLE_EDAD,
        PD.PARES_MODULO,
        PD.PRECIO_FOB_PAR,

        P.CODIGO_PROVEEDOR,
        P.DETALLE_PROVEEDOR,

        A.CODIGO_ANO,
        A.CODIGO_TEMPORADA,
        A.DETALLE_TEMPORADA,
        A.CODIGO_MARCA,
        A.DETALLE_MARCA,

        D.CODIGO_GRUPO,
        D.DETALLE_GRUPO,
        D.CODIGO_SUBGRUPO,
        D.DETALLE_SUBGRUPO,
        D.CODIGO_LINEA,
        D.DETALLE_LINEA,
        D.CODIGO_DEPORTE,
        D.DETALLE_DEPORTE,
        D.CODIGO_EDAD,
        D.SEXO,
        D.CODIGO_CLASIFICACION,
        D.DETALLE_CLASIFICACION,
        D.CODIGO_PAIS,
        D.DETALLE_PAIS,

        PR.CODIGO AS CODIGO_INTERNO_PRODUCTO,
        PR.CODIGO_ERP AS CODIGO_ERP_PRODUCTO,

        TM.*

      FROM dbo.PEDIDOS_DETALLE PD
      INNER JOIN dbo.PEDIDOS P
        ON P.ID_PEDIDO = PD.ID_PEDIDO
      INNER JOIN dbo.ALTAS_PRODUCTOS A
        ON A.ID_ALTA = P.ID_ALTA
      INNER JOIN dbo.ALTAS_PRODUCTOS_DETALLE D
        ON D.ID_ALTA = P.ID_ALTA
       AND D.CODIGO_ALFA = PD.CODIGO_ALFA
       AND D.CODIGO_PROVEEDOR = P.CODIGO_PROVEEDOR
      INNER JOIN dbo.PRODUCTOS PR
        ON PR.ID_PRODUCTO = PD.ID_PRODUCTO
      LEFT JOIN dbo.MAESTRO_TALLES_MODULOS TM
        ON TM.CODIGO_MODULO = PD.CODIGO_MODULO
      WHERE PD.ID_PEDIDO = @ID_PEDIDO
      ORDER BY PD.ID_PEDIDO_DETALLE;
    `);

  return resultado.recordset;
}



/* ============================================================
   REGISTRAR EXPORTACION DE PEDIDO
   - Una exportación no cambia el estado del Pedido.
   - Se permiten múltiples exportaciones del mismo tipo.
   ============================================================ */
async function registrarExportacionPedido(datos) {
  const pool = await getConnection();

  const resultado = await pool
    .request()
    .input('ID_PEDIDO', sql.BigInt, datos.ID_PEDIDO)
    .input('TIPO_EXPORTACION', sql.VarChar(30), datos.TIPO_EXPORTACION)
    .input('NOMBRE_ARCHIVO', sql.VarChar(255), datos.NOMBRE_ARCHIVO)
    .input('USUARIO_EXPORTACION', sql.VarChar(100), datos.USUARIO_EXPORTACION || 'SISTEMA')
    .input('CANTIDAD_REGISTROS', sql.Int, datos.CANTIDAD_REGISTROS)
    .input('ESTADO', sql.VarChar(20), datos.ESTADO || 'OK')
    .input('OBSERVACIONES', sql.VarChar(500), datos.OBSERVACIONES || null)
    .query(`
      INSERT INTO dbo.PEDIDOS_EXPORTACIONES
      (
        ID_PEDIDO,
        TIPO_EXPORTACION,
        NOMBRE_ARCHIVO,
        FECHA_EXPORTACION,
        USUARIO_EXPORTACION,
        CANTIDAD_REGISTROS,
        ESTADO,
        OBSERVACIONES
      )
      OUTPUT INSERTED.*
      VALUES
      (
        @ID_PEDIDO,
        @TIPO_EXPORTACION,
        @NOMBRE_ARCHIVO,
        SYSDATETIME(),
        @USUARIO_EXPORTACION,
        @CANTIDAD_REGISTROS,
        @ESTADO,
        @OBSERVACIONES
      );
    `);

  return resultado.recordset[0] || null;
}


/* ============================================================
   LISTAR EXPORTACIONES DE UN PEDIDO
   ============================================================ */
async function listarExportacionesPedido(idPedido) {
  const pool = await getConnection();

  const resultado = await pool
    .request()
    .input('ID_PEDIDO', sql.BigInt, idPedido)
    .query(`
      SELECT
        ID_EXPORTACION,
        ID_PEDIDO,
        TIPO_EXPORTACION,
        NOMBRE_ARCHIVO,
        FECHA_EXPORTACION,
        USUARIO_EXPORTACION,
        CANTIDAD_REGISTROS,
        ESTADO,
        OBSERVACIONES
      FROM dbo.PEDIDOS_EXPORTACIONES
      WHERE ID_PEDIDO = @ID_PEDIDO
      ORDER BY ID_EXPORTACION DESC;
    `);

  return resultado.recordset;
}

module.exports = {
  listarPedidos,
  obtenerAltasDisponibles,
  obtenerAltaDisponiblePorId,
  obtenerProveedoresPorAlta,
  obtenerProductosDisponibles,
  buscarPedidoDuplicadoActivo,
  crearPedido,
  obtenerPedidoPorId,
  buscarProductoEnPedido,
  agregarProductoPedido,
  listarDetallePedido,
  obtenerDetallePedidoPorId,
  actualizarDetallePedido,
  eliminarDetallePedido,
  marcarPedidoValidado,
  marcarPedidoAnulado,
  obtenerDatosMasterPedido,
  registrarExportacionPedido,
  listarExportacionesPedido,
};
