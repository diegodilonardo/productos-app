const express = require('express');
const fs = require('fs');
const path = require('path');

const altasRepository =
    require('../repositories/altas.repository');

const router = express.Router();

const EXTENSIONES = ['.jpg', '.jpeg', '.png'];
const MAX_BYTES = 6 * 1024 * 1024;

/* ============================================================
   CONFIGURACION
   ============================================================ */

function obtenerCarpetaImagenes() {
    const configurada =
        String(
            process.env.IMAGENES_PRODUCTOS_PATH || ''
        ).trim();

    return configurada
        ? path.resolve(configurada)
        : path.resolve(
            process.cwd(),
            'storage',
            'imagenes-productos'
        );
}


function asegurarCarpeta() {
    const carpeta =
        obtenerCarpetaImagenes();

    fs.mkdirSync(
        carpeta,
        { recursive: true }
    );

    return carpeta;
}

function segmentoCarpeta(valor, respaldo) {
    const normalizado = texto(valor)
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^A-Za-z0-9._-]+/g, '_')
        .replace(/^_+|_+$/g, '');
    return normalizado || respaldo;
}

async function obtenerUbicacionOrganizada(idAlta, datos, altaExistente = null) {
    const id = Number(idAlta);
    if (!Number.isInteger(id) || id <= 0) return null;

    const alta = altaExistente || await altasRepository.obtenerAltaPorId(id);
    if (!alta) return null;

    const detalle = await altasRepository.obtenerDetalleAlta(id);
    const producto = detalle.find(item =>
        texto(item.CODIGO_MODELO) === texto(datos.modelo) &&
        texto(item.CODIGO_COLOR) === texto(datos.color)
    );
    const licencia = texto(producto?.LICENCIA) || 'SIN_LICENCIA';

    return path.join(
        asegurarCarpeta(),
        segmentoCarpeta(alta.RAZON_SOCIAL || alta.CODIGO_EMPRESA, `EMPRESA_${alta.ID_EMPRESA}`),
        segmentoCarpeta(alta.DETALLE_MARCA || alta.CODIGO_MARCA, 'SIN_MARCA'),
        segmentoCarpeta(alta.DETALLE_RUBRO || alta.CODIGO_RUBRO, 'SIN_RUBRO'),
        segmentoCarpeta(licencia, 'SIN_LICENCIA')
    );
}


/* ============================================================
   VALIDACIONES
   ============================================================ */

function texto(valor) {
    return String(
        valor === undefined ||
        valor === null
            ? ''
            : valor
    ).trim();
}


function validarSegmento(
    valor,
    nombre
) {
    const dato =
        texto(valor);

    if (!dato) {
        throw new Error(
            `${nombre} es obligatorio.`
        );
    }

    /*
      Los códigos ERP normalmente son alfanuméricos.
      Permitimos punto, guion y guion bajo, pero nunca
      separadores de carpeta ni "..".
    */
    if (
        dato.includes('..') ||
        !/^[A-Za-z0-9._-]+$/.test(dato)
    ) {
        throw new Error(
            `${nombre} contiene caracteres no permitidos.`
        );
    }

    return dato;
}


function obtenerClave(datos) {
    const ano =
        validarSegmento(
            datos.ano,
            'COD_AÑO'
        );

    const temporada =
        validarSegmento(
            datos.temporada,
            'COD_TEM'
        );

    const modelo =
        validarSegmento(
            datos.modelo,
            'COD_MODELO'
        );

    const color =
        validarSegmento(
            datos.color,
            'COD_COLOR'
        );

    return (
        ano +
        temporada +
        modelo +
        color
    );
}


function detectarImagen(buffer) {
    if (
        buffer.length >= 3 &&
        buffer[0] === 0xFF &&
        buffer[1] === 0xD8 &&
        buffer[2] === 0xFF
    ) {
        return {
            extension: '.jpg',
            mime: 'image/jpeg'
        };
    }

    const firmaPng =
        [
            0x89, 0x50, 0x4E, 0x47,
            0x0D, 0x0A, 0x1A, 0x0A
        ];

    if (
        buffer.length >= 8 &&
        firmaPng.every(
            (byte, i) =>
                buffer[i] === byte
        )
    ) {
        return {
            extension: '.png',
            mime: 'image/png'
        };
    }

    throw new Error(
        'El archivo no es una imagen JPG o PNG válida.'
    );
}


