const repository =
  require('../repositories/maestros.repository');


function codigoPermitido(lista, campo, codigo) {

  return lista.some(
    item =>
      String(item[campo] ?? '').trim() ===
      String(codigo ?? '').trim()
  );
}


function alcancePermiteValor(lista, campos, valor) {

  const objetivo =
    String(valor ?? '')
      .trim()
      .toUpperCase();

  if (!objetivo) {
    return true;
  }

  return (lista || []).some(
    item =>
      campos.some(
        campo =>
          String(item?.[campo] ?? '')
            .trim()
            .toUpperCase() ===
          objetivo
      )
  );
}


function validarMarca(acceso, marca) {

  if (
    !marca ||
    acceso.todasMarcas
  ) {
    return;
  }

  /*
   * El frontend puede enviar CODIGO_MARCA o DETALLE_MARCA.
   * MAESTRO_MODELOS también puede guardar MARCA_MODELO en
   * cualquiera de esos dos formatos. Por eso la autorización
   * debe aceptar ambos valores del alcance del usuario.
   */
  if (
    !alcancePermiteValor(
      acceso.marcas || [],
      [
        'codigoMarca',
        'detalleMarca',
        'CODIGO_MARCA',
        'DETALLE_MARCA'
      ],
      marca
    )
  ) {
    const error =
      new Error(
        'No tiene permisos para utilizar esa marca.'
      );
    error.status = 403;
    throw error;
  }
}


function validarRubro(acceso, rubro) {

  if (
    !rubro ||
    acceso.todosRubros
  ) {
    return;
  }

  /* Mismo criterio: el filtro puede llegar por código o detalle. */
  if (
    !alcancePermiteValor(
      acceso.rubros || [],
      [
        'codigoRubro',
        'detalleRubro',
        'CODIGO_RUBRO',
        'DETALLE_RUBRO'
      ],
      rubro
    )
  ) {
    const error =
      new Error(
        'No tiene permisos para utilizar ese rubro.'
      );
    error.status = 403;
    throw error;
  }
}


function normalizarLicencia(valor) {

  const normalizado =
    String(valor ?? '')
      .trim()
      .toUpperCase();

  /*
   * En el maestro de modelos, una licencia inexistente puede llegar
   * como NULL/'' o mediante el valor técnico __SIN_LICENCIA__.
   * En seguridad, en cambio, el scope se guarda como SIN LICENCIA.
   * Los tres casos representan exactamente el mismo alcance.
   */
  if (
    !normalizado ||
    normalizado === '__SIN_LICENCIA__' ||
    normalizado === 'SIN LICENCIA'
  ) {
    return 'SIN LICENCIA';
  }

  return normalizado;
}


function licenciaPermitida(
  acceso,
  licencia
) {

  if (acceso.todasLicencias) {
    return true;
  }

  const objetivo =
    normalizarLicencia(licencia);

  return (acceso.licencias || [])
    .some(
      item =>
        normalizarLicencia(item) ===
        objetivo
    );
}


function filtrarMarcas(datos, acceso) {

  if (acceso.todasMarcas) {
    return datos;
  }

  const permitidas =
    new Set(
      (acceso.marcas || [])
        .map(
          item =>
            String(item.codigoMarca).trim()
        )
    );

  return datos.filter(
    item =>
      permitidas.has(
        String(item.CODIGO_MARCA).trim()
      )
  );
}


function filtrarRubros(datos, acceso) {

  if (acceso.todosRubros) {
    return datos;
  }

  const permitidos =
    new Set(
      (acceso.rubros || [])
        .map(
          item =>
            String(item.codigoRubro).trim()
        )
    );

  return datos.filter(
    item =>
      permitidos.has(
        String(item.CODIGO_RUBRO).trim()
      )
  );
}


async function simple(
  idEmpresa,
  tabla,
  columnas,
  orden
) {

  return repository.obtenerMaestroSimple({
    tabla,
    columnas,
    orden,
    idEmpresa
  });
}


async function obtenerAnos({ idEmpresa }) {
  return simple(
    idEmpresa,
    'MAESTRO_ANOS',
    ['CODIGO_ANO', 'DETALLE_ANO'],
    'DETALLE_ANO'
  );
}


