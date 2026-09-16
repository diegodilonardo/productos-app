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
