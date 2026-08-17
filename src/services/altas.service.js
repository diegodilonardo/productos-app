const crypto = require('crypto');

const altasRepository =
    require('../repositories/altas.repository');


/* ============================================================
   UTILIDADES
   ============================================================ */

function normalizarTexto(valor) {

    if (
        valor === undefined ||
        valor === null
    ) {
        return '';
    }

    return String(valor).trim();
}


function normalizarEspacios(texto) {

    return String(texto || '')
        .replace(/\s+/g, ' ')
        .trim();
}


function normalizarTipoProducto(valor) {

    return normalizarTexto(valor)
        .toUpperCase()
        .replace(/\s+/g, '_')
        .replace(/-+/g, '_');
}


function validarId(idAlta) {

    const id = Number(idAlta);

    if (
        !Number.isInteger(id) ||
        id <= 0
    ) {

        throw new Error(
            'ID_ALTA inválido.'
        );
    }

    return id;
}


/* ============================================================
   CODIGO ALTA
   ============================================================ */

function generarCodigoAlta() {

    const ahora = new Date();

    const yyyy =
        ahora.getFullYear();

    const mm =
        String(
            ahora.getMonth() + 1
        ).padStart(
            2,
            '0'
        );

    const dd =
        String(
            ahora.getDate()
        ).padStart(
            2,
            '0'
        );

    const aleatorio =
        crypto
            .randomUUID()
            .replaceAll('-', '')
            .substring(0, 8)
            .toUpperCase();


    return (
        `ALT-${yyyy}${mm}${dd}-${aleatorio}`
    );
}


/* ============================================================
   CREAR CABECERA
   ============================================================ */

async function crearAlta(
    datosEntrada
) {

    const codigoMarca =
        normalizarTexto(
            datosEntrada.codigoMarca
        );


    const codigoRubro =
        normalizarTexto(
            datosEntrada.codigoRubro
        );


    const tipoProducto =
        normalizarTipoProducto(
            datosEntrada.tipoProducto
        );


    const codigoTemporada =
        normalizarTexto(
            datosEntrada.codigoTemporada
        );


    const codigoAno =
        normalizarTexto(
            datosEntrada.codigoAno
        );


    const usuarioCreacion =
        normalizarTexto(
            datosEntrada.usuario
        ) || 'SISTEMA';


    /* ========================================================
       VALIDACIONES
       ======================================================== */

    if (!codigoMarca) {

        throw new Error(
            'Debe seleccionar una marca.'
        );
    }


    if (!codigoRubro) {

        throw new Error(
            'Debe seleccionar un rubro.'
        );
    }


    if (!codigoTemporada) {

        throw new Error(
            'Debe seleccionar una temporada.'
        );
    }


    if (!codigoAno) {

        throw new Error(
            'Debe seleccionar un año.'
        );
    }


    if (
        ![
            'MODULO',
            'PAR_SUELTO'
        ].includes(
            tipoProducto
        )
    ) {

        throw new Error(
            'TIPO_PRODUCTO debe ser MODULO o PAR_SUELTO.'
        );
    }


    /* ========================================================
       BUSCAR MAESTROS
       ======================================================== */

    const [
        marca,
        rubro,
        temporada,
        ano
    ] = await Promise.all([

        altasRepository.buscarMarca(
            codigoMarca
        ),

        altasRepository.buscarRubro(
            codigoRubro
        ),

        altasRepository.buscarTemporada(
            codigoTemporada
        ),

        altasRepository.buscarAno(
            codigoAno
        )
    ]);


    if (!marca) {

        throw new Error(
            `Marca ${codigoMarca} inexistente o inactiva.`
        );
    }


    if (!rubro) {

        throw new Error(
            `Rubro ${codigoRubro} inexistente o inactivo.`
        );
    }


    if (!temporada) {

        throw new Error(
            `Temporada ${codigoTemporada} inexistente o inactiva.`
        );
    }


    if (!ano) {

        throw new Error(
            `Año ${codigoAno} inexistente o inactivo.`
        );
    }


    /* ========================================================
       CREAR ALTA
       ======================================================== */

    return altasRepository.crearAlta({

        codigoAlta:
            generarCodigoAlta(),

        codigoMarca:
            marca.CODIGO_MARCA,

        detalleMarca:
            marca.DETALLE_MARCA,

        codigoRubro:
            rubro.CODIGO_RUBRO,

        detalleRubro:
            rubro.DETALLE_RUBRO,

        tipoProducto,

        codigoTemporada:
            temporada.CODIGO_TEMPORADA,

        detalleTemporada:
            temporada.DETALLE_TEMPORADA,

        codigoAno:
            ano.CODIGO_ANO,

        usuarioCreacion
    });
}


/* ============================================================
   LISTAR ALTAS
   ============================================================ */

async function listarAltas() {

    return altasRepository
        .listarAltas();
}


/* ============================================================
   OBTENER ALTA
   ============================================================ */

async function obtenerAlta(
    idAlta
) {

    const id =
        validarId(
            idAlta
        );


    const alta =
        await altasRepository
            .obtenerAltaPorId(
                id
            );


    if (!alta) {

        return null;
    }


    const detalle =
        await altasRepository
            .obtenerDetalleAlta(
                id
            );


    return {

        ...alta,

        detalle
    };
}


/* ============================================================
   RUBRO FACTURACION
   ============================================================ */