async function obtenerMarcas({
  idEmpresa,
  acceso
}) {

  const datos =
    await simple(
      idEmpresa,
      'MAESTRO_MARCAS',
      [
        'CODIGO_MARCA',
        'DETALLE_MARCA',
        'OBSERVACION'
      ],
      'DETALLE_MARCA'
    );

  return filtrarMarcas(
    datos,
    acceso
  );
}


async function obtenerRubros({
  idEmpresa,
  acceso
}) {

  const datos =
    await simple(
      idEmpresa,
      'MAESTRO_RUBROS',
      [
        'CODIGO_RUBRO',
        'DETALLE_RUBRO'
      ],
      'DETALLE_RUBRO'
    );

  return filtrarRubros(
    datos,
    acceso
  );
}


async function obtenerTemporadas({ idEmpresa }) {
  return simple(
    idEmpresa,
    'MAESTRO_TEMPORADAS',
    ['CODIGO_TEMPORADA', 'DETALLE_TEMPORADA'],
    'CODIGO_TEMPORADA'
  );
}


async function obtenerColores({ idEmpresa }) {
  return simple(
    idEmpresa,
    'MAESTRO_COLORES',
    ['CODIGO_COLOR', 'DETALLE_COLOR'],
    'DETALLE_COLOR'
  );
}


async function obtenerGrupos({ idEmpresa }) {
  return simple(
    idEmpresa,
    'MAESTRO_GRUPOS',
    ['CODIGO_GRUPO', 'DETALLE_GRUPO'],
    'DETALLE_GRUPO'
  );
}


async function obtenerSubgrupos({ idEmpresa }) {
  return simple(
    idEmpresa,
    'MAESTRO_SUBGRUPOS',
    ['CODIGO_SUBGRUPO', 'DETALLE_SUBGRUPO'],
    'DETALLE_SUBGRUPO'
  );
}


async function obtenerLineas({ idEmpresa }) {
  return simple(
    idEmpresa,
    'MAESTRO_LINEA',
    ['CODIGO_LINEA', 'DETALLE_LINEA'],
    'DETALLE_LINEA'
  );
}


async function obtenerDeportes({ idEmpresa }) {
  return simple(
    idEmpresa,
    'MAESTRO_DEPORTES',
    ['CODIGO_DEPORTE', 'DETALLE_DEPORTE'],
    'DETALLE_DEPORTE'
  );
}


async function obtenerEdades({ idEmpresa }) {
  return simple(
    idEmpresa,
    'MAESTRO_EDADES',
    ['CODIGO_EDAD', 'DETALLE_EDAD'],
    'CODIGO_EDAD'
  );
}


async function obtenerSexo({ idEmpresa }) {
  return simple(
    idEmpresa,
    'MAESTRO_SEXO',
    ['SEXO'],
    'SEXO'
  );
}


async function obtenerClasificaciones({ idEmpresa }) {
  return simple(
    idEmpresa,
    'MAESTRO_CLASIFICACION',
    [
      'CODIGO_CLASIFICACION',
      'DETALLE_CLASIFICACION'
    ],
    'CODIGO_CLASIFICACION'
  );
}


async function obtenerPaises({ idEmpresa }) {
  return simple(
    idEmpresa,
    'MAESTRO_PAISES',
    ['CODIGO_PAIS', 'DETALLE_PAIS'],
    'DETALLE_PAIS'
  );
}


async function obtenerOrigenes({ idEmpresa }) {
  return simple(
    idEmpresa,
    'MAESTRO_ORIGENES',
    ['CODIGO_ORIGEN', 'DETALLE_ORIGEN'],
    'CODIGO_ORIGEN'
  );
}


function valorPermitido(
  lista,
  campos,
  valor
) {

  const objetivo =
    String(valor ?? '')
      .trim()
      .toUpperCase();

  return (lista || []).some(
    item =>
      campos.some(
        campo =>
          String(item[campo] ?? '')
            .trim()
            .toUpperCase() ===
          objetivo
      )
  );
}