function decodificarBase64(valor) {
    const entrada =
        texto(valor)
            .replace(
                /^data:image\/(?:jpeg|jpg|png);base64,/i,
                ''
            );

    if (!entrada) {
        throw new Error(
            'No se recibió contenido de imagen.'
        );
    }

    const buffer =
        Buffer.from(
            entrada,
            'base64'
        );

    if (
        !buffer.length
    ) {
        throw new Error(
            'La imagen está vacía.'
        );
    }

    if (
        buffer.length >
        MAX_BYTES
    ) {
        throw new Error(
            'La imagen supera el máximo permitido de 6 MB.'
        );
    }

    return buffer;
}


/* ============================================================
   ARCHIVOS
   ============================================================ */

function buscarArchivoExistente(
    carpeta,
    clave
) {
    for (
        const extension
        of EXTENSIONES
    ) {
        const nombre =
            clave + extension;

        const archivo =
            path.join(
                carpeta,
                nombre
            );

        if (
            fs.existsSync(
                archivo
            )
        ) {
            return {
                nombre,
                archivo,
                extension
            };
        }
    }

    return null;
}

async function buscarImagenContextual(req, clave) {
    const raiz = asegurarCarpeta();
    const organizada = await obtenerUbicacionOrganizada(req.query.idAlta, queryImagen(req));
    if (organizada) {
        const encontrada = buscarArchivoExistente(organizada, clave);
        if (encontrada) return encontrada;
    }
    return buscarArchivoExistente(raiz, clave);
}


function eliminarVersionesAnteriores(
    carpeta,
    clave
) {
    for (
        const extension
        of EXTENSIONES
    ) {
        const archivo =
            path.join(
                carpeta,
                clave + extension
            );

        if (
            fs.existsSync(
                archivo
            )
        ) {
            fs.unlinkSync(
                archivo
            );
        }
    }
}


function queryImagen(req) {
    return {
        ano:
            req.query.ano,
        temporada:
            req.query.temporada,
        modelo:
            req.query.modelo,
        color:
            req.query.color
    };
}


/* ============================================================
   GET /api/imagenes/estado
   ============================================================ */

router.get(
    '/estado',
    async (req, res) => {
        try {
            const clave =
                obtenerClave(
                    queryImagen(req)
                );

            const existente =
                await buscarImagenContextual(req, clave);

            res.json({
                ok: true,
                existe:
                    Boolean(
                        existente
                    ),
                clave,
                archivo:
                    existente
                        ? existente.nombre
                        : null,
                url:
                    existente
                        ? (
                            '/api/imagenes/archivo?' +
                            new URLSearchParams({
                                idAlta:
                                    texto(req.query.idAlta),
                                ano:
                                    texto(
                                        req.query.ano
                                    ),
                                temporada:
                                    texto(
                                        req.query.temporada
                                    ),
                                modelo:
                                    texto(
                                        req.query.modelo
                                    ),
                                color:
                                    texto(
                                        req.query.color
                                    )
                            })
                                .toString()
                          )
                        : null
            });

        } catch (error) {
            res.status(400).json({
                ok: false,
                mensaje:
                    error.message
            });
        }
    }
);


/* ============================================================
   GET /api/imagenes/archivo
   ============================================================ */

router.get(
    '/archivo',
    async (req, res) => {
        try {
            const clave =
                obtenerClave(
                    queryImagen(req)
                );

            const existente =
                await buscarImagenContextual(req, clave);

            if (
                !existente
            ) {
                return res
                    .status(404)
                    .json({
                        ok: false,
                        mensaje:
                            'Imagen no encontrada.'
                    });
            }

            res.setHeader(
                'Cache-Control',
                'no-cache, no-store, must-revalidate'
            );

            return res.sendFile(
                existente.archivo
            );

        } catch (error) {
            return res
                .status(400)
                .json({
                    ok: false,
                    mensaje:
                        error.message
                });
        }
    }
);