function determinarRubroFact(
    marca,
    rubro,
    codigoClasificacion,
    tipoProductoDetalle = null
) {

    const marcaNormalizada =
        normalizarTexto(marca).toUpperCase();

    const rubroNormalizado =
        normalizarTexto(rubro).toUpperCase();

    if (marcaNormalizada !== 'ATOMIK') {
        throw new Error(
            `No existe todavía una regla de RUBRO_FACT ` +
            `definida para la marca ${marca}.`
        );
    }

    const tipoNormalizado =
        tipoProductoDetalle
            ? normalizarTipoProducto(tipoProductoDetalle)
            : null;

    /* PRIMERA y SEGUNDA son ambos productos PAR_SUELTO.
       Si no se informa el tipo, mantenemos compatibilidad con
       la lógica anterior. */
    const esParSuelto =
        tipoNormalizado
            ? tipoNormalizado === 'PAR_SUELTO'
            : ['1', '2'].includes(codigoClasificacion);

    if (rubroNormalizado === 'CALZADO') {
        return esParSuelto
            ? 'CALZ_ATK'
            : 'MOD_CALZ_ATK';
    }

    if (rubroNormalizado === 'INDUMENTARIA') {
        return esParSuelto
            ? 'INDU_ATK'
            : 'MOD_INDU_ATK';
    }

    if (rubroNormalizado === 'ACCESORIOS') {
        return esParSuelto
            ? 'ACCE_ATK'
            : 'MOD_ACCE_ATK';
    }

    if (rubroNormalizado === 'POP') {
        if (!esParSuelto) {
            throw new Error(
                'No está definida una regla de RUBRO_FACT para módulos POP.'
            );
        }

        return 'POP_ATK';
    }

    throw new Error(
        `No existe regla de RUBRO_FACT para ${marca} / ${rubro}.`
    );
}

/* ============================================================
   VALIDAR CLASIFICACION
   ============================================================ */

function validarClasificacion(
    tipoProducto,
    codigoClasificacion
) {

    const tipo =
        normalizarTipoProducto(
            tipoProducto
        );


    /* ========================================================
       PAR SUELTO
       ======================================================== */

    if (
        tipo ===
        'PAR_SUELTO'
    ) {

        if (
            codigoClasificacion !==
            '1'
        ) {

            throw new Error(
                'PAR_SUELTO solamente admite ' +
                'clasificación 1 - PRIMERA.'
            );
        }


        return;
    }


    /* ========================================================
       MODULO
       ======================================================== */

    const permitidasModulo = [

        '0',
        '3',
        '4',
        '5',
        '6',
        '7',
        '8',
        '9'
    ];


    if (
        !permitidasModulo.includes(
            codigoClasificacion
        )
    ) {

        throw new Error(
            'Clasificación inválida para MODULO.'
        );
    }
}


/* ============================================================
   CODIGO ALFA
   ============================================================ */

function construirCodigoAlfa({
    alta,
    modelo,
    clasificacion,
    color,
    codigoModulo,
    detalleTalle,
    tipoProductoDetalle = null
}) {

    const tipoProducto =
        normalizarTipoProducto(
            tipoProductoDetalle || alta.TIPO_PRODUCTO
        );

    const ultimoSegmento =
        tipoProducto === 'MODULO'
            ? codigoModulo
            : detalleTalle;

    return [
        alta.CODIGO_ANO,
        alta.CODIGO_TEMPORADA,
        alta.CODIGO_RUBRO,
        modelo.CODIGO_MODELO,
        clasificacion.CODIGO_CLASIFICACION,
        color.CODIGO_COLOR,
        ultimoSegmento
    ].join('');
}

/* ============================================================
   MAPA TALLES MODULO
   ============================================================ */

const mapaTallesModulo = [

    ['T01', '01'],
    ['T02', '02'],
    ['T03', '03'],
    ['T04', '04'],
    ['T05', '05'],
    ['T06', '06'],
    ['T07', '07'],
    ['T08', '08'],

    ['T10', '10'],
    ['T12', '12'],
    ['T14', '14'],
    ['T15', '15'],
    ['T16', '16'],
    ['T17', '17'],
    ['T18', '18'],
    ['T19', '19'],

    ['T20', '20'],
    ['T21', '21'],
    ['T22', '22'],
    ['T23', '23'],
    ['T24', '24'],
    ['T25', '25'],
    ['T26', '26'],
    ['T27', '27'],
    ['T28', '28'],
    ['T29', '29'],

    ['T30', '30'],
    ['T31', '31'],
    ['T32', '32'],
    ['T33', '33'],
    ['T34', '34'],
    ['T35', '35'],
    ['T36', '36'],
    ['T37', '37'],
    ['T38', '38'],
    ['T385', '38.5'],
    ['T39', '39'],
    ['T395', '39.5'],

    ['T40', '40'],
    ['T405', '40.5'],
    ['T41', '41'],
    ['T415', '41.5'],
    ['T42', '42'],
    ['T425', '42.5'],
    ['T43', '43'],
    ['T435', '43.5'],
    ['T44', '44'],
    ['T445', '44.5'],
    ['T45', '45'],
    ['T455', '45.5'],

    ['T46', '46'],
    ['T47', '47'],
    ['T48', '48'],
    ['T49', '49'],
    ['T50', '50'],

    ['T_XS', 'XS'],
    ['T_S', 'S'],
    ['T_M', 'M'],
    ['T_L', 'L'],
    ['T_XL', 'XL'],
    ['T_2XL', '2XL'],
    ['T_3XL', '3XL']
];


/* ============================================================
   DESCRIPCION COMPACTA MODULO
   ============================================================ */

function construirDescripcionModuloCompacta(
    modulo
) {

    const tallesActivos = [];


    for (
        const [
            columna,
            talle
        ]
        of mapaTallesModulo
    ) {

        const cantidad =
            Number(
                modulo[columna] || 0
            );


        if (
            cantidad > 0
        ) {

            tallesActivos.push({

                talle,

                cantidad
            });
        }
    }


    if (
        tallesActivos.length === 0
    ) {

        return (
            `${modulo.PARES}P`
        );
    }


    const primerTalle =
        tallesActivos[0]
            .talle;


    const ultimoTalle =
        tallesActivos[
            tallesActivos.length - 1
        ].talle;


    const cantidades =
        tallesActivos
            .map(
                item =>
                    item.cantidad
            )
            .join(',');


    return (
        `${primerTalle}-${ultimoTalle} ` +
        `(${cantidades}) ` +
        `${modulo.PARES}P`
    );
}


/* ============================================================
   DETALLE PRODUCTO
   ============================================================ */