async function obtenerProveedores({
  idEmpresa,
  acceso,
  rubro = null,
  marca = null
}) {

  /*
   * MAESTRO_PROVEEDORES es GLOBAL.
   *
   * La habilitación real se obtiene desde:
   *
   * EMPRESAS_MARCAS
   *        |
   * EMPRESAS_MARCAS_PROVEEDORES
   *        |
   * MAESTRO_PROVEEDORES
   *
   * Nunca se usa MAESTRO_PROVEEDORES.ID_EMPRESA
   * para autorizar o seleccionar proveedores.
   */

  let codigoMarca =
    marca
      ? String(marca).trim()
      : null;


  if (codigoMarca) {

    if (
      !acceso.todasMarcas &&
      !valorPermitido(
        acceso.marcas,
        [
          'codigoMarca',
          'detalleMarca'
        ],
        codigoMarca
      )
    ) {

      const error =
        new Error(
          'No tiene permisos para consultar proveedores de esa marca.'
        );

      error.status = 403;
      throw error;
    }

  } else if (
    !acceso.todasMarcas &&
    (acceso.marcas || []).length === 1
  ) {

    /*
     * Caso Fabricio:
     * una sola marca habilitada.
     *
     * No hace falta que el frontend envíe marca.
     */

    codigoMarca =
      String(
        acceso.marcas[0].codigoMarca
      ).trim();
  }


  if (
    rubro &&
    !acceso.todosRubros &&
    !valorPermitido(
      acceso.rubros,
      [
        'codigoRubro',
        'detalleRubro'
      ],
      rubro
    )
  ) {

    const error =
      new Error(
        'No tiene permisos para consultar proveedores de ese rubro.'
      );

    error.status = 403;
    throw error;
  }


  /*
   * Si el usuario tiene varias marcas restringidas y no
   * especificó una, consultamos únicamente sus marcas permitidas.
   */

  if (
    !codigoMarca &&
    !acceso.todasMarcas
  ) {

    const codigos =
      [
        ...new Set(
          (acceso.marcas || [])
            .map(
              item =>
                String(
                  item.codigoMarca ?? ''
                ).trim()
            )
            .filter(Boolean)
        )
      ];

    const acumulados = [];

    for (
      const codigoMarcaPermitida
      of codigos
    ) {

      const datos =
        await repository.buscarProveedores({
          idEmpresa,
          rubro,
          codigoMarca:
            codigoMarcaPermitida
        });

      acumulados.push(
        ...datos
      );
    }


    const unicos =
      new Map();

    for (const proveedor of acumulados) {
      unicos.set(
        String(proveedor.CODIGO),
        proveedor
      );
    }

    return [
      ...unicos.values()
    ].sort(
      (a, b) =>
        String(
          a.NVA_RAZON_SOCIAL || ''
        ).localeCompare(
          String(
            b.NVA_RAZON_SOCIAL || ''
          ),
          'es'
        )
    );
  }


  return repository.buscarProveedores({
    idEmpresa,
    rubro,
    codigoMarca
  });
}


async function obtenerTalles({ idEmpresa }) {
  return simple(
    idEmpresa,
    'MAESTRO_TALLES',
    ['CODIGO_TALLE', 'DETALLE_TALLE'],
    'DETALLE_TALLE'
  );
}


async function buscarModelos({
  idEmpresa,
  acceso,
  marca,
  rubro,
  texto,
  licencia
}) {

  validarMarca(
    acceso,
    marca
  );

  /*
   * En MODELOS, MARCA_MODELO y RUBRO_MODELO pueden contener
   * el detalle en lugar del código. El filtro principal de
   * seguridad sigue siendo ID_EMPRESA; el alcance se vuelve a
   * controlar sobre los resultados.
   */

  const datos =
    await repository.buscarModelos({
      idEmpresa,
      marca,
      rubro,
      texto,
      licencia
    });

  return datos.filter(
    item => {

      if (
        !acceso.todasMarcas &&
        !(acceso.marcas || [])
          .some(
            m =>
              [
                m.codigoMarca,
                m.detalleMarca
              ]
              .map(v => String(v || '').trim().toUpperCase())
              .includes(
                String(item.MARCA_MODELO || '')
                  .trim()
                  .toUpperCase()
              )
          )
      ) {
        return false;
      }

      if (
        !acceso.todosRubros &&
        !(acceso.rubros || [])
          .some(
            r =>
              [
                r.codigoRubro,
                r.detalleRubro
              ]
              .map(v => String(v || '').trim().toUpperCase())
              .includes(
                String(item.RUBRO_MODELO || '')
                  .trim()
                  .toUpperCase()
              )
          )
      ) {
        return false;
      }

      return licenciaPermitida(
        acceso,
        item.LICENCIA
      );
    }
  );
}