/* ============================================================
   POST /api/imagenes/producto

   BODY:
   {
     ano,
     temporada,
     modelo,
     color,
     contenidoBase64
   }
   ============================================================ */

router.post(
    '/producto',
    async (req, res) => {
        try {
            const idAlta =
                Number(
                    req.body?.idAlta
                );

            if (
                !Number.isInteger(idAlta) ||
                idAlta <= 0
            ) {
                throw new Error(
                    'ID_ALTA inválido para guardar la imagen.'
                );
            }

            const alta =
                await altasRepository
                    .obtenerAltaPorId(
                        idAlta
                    );

            if (!alta) {
                throw new Error(
                    'Alta no encontrada.'
                );
            }

            const estadoAlta =
                texto(
                    alta.ESTADO
                ).toUpperCase();

            if (
                ![
                    'BORRADOR',
                    'VALIDADO'
                ].includes(
                    estadoAlta
                )
            ) {
                throw new Error(
                    `Las imágenes solamente se pueden modificar ` +
                    `cuando el alta está en BORRADOR o VALIDADO. ` +
                    `Estado actual: ${alta.ESTADO}.`
                );
            }

            if (
                texto(
                    alta.CODIGO_ANO
                ) !==
                texto(
                    req.body?.ano
                )
            ) {
                throw new Error(
                    'El año de la imagen no coincide con el alta.'
                );
            }

            if (
                texto(
                    alta.CODIGO_TEMPORADA
                ) !==
                texto(
                    req.body?.temporada
                )
            ) {
                throw new Error(
                    'La temporada de la imagen no coincide con el alta.'
                );
            }

            /*
              En estado VALIDADO la combinación MODELO + COLOR
              debe pertenecer efectivamente a uno de los productos
              del Alta. En BORRADOR permitimos cargar la foto antes
              de agregar el producto.
            */
            if (
                estadoAlta ===
                'VALIDADO'
            ) {
                const detalle =
                    await altasRepository
                        .obtenerDetalleAlta(
                            idAlta
                        );

                const pertenece =
                    (detalle || [])
                        .some(
                            item =>
                                texto(
                                    item.CODIGO_MODELO
                                ) ===
                                texto(
                                    req.body?.modelo
                                ) &&
                                texto(
                                    item.CODIGO_COLOR
                                ) ===
                                texto(
                                    req.body?.color
                                )
                        );

                if (!pertenece) {
                    throw new Error(
                        'La combinación Modelo + Color no pertenece a este Alta validada.'
                    );
                }
            }

            const clave =
                obtenerClave(
                    req.body || {}
                );

            const buffer =
                decodificarBase64(
                    req.body
                        ?.contenidoBase64
                );

            const tipo =
                detectarImagen(
                    buffer
                );

            const carpeta =
                await obtenerUbicacionOrganizada(idAlta, req.body || {}, alta) ||
                asegurarCarpeta();

            fs.mkdirSync(carpeta, { recursive: true });

            /*
              Una sola imagen activa por:
              AÑO + TEMPORADA + MODELO + COLOR.

              Si antes había JPG y ahora llega PNG
              (o viceversa), eliminamos la versión anterior.
            */
            eliminarVersionesAnteriores(
                carpeta,
                clave
            );

            const nombre =
                clave +
                tipo.extension;

            const archivo =
                path.join(
                    carpeta,
                    nombre
                );

            fs.writeFileSync(
                archivo,
                buffer
            );

            res.json({
                ok: true,
                mensaje:
                    'Imagen guardada correctamente.',
                clave,
                archivo:
                    nombre,
                extension:
                    tipo.extension,
                mime:
                    tipo.mime,
                bytes:
                    buffer.length,
                url:
                    '/api/imagenes/archivo?' +
                    new URLSearchParams({
                        idAlta:
                            texto(idAlta),
                        ano:
                            texto(
                                req.body.ano
                            ),
                        temporada:
                            texto(
                                req.body.temporada
                            ),
                        modelo:
                            texto(
                                req.body.modelo
                            ),
                        color:
                            texto(
                                req.body.color
                            )
                    })
                        .toString()
            });

        } catch (error) {
            res.status(400).json({
                ok: false,
                mensaje:
                    error.message
            });
        }
    }
);


module.exports = router;
