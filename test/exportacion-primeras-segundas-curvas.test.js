const test = require("node:test");
const assert = require("node:assert/strict");

const {
  armarRegistrosPRIMERAS_SEGUNDAS,
} = require("../src/services/exportacion.service");

function detalle(codigoAlfa, clasificacion) {
  return {
    CODIGO_ALFA: codigoAlfa,
    CODIGO_MODELO: "150365",
    CODIGO_COLOR: "48",
    CODIGO_TALLE: "40",
    SEXO: "UNI",
    CODIGO_CLASIFICACION: clasificacion,
    DETALLE_PRODUCTO: `${codigoAlfa} DETALLE`,
    ESTADO_VALIDACION: "VALIDO",
  };
}

test("separa parejas de curvas combinadas con el mismo modelo, color y talle", () => {
  const detalles = [
    detalle("26IF15036514840", "1"),
    detalle("26IF15036524840", "2"),
    detalle("26IM15036514840", "1"),
    detalle("26IM15036524840", "2"),
  ];

  const registros = armarRegistrosPRIMERAS_SEGUNDAS({}, detalles);

  assert.deepEqual(
    registros.map((item) => [item.COD_ALFA, item.COD_ALFAR]),
    [
      ["26IF15036514840", "26IF15036524840"],
      ["26IM15036514840", "26IM15036524840"],
    ],
  );
});

test("sigue rechazando una PRIMERA realmente duplicada", () => {
  const detalles = [
    detalle("26IF15036514840", "1"),
    detalle("26IF15036514840", "1"),
    detalle("26IF15036524840", "2"),
  ];

  assert.throws(
    () => armarRegistrosPRIMERAS_SEGUNDAS({}, detalles),
    /Existe más de una PRIMERA/,
  );
});

test("permite reemitir una pareja histórica que ya existe en Presea", () => {
  const primera = detalle("271F13519910135", "1");
  const segunda = detalle("271F13519920135", "2");
  primera.ESTADO_VALIDACION = "EXPORTADO";
  segunda.ESTADO_VALIDACION = "EXPORTADO";

  const registros = armarRegistrosPRIMERAS_SEGUNDAS(
    {},
    [primera, segunda],
    { incluirHistorico: true },
  );

  assert.deepEqual(
    registros.map((item) => [item.COD_ALFA, item.COD_ALFAR]),
    [["271F13519910135", "271F13519920135"]],
  );
});

test("empareja una segunda histórica que reemplaza el cero de relleno por un espacio", () => {
  const base = {
    ESTADO_VALIDACION: "EXISTE_ERP",
    TIPO_PRODUCTO_DETALLE: "PAR_SUELTO",
    CODIGO_MODELO: "MT508",
    CODIGO_COLOR: "10",
    CODIGO_TALLE: "40",
    DETALLE_TALLE: "40",
    SEXO: "MAS",
  };
  const registros = armarRegistrosPRIMERAS_SEGUNDAS(
    {},
    [
      {
        ...base,
        CODIGO_ALFA: "26210MT50811040",
        CODIGO_CLASIFICACION: "1",
        DETALLE_PRODUCTO: "PRIMERA HISTORICA",
      },
      {
        ...base,
        CODIGO_ALFA: "2621MT508 21040",
        CODIGO_CLASIFICACION: "2",
        DETALLE_PRODUCTO: "SEGUNDA HISTORICA",
      },
    ],
    { incluirHistorico: true },
  );

  assert.equal(registros.length, 1);
  assert.equal(registros[0].COD_ALFA, "26210MT50811040");
  assert.equal(registros[0].COD_ALFAR, "2621MT508 21040");
});

test("empareja primeras históricas con clasificación del módulo y segundas con espacio", () => {
  const base = { ESTADO_VALIDACION: "EXISTE_ERP", TIPO_PRODUCTO_DETALLE: "PAR_SUELTO",
    CODIGO_MODELO: "MT493", CODIGO_COLOR: "10", CODIGO_TALLE: "40", SEXO: "MAS" };
  const detalles = [
    { ...base, CODIGO_ALFA: "2721MT493711040", CODIGO_CLASIFICACION: "1" },
    { ...base, CODIGO_ALFA: "2721MT493 21040", CODIGO_CLASIFICACION: "2" },
  ];
  assert.equal(armarRegistrosPRIMERAS_SEGUNDAS({}, detalles).length, 0);
  const [relacion] = armarRegistrosPRIMERAS_SEGUNDAS({}, detalles, { incluirHistorico: true });
  assert.equal(relacion.COD_ALFA, "2721MT493711040");
  assert.equal(relacion.COD_ALFAR, "2721MT493 21040");
});
