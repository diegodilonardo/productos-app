const fs = require("fs");

const iconv = require("iconv-lite");

/* ============================================================
   ENCODING

   Usamos Windows-1252 para mantener correctamente:
   Á É Í Ó Ú Ñ
   ============================================================ */

const DBF_ENCODING = "win1252";

/* ============================================================
   DEFINICION EXACTA ERP
   ============================================================ */

const camposERP = [
  {
    nombre: "DETALLE",
    tipo: "C",
    largo: 50,
    decimales: 0,
  },

  {
    nombre: "NIVEL",
    tipo: "N",
    largo: 6,
    decimales: 0,
  },

  {
    nombre: "FECHA_ALTA",
    tipo: "D",
    largo: 8,
    decimales: 0,
  },

  {
    nombre: "COD_ALFA",
    tipo: "C",
    largo: 15,
    decimales: 0,
  },

  {
    nombre: "MARCA",
    tipo: "N",
    largo: 6,
    decimales: 0,
  },

  {
    nombre: "COD_SUBG",
    tipo: "C",
    largo: 2,
    decimales: 0,
  },

  {
    nombre: "COD_TEM",
    tipo: "C",
    largo: 1,
    decimales: 0,
  },

  {
    nombre: "COD_GRUPOC",
    tipo: "C",
    largo: 2,
    decimales: 0,
  },

  {
    nombre: "SEXO",
    tipo: "C",
    largo: 3,
    decimales: 0,
  },

  {
    nombre: "CLASIFIC",
    tipo: "C",
    largo: 1,
    decimales: 0,
  },

  {
    nombre: "COLORC",
    tipo: "C",
    largo: 2,
    decimales: 0,
  },

  {
    nombre: "LINEA",
    tipo: "C",
    largo: 4,
    decimales: 0,
  },

  {
    nombre: "MODC",
    tipo: "C",
    largo: 6,
    decimales: 0,
  },

  {
    nombre: "NOMB_ART",
    tipo: "C",
    largo: 50,
    decimales: 0,
  },

  {
    nombre: "ORIG_PRO",
    tipo: "C",
    largo: 1,
    decimales: 0,
  },

  {
    nombre: "RUBROS",
    tipo: "C",
    largo: 1,
    decimales: 0,
  },

  {
    nombre: "RUBRO",
    tipo: "C",
    largo: 30,
    decimales: 0,
  },

  {
    nombre: "TALLC",
    tipo: "C",
    largo: 2,
    decimales: 0,
  },

  {
    nombre: "PARES",
    tipo: "N",
    largo: 2,
    decimales: 0,
  },

  {
    nombre: "COD_ANO",
    tipo: "C",
    largo: 2,
    decimales: 0,
  },

  {
    nombre: "COD_EDAD",
    tipo: "C",
    largo: 1,
    decimales: 0,
  },

  {
    nombre: "RUBRO_FACT",
    tipo: "C",
    largo: 20,
    decimales: 0,
  },

  {
    nombre: "PAIS",
    tipo: "N",
    largo: 3,
    decimales: 0,
  },

  {
    nombre: "COD_DISCIP",
    tipo: "C",
    largo: 3,
    decimales: 0,
  },

  {
    nombre: "LICENCIAS",
    tipo: "C",
    largo: 25,
    decimales: 0,
  },

  {
    nombre: "DCLASIFIC",
    tipo: "C",
    largo: 10,
    decimales: 0,
  },

  {
    nombre: "DCOD_TEM",
    tipo: "C",
    largo: 20,
    decimales: 0,
  },

  {
    nombre: "DCOLORC",
    tipo: "C",
    largo: 20,
    decimales: 0,
  },

  {
    nombre: "COSTO",
    tipo: "N",
    largo: 14,
    decimales: 4,
  },

  {
    nombre: "DET_LINEA",
    tipo: "C",
    largo: 20,
    decimales: 0,
  },

  {
    nombre: "DET_ORIGEN",
    tipo: "C",
    largo: 20,
    decimales: 0,
  },

  {
    nombre: "DGRUPO",
    tipo: "C",
    largo: 20,
    decimales: 0,
  },

  {
    nombre: "DISCIPLINA",
    tipo: "C",
    largo: 20,
    decimales: 0,
  },

  {
    nombre: "DMARCA",
    tipo: "C",
    largo: 15,
    decimales: 0,
  },

  {
    nombre: "DMODC",
    tipo: "C",
    largo: 50,
    decimales: 0,
  },

  {
    nombre: "DSUBG",
    tipo: "C",
    largo: 20,
    decimales: 0,
  },

  {
    nombre: "DTALLC",
    tipo: "C",
    largo: 40,
    decimales: 0,
  },

  {
    nombre: "EDAD",
    tipo: "C",
    largo: 15,
    decimales: 0,
  },
];

/* ============================================================
   TEXTO DBF
   ============================================================ */