async function obtenerLicenciasModelos({
  idEmpresa,
  acceso,
  marca,
  rubro
}) {

  const datos =
    await repository.buscarLicenciasModelos({
      idEmpresa,
      marca,
      rubro
    });

  if (acceso.todasLicencias) {
    return datos;
  }

  return datos.filter(
    item =>
      licenciaPermitida(
        acceso,
        item.CODIGO_LICENCIA
      )
  );
}


/* ============================================================
   DESCRIPCION VISUAL CURVA
   ============================================================ */

const mapaTalles = {
  T01: '01', T02: '02', T03: '03', T04: '04',
  T05: '05', T06: '06', T07: '07', T08: '08',
  T10: '10', T12: '12', T14: '14', T15: '15',
  T16: '16', T17: '17', T18: '18', T19: '19',
  T20: '20', T21: '21', T22: '22', T23: '23',
  T24: '24', T25: '25', T26: '26', T27: '27',
  T28: '28', T29: '29', T30: '30', T31: '31',
  T32: '32', T33: '33', T34: '34', T35: '35',
  T36: '36', T37: '37', T38: '38', T385: '38.5',
  T39: '39', T395: '39.5', T40: '40', T405: '40.5',
  T41: '41', T415: '41.5', T42: '42', T425: '42.5',
  T43: '43', T435: '43.5', T44: '44', T445: '44.5',
  T45: '45', T455: '45.5', T46: '46', T47: '47',
  T48: '48', T49: '49', T50: '50',
  T_XS: 'XS', T_S: 'S', T_M: 'M', T_L: 'L',
  T_XL: 'XL', T_2XL: '2XL', T_3XL: '3XL'
};


function generarDescripcionCurva(modulo) {

  const talles = [];

  for (
    const [columna, talle]
    of Object.entries(mapaTalles)
  ) {

    const cantidad =
      Number(modulo[columna] || 0);

    if (cantidad > 0) {
      talles.push({
        talle,
        cantidad
      });
    }
  }

  if (talles.length === 0) {
    return (
      `Sin distribución / ` +
      `(PARES ${modulo.PARES})`
    );
  }

  const primero =
    talles[0].talle;

  const ultimo =
    talles[talles.length - 1].talle;

  const distribucion =
    talles
      .map(
        item =>
          `${item.talle}:${item.cantidad}`
      )
      .join(' | ');

  return (
    `(${primero}-${ultimo}) / ` +
    `${distribucion} / ` +
    `(PARES ${modulo.PARES})`
  );
}


async function obtenerTallesModulos({ idEmpresa }) {

  const registros =
    await repository.obtenerTallesModulos(
      idEmpresa
    );

  return registros.map(
    modulo => ({
      ...modulo,
      DESCRIPCION_CURVA:
        generarDescripcionCurva(modulo)
    })
  );
}


module.exports = {
  obtenerAnos,
  obtenerMarcas,
  obtenerRubros,
  obtenerTemporadas,
  obtenerColores,
  obtenerGrupos,
  obtenerSubgrupos,
  obtenerLineas,
  obtenerDeportes,
  obtenerEdades,
  obtenerSexo,
  obtenerClasificaciones,
  obtenerPaises,
  obtenerOrigenes,
  obtenerProveedores,
  obtenerTalles,
  obtenerTallesModulos,
  buscarModelos,
  obtenerLicenciasModelos,
  validarMarca,
  validarRubro,
  licenciaPermitida
};
