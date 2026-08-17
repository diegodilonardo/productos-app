const express =
    require('express');

const router =
    express.Router();

const maestrosService =
    require('../services/maestros.service');


/* ============================================================
   FUNCION AUXILIAR
   ============================================================ */

function crearRutaSimple(
    metodoService
) {

    return async (
        req,
        res
    ) => {

        try {

            const datos =
                await metodoService();


            res.json({
                ok: true,
                cantidad:
                    datos.length,
                datos
            });


        } catch (error) {

            console.error(
                error
            );


            res.status(500).json({

                ok: false,

                mensaje:
                    error.message
            });
        }
    };
}


/* ============================================================
   MAESTROS
   ============================================================ */

router.get(
    '/anos',
    crearRutaSimple(
        maestrosService.obtenerAnos
    )
);


router.get(
    '/marcas',
    crearRutaSimple(
        maestrosService.obtenerMarcas
    )
);


router.get(
    '/rubros',
    crearRutaSimple(
        maestrosService.obtenerRubros
    )
);


router.get(
    '/temporadas',
    crearRutaSimple(
        maestrosService.obtenerTemporadas
    )
);


router.get(
    '/colores',
    crearRutaSimple(
        maestrosService.obtenerColores
    )
);


router.get(
    '/grupos',
    crearRutaSimple(
        maestrosService.obtenerGrupos
    )
);


router.get(
    '/subgrupos',
    crearRutaSimple(
        maestrosService.obtenerSubgrupos
    )
);


router.get(
    '/lineas',
    crearRutaSimple(
        maestrosService.obtenerLineas
    )
);


router.get(
    '/deportes',
    crearRutaSimple(
        maestrosService.obtenerDeportes
    )
);


router.get(
    '/edades',
    crearRutaSimple(
        maestrosService.obtenerEdades
    )
);


router.get(
    '/sexo',
    crearRutaSimple(
        maestrosService.obtenerSexo
    )
);


router.get(
    '/clasificaciones',
    crearRutaSimple(
        maestrosService.obtenerClasificaciones
    )
);


router.get(
    '/paises',
    crearRutaSimple(
        maestrosService.obtenerPaises
    )
);


router.get(
    '/origenes',
    crearRutaSimple(
        maestrosService.obtenerOrigenes
    )
);


router.get(
    '/talles',
    crearRutaSimple(
        maestrosService.obtenerTalles
    )
);


router.get(
    '/talles-modulos',
    crearRutaSimple(
        maestrosService.obtenerTallesModulos
    )
);


/* ============================================================
   MODELOS
   ============================================================ */

router.get(
    '/modelos',

    async (
        req,
        res
    ) => {

        try {

            const marca =
                req.query.marca
                    ? String(
                        req.query.marca
                    ).trim()
                    : null;


            const rubro =
                req.query.rubro
                    ? String(
                        req.query.rubro
                    ).trim()
                    : null;


            const texto =
                req.query.texto
                    ? String(
                        req.query.texto
                    ).trim()
                    : null;


            const datos =
                await maestrosService.buscarModelos({
                    marca,
                    rubro,
                    texto
                });


            res.json({

                ok: true,

                cantidad:
                    datos.length,

                filtros: {
                    marca,
                    rubro,
                    texto
                },

                datos
            });


        } catch (error) {

            console.error(
                error
            );


            res.status(500).json({

                ok: false,

                mensaje:
                    error.message
            });
        }
    }
);


module.exports =
    router;