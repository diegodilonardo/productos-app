const fs = require("fs");

const { obtenerRutaMaestro } = require("../config/masters");

const {
  obtenerMetadataArchivo,
  calcularHashArchivo,
  leerArchivoPipe,
} = require("../utils/fileParser");

const {
  obtenerUltimoHashOK,
  crearControlImportacion,
  finalizarControlImportacion,
} = require("./controlImportaciones.service");

const { getConnection, sql } = require("../config/database");

/* ============================================================
   VALIDAR NOMBRE SQL
   ============================================================ */

function validarNombreSQL(nombre) {
  if (!/^[A-Z0-9_]+$/i.test(nombre)) {
    throw new Error(`Nombre SQL inválido: ${nombre}`);
  }

  return nombre;
}

/* ============================================================
   TIPO SQL
   ============================================================ */

function obtenerTipoSQL(configColumna) {
  const tipo = String(configColumna.tipo || "VARCHAR").toUpperCase();

  switch (tipo) {
    case "VARCHAR":
      return sql.VarChar(configColumna.longitud);

    case "NVARCHAR":
      return sql.NVarChar(configColumna.longitud);

    case "INT":
      return sql.Int;

    case "BIGINT":
      return sql.BigInt;

    case "DECIMAL":
      return sql.Decimal(
        configColumna.precision || 18,
        configColumna.escala || 2,
      );

    case "BIT":
      return sql.Bit;

    default:
      throw new Error(`Tipo SQL no soportado: ${tipo}`);
  }
}

/* ============================================================
   CONVERTIR VALOR
   ============================================================ */

function convertirValor(valor, configColumna) {
  if (valor === undefined || valor === null || valor === "") {
    if (configColumna.requerido) {
      return "";
    }

    return null;
  }

  const tipo = String(configColumna.tipo || "VARCHAR").toUpperCase();

  switch (tipo) {
    case "INT":
      return parseInt(valor, 10);

    case "BIGINT":
      return valor;

    case "DECIMAL":
      return Number(String(valor).replace(",", "."));

    case "BIT":
      return valor === "1" || String(valor).toUpperCase() === "TRUE";

    default:
      return String(valor);
  }
}

/* ============================================================
   OBTENER CLAVES
   ============================================================ */

function obtenerClaves(maestro) {
  if (Array.isArray(maestro.clave)) {
    return maestro.clave.map(validarNombreSQL);
  }

  return [validarNombreSQL(maestro.clave)];
}

/* ============================================================
   CARGA BULK
   ============================================================ */

async function cargarStagingBulk(
  transaction,
  maestro,
  registros,
  idImportacion,
) {
  const staging = validarNombreSQL(maestro.staging);

  const table = new sql.Table(`dbo.${staging}`);

  table.create = false;

  /* ========================================================
       ID IMPORTACION
       ======================================================== */

  table.columns.add("ID_IMPORTACION", sql.BigInt, {
    nullable: false,
  });

  /* ========================================================
       COLUMNAS
       ======================================================== */

  for (const configColumna of maestro.columnas) {
    table.columns.add(
      configColumna.nombre,

      obtenerTipoSQL(configColumna),

      {
        nullable: !configColumna.requerido,
      },
    );
  }

  /* ========================================================
       FILAS
       ======================================================== */

  for (const registro of registros) {
    const valores = [idImportacion];

    for (const configColumna of maestro.columnas) {
      valores.push(
        convertirValor(
          registro[configColumna.nombre],

          configColumna,
        ),
      );
    }

    table.rows.add(...valores);
  }

  /* ========================================================
       BULK
       ======================================================== */

  const request = new sql.Request(transaction);

  await request.bulk(table);
}

/* ============================================================
   IMPORTADOR
   ============================================================ */