function construirDetalleProducto({
    alta,
    modelo,
    color,
    clasificacion,
    modulo,
    talle
}) {

    const tipoProducto =
        normalizarTipoProducto(
            alta.TIPO_PRODUCTO
        );


    let detalle;


    /* ========================================================
       MODULO

       Ejemplo:
       FAIRFAXX NEGRO 35-40 (1,2,3,3,2,1) 12P
       ======================================================== */

    if (
        tipoProducto ===
        'MODULO'
    ) {

        const curvaCompacta =
            construirDescripcionModuloCompacta(
                modulo
            );


        detalle =
            normalizarEspacios(
                [
                    modelo.DETALLE_MODELO,
                    color.DETALLE_COLOR,
                    curvaCompacta
                ].join(' ')
            );
    }


    /* ========================================================
       PAR SUELTO

       Ejemplo:
       FAIRFAXX NEGRO PRIMERA 34
       ======================================================== */

    else {

        detalle =
            normalizarEspacios(
                [
                    modelo.DETALLE_MODELO,
                    color.DETALLE_COLOR,
                    clasificacion
                        .DETALLE_CLASIFICACION,
                    talle.DETALLE_TALLE
                ].join(' ')
            );
    }


    /* ========================================================
       LIMITE ERP
       ======================================================== */

    if (
        detalle.length > 50
    ) {

        detalle =
            detalle
                .substring(
                    0,
                    50
                )
                .trim();
    }


    return detalle;
}


/* ============================================================
   AGREGAR DETALLE

   REGLAS:
   - MODULO: crea módulo + PRIMERAS + SEGUNDAS por talle activo.
   - PAR_SUELTO: crea PRIMERA + SEGUNDA.
   - Los productos automáticos existentes en ERP o en el lote se omiten.
   - El producto principal solicitado por el usuario nunca se omite:
     si ya existe, se informa error.
   ============================================================ */