function crearCampoTexto(valor, largo) {
  const texto = valor === null || valor === undefined ? "" : String(valor);

  let buffer = iconv.encode(texto, DBF_ENCODING);

  if (buffer.length > largo) {
    buffer = buffer.subarray(0, largo);
  }

  const salida = Buffer.alloc(largo, 0x20);

  buffer.copy(salida, 0);

  return salida;
}

/* ============================================================
   NUMERO DBF
   ============================================================ */

function crearCampoNumero(valor, largo, decimales) {
  if (valor === null || valor === undefined || valor === "") {
    return Buffer.from(" ".repeat(largo), "ascii");
  }

  const numero = Number(valor);

  if (!Number.isFinite(numero)) {
    throw new Error(`Valor numérico inválido: ${valor}`);
  }

  let texto;

  if (decimales > 0) {
    texto = numero.toFixed(decimales);
  } else {
    texto = Math.trunc(numero).toString();
  }

  if (texto.length > largo) {
    throw new Error(`El número ${texto} supera ` + `el largo DBF ${largo}.`);
  }

  texto = texto.padStart(largo, " ");

  return Buffer.from(texto, "ascii");
}

/* ============================================================
   FECHA DBF
   FORMATO YYYYMMDD
   ============================================================ */

function crearCampoFecha(valor) {
  if (!valor) {
    return Buffer.from("        ", "ascii");
  }

  const fecha = valor instanceof Date ? valor : new Date(valor);

  if (Number.isNaN(fecha.getTime())) {
    throw new Error(`Fecha DBF inválida: ${valor}`);
  }

  const yyyy = fecha.getFullYear().toString().padStart(4, "0");

  const mm = String(fecha.getMonth() + 1).padStart(2, "0");

  const dd = String(fecha.getDate()).padStart(2, "0");

  return Buffer.from(`${yyyy}${mm}${dd}`, "ascii");
}

/* ============================================================
   CREAR BUFFER DE CAMPO
   ============================================================ */

function crearValorCampo(campo, valor) {
  switch (campo.tipo) {
    case "C":
      return crearCampoTexto(valor, campo.largo);

    case "N":
      return crearCampoNumero(valor, campo.largo, campo.decimales);

    case "D":
      return crearCampoFecha(valor);

    default:
      throw new Error(`Tipo DBF no soportado: ${campo.tipo}`);
  }
}

/* ============================================================
   CREAR DBF
   ============================================================ */

function escribirDBF(rutaArchivo, registros) {
  if (!Array.isArray(registros) || registros.length === 0) {
    throw new Error("No existen registros para generar el DBF.");
  }

  const cantidadCampos = camposERP.length;

  const largoCabecera = 32 + cantidadCampos * 32 + 1;

  const largoRegistro =
    1 +
    camposERP.reduce(
      (acumulado, campo) => acumulado + campo.largo,

      0,
    );

  const cantidadRegistros = registros.length;

  const largoTotal = largoCabecera + largoRegistro * cantidadRegistros + 1;

  const buffer = Buffer.alloc(largoTotal, 0);

  /* ========================================================
       HEADER DBF III
       ======================================================== */

  buffer[0] = 0x03;

  const ahora = new Date();

  buffer[1] = ahora.getFullYear() - 1900;

  buffer[2] = ahora.getMonth() + 1;

  buffer[3] = ahora.getDate();

  buffer.writeUInt32LE(cantidadRegistros, 4);

  buffer.writeUInt16LE(largoCabecera, 8);

  buffer.writeUInt16LE(largoRegistro, 10);

  /*
   * Language driver:
   * ANSI / Windows
   */
  buffer[29] = 0x57;

  /* ========================================================
       DESCRIPTORES CAMPOS
       ======================================================== */

  let offset = 32;

  for (const campo of camposERP) {
    const descriptor = Buffer.alloc(32, 0);

    const nombre = Buffer.from(campo.nombre, "ascii");

    nombre.subarray(0, 11).copy(descriptor, 0);

    descriptor[11] = campo.tipo.charCodeAt(0);

    descriptor[16] = campo.largo;

    descriptor[17] = campo.decimales || 0;

    descriptor.copy(buffer, offset);

    offset += 32;
  }

  /* ========================================================
       FIN HEADER
       ======================================================== */

  buffer[offset] = 0x0d;

  offset = largoCabecera;

  /* ========================================================
       REGISTROS
       ======================================================== */

  for (const registro of registros) {
    /*
     * Espacio = registro activo/no eliminado.
     */
    buffer[offset] = 0x20;

    offset += 1;

    for (const campo of camposERP) {
      const valor = crearValorCampo(
        campo,

        registro[campo.nombre],
      );

      valor.copy(buffer, offset);

      offset += campo.largo;
    }
  }

  /* ========================================================
       EOF DBF
       ======================================================== */

  buffer[offset] = 0x1a;

  fs.writeFileSync(rutaArchivo, buffer);

  return {
    ruta: rutaArchivo,

    registros: cantidadRegistros,

    campos: cantidadCampos,

    largoRegistro,

    largoCabecera,
  };
}

module.exports = {
  escribirDBF,

  camposERP,
};