async function importarMaestroGenerico(maestro) {
  const rutaArchivo = obtenerRutaMaestro(maestro);

  let idImportacion = null;

  try {
    /* =====================================================
           ARCHIVO
           ===================================================== */

    if (!fs.existsSync(rutaArchivo)) {
      throw new Error(`No se encontró el archivo: ` + `${rutaArchivo}`);
    }

    /* =====================================================
           METADATA
           ===================================================== */

    const metadata = await obtenerMetadataArchivo(rutaArchivo);

    /* =====================================================
           HASH
           ===================================================== */

    const hash = await calcularHashArchivo(rutaArchivo);

    /* =====================================================
           VERIFICAR CAMBIO
           ===================================================== */

    const ultimoHash = await obtenerUltimoHashOK(maestro.nombre);

    if (ultimoHash === hash) {
      idImportacion = await crearControlImportacion({
        maestro: maestro.nombre,

        archivo: maestro.archivo,

        estado: "SIN_CAMBIOS",

        hash,

        tamano: metadata.tamano,

        fechaArchivo: metadata.fechaModificacion,
      });

      await finalizarControlImportacion(
        idImportacion,

        {
          estado: "SIN_CAMBIOS",

          mensaje: "El archivo no presenta cambios.",
        },
      );

      return {
        maestro: maestro.nombre,

        estado: "SIN_CAMBIOS",
      };
    }

    /* =====================================================
           CONTROL
           ===================================================== */

    idImportacion = await crearControlImportacion({
      maestro: maestro.nombre,

      archivo: maestro.archivo,

      estado: "EJECUTANDO",

      hash,

      tamano: metadata.tamano,

      fechaArchivo: metadata.fechaModificacion,
    });

    /* =====================================================
           LEER ARCHIVO
           ===================================================== */

    const filas = await leerArchivoPipe(
      rutaArchivo,

      maestro.columnas.length,
    );

    /* =====================================================
           CLAVES
           ===================================================== */

    const claves = obtenerClaves(maestro);

    /* =====================================================
           VALIDAR REGISTROS
           ===================================================== */

    const registros = [];

    const clavesEncontradas = new Set();

    for (let i = 0; i < filas.length; i++) {
      const registro = {};

      for (let c = 0; c < maestro.columnas.length; c++) {
        const configColumna = maestro.columnas[c];

        const valorOriginal = filas[i][configColumna.archivo];

        const valor =
          valorOriginal === undefined || valorOriginal === null
            ? ""
            : String(valorOriginal).trim();

        /* =============================================
                   REQUERIDO
                   ============================================= */

        if (configColumna.requerido && valor === "") {
          throw new Error(
            `Campo ` +
              `${configColumna.nombre} ` +
              `vacío en línea ` +
              `${i + 1}.`,
          );
        }

        /* =============================================
                   LONGITUD
                   ============================================= */

        if (
          valor !== "" &&
          configColumna.longitud &&
          valor.length > configColumna.longitud
        ) {
          throw new Error(
            `Campo ` +
              `${configColumna.nombre} ` +
              `demasiado largo ` +
              `en línea ${i + 1}. ` +
              `Valor: "${valor}". ` +
              `Máximo: ` +
              `${configColumna.longitud}.`,
          );
        }

        /* =============================================
                   INT
                   ============================================= */

        if (
          valor !== "" &&
          String(configColumna.tipo).toUpperCase() === "INT"
        ) {
          if (!/^-?\d+$/.test(valor)) {
            throw new Error(
              `Campo ` +
                `${configColumna.nombre} ` +
                `debe ser entero ` +
                `en línea ${i + 1}.`,
            );
          }
        }

        registro[configColumna.nombre] = valor;
      }

      /* =============================================
               ARMAR CLAVE COMPUESTA
               ============================================= */

      const valoresClave = claves.map((clave) => registro[clave]);

      for (let k = 0; k < valoresClave.length; k++) {
        if (
          valoresClave[k] === undefined ||
          valoresClave[k] === null ||
          valoresClave[k] === ""
        ) {
          throw new Error(
            `Clave ${claves[k]} ` + `vacía en línea ` + `${i + 1}.`,
          );
        }
      }

      const claveCompuesta = valoresClave.join("|||");

      if (clavesEncontradas.has(claveCompuesta)) {
        throw new Error(
          `Clave duplicada ` + `"${claveCompuesta}" ` + `en ${maestro.nombre}.`,
        );
      }

      clavesEncontradas.add(claveCompuesta);

      registros.push(registro);
    }

    /* =====================================================
           ARCHIVO VACIO
           ===================================================== */

    if (registros.length === 0) {
      throw new Error(`${maestro.nombre} ` + `no contiene registros válidos.`);
    }

    /* =====================================================
           PREPARAR SQL
           ===================================================== */

    const tabla = validarNombreSQL(maestro.tabla);

    const staging = validarNombreSQL(maestro.staging);

    const columnas = maestro.columnas.map((columna) =>
      validarNombreSQL(columna.nombre),
    );

    const columnasNoClave = columnas.filter(
      (columna) => !claves.includes(columna),
    );

    const primeraClave = claves[0];

    /* =====================================================
           JOIN POR CLAVE
           ===================================================== */

    const condicionJoin = claves
      .map((clave) => `M.${clave} = T.${clave}`)
      .join(" AND ");

    /* =====================================================
           CAMBIOS
           ===================================================== */

    let condicionesCambio = "1 = 0";

    if (columnasNoClave.length > 0) {
      condicionesCambio = columnasNoClave
        .map(
          (columna) =>
            `ISNULL(M.${columna}, '') ` + `<> ` + `ISNULL(T.${columna}, '')`,
        )
        .join(" OR ");
    }

    /* =====================================================
           ASIGNACIONES UPDATE
           ===================================================== */

    const asignacionesUpdate = columnasNoClave.map(
      (columna) => `M.${columna} = ` + `T.${columna}`,
    );

    /* =====================================================
           CONEXION
           ===================================================== */

    const pool = await getConnection();

    const transaction = new sql.Transaction(pool);

    await transaction.begin();

    try {
      /* =================================================
               LIMPIAR STAGING
               ================================================= */

      await new sql.Request(transaction).input(
        "ID_IMPORTACION",
        sql.BigInt,
        idImportacion,
      ).query(`
                    DELETE
                    FROM dbo.${staging}

                    WHERE
                        ID_IMPORTACION =
                        @ID_IMPORTACION;
                `);

      /* =================================================
               BULK
               ================================================= */

      console.log(
        `${maestro.nombre}: ` +
          `cargando ` +
          `${registros.length} ` +
          `registros al staging...`,
      );

      const inicioBulk = Date.now();

      await cargarStagingBulk(
        transaction,

        maestro,

        registros,

        idImportacion,
      );

      const tiempoBulk = Date.now() - inicioBulk;

      console.log(
        `${maestro.nombre}: ` + `staging cargado ` + `en ${tiempoBulk} ms.`,
      );

      /* =================================================
               NUEVOS
               ================================================= */

      const nuevosResult = await new sql.Request(transaction).input(
        "ID_IMPORTACION",
        sql.BigInt,
        idImportacion,
      ).query(`
                        SELECT
                            COUNT(*) AS CANTIDAD

                        FROM dbo.${staging} T

                        LEFT JOIN dbo.${tabla} M

                            ON ${condicionJoin}

                        WHERE
                            T.ID_IMPORTACION =
                                @ID_IMPORTACION

                            AND
                            M.${primeraClave}
                                IS NULL;
                    `);

      const nuevos = nuevosResult.recordset[0].CANTIDAD;

      /* =================================================
               MODIFICADOS
               ================================================= */

      const modificadosResult = await new sql.Request(transaction).input(
        "ID_IMPORTACION",
        sql.BigInt,
        idImportacion,
      ).query(`
                        SELECT
                            COUNT(*) AS CANTIDAD

                        FROM dbo.${staging} T

                        INNER JOIN dbo.${tabla} M

                            ON ${condicionJoin}

                        WHERE
                            T.ID_IMPORTACION =
                                @ID_IMPORTACION

                            AND
                            (
                                ${condicionesCambio}

                                OR M.ACTIVO = 0
                            );
                    `);

      const modificados = modificadosResult.recordset[0].CANTIDAD;

      /* =================================================
               INACTIVOS
               ================================================= */

      const inactivosResult = await new sql.Request(transaction).input(
        "ID_IMPORTACION",
        sql.BigInt,
        idImportacion,
      ).query(`
                        SELECT
                            COUNT(*) AS CANTIDAD

                        FROM dbo.${tabla} M

                        LEFT JOIN dbo.${staging} T

                            ON
                                ${condicionJoin}

                                AND
                                T.ID_IMPORTACION =
                                    @ID_IMPORTACION

                        WHERE
                            T.${primeraClave}
                                IS NULL

                            AND
                            M.ACTIVO = 1;
                    `);

      const inactivos = inactivosResult.recordset[0].CANTIDAD;

      /* =================================================
               UPDATE
               ================================================= */

      let setUpdate = "";

      if (asignacionesUpdate.length > 0) {
        setUpdate = asignacionesUpdate.join(", ") + ", ";
      }

      await new sql.Request(transaction).input(
        "ID_IMPORTACION",
        sql.BigInt,
        idImportacion,
      ).query(`
                    UPDATE M

                    SET
                        ${setUpdate}

                        M.ACTIVO = 1,

                        M.FECHA_ACTUALIZACION =
                            SYSDATETIME()

                    FROM dbo.${tabla} M

                    INNER JOIN dbo.${staging} T

                        ON ${condicionJoin}

                    WHERE
                        T.ID_IMPORTACION =
                            @ID_IMPORTACION

                        AND
                        (
                            ${condicionesCambio}

                            OR M.ACTIVO = 0
                        );
                `);

      /* =================================================
               INSERT NUEVOS
               ================================================= */

      const columnasSelect = columnas
        .map((columna) => `T.${columna}`)
        .join(", ");

      await new sql.Request(transaction).input(
        "ID_IMPORTACION",
        sql.BigInt,
        idImportacion,
      ).query(`
                    INSERT INTO dbo.${tabla}
                    (
                        ${columnas.join(", ")},
                        ACTIVO,
                        FECHA_ACTUALIZACION
                    )

                    SELECT
                        ${columnasSelect},
                        1,
                        SYSDATETIME()

                    FROM dbo.${staging} T

                    LEFT JOIN dbo.${tabla} M

                        ON ${condicionJoin}

                    WHERE
                        T.ID_IMPORTACION =
                            @ID_IMPORTACION

                        AND
                        M.${primeraClave}
                            IS NULL;
                `);

      /* =================================================
               INACTIVAR AUSENTES
               ================================================= */

      await new sql.Request(transaction).input(
        "ID_IMPORTACION",
        sql.BigInt,
        idImportacion,
      ).query(`
                    UPDATE M

                    SET
                        M.ACTIVO = 0,

                        M.FECHA_ACTUALIZACION =
                            SYSDATETIME()

                    FROM dbo.${tabla} M

                    LEFT JOIN dbo.${staging} T

                        ON
                            ${condicionJoin}

                            AND
                            T.ID_IMPORTACION =
                                @ID_IMPORTACION

                    WHERE
                        T.${primeraClave}
                            IS NULL

                        AND
                        M.ACTIVO = 1;
                `);

      /* =================================================
               LIMPIAR STAGING
               ================================================= */

      await new sql.Request(transaction).input(
        "ID_IMPORTACION",
        sql.BigInt,
        idImportacion,
      ).query(`
                    DELETE
                    FROM dbo.${staging}

                    WHERE
                        ID_IMPORTACION =
                            @ID_IMPORTACION;
                `);

      /* =================================================
               COMMIT
               ================================================= */

      await transaction.commit();

      /* =================================================
               AUDITORIA
               ================================================= */

      await finalizarControlImportacion(
        idImportacion,

        {
          estado: "OK",

          registrosArchivo: registros.length,

          nuevos,

          modificados,

          inactivos,

          errores: 0,

          mensaje:
            `Importación finalizada. ` + `Bulk staging: ` + `${tiempoBulk} ms.`,
        },
      );

      return {
        maestro: maestro.nombre,

        estado: "OK",

        registros: registros.length,

        nuevos,

        modificados,

        inactivos,

        bulkMs: tiempoBulk,
      };
    } catch (error) {
      try {
        await transaction.rollback();
      } catch (_) {}

      throw error;
    }
  } catch (error) {
    console.error(`Error importando ` + `${maestro.nombre}:`, error.message);

    if (idImportacion) {
      try {
        await finalizarControlImportacion(
          idImportacion,

          {
            estado: "ERROR",

            errores: 1,

            mensaje: error.message.substring(0, 1000),
          },
        );
      } catch (errorControl) {
        console.error(
          "No se pudo actualizar " + "CONTROL_IMPORTACIONES:",
          errorControl.message,
        );
      }
    }

    throw error;
  }
}

module.exports = {
  importarMaestroGenerico,
};