async function prepararDetalleProducto(
    idAlta,
    datosEntrada,
    contexto = {}
) {

    const id = validarId(idAlta);

    const alta =
        await altasRepository.obtenerAltaPorId(id);

    if (!alta) {
        throw new Error('Alta no encontrada.');
    }

    if (alta.ESTADO !== 'BORRADOR') {
        throw new Error(
            `El alta está en estado ${alta.ESTADO}. ` +
            `Solamente se pueden agregar productos a un alta BORRADOR.`
        );
    }

    const tipoProducto =
        normalizarTipoProducto(alta.TIPO_PRODUCTO);

    if (!['MODULO', 'PAR_SUELTO'].includes(tipoProducto)) {
        throw new Error(
            `TIPO_PRODUCTO inválido en el alta: ` +
            `"${alta.TIPO_PRODUCTO}" (normalizado: "${tipoProducto}").`
        );
    }

    const codigoModelo = normalizarTexto(datosEntrada.codigoModelo);
    const codigoGrupo = normalizarTexto(datosEntrada.codigoGrupo);
    const codigoSubgrupo = normalizarTexto(datosEntrada.codigoSubgrupo);
    const codigoLinea = normalizarTexto(datosEntrada.codigoLinea);
    const codigoDeporte = normalizarTexto(datosEntrada.codigoDeporte);
    const codigoEdad = normalizarTexto(datosEntrada.codigoEdad);
    const sexo = normalizarTexto(datosEntrada.sexo).toUpperCase();
    const codigoPais = normalizarTexto(datosEntrada.codigoPais);
    const codigoModulo = normalizarTexto(datosEntrada.codigoModulo);
    const codigoTalle = normalizarTexto(datosEntrada.codigoTalle);
    const usuario = normalizarTexto(datosEntrada.usuario) || 'SISTEMA';

    let codigoClasificacion;

    if (tipoProducto === 'PAR_SUELTO') {
        codigoClasificacion = '1';
    } else {
        codigoClasificacion =
            normalizarTexto(datosEntrada.codigoClasificacion);
    }

    let codigosColor = [];

    if (Array.isArray(datosEntrada.codigosColor)) {
        codigosColor =
            datosEntrada.codigosColor
                .map(normalizarTexto)
                .filter(Boolean);
    } else {
        const codigoColor =
            normalizarTexto(datosEntrada.codigoColor);

        if (codigoColor) {
            codigosColor = [codigoColor];
        }
    }

    codigosColor = [...new Set(codigosColor)];

    const obligatorios = [
        [codigoModelo, 'Debe seleccionar un modelo.'],
        [codigoGrupo, 'Debe seleccionar un grupo.'],
        [codigoSubgrupo, 'Debe seleccionar un subgrupo.'],
        [codigoLinea, 'Debe seleccionar una línea.'],
        [codigoDeporte, 'Debe seleccionar un deporte.'],
        [codigoEdad, 'Debe seleccionar una edad.'],
        [sexo, 'Debe seleccionar sexo.'],
        [codigoPais, 'Debe seleccionar país.']
    ];

    for (const [valor, mensaje] of obligatorios) {
        if (!valor) {
            throw new Error(mensaje);
        }
    }

    if (tipoProducto === 'MODULO' && !codigoClasificacion) {
        throw new Error('Debe seleccionar clasificación.');
    }

    if (codigosColor.length === 0) {
        throw new Error('Debe seleccionar al menos un color.');
    }

    if (tipoProducto === 'MODULO' && !codigoModulo) {
        throw new Error('Debe seleccionar una curva/módulo.');
    }

    if (tipoProducto === 'PAR_SUELTO' && !codigoTalle) {
        throw new Error('Debe seleccionar un talle.');
    }

    validarClasificacion(tipoProducto, codigoClasificacion);

    const [
        modelo,
        grupo,
        subgrupo,
        linea,
        deporte,
        edad,
        sexoMaestro,
        clasificacionPrincipal,
        clasificacionPrimera,
        clasificacionSegunda,
        pais
    ] = await Promise.all([
        altasRepository.buscarModelo(
            codigoModelo,
            alta.DETALLE_MARCA,
            alta.DETALLE_RUBRO
        ),
        altasRepository.buscarGrupo(codigoGrupo),
        altasRepository.buscarSubgrupo(codigoSubgrupo),
        altasRepository.buscarLinea(codigoLinea),
        altasRepository.buscarDeporte(codigoDeporte),
        altasRepository.buscarEdad(codigoEdad),
        altasRepository.buscarSexo(sexo),
        altasRepository.buscarClasificacion(codigoClasificacion),
        altasRepository.buscarClasificacion('1'),
        altasRepository.buscarClasificacion('2'),
        altasRepository.buscarPais(codigoPais)
    ]);

    if (!modelo) {
        throw new Error(
            'El modelo no existe, está inactivo o no corresponde a la marca/rubro del alta.'
        );
    }
    if (!grupo) throw new Error('Grupo inexistente o inactivo.');
    if (!subgrupo) throw new Error('Subgrupo inexistente o inactivo.');
    if (!linea) throw new Error('Línea inexistente o inactiva.');
    if (!deporte) throw new Error('Deporte inexistente o inactivo.');
    if (!edad) throw new Error('Edad inexistente o inactiva.');
    if (!sexoMaestro) throw new Error('Sexo inexistente o inactivo.');
    if (!clasificacionPrincipal) {
        throw new Error(
            `No se encontró la clasificación ${codigoClasificacion} en el maestro.`
        );
    }
    if (!clasificacionPrimera) {
        throw new Error('No se encontró la clasificación 1 - PRIMERA en el maestro.');
    }
    if (!clasificacionSegunda) {
        throw new Error('No se encontró la clasificación 2 - SEGUNDA en el maestro.');
    }
    if (!pais) throw new Error('País inexistente o inactivo.');

    const codigoOrigen =
        normalizarTexto(pais.DETALLE_PAIS).toUpperCase() === 'ARGENTINA'
            ? '1'
            : '2';

    const origen =
        await altasRepository.buscarOrigen(codigoOrigen);

    if (!origen) {
        throw new Error(`No se encontró el origen ${codigoOrigen}.`);
    }

    let modulo = null;
    let tallePrincipal = null;

    if (tipoProducto === 'MODULO') {
        modulo =
            await altasRepository.buscarModulo(codigoModulo);

        if (!modulo) {
            throw new Error(
                'La curva seleccionada no existe, está inactiva o es inconsistente.'
            );
        }
    } else {
        tallePrincipal =
            await altasRepository.buscarTalle(codigoTalle);

        if (!tallePrincipal) {
            throw new Error(
                `El talle "${codigoTalle}" no existe o está inactivo.`
            );
        }
    }

    const rubroFactPrincipal =
        determinarRubroFact(
            alta.DETALLE_MARCA,
            alta.DETALLE_RUBRO,
            clasificacionPrincipal.CODIGO_CLASIFICACION,
            tipoProducto
        );

    const rubroFactSuelto =
        determinarRubroFact(
            alta.DETALLE_MARCA,
            alta.DETALLE_RUBRO,
            '1',
            'PAR_SUELTO'
        );

    const [rubroFactPrincipalMaestro, rubroFactSueltoMaestro] =
        await Promise.all([
            altasRepository.buscarRubroFacturacion(
                alta.DETALLE_MARCA,
                rubroFactPrincipal
            ),
            altasRepository.buscarRubroFacturacion(
                alta.DETALLE_MARCA,
                rubroFactSuelto
            )
        ]);

    if (!rubroFactPrincipalMaestro) {
        throw new Error(
            `El RUBRO_FACT calculado "${rubroFactPrincipal}" ` +
            `no existe activo en MAESTRO_RUBRO_FACT.`
        );
    }

    if (!rubroFactSueltoMaestro) {
        throw new Error(
            `El RUBRO_FACT de pares sueltos "${rubroFactSuelto}" ` +
            `no existe activo en MAESTRO_RUBRO_FACT.`
        );
    }

    const colores = [];

    for (const codigoColor of codigosColor) {
        const color =
            await altasRepository.buscarColor(codigoColor);

        if (!color) {
            throw new Error(
                `Color ${codigoColor} inexistente o inactivo.`
            );
        }

        colores.push(color);
    }

    /* Talles que se deben generar en forma automática. */
    let tallesAutomaticos = [];

    if (tipoProducto === 'MODULO') {
        for (const [columna, talleVisible] of mapaTallesModulo) {
            const cantidad = Number(modulo[columna] || 0);

            if (cantidad <= 0) {
                continue;
            }

            let talleMaestro =
                await altasRepository.buscarTalle(columna);

            /* Fallback por si algún maestro usa el talle visible como código. */
            if (!talleMaestro) {
                talleMaestro =
                    await altasRepository.buscarTalle(talleVisible);
            }

            if (!talleMaestro) {
                throw new Error(
                    `La curva ${modulo.CODIGO_MODULO} contiene el talle ` +
                    `${talleVisible}, pero no existe activo en MAESTRO_TALLES.`
                );
            }

            tallesAutomaticos.push({
                ...talleMaestro,
                CANTIDAD_EN_MODULO: cantidad
            });
        }

        if (tallesAutomaticos.length === 0) {
            throw new Error(
                `La curva ${modulo.CODIGO_MODULO} no contiene talles con cantidad mayor a cero.`
            );
        }
    } else {
        tallesAutomaticos = [tallePrincipal];
    }

    const detallesAGuardar = [];
    const codigosGenerados =
        contexto.codigosGenerados || new Set();

    const omitidos = [];

    function armarObjetoDetalle({
        color,
        clasificacion,
        tipoDetalle,
        talle = null,
        moduloDetalle = null,
        pares,
        rubroFact,
        codigoAlfa,
        detalleProducto,
        claveTemporal,
        padreTemporal,
        generadoAutomatico,
        estadoValidacion = 'VALIDO',
        observacionValidacion = null
    }) {
        return {
            CLAVE_TEMPORAL: claveTemporal,
            PADRE_TEMPORAL: padreTemporal,

            CODIGO_MODELO: modelo.CODIGO_MODELO,
            DETALLE_MODELO: modelo.DETALLE_MODELO,
            LICENCIA: modelo.LICENCIA || null,
            CODIGO_GRUPO: grupo.CODIGO_GRUPO,
            DETALLE_GRUPO: grupo.DETALLE_GRUPO,
            CODIGO_SUBGRUPO: subgrupo.CODIGO_SUBGRUPO,
            DETALLE_SUBGRUPO: subgrupo.DETALLE_SUBGRUPO,
            CODIGO_LINEA: linea.CODIGO_LINEA,
            DETALLE_LINEA: linea.DETALLE_LINEA,
            CODIGO_DEPORTE: deporte.CODIGO_DEPORTE,
            DETALLE_DEPORTE: deporte.DETALLE_DEPORTE,
            CODIGO_COLOR: color.CODIGO_COLOR,
            DETALLE_COLOR: color.DETALLE_COLOR,
            CODIGO_EDAD: edad.CODIGO_EDAD,
            DETALLE_EDAD: edad.DETALLE_EDAD,
            SEXO: sexoMaestro.SEXO,
            CODIGO_CLASIFICACION: clasificacion.CODIGO_CLASIFICACION,
            DETALLE_CLASIFICACION: clasificacion.DETALLE_CLASIFICACION,
            CODIGO_MODULO:
                tipoDetalle === 'MODULO' && moduloDetalle
                    ? moduloDetalle.CODIGO_MODULO
                    : null,
            DETALLE_MODULO:
                tipoDetalle === 'MODULO' && moduloDetalle
                    ? moduloDetalle.DETALLE_MODULO
                    : null,
            CODIGO_TALLE:
                tipoDetalle === 'PAR_SUELTO' && talle
                    ? talle.DETALLE_TALLE
                    : null,
            DETALLE_TALLE:
                tipoDetalle === 'PAR_SUELTO' && talle
                    ? talle.DETALLE_TALLE
                    : null,
            PARES: pares,
            CODIGO_PAIS: pais.CODIGO_PAIS,
            DETALLE_PAIS: pais.DETALLE_PAIS,
            CODIGO_ORIGEN: origen.CODIGO_ORIGEN,
            DETALLE_ORIGEN: origen.DETALLE_ORIGEN,
            RUBRO_FACT: rubroFact,
            CODIGO_ALFA: codigoAlfa,
            DETALLE_PRODUCTO: detalleProducto,
            NIVEL: tipoDetalle === 'MODULO' ? 950 : 900,
            TIPO_PRODUCTO_DETALLE: tipoDetalle,
            GENERADO_AUTOMATICO: generadoAutomatico,
            ESTADO_VALIDACION: estadoValidacion,
            OBSERVACION_VALIDACION: observacionValidacion
        };
    }

    function observacionExisteERP(existenteERP) {
        const partes = ['Ya existe en Presea'];

        if (existenteERP?.CODIGO) {
            partes.push(`Código ERP: ${existenteERP.CODIGO}`);
        }

        if (existenteERP?.CODIGO_EAN) {
            partes.push(`EAN: ${existenteERP.CODIGO_EAN}`);
        }

        return partes.join(' | ');
    }

    async function validarPrincipal(codigoAlfa, tipoDetalle) {
        if (codigosGenerados.has(codigoAlfa)) {
            throw new Error(
                `CODIGO_ALFA duplicado en la operación: ${codigoAlfa}.`
            );
        }

        const existenteLote =
            await altasRepository.buscarDetallePorCodigoAlfa(
                id,
                codigoAlfa
            );

        if (existenteLote) {
            throw new Error(
                `El producto ${codigoAlfa} ya existe dentro de esta alta.`
            );
        }

        const existenteOtraAlta =
            await altasRepository.buscarCodigoAlfaEnOtraAlta(
                id,
                codigoAlfa
            );

        if (existenteOtraAlta) {
            throw new Error(
                `El producto ${codigoAlfa} ya se encuentra en el alta ` +
                `${existenteOtraAlta.CODIGO_ALTA} ` +
                `(ID_ALTA ${existenteOtraAlta.ID_ALTA}), ` +
                `estado ${existenteOtraAlta.ESTADO_ALTA}.`
            );
        }

        const existenteERP =
            await altasRepository.buscarProductoERP(
                tipoDetalle,
                codigoAlfa
            );

        codigosGenerados.add(codigoAlfa);

        return existenteERP || null;
    }

    async function agregarAutomaticoSiCorresponde({
        color,
        talle,
        clasificacion,
        padreTemporal,
        sufijoClave
    }) {
        const codigoAlfa =
            construirCodigoAlfa({
                alta,
                modelo,
                clasificacion,
                color,
                codigoModulo: null,
                detalleTalle: talle.DETALLE_TALLE,
                tipoProductoDetalle: 'PAR_SUELTO'
            });

        if (codigosGenerados.has(codigoAlfa)) {
            omitidos.push({
                codigoAlfa,
                motivo: 'DUPLICADO_OPERACION'
            });
            return;
        }

        const existenteLote =
            await altasRepository.buscarDetallePorCodigoAlfa(
                id,
                codigoAlfa
            );

        if (existenteLote) {
            omitidos.push({
                codigoAlfa,
                motivo: 'YA_EXISTE_EN_ALTA'
            });
            return;
        }

        const existenteOtraAlta =
            await altasRepository.buscarCodigoAlfaEnOtraAlta(
                id,
                codigoAlfa
            );

        if (existenteOtraAlta) {
            omitidos.push({
                codigoAlfa,
                motivo: 'YA_EXISTE_EN_OTRA_ALTA',
                idAltaExistente: existenteOtraAlta.ID_ALTA,
                codigoAltaExistente: existenteOtraAlta.CODIGO_ALTA,
                estadoAltaExistente: existenteOtraAlta.ESTADO_ALTA
            });
            return;
        }

        const existenteERP =
            await altasRepository.buscarProductoERP(
                'PAR_SUELTO',
                codigoAlfa
            );

        codigosGenerados.add(codigoAlfa);

        const detalleProducto =
            construirDetalleProducto({
                alta: {
                    ...alta,
                    TIPO_PRODUCTO: 'PAR_SUELTO'
                },
                modelo,
                color,
                clasificacion,
                modulo: null,
                talle
            });

        detallesAGuardar.push(
            armarObjetoDetalle({
                color,
                clasificacion,
                tipoDetalle: 'PAR_SUELTO',
                talle,
                moduloDetalle: null,
                pares: 1,
                rubroFact: rubroFactSuelto,
                codigoAlfa,
                detalleProducto,
                claveTemporal:
                    `${padreTemporal}_${sufijoClave}_${talle.DETALLE_TALLE}`,
                padreTemporal,
                generadoAutomatico: true,
                estadoValidacion:
                    existenteERP ? 'EXISTE_ERP' : 'VALIDO',
                observacionValidacion:
                    existenteERP
                        ? observacionExisteERP(existenteERP)
                        : null
            })
        );
    }

    for (const color of colores) {
        if (tipoProducto === 'MODULO') {
            const codigoAlfaModulo =
                construirCodigoAlfa({
                    alta,
                    modelo,
                    clasificacion: clasificacionPrincipal,
                    color,
                    codigoModulo: modulo.CODIGO_MODULO,
                    detalleTalle: null,
                    tipoProductoDetalle: 'MODULO'
                });

            const existenteERPModulo =
                await validarPrincipal(
                    codigoAlfaModulo,
                    'MODULO'
                );

            const detalleModulo =
                construirDetalleProducto({
                    alta: {
                        ...alta,
                        TIPO_PRODUCTO: 'MODULO'
                    },
                    modelo,
                    color,
                    clasificacion: clasificacionPrincipal,
                    modulo,
                    talle: null
                });

            const prefijoClave =
                contexto.prefijoClave || modelo.CODIGO_MODELO;

            const claveModulo =
                `${prefijoClave}_MOD_${color.CODIGO_COLOR}_${modulo.CODIGO_MODULO}`;

            detallesAGuardar.push(
                armarObjetoDetalle({
                    color,
                    clasificacion: clasificacionPrincipal,
                    tipoDetalle: 'MODULO',
                    talle: null,
                    moduloDetalle: modulo,
                    pares: Number(modulo.PARES),
                    rubroFact: rubroFactPrincipal,
                    codigoAlfa: codigoAlfaModulo,
                    detalleProducto: detalleModulo,
                    claveTemporal: claveModulo,
                    padreTemporal: null,
                    generadoAutomatico: false,
                    estadoValidacion:
                        existenteERPModulo ? 'EXISTE_ERP' : 'VALIDO',
                    observacionValidacion:
                        existenteERPModulo
                            ? observacionExisteERP(existenteERPModulo)
                            : null
                })
            );

            for (const talle of tallesAutomaticos) {
                await agregarAutomaticoSiCorresponde({
                    color,
                    talle,
                    clasificacion: clasificacionPrimera,
                    padreTemporal: claveModulo,
                    sufijoClave: 'PRI'
                });

                await agregarAutomaticoSiCorresponde({
                    color,
                    talle,
                    clasificacion: clasificacionSegunda,
                    padreTemporal: claveModulo,
                    sufijoClave: 'SEG'
                });
            }
        } else {
            const codigoAlfaPrimera =
                construirCodigoAlfa({
                    alta,
                    modelo,
                    clasificacion: clasificacionPrimera,
                    color,
                    codigoModulo: null,
                    detalleTalle: tallePrincipal.DETALLE_TALLE,
                    tipoProductoDetalle: 'PAR_SUELTO'
                });

            const existenteERPPrimera =
                await validarPrincipal(
                    codigoAlfaPrimera,
                    'PAR_SUELTO'
                );

            const detallePrimera =
                construirDetalleProducto({
                    alta: {
                        ...alta,
                        TIPO_PRODUCTO: 'PAR_SUELTO'
                    },
                    modelo,
                    color,
                    clasificacion: clasificacionPrimera,
                    modulo: null,
                    talle: tallePrincipal
                });

            const prefijoClave =
                contexto.prefijoClave || modelo.CODIGO_MODELO;

            const clavePrimera =
                `${prefijoClave}_PRI_${color.CODIGO_COLOR}_${tallePrincipal.DETALLE_TALLE}`;

            detallesAGuardar.push(
                armarObjetoDetalle({
                    color,
                    clasificacion: clasificacionPrimera,
                    tipoDetalle: 'PAR_SUELTO',
                    talle: tallePrincipal,
                    moduloDetalle: null,
                    pares: 1,
                    rubroFact: rubroFactSuelto,
                    codigoAlfa: codigoAlfaPrimera,
                    detalleProducto: detallePrimera,
                    claveTemporal: clavePrimera,
                    padreTemporal: null,
                    generadoAutomatico: false,
                    estadoValidacion:
                        existenteERPPrimera ? 'EXISTE_ERP' : 'VALIDO',
                    observacionValidacion:
                        existenteERPPrimera
                            ? observacionExisteERP(existenteERPPrimera)
                            : null
                })
            );

            await agregarAutomaticoSiCorresponde({
                color,
                talle: tallePrincipal,
                clasificacion: clasificacionSegunda,
                padreTemporal: clavePrimera,
                sufijoClave: 'SEG'
            });
        }
    }

    return {
        idAlta: id,
        tipoProducto,
        usuario,
        detallesAGuardar,
        omitidos
    };
}

