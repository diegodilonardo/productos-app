const {
    maestros
} = require('../config/masters');

const {
    importarMaestroGenerico
} = require('./importadorGenerico.service');

const {
    importarTallesModulos
} = require('./importarTallesModulos.service');


/* =============================================================
   IMPORTAR TODOS LOS MAESTROS
   ============================================================= */

async function importarTodosLosMaestros() {

    const resultados = [];


    /* =========================================================
       MAESTROS GENERICOS
       ========================================================= */

    const configuraciones = [

        [
            'ANOS',
            maestros.ANOS
        ],

        [
            'COLORES',
            maestros.COLORES
        ],

        [
            'CLASIFICACION',
            maestros.CLASIFICACION
        ],

        [
            'DEPORTES',
            maestros.DEPORTES
        ],

        [
            'EDADES',
            maestros.EDADES
        ],

        [
            'GRUPOS',
            maestros.GRUPOS
        ],

        [
            'LINEA',
            maestros.LINEA
        ],

        [
            'MARCAS',
            maestros.MARCAS
        ],

        [
            'MODELOS',
            maestros.MODELOS
        ],

        [
            'ORIGENES',
            maestros.ORIGENES
        ],

        [
            'PAISES',
            maestros.PAISES
        ],

        [
            'RUBROS',
            maestros.RUBROS
        ],

        [
            'SUBGRUPOS',
            maestros.SUBGRUPOS
        ],

        [
            'TALLES',
            maestros.TALLES
        ],

        [
            'TEMPORADAS',
            maestros.TEMPORADAS
        ],

        [
            'SEXO',
            maestros.SEXO
        ],

        [
            'RUBRO_FACT',
            maestros.RUBRO_FACT
        ]
    ];


    /* =========================================================
       PROCESAR MAESTROS GENERICOS
       ========================================================= */

    for (
        const [
            nombreConfig,
            maestro
        ]
        of configuraciones
    ) {

        /* -----------------------------------------------------
           VALIDAR CONFIGURACION
           ----------------------------------------------------- */

        if (!maestro) {

            console.error(
                `No existe la configuración ` +
                `"${nombreConfig}" ` +
                `en config/masters.js`
            );


            resultados.push({

                maestro:
                    nombreConfig,

                estado:
                    'ERROR',

                error:
                    `Configuración ` +
                    `"${nombreConfig}" ` +
                    `no definida en masters.js`
            });


            continue;
        }


        /* -----------------------------------------------------
           IMPORTAR
           ----------------------------------------------------- */

        try {

            console.log(
                `Procesando ` +
                `${maestro.nombre}...`
            );


            const resultado =
                await importarMaestroGenerico(
                    maestro
                );


            resultados.push(
                resultado
            );


        } catch (error) {

            resultados.push({

                maestro:
                    maestro.nombre,

                estado:
                    'ERROR',

                error:
                    error.message
            });
        }
    }


    /* =========================================================
       TALLES POR MODULO
       IMPORTADOR ESPECIAL
       ========================================================= */

    try {

        console.log(
            'Procesando TBL_TALLES_MODULOS...'
        );


        const resultadoModulos =
            await importarTallesModulos();


        resultados.push(
            resultadoModulos
        );


    } catch (error) {

        resultados.push({

            maestro:
                'TBL_TALLES_MODULOS',

            estado:
                'ERROR',

            error:
                error.message
        });
    }


    /* =========================================================
       RESULTADOS
       ========================================================= */

    return resultados;
}


module.exports = {
    importarTodosLosMaestros
};