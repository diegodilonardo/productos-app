const path = require('path');


const maestros = {

    /* =========================================================
       AÑOS
       ========================================================= */

    ANOS: {
        nombre: 'TBL_AÑOS',
        archivo: 'TBL_AÑOS.TXT',
        tabla: 'MAESTRO_ANOS',
        staging: 'STG_MAESTRO_ANOS',

        columnas: [
            {
                archivo: 0,
                nombre: 'CODIGO_ANO',
                tipo: 'VARCHAR',
                longitud: 2,
                requerido: true
            },
            {
                archivo: 1,
                nombre: 'DETALLE_ANO',
                tipo: 'VARCHAR',
                longitud: 4,
                requerido: true
            }
        ],

        clave: 'CODIGO_ANO'
    },


    /* =========================================================
       COLORES
       ========================================================= */

    COLORES: {
        nombre: 'TBL_COLORES',
        archivo: 'TBL_COLORES.TXT',
        tabla: 'MAESTRO_COLORES',
        staging: 'STG_MAESTRO_COLORES',

        columnas: [
            {
                archivo: 0,
                nombre: 'CODIGO_COLOR',
                tipo: 'VARCHAR',
                longitud: 2,
                requerido: true
            },
            {
                archivo: 1,
                nombre: 'DETALLE_COLOR',
                tipo: 'VARCHAR',
                longitud: 30,
                requerido: true
            }
        ],

        clave: 'CODIGO_COLOR'
    },


    /* =========================================================
       CLASIFICACION
       ========================================================= */

    CLASIFICACION: {
        nombre: 'TBL_CLASIFICACION',
        archivo: 'TBL_CLASIFICACION.TXT',
        tabla: 'MAESTRO_CLASIFICACION',
        staging: 'STG_MAESTRO_CLASIFICACION',

        columnas: [
            {
                archivo: 0,
                nombre: 'CODIGO_CLASIFICACION',
                tipo: 'VARCHAR',
                longitud: 1,
                requerido: true
            },
            {
                archivo: 1,
                nombre: 'DETALLE_CLASIFICACION',
                tipo: 'VARCHAR',
                longitud: 20,
                requerido: true
            }
        ],

        clave: 'CODIGO_CLASIFICACION'
    },


    /* =========================================================
       DEPORTES
       ========================================================= */

    DEPORTES: {
        nombre: 'TBL_DEPORTES',
        archivo: 'TBL_DEPORTES.TXT',
        tabla: 'MAESTRO_DEPORTES',
        staging: 'STG_MAESTRO_DEPORTES',

        columnas: [
            {
                archivo: 0,
                nombre: 'CODIGO_DEPORTE',
                tipo: 'VARCHAR',
                longitud: 3,
                requerido: true
            },
            {
                archivo: 1,
                nombre: 'DETALLE_DEPORTE',
                tipo: 'VARCHAR',
                longitud: 30,
                requerido: true
            }
        ],

        clave: 'CODIGO_DEPORTE'
    },


    /* =========================================================
       EDADES
       ========================================================= */

    EDADES: {
        nombre: 'TBL_EDADES',
        archivo: 'TBL_EDADES.TXT',
        tabla: 'MAESTRO_EDADES',
        staging: 'STG_MAESTRO_EDADES',

        columnas: [
            {
                archivo: 0,
                nombre: 'CODIGO_EDAD',
                tipo: 'VARCHAR',
                longitud: 1,
                requerido: true
            },
            {
                archivo: 1,
                nombre: 'DETALLE_EDAD',
                tipo: 'VARCHAR',
                longitud: 20,
                requerido: true
            }
        ],

        clave: 'CODIGO_EDAD'
    },


    /* =========================================================
       GRUPOS
       ========================================================= */

    GRUPOS: {
        nombre: 'TBL_GRUPOS',
        archivo: 'TBL_GRUPO.TXT',
        tabla: 'MAESTRO_GRUPOS',
        staging: 'STG_MAESTRO_GRUPOS',

        columnas: [
            {
                archivo: 0,
                nombre: 'CODIGO_GRUPO',
                tipo: 'VARCHAR',
                longitud: 2,
                requerido: true
            },
            {
                archivo: 1,
                nombre: 'DETALLE_GRUPO',
                tipo: 'VARCHAR',
                longitud: 30,
                requerido: true
            }
        ],

        clave: 'CODIGO_GRUPO'
    },


    /* =========================================================
       LINEA
       ========================================================= */

    LINEA: {
        nombre: 'TBL_LINEA',
        archivo: 'TBL_LINEA.TXT',
        tabla: 'MAESTRO_LINEA',
        staging: 'STG_MAESTRO_LINEA',

        columnas: [
            {
                archivo: 0,
                nombre: 'CODIGO_LINEA',
                tipo: 'VARCHAR',
                longitud: 4,
                requerido: true
            },
            {
                archivo: 1,
                nombre: 'DETALLE_LINEA',
                tipo: 'VARCHAR',
                longitud: 30,
                requerido: true
            }
        ],

        clave: 'CODIGO_LINEA'
    },


    /* =========================================================
       MARCAS
       ========================================================= */

    MARCAS: {
        nombre: 'TBL_MARCAS',
        archivo: 'TBL_MARCAS.TXT',
        tabla: 'MAESTRO_MARCAS',
        staging: 'STG_MAESTRO_MARCAS',

        columnas: [
            {
                archivo: 0,
                nombre: 'CODIGO_MARCA',
                tipo: 'VARCHAR',
                longitud: 3,
                requerido: true
            },
            {
                archivo: 1,
                nombre: 'DETALLE_MARCA',
                tipo: 'VARCHAR',
                longitud: 30,
                requerido: true
            },
            {
                archivo: 2,
                nombre: 'OBSERVACION',
                tipo: 'VARCHAR',
                longitud: 50,
                requerido: false
            }
        ],

        clave: 'CODIGO_MARCA'
    },


    /* =========================================================
       MODELOS
       ========================================================= */

    MODELOS: {
        nombre: 'TBL_MODELOS',
        archivo: 'TBL_MODELOS.TXT',
        tabla: 'MAESTRO_MODELOS',
        staging: 'STG_MAESTRO_MODELOS',

        columnas: [
            {
                archivo: 0,
                nombre: 'CODIGO_MODELO',
                tipo: 'VARCHAR',
                longitud: 6,
                requerido: true
            },
            {
                archivo: 1,
                nombre: 'RUBRO_MODELO',
                tipo: 'VARCHAR',
                longitud: 20,
                requerido: true
            },
            {
                archivo: 2,
                nombre: 'DETALLE_MODELO',
                tipo: 'VARCHAR',
                longitud: 60,
                requerido: true
            },
            {
                archivo: 3,
                nombre: 'LICENCIA',
                tipo: 'VARCHAR',
                longitud: 30,
                requerido: false
            },
            {
                archivo: 4,
                nombre: 'MARCA_MODELO',
                tipo: 'VARCHAR',
                longitud: 20,
                requerido: true
            }
        ],

        clave: 'CODIGO_MODELO'
    },


    /* =========================================================
       ORIGENES
       ========================================================= */

    ORIGENES: {
        nombre: 'TBL_ORIGENES',
        archivo: 'TBL_ORIGENES.TXT',
        tabla: 'MAESTRO_ORIGENES',
        staging: 'STG_MAESTRO_ORIGENES',

        columnas: [
            {
                archivo: 0,
                nombre: 'CODIGO_ORIGEN',
                tipo: 'VARCHAR',
                longitud: 1,
                requerido: true
            },
            {
                archivo: 1,
                nombre: 'DETALLE_ORIGEN',
                tipo: 'VARCHAR',
                longitud: 20,
                requerido: true
            }
        ],

        clave: 'CODIGO_ORIGEN'
    },


    /* =========================================================
       PAISES
       ========================================================= */

    PAISES: {
        nombre: 'TBL_PAISES',
        archivo: 'TBL_PAISES.TXT',
        tabla: 'MAESTRO_PAISES',
        staging: 'STG_MAESTRO_PAISES',

        columnas: [
            {
                archivo: 0,
                nombre: 'CODIGO_PAIS',
                tipo: 'VARCHAR',
                longitud: 3,
                requerido: true
            },
            {
                archivo: 1,
                nombre: 'DETALLE_PAIS',
                tipo: 'VARCHAR',
                longitud: 30,
                requerido: true
            }
        ],

        clave: 'CODIGO_PAIS'
    },


    /* =========================================================
       RUBROS
       ========================================================= */

    RUBROS: {
        nombre: 'TBL_RUBROS',
        archivo: 'TBL_RUBROS.TXT',
        tabla: 'MAESTRO_RUBROS',
        staging: 'STG_MAESTRO_RUBROS',

        columnas: [
            {
                archivo: 0,
                nombre: 'CODIGO_RUBRO',
                tipo: 'VARCHAR',
                longitud: 1,
                requerido: true
            },
            {
                archivo: 1,
                nombre: 'DETALLE_RUBRO',
                tipo: 'VARCHAR',
                longitud: 30,
                requerido: true
            }
        ],

        clave: 'CODIGO_RUBRO'
    },


    /* =========================================================
       SUBGRUPOS
       ========================================================= */

    SUBGRUPOS: {
        nombre: 'TBL_SUBGRUPO',
        archivo: 'TBL_SUBGRUPO.TXT',
        tabla: 'MAESTRO_SUBGRUPOS',
        staging: 'STG_MAESTRO_SUBGRUPOS',

        columnas: [
            {
                archivo: 0,
                nombre: 'CODIGO_SUBGRUPO',
                tipo: 'VARCHAR',
                longitud: 2,
                requerido: true
            },
            {
                archivo: 1,
                nombre: 'DETALLE_SUBGRUPO',
                tipo: 'VARCHAR',
                longitud: 30,
                requerido: true
            }
        ],

        clave: 'CODIGO_SUBGRUPO'
    },


    /* =========================================================
       TALLES
       ========================================================= */

    TALLES: {
        nombre: 'TBL_TALLES',
        archivo: 'TBL_TALLES.TXT',
        tabla: 'MAESTRO_TALLES',
        staging: 'STG_MAESTRO_TALLES',

        columnas: [
            {
                archivo: 0,
                nombre: 'CODIGO_TALLE',
                tipo: 'VARCHAR',
                longitud: 10,
                requerido: true
            },
            {
                archivo: 1,
                nombre: 'DETALLE_TALLE',
                tipo: 'VARCHAR',
                longitud: 10,
                requerido: true
            }
        ],

        clave: 'CODIGO_TALLE'
    },


    /* =========================================================
       TEMPORADAS
       ========================================================= */

    TEMPORADAS: {
        nombre: 'TBL_TEMPORADA',
        archivo: 'TBL_TEMPORADA.TXT',
        tabla: 'MAESTRO_TEMPORADAS',
        staging: 'STG_MAESTRO_TEMPORADAS',

        columnas: [
            {
                archivo: 0,
                nombre: 'CODIGO_TEMPORADA',
                tipo: 'VARCHAR',
                longitud: 1,
                requerido: true
            },
            {
                archivo: 1,
                nombre: 'DETALLE_TEMPORADA',
                tipo: 'VARCHAR',
                longitud: 20,
                requerido: true
            }
        ],

        clave: 'CODIGO_TEMPORADA'
    },


    /* =========================================================
       SEXO
       ========================================================= */

    SEXO: {
        nombre: 'TBL_SEXO',
        archivo: 'TBL_SEXO.TXT',
        tabla: 'MAESTRO_SEXO',
        staging: 'STG_MAESTRO_SEXO',

        columnas: [
            {
                archivo: 0,
                nombre: 'SEXO',
                tipo: 'VARCHAR',
                longitud: 3,
                requerido: true
            }
        ],

        clave: 'SEXO'
    },


    /* =========================================================
       RUBRO FACTURACION
       ========================================================= */

    RUBRO_FACT: {
        nombre: 'TBL_RUBRO_FACT',
        archivo: 'TBL_RUBRO_FACT.TXT',
        tabla: 'MAESTRO_RUBRO_FACT',
        staging: 'STG_MAESTRO_RUBRO_FACT',

        columnas: [
            {
                archivo: 0,
                nombre: 'CODIGO_EMPRESA',
                tipo: 'VARCHAR',
                longitud: 10,
                requerido: true
            },
            {
                archivo: 1,
                nombre: 'NOMBRE_EMPRESA',
                tipo: 'VARCHAR',
                longitud: 60,
                requerido: true
            },
            {
                archivo: 2,
                nombre: 'MARCA_EMPRESA',
                tipo: 'VARCHAR',
                longitud: 30,
                requerido: true
            },
            {
                archivo: 3,
                nombre: 'RUBRO_FACTURACION',
                tipo: 'VARCHAR',
                longitud: 30,
                requerido: true
            }
        ],

        clave: [
            'CODIGO_EMPRESA',
            'MARCA_EMPRESA',
            'RUBRO_FACTURACION'
        ]
    },


    /* =========================================================
       TALLES POR MODULO
       IMPORTADOR ESPECIAL
       ========================================================= */

    TALLES_MODULOS: {
        nombre: 'TBL_TALLES_MODULOS',
        archivo: 'TBL_TALLES_MODULOS.TXT',
        tabla: 'MAESTRO_TALLES_MODULOS',
        staging: 'STG_MAESTRO_TALLES_MODULOS'
    }

};


/* =============================================================
   OBTENER RUTA DEL ARCHIVO
   ============================================================= */

function obtenerRutaMaestro(maestro) {

    if (!process.env.MAESTROS_PATH) {

        throw new Error(
            'No está definida MAESTROS_PATH en el archivo .env'
        );
    }


    return path.join(
        process.env.MAESTROS_PATH,
        maestro.archivo
    );
}


module.exports = {
    maestros,
    obtenerRutaMaestro
};