/* ============================================================
   AGREGAR DETALLE / LOTE DE PRODUCTOS

   FORMATOS SOPORTADOS:
   1) JSON tradicional de un solo producto.
   2) { usuario, productos: [ ... ] } para varios productos.

   En ambos casos se ejecuta UN SOLO crearDetalles(), por lo que
   todos los registros se insertan dentro de una única transacción.
   ============================================================ */

async function agregarDetalle(
    idAlta,
    datosEntrada
) {

    const id = validarId(idAlta);

    if (!datosEntrada || typeof datosEntrada !== 'object') {
        throw new Error('El cuerpo de la petición es inválido.');
    }

    const esLote =
        Array.isArray(datosEntrada.productos);

    /* ========================================================
       FORMATO TRADICIONAL - UN SOLO PRODUCTO
       ======================================================== */

    if (!esLote) {
        const preparado =
            await prepararDetalleProducto(
                id,
                datosEntrada,
                {
                    codigosGenerados: new Set(),
                    prefijoClave: 'P1'
                }
            );

        const creados =
            await altasRepository.crearDetalles(
                id,
                preparado.detallesAGuardar,
                preparado.usuario
            );

        return {
            idAlta: id,
            tipoProducto: preparado.tipoProducto,
            cantidad: creados.length,
            cantidadOmitidos: preparado.omitidos.length,
            productos: creados,
            omitidos: preparado.omitidos
        };
    }

    /* ========================================================
       FORMATO LOTE - VARIOS PRODUCTOS
       ======================================================== */

    if (datosEntrada.productos.length === 0) {
        throw new Error(
            'El array productos debe contener al menos un producto.'
        );
    }

    const usuarioLote =
        normalizarTexto(datosEntrada.usuario) || 'SISTEMA';

    const codigosGenerados = new Set();
    const todosLosDetalles = [];
    const todosLosOmitidos = [];
    const resumenProductos = [];
    let tipoProductoAlta = null;

    for (
        let i = 0;
        i < datosEntrada.productos.length;
        i++
    ) {
        const productoEntrada =
            datosEntrada.productos[i];

        if (
            !productoEntrada ||
            typeof productoEntrada !== 'object' ||
            Array.isArray(productoEntrada)
        ) {
            throw new Error(
                `El producto en posición ${i + 1} es inválido.`
            );
        }

        const preparado =
            await prepararDetalleProducto(
                id,
                {
                    ...productoEntrada,
                    usuario:
                        normalizarTexto(productoEntrada.usuario) ||
                        usuarioLote
                },
                {
                    codigosGenerados,
                    prefijoClave: `P${i + 1}`
                }
            );

        if (tipoProductoAlta === null) {
            tipoProductoAlta = preparado.tipoProducto;
        }

        todosLosDetalles.push(
            ...preparado.detallesAGuardar
        );

        todosLosOmitidos.push(
            ...preparado.omitidos.map(item => ({
                productoSolicitud: i + 1,
                ...item
            }))
        );

        resumenProductos.push({
            productoSolicitud: i + 1,
            cantidadGenerada:
                preparado.detallesAGuardar.length,
            cantidadOmitida:
                preparado.omitidos.length
        });
    }

    if (todosLosDetalles.length === 0) {
        throw new Error(
            'No existen productos nuevos para agregar al alta.'
        );
    }

    /* ========================================================
       UN SOLO INSERT TRANSACCIONAL PARA TODO EL JSON
       ======================================================== */

    const creados =
        await altasRepository.crearDetalles(
            id,
            todosLosDetalles,
            usuarioLote
        );

    return {
        idAlta: id,
        tipoProducto: tipoProductoAlta,
        cantidadProductosSolicitados:
            datosEntrada.productos.length,
        cantidad: creados.length,
        cantidadOmitidos: todosLosOmitidos.length,
        resumenProductos,
        productos: creados,
        omitidos: todosLosOmitidos
    };
}

