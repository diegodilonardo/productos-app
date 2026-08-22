const repository =
    require('../repositories/maestros.repository');


async function obtenerAnos() {

    return repository.obtenerMaestroSimple({
        tabla: 'MAESTRO_ANOS',

        columnas: [
            'CODIGO_ANO',
            'DETALLE_ANO'
        ],

        orden: 'DETALLE_ANO'
    });
}


async function obtenerMarcas() {

    return repository.obtenerMaestroSimple({
        tabla: 'MAESTRO_MARCAS',

        columnas: [
            'CODIGO_MARCA',
            'DETALLE_MARCA',
            'OBSERVACION'
        ],

        orden: 'DETALLE_MARCA'
    });
}


async function obtenerRubros() {

    return repository.obtenerMaestroSimple({
        tabla: 'MAESTRO_RUBROS',

        columnas: [
            'CODIGO_RUBRO',
            'DETALLE_RUBRO'
        ],

        orden: 'DETALLE_RUBRO'
    });
}


async function obtenerTemporadas() {

    return repository.obtenerMaestroSimple({
        tabla: 'MAESTRO_TEMPORADAS',

        columnas: [
            'CODIGO_TEMPORADA',
            'DETALLE_TEMPORADA'
        ],

        orden: 'CODIGO_TEMPORADA'
    });
}


async function obtenerColores() {

    return repository.obtenerMaestroSimple({
        tabla: 'MAESTRO_COLORES',

        columnas: [
            'CODIGO_COLOR',
            'DETALLE_COLOR'
        ],

        orden: 'DETALLE_COLOR'
    });
}


async function obtenerGrupos() {

    return repository.obtenerMaestroSimple({
        tabla: 'MAESTRO_GRUPOS',

        columnas: [
            'CODIGO_GRUPO',
            'DETALLE_GRUPO'
        ],

        orden: 'DETALLE_GRUPO'
    });
}


async function obtenerSubgrupos() {

    return repository.obtenerMaestroSimple({
        tabla: 'MAESTRO_SUBGRUPOS',

        columnas: [
            'CODIGO_SUBGRUPO',
            'DETALLE_SUBGRUPO'
        ],

        orden: 'DETALLE_SUBGRUPO'
    });
}


async function obtenerLineas() {

    return repository.obtenerMaestroSimple({
        tabla: 'MAESTRO_LINEA',

        columnas: [
            'CODIGO_LINEA',
            'DETALLE_LINEA'
        ],

        orden: 'DETALLE_LINEA'
    });
}


async function obtenerDeportes() {

    return repository.obtenerMaestroSimple({
        tabla: 'MAESTRO_DEPORTES',

        columnas: [
            'CODIGO_DEPORTE',
            'DETALLE_DEPORTE'
        ],

        orden: 'DETALLE_DEPORTE'
    });
}


async function obtenerEdades() {

    return repository.obtenerMaestroSimple({
        tabla: 'MAESTRO_EDADES',

        columnas: [
            'CODIGO_EDAD',
            'DETALLE_EDAD'
        ],

        orden: 'CODIGO_EDAD'
    });
}


async function obtenerSexo() {

    return repository.obtenerMaestroSimple({
        tabla: 'MAESTRO_SEXO',

        columnas: [
            'SEXO'
        ],

        orden: 'SEXO'
    });
}


async function obtenerClasificaciones() {

    return repository.obtenerMaestroSimple({
        tabla: 'MAESTRO_CLASIFICACION',

        columnas: [
            'CODIGO_CLASIFICACION',
            'DETALLE_CLASIFICACION'
        ],

        orden: 'CODIGO_CLASIFICACION'
    });
}


async function obtenerPaises() {

    return repository.obtenerMaestroSimple({
        tabla: 'MAESTRO_PAISES',

        columnas: [
            'CODIGO_PAIS',
            'DETALLE_PAIS'
        ],

        orden: 'DETALLE_PAIS'
    });
}


async function obtenerOrigenes() {

    return repository.obtenerMaestroSimple({
        tabla: 'MAESTRO_ORIGENES',

        columnas: [
            'CODIGO_ORIGEN',
            'DETALLE_ORIGEN'
        ],

        orden: 'CODIGO_ORIGEN'
    });
}


async function obtenerProveedores(
    filtros = {}
) {

    return repository.buscarProveedores({
        rubro:
            filtros.rubro || null
    });
}


async function obtenerTalles() {

    return repository.obtenerMaestroSimple({
        tabla: 'MAESTRO_TALLES',

        columnas: [
            'CODIGO_TALLE',
            'DETALLE_TALLE'
        ],

        orden: 'DETALLE_TALLE'
    });
}


async function buscarModelos(filtros) {

    return repository.buscarModelos(
        filtros
    );
}


async function obtenerLicenciasModelos(filtros) {

    return repository.buscarLicenciasModelos(
        filtros
    );
}


/* ============================================================
   DESCRIPCION VISUAL CURVA
   ============================================================ */

const mapaTalles = {

    T01: '01',
    T02: '02',
    T03: '03',
    T04: '04',
    T05: '05',
    T06: '06',
    T07: '07',
    T08: '08',

    T10: '10',
    T12: '12',
    T14: '14',
    T15: '15',
    T16: '16',
    T17: '17',
    T18: '18',
    T19: '19',

    T20: '20',
    T21: '21',
    T22: '22',
    T23: '23',
    T24: '24',
    T25: '25',
    T26: '26',
    T27: '27',
    T28: '28',
    T29: '29',

    T30: '30',
    T31: '31',
    T32: '32',
    T33: '33',
    T34: '34',
    T35: '35',
    T36: '36',
    T37: '37',
    T38: '38',

    T385: '38.5',

    T39: '39',

    T395: '39.5',

    T40: '40',

    T405: '40.5',

    T41: '41',

    T415: '41.5',

    T42: '42',

    T425: '42.5',

    T43: '43',

    T435: '43.5',

    T44: '44',

    T445: '44.5',

    T45: '45',

    T455: '45.5',

    T46: '46',
    T47: '47',
    T48: '48',
    T49: '49',
    T50: '50',

    T_XS: 'XS',
    T_S: 'S',
    T_M: 'M',
    T_L: 'L',
    T_XL: 'XL',
    T_2XL: '2XL',
    T_3XL: '3XL'
};


function generarDescripcionCurva(
    modulo
) {

    const talles = [];


    for (
        const [
            columna,
            talle
        ]
        of Object.entries(mapaTalles)
    ) {

        const cantidad =
            Number(
                modulo[columna] || 0
            );


        if (
            cantidad > 0
        ) {

            talles.push({
                talle,
                cantidad
            });
        }
    }


    if (
        talles.length === 0
    ) {

        return `Sin distribución / ` +
            `(PARES ${modulo.PARES})`;
    }


    const primero =
        talles[0].talle;


    const ultimo =
        talles[
            talles.length - 1
        ].talle;


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


async function obtenerTallesModulos() {

    const registros =
        await repository.obtenerTallesModulos();


    return registros.map(
        modulo => ({

            ...modulo,

            DESCRIPCION_CURVA:
                generarDescripcionCurva(
                    modulo
                )
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
    obtenerLicenciasModelos
};