/* ============================================================
   ELIMINAR DETALLE

   Los productos automáticos no se eliminan individualmente.
   Al eliminar el producto principal, el repository elimina también
   sus hijos dentro de la misma transacción.
   ============================================================ */

async function eliminarDetalle(
    idAlta,
    idDetalle
) {

    const id = validarId(idAlta);
    const detalleId = Number(idDetalle);

    if (!Number.isInteger(detalleId) || detalleId <= 0) {
        throw new Error('ID_DETALLE inválido.');
    }

    const alta =
        await altasRepository.obtenerAltaPorId(id);

    if (!alta) {
        throw new Error('Alta no encontrada.');
    }

    if (alta.ESTADO !== 'BORRADOR') {
        throw new Error(
            `No se pueden eliminar productos ` +
            `porque el alta está en estado ${alta.ESTADO}.`
        );
    }

    const detalle =
        await altasRepository.obtenerDetallePorId(
            id,
            detalleId
        );

    if (!detalle) {
        throw new Error(
            'El producto no existe dentro de esta alta.'
        );
    }

    if (Boolean(detalle.GENERADO_AUTOMATICO)) {
        throw new Error(
            `El producto ${detalle.CODIGO_ALFA} fue generado automáticamente. ` +
            `Debe eliminar el producto principal que le dio origen.`
        );
    }

    const eliminado =
        await altasRepository.eliminarDetalle(
            id,
            detalleId
        );

    if (!eliminado) {
        throw new Error('No se pudo eliminar el producto.');
    }

    return eliminado;
}

/* ============================================================
   VALIDAR ALTA COMPLETA
   ============================================================ */

async function validarAlta(
    idAlta,
    datosEntrada = {}
) {

    const id = validarId(idAlta);
    const usuario =
        normalizarTexto(datosEntrada.usuario) || 'SISTEMA';

    const alta =
        await altasRepository.obtenerAltaPorId(id);

    if (!alta) {
        throw new Error('Alta no encontrada.');
    }

    if (alta.ESTADO !== 'BORRADOR') {
        throw new Error(
            `El alta está en estado ${alta.ESTADO}. ` +
            `Solamente se pueden validar altas BORRADOR.`
        );
    }

    const detalles =
        await altasRepository.obtenerDetalleAlta(id);

    if (!detalles || detalles.length === 0) {
        throw new Error(
            'El alta no contiene productos para validar.'
        );
    }

    const duplicados =
        await altasRepository.buscarDuplicadosAlta(id);

    if (duplicados.length > 0) {
        const codigos =
            duplicados
                .map(item => item.CODIGO_ALFA)
                .join(', ');

        throw new Error(
            `Existen CODIGO_ALFA duplicados dentro del lote: ${codigos}.`
        );
    }

    const codigosInternos = new Set();
    const idsDetalle =
        new Set(detalles.map(item => Number(item.ID_DETALLE)));

    for (const detalle of detalles) {
        const codigoAlfa =
            normalizarTexto(detalle.CODIGO_ALFA);

        const tipoDetalle =
            normalizarTipoProducto(
                detalle.TIPO_PRODUCTO_DETALLE || alta.TIPO_PRODUCTO
            );

        if (!codigoAlfa) {
            throw new Error(
                `El detalle ${detalle.ID_DETALLE} no tiene CODIGO_ALFA.`
            );
        }

        if (!['MODULO', 'PAR_SUELTO'].includes(tipoDetalle)) {
            throw new Error(
                `El producto ${codigoAlfa} tiene ` +
                `TIPO_PRODUCTO_DETALLE inválido: ${detalle.TIPO_PRODUCTO_DETALLE}.`
            );
        }

        const estadoValidacion =
            normalizarTexto(
                detalle.ESTADO_VALIDACION
            ).toUpperCase();

        if (
            !['VALIDO', 'EXISTE_ERP'].includes(
                estadoValidacion
            )
        ) {
            throw new Error(
                `El producto ${codigoAlfa} tiene un estado de validación ` +
                `no permitido: ${detalle.ESTADO_VALIDACION}.`
            );
        }

        if (codigosInternos.has(codigoAlfa)) {
            throw new Error(
                `El producto ${codigoAlfa} está duplicado dentro del alta.`
            );
        }

        codigosInternos.add(codigoAlfa);

        if (Boolean(detalle.GENERADO_AUTOMATICO)) {
            const idPadre = Number(detalle.ID_DETALLE_PADRE);

            if (!idPadre || !idsDetalle.has(idPadre)) {
                throw new Error(
                    `El producto automático ${codigoAlfa} ` +
                    `no tiene un detalle padre válido.`
                );
            }
        }

        const existeOtraAlta =
            await altasRepository.buscarCodigoAlfaEnOtraAlta(
                id,
                codigoAlfa
            );

        if (existeOtraAlta) {
            throw new Error(
                `No se puede validar el alta. El producto ${codigoAlfa} ` +
                `también se encuentra en el alta ${existeOtraAlta.CODIGO_ALTA} ` +
                `(ID_ALTA ${existeOtraAlta.ID_ALTA}), ` +
                `estado ${existeOtraAlta.ESTADO_ALTA}.`
            );
        }

        const existeERP =
            await altasRepository.buscarProductoERP(
                tipoDetalle,
                codigoAlfa
            );

        if (estadoValidacion === 'EXISTE_ERP') {
            if (!existeERP) {
                throw new Error(
                    `El producto ${codigoAlfa} está marcado como EXISTE_ERP, ` +
                    `pero ya no se encuentra en la réplica de Presea. ` +
                    `Elimine y vuelva a agregar la familia para recalcularla.`
                );
            }
        } else if (existeERP) {
            let mensaje =
                `El producto ${codigoAlfa} apareció en Presea después de ` +
                `haber sido agregado al lote`;

            if (existeERP.CODIGO) {
                mensaje += ` con código ${existeERP.CODIGO}`;
            }

            if (existeERP.CODIGO_EAN) {
                mensaje += ` y EAN ${existeERP.CODIGO_EAN}`;
            }

            mensaje +=
                `. Elimine y vuelva a agregar la familia para que quede ` +
                `marcado como EXISTE_ERP.`;

            throw new Error(mensaje);
        }

        if (tipoDetalle === 'MODULO') {
            if (!detalle.CODIGO_MODULO) {
                throw new Error(
                    `El producto ${codigoAlfa} no tiene módulo/curva.`
                );
            }

            if (Number(detalle.PARES) <= 0) {
                throw new Error(
                    `El producto ${codigoAlfa} tiene una cantidad de pares inválida.`
                );
            }

            if (Number(detalle.NIVEL) !== 950) {
                throw new Error(
                    `El módulo ${codigoAlfa} debe tener NIVEL = 950.`
                );
            }
        }

        if (tipoDetalle === 'PAR_SUELTO') {
            if (!['1', '2'].includes(detalle.CODIGO_CLASIFICACION)) {
                throw new Error(
                    `El producto ${codigoAlfa} debe tener ` +
                    `clasificación 1 - PRIMERA o 2 - SEGUNDA.`
                );
            }

            if (!detalle.CODIGO_TALLE) {
                throw new Error(
                    `El producto ${codigoAlfa} no tiene talle.`
                );
            }

            if (Number(detalle.PARES) !== 1) {
                throw new Error(
                    `El producto ${codigoAlfa} de PAR_SUELTO debe tener PARES = 1.`
                );
            }

            if (Number(detalle.NIVEL) !== 900) {
                throw new Error(
                    `El par suelto ${codigoAlfa} debe tener NIVEL = 900.`
                );
            }
        }

        const detalleProducto =
            normalizarTexto(detalle.DETALLE_PRODUCTO);

        if (!detalleProducto) {
            throw new Error(
                `El producto ${codigoAlfa} no tiene DETALLE_PRODUCTO.`
            );
        }

        if (detalleProducto.length > 50) {
            throw new Error(
                `El producto ${codigoAlfa} tiene ` +
                `DETALLE_PRODUCTO mayor a 50 caracteres.`
            );
        }
    }

    const altaValidada =
        await altasRepository.marcarAltaValidada(
            id,
            usuario
        );

    if (!altaValidada) {
        throw new Error(
            'No se pudo validar el alta. ' +
            'Es posible que su estado haya cambiado.'
        );
    }

    const cantidadExistentesERP =
        detalles.filter(
            item =>
                normalizarTexto(
                    item.ESTADO_VALIDACION
                ).toUpperCase() === 'EXISTE_ERP'
        ).length;

    return {
        alta: altaValidada,
        cantidadProductos: detalles.length,
        cantidadExistentesERP,
        cantidadAExportar:
            detalles.length - cantidadExistentesERP
    };
}

/* ============================================================
   EXPORTS
   ============================================================ */

module.exports = {

    crearAlta,

    listarAltas,

    obtenerAlta,

    agregarDetalle,

    eliminarDetalle,

    validarAlta
};