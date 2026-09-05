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


function normalizarTextoLimitado(valor, campo, largoMaximo) {

    const texto = normalizarTexto(valor);

    if (texto.length > largoMaximo) {
        throw new Error(
            `${campo} no puede superar los ${largoMaximo} caracteres.`
        );
    }

    return texto || null;
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


function normalizarLicenciaSeguridad(valor) {

    let bruto = valor;

    if (
        bruto &&
        typeof bruto === 'object'
    ) {
        bruto =
            bruto.codigoLicencia ??
            bruto.CODIGO_LICENCIA ??
            bruto.licencia ??
            bruto.LICENCIA ??
            bruto.detalleLicencia ??
            bruto.DETALLE_LICENCIA ??
            '';
    }

    const texto =
        normalizarTexto(bruto)
            .toUpperCase();

    if (
        !texto ||
        texto === '__SIN_LICENCIA__' ||
        texto === 'SIN LICENCIA'
    ) {
        return 'SIN LICENCIA';
    }

    return texto;
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



function obtenerAccesoEmpresaContexto(
    contextoUsuario,
    idEmpresa
) {

    if (!contextoUsuario) {
        return null;
    }

    const id = Number(idEmpresa);

    const acceso =
        (contextoUsuario.empresas || [])
            .find(
                item =>
                    Number(item.idEmpresa) === id
            );

    if (!acceso) {
        return null;
    }

    if (contextoUsuario.superAdmin) {
        return {
            ...acceso,
            rol: 'SUPER_ADMIN',
            todasMarcas: true,
            todosRubros: true,
            todasLicencias: true,
            marcas: [],
            rubros: [],
            licencias: []
        };
    }

    return acceso;
}


function alcanceContiene(
    lista,
    campos,
    valor
) {

    const objetivo =
        normalizarTexto(valor)
            .toUpperCase();

    return (lista || []).some(
        item =>
            campos.some(
                campo =>
                    normalizarTexto(
                        item[campo]
                    ).toUpperCase() ===
                    objetivo
            )
    );
}


function validarAlcanceAlta(
    contextoUsuario,
    alta,
    licencia = undefined
) {

    if (!contextoUsuario) {
        throw new Error(
            'No existe contexto de seguridad del usuario.'
        );
    }

    const acceso =
        obtenerAccesoEmpresaContexto(
            contextoUsuario,
            alta.ID_EMPRESA
        );

    if (!acceso) {
        throw new Error(
            'No tiene permisos para la empresa del alta.'
        );
    }

    if (
        !acceso.todasMarcas &&
        !alcanceContiene(
            acceso.marcas,
            [
                'codigoMarca',
                'detalleMarca'
            ],
            alta.CODIGO_MARCA
        ) &&
        !alcanceContiene(
            acceso.marcas,
            [
                'codigoMarca',
                'detalleMarca'
            ],
            alta.DETALLE_MARCA
        )
    ) {
        throw new Error(
            'No tiene permisos para la marca del alta.'
        );
    }

    if (
        !acceso.todosRubros &&
        !alcanceContiene(
            acceso.rubros,
            [
                'codigoRubro',
                'detalleRubro'
            ],
            alta.CODIGO_RUBRO
        ) &&
        !alcanceContiene(
            acceso.rubros,
            [
                'codigoRubro',
                'detalleRubro'
            ],
            alta.DETALLE_RUBRO
        )
    ) {
        throw new Error(
            'No tiene permisos para el rubro del alta.'
        );
    }

    if (
        licencia !== undefined &&
        !acceso.todasLicencias
    ) {

        const valorLicencia =
            normalizarLicenciaSeguridad(
                licencia
            );

        const permitida =
            (acceso.licencias || [])
                .some(
                    item =>
                        normalizarLicenciaSeguridad(
                            item
                        ) ===
                        valorLicencia
                );

        if (!permitida) {
            throw new Error(
                `No tiene permisos para la licencia ` +
                `"${valorLicencia}".`
            );
        }
    }

    return acceso;
}

function accesoEmpresaPermiteAlta(acceso, alta) {
    if (!acceso) return false;

    const marcaPermitida = acceso.todasMarcas ||
        alcanceContiene(acceso.marcas, ['codigoMarca', 'detalleMarca', 'CODIGO_MARCA', 'DETALLE_MARCA'], alta.CODIGO_MARCA) ||
        alcanceContiene(acceso.marcas, ['codigoMarca', 'detalleMarca', 'CODIGO_MARCA', 'DETALLE_MARCA'], alta.DETALLE_MARCA);
    if (!marcaPermitida) return false;

    const rubroPermitido = acceso.todosRubros ||
        alcanceContiene(acceso.rubros, ['codigoRubro', 'detalleRubro', 'CODIGO_RUBRO', 'DETALLE_RUBRO'], alta.CODIGO_RUBRO) ||
        alcanceContiene(acceso.rubros, ['codigoRubro', 'detalleRubro', 'CODIGO_RUBRO', 'DETALLE_RUBRO'], alta.DETALLE_RUBRO);
    if (!rubroPermitido) return false;

    if (!acceso.todasLicencias) {
        const licenciaAlta = normalizarLicenciaSeguridad(alta.LICENCIA_ALTA);
        const permitida = (acceso.licencias || []).some(
            licencia => normalizarLicenciaSeguridad(licencia) === licenciaAlta
        );
        if (!permitida) return false;
    }

    return true;
}


/* ============================================================
   CREAR CABECERA
   ============================================================ */

async function crearAlta(
    datosEntrada,
    contextoUsuario = null
) {

    const idEmpresa =
        Number(datosEntrada.idEmpresa);

    if (
        !Number.isInteger(idEmpresa) ||
        idEmpresa <= 0
    ) {
        throw new Error(
            'Debe seleccionar una empresa válida.'
        );
    }

    const accesoEmpresa =
        obtenerAccesoEmpresaContexto(
            contextoUsuario,
            idEmpresa
        );

    if (!accesoEmpresa) {
        throw new Error(
            'No tiene permisos para la empresa seleccionada.'
        );
    }


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
            codigoMarca,
            idEmpresa
        ),

        altasRepository.buscarRubro(
            codigoRubro,
            idEmpresa
        ),

        altasRepository.buscarTemporada(
            codigoTemporada,
            idEmpresa
        ),

        altasRepository.buscarAno(
            codigoAno,
            idEmpresa
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


    validarAlcanceAlta(
        contextoUsuario,
        {
            ID_EMPRESA: idEmpresa,
            CODIGO_MARCA: marca.CODIGO_MARCA,
            DETALLE_MARCA: marca.DETALLE_MARCA,
            CODIGO_RUBRO: rubro.CODIGO_RUBRO,
            DETALLE_RUBRO: rubro.DETALLE_RUBRO
        }
    );

    /* ========================================================
       CREAR ALTA
       ======================================================== */

    return altasRepository.crearAlta({

        idEmpresa,

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

async function listarAltas(idEmpresa, accesoEmpresa) {

    const altas = await altasRepository
        .listarAltas(idEmpresa);

    return altas.filter(alta => accesoEmpresaPermiteAlta(accesoEmpresa, alta));
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

    /*
     * IMPORTANTE:
     * Obtener/refrescar una pantalla NO debe modificar el estado
     * de validación de los productos.
     *
     * La conciliación contra PRODUCTOS (Presea) se realiza en
     * validarAlta(), antes de validar definitivamente el Alta.
     */


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

    const tipoNormalizado =
        tipoProductoDetalle
            ? normalizarTipoProducto(tipoProductoDetalle)
            : null;

    /*
     * PRIMERA y SEGUNDA son ambos productos PAR_SUELTO.
     *
     * Si no se informa el tipo, mantenemos la misma
     * compatibilidad que ya tenía VICBOR.
     */
    const esParSuelto =
        tipoNormalizado
            ? tipoNormalizado === 'PAR_SUELTO'
            : ['1', '2'].includes(codigoClasificacion);


    /* ========================================================
       VICBOR / ATOMIK

       SE CONSERVA EXACTAMENTE LA LOGICA EXISTENTE.
       ======================================================== */

    if (marcaNormalizada === 'ATOMIK') {

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
                    'No está definida una regla de RUBRO_FACT ' +
                    'para módulos POP de ATOMIK.'
                );
            }

            return 'POP_ATK';
        }
    }


    /* ========================================================
       MIDING / MONTAGNE

       Maestro recibido:
         CALZ_MON
         MOD_CALZ_MON
         POP_MON
         MOD_POP_MON
       ======================================================== */

    if (marcaNormalizada === 'MONTAGNE') {

        if (rubroNormalizado === 'CALZADO') {
            return esParSuelto
                ? 'CALZ_MON'
                : 'MOD_CALZ_MON';
        }

        if (rubroNormalizado === 'POP') {
            return esParSuelto
                ? 'POP_MON'
                : 'MOD_POP_MON';
        }
    }


    /* ========================================================
       MIDING / 47 STREET

       Maestro recibido:
         CALZ_47S
         MOD_CALZ_47S
         ACCE_47S
         MOD_ACCE_47S
         POP_47S

       No existe MOD_POP_47S en el maestro recibido, por eso
       se rechaza de la misma forma segura que hacemos cuando
       falta una regla real.
       ======================================================== */

    if (marcaNormalizada === '47 STREET') {

        if (rubroNormalizado === 'CALZADO') {
            return esParSuelto
                ? 'CALZ_47S'
                : 'MOD_CALZ_47S';
        }

        if (rubroNormalizado === 'ACCESORIOS') {
            return esParSuelto
                ? 'ACCE_47S'
                : 'MOD_ACCE_47S';
        }

        if (rubroNormalizado === 'POP') {

            if (!esParSuelto) {
                throw new Error(
                    'No está definida una regla de RUBRO_FACT ' +
                    'para módulos POP de 47 STREET.'
                );
            }

            return 'POP_47S';
        }
    }


    /* ========================================================
       INDUSTRIAS GYD / MARCEL
       ======================================================== */

    if (marcaNormalizada === 'MARCEL') {
        if (rubroNormalizado === 'CALZADO') {
            return esParSuelto ? 'CALZ_MAR' : 'MOD_CALZ_MAR';
        }

        if (rubroNormalizado === 'ACCESORIOS') {
            return esParSuelto ? 'ACCE_MAR' : 'MOD_PACK_MAR';
        }

        if (rubroNormalizado === 'POP' && esParSuelto) {
            return 'POP_MAR';
        }
    }


    /* ========================================================
       INDUSTRIAS GYD / MASSIMO
       ======================================================== */

    if (marcaNormalizada === 'MASSIMO') {
        if (rubroNormalizado === 'CALZADO') {
            return esParSuelto ? 'CALZ_MAS' : 'MOD_CALZ_MAS';
        }

        if (rubroNormalizado === 'ACCESORIOS' && esParSuelto) {
            return 'ACCE_MAS';
        }

        if (rubroNormalizado === 'POP' && esParSuelto) {
            return 'POP_MAS';
        }
    }

    /* ========================================================
       INDUSTRIAS GYD / WAKE
       ======================================================== */

    if (marcaNormalizada === 'WAKE') {
        if (rubroNormalizado === 'CALZADO') {
            return esParSuelto ? 'CALZ_WK' : 'MOD_CALZ_WK';
        }

        if (rubroNormalizado === 'LICENCIAS') {
            return esParSuelto ? 'LICE_WK' : 'MOD_LICE_WK';
        }

        if (rubroNormalizado === 'POP' && esParSuelto) {
            return 'POP_WK';
        }
    }


    /* ========================================================
       BAGUNZA / BAGUNZA

       Maestro recibido:
         CALZ_BGZ
         MOD_CALZ_BGZ
         ACC_BGZ
         POP_BGZ

       ACCESORIOS y POP no poseen regla de módulo en el maestro,
       por lo que sólo se habilitan como PAR_SUELTO.
       ======================================================== */

    if (marcaNormalizada === 'BAGUNZA') {
        if (rubroNormalizado === 'CALZADO') {
            return esParSuelto ? 'CALZ_BGZ' : 'MOD_CALZ_BGZ';
        }

        if (rubroNormalizado === 'ACCESORIOS' && esParSuelto) {
            return 'ACC_BGZ';
        }

        if (rubroNormalizado === 'POP' && esParSuelto) {
            return 'POP_BGZ';
        }
    }


    throw new Error(
        `No existe regla de RUBRO_FACT para ` +
        `${marca} / ${rubro} / ` +
        `${esParSuelto ? 'PAR_SUELTO' : 'MODULO'}.`
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
   VALIDAR EDAD + SEXO + CLASIFICACION
   ============================================================ */

function normalizarValorRegla(valor) {

    return normalizarTexto(valor)
        .toUpperCase()
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}


function validarEdadSexoClasificacion({
    tipoProducto,
    edad,
    sexo,
    clasificacion
}) {

    if (
        normalizarTipoProducto(tipoProducto) !==
        'MODULO'
    ) {
        return;
    }


    const detalleEdad =
        normalizarValorRegla(
            edad?.DETALLE_EDAD
        );

    let sexoNormalizado =
        normalizarValorRegla(
            sexo?.SEXO
        );

    if (sexoNormalizado === 'HOM') {
        sexoNormalizado = 'MAS';
    }

    const detalleClasificacion =
        normalizarValorRegla(
            clasificacion?.DETALLE_CLASIFICACION
        );


    const reglas = {
        ADULTO: {
            MAS: 'MOD.HOM',
            FEM: 'MOD.MUJ',
            UNI: 'MOD.UNI'
        },
        BABY: {
            MAS: 'MOD.BB',
            FEM: 'MOD.BB',
            UNI: 'MOD.BB'
        },
        JUNIOR: {
            MAS: 'MOD.JUN',
            FEM: 'MOD.JUN',
            UNI: 'MOD.JUN'
        },
        KIDS: {
            MAS: 'MOD.KID',
            FEM: 'MOD.KID',
            UNI: 'MOD.KID'
        },
        TEEN: {
            MAS: 'MOD.TEEN',
            FEM: 'MOD.TEEN',
            UNI: 'MOD.TEEN'
        },
        YOUTH: {
            MAS: 'MOD.YOUTH',
            FEM: 'MOD.YOUTH',
            UNI: 'MOD.YOUTH'
        }
    };


    const clasificacionEsperada =
        reglas?.[detalleEdad]?.[sexoNormalizado];


    if (!clasificacionEsperada) {
        throw new Error(
            `No existe una regla de clasificación para ` +
            `Edad ${edad?.DETALLE_EDAD || detalleEdad} + ` +
            `Sexo ${sexo?.SEXO || sexoNormalizado}.`
        );
    }


    if (
        detalleClasificacion !==
        clasificacionEsperada
    ) {
        throw new Error(
            `Clasificación incompatible con Edad + Sexo. ` +
            `Para ${edad.DETALLE_EDAD} / ${sexo.SEXO} ` +
            `corresponde ${clasificacionEsperada}, ` +
            `no ${clasificacion.DETALLE_CLASIFICACION}.`
        );
    }
}


/* ============================================================
   CODIGO ALFA
   ============================================================ */

function obtenerRubroCodigoAlfaHijoModulo(
    clasificacionModulo
) {

    const detalleClasificacion =
        normalizarTexto(
            clasificacionModulo?.DETALLE_CLASIFICACION
        )
            .toUpperCase()
            .replace(/\s+/g, '');

    /*
     * REGLA ESPECIAL COD_ALFA:
     * - solamente para hijos automáticos de MOD.MUJ => F
     * - solamente para hijos automáticos de MOD.HOM => M
     * - cualquier otro módulo conserva CODIGO_RUBRO normal
     */
    if (detalleClasificacion === 'MOD.MUJ') {
        return 'F';
    }

    if (detalleClasificacion === 'MOD.HOM') {
        return 'M';
    }

    return null;
}


function normalizarTalleCodigoAlfa(detalleTalle) {

    const talle =
        normalizarTexto(detalleTalle)
            .toUpperCase();

    const equivalencias = {
        S: '0S',
        M: '0M',
        L: '0L',
        '2XL': '2X',
        '3XL': '3X'
    };

    return (
        equivalencias[talle] ||
        talle
    );
}


function construirCodigoAlfa({
    alta,
    modelo,
    clasificacion,
    color,
    codigoModulo,
    detalleTalle,
    tipoProductoDetalle = null,
    codigoRubroCodAlfa = null
}) {

    const tipoProducto =
        normalizarTipoProducto(
            tipoProductoDetalle || alta.TIPO_PRODUCTO
        );

    const ultimoSegmento =
        tipoProducto === 'MODULO'
            ? codigoModulo
            : normalizarTalleCodigoAlfa(
                detalleTalle
            );

    const segmentoRubro =
        normalizarTexto(codigoRubroCodAlfa) ||
        alta.CODIGO_RUBRO;


    /*
     * MONTAGNE utiliza códigos de modelo de 5 caracteres
     * (por ejemplo MT062).
     *
     * Para conservar la estructura ERP de COD_ALFA de 15
     * caracteres, las marcas que admiten modelos variables
     * de 5/6 posiciones completan el segmento MODELO a 6
     * caracteres agregando un 0 a la izquierda:
     *
     * MT062  ->  0MT062
     *
     * MONTAGNE y las marcas de GYD comparten esta regla.
     * Las demás marcas conservan exactamente su código.
     */
    const detalleMarca =
        normalizarTexto(
            alta.DETALLE_MARCA
        ).toUpperCase();

    const codigoModeloOriginal =
        normalizarTexto(
            modelo.CODIGO_MODELO
        );

    const codigoModeloCodigoAlfa =
        normalizarCodigoModeloCodigoAlfa(
            detalleMarca,
            codigoModeloOriginal
        );


    return [
        alta.CODIGO_ANO,
        alta.CODIGO_TEMPORADA,
        segmentoRubro,
        codigoModeloCodigoAlfa,
        clasificacion.CODIGO_CLASIFICACION,
        color.CODIGO_COLOR,
        ultimoSegmento
    ].join('');
}

function normalizarCodigoModeloCodigoAlfa(detalleMarca, codigoModelo) {
    const marca = normalizarTexto(detalleMarca).toUpperCase();
    const modelo = normalizarTexto(codigoModelo);
    const marcasModeloVariable = new Set([
        'MONTAGNE',
        'MASSIMO',
        'WAKE',
        'MARCEL'
    ]);

    return marcasModeloVariable.has(marca) && modelo.length === 5
        ? `0${modelo}`
        : modelo;
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

    const contextoUsuario =
        contexto.contextoUsuario || null;

    validarAlcanceAlta(
        contextoUsuario,
        alta
    );

    const idEmpresa =
        Number(alta.ID_EMPRESA);

    const tipoProducto =
        normalizarTipoProducto(alta.TIPO_PRODUCTO);

    if (!['MODULO', 'PAR_SUELTO'].includes(tipoProducto)) {
        throw new Error(
            `TIPO_PRODUCTO inválido en el alta: ` +
            `"${alta.TIPO_PRODUCTO}" (normalizado: "${tipoProducto}").`
        );
    }

    const codigoModelo = normalizarTexto(datosEntrada.codigoModelo);
    const codigoProveedor = normalizarTexto(datosEntrada.codigoProveedor);
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

    const informacionAdicional = {
        CO_NEW: normalizarTextoLimitado(datosEntrada.coNew, 'CO_NEW', 50),
        MUESTRA: normalizarTextoLimitado(datosEntrada.muestra, 'MUESTRA', 50),
        COMENTARIO: normalizarTextoLimitado(datosEntrada.comentario, 'COMENTARIO', 255),
        CORRECCIONES: normalizarTextoLimitado(datosEntrada.correcciones, 'CORRECCIONES', 255),
        MATERIAL_CALZADO: normalizarTextoLimitado(datosEntrada.materialCalzado, 'MATERIAL_CALZADO', 100),
        MATERIAL_SUELA: normalizarTextoLimitado(datosEntrada.materialSuela, 'MATERIAL_SUELA', 100),
        TIPO_AJUSTE: normalizarTextoLimitado(datosEntrada.tipoAjuste, 'TIPO_AJUSTE', 100),
        DESCRIPCION: normalizarTextoLimitado(datosEntrada.descripcion, 'DESCRIPCION', 500),
        FLOW: normalizarTextoLimitado(datosEntrada.flow, 'FLOW', 100)
    };

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
        [codigoProveedor, 'Debe seleccionar un proveedor.'],
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
        proveedor,
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
            alta.DETALLE_RUBRO,
            idEmpresa
        ),
        altasRepository.buscarProveedor(
            codigoProveedor,
            alta.DETALLE_RUBRO,
            idEmpresa,
            alta.CODIGO_MARCA
        ),
        altasRepository.buscarGrupo(codigoGrupo, idEmpresa),
        altasRepository.buscarSubgrupo(codigoSubgrupo, idEmpresa),
        altasRepository.buscarLinea(codigoLinea, idEmpresa),
        altasRepository.buscarDeporte(codigoDeporte, idEmpresa),
        altasRepository.buscarEdad(codigoEdad, idEmpresa),
        altasRepository.buscarSexo(sexo, idEmpresa),
        altasRepository.buscarClasificacion(codigoClasificacion, idEmpresa),
        altasRepository.buscarClasificacion('1', idEmpresa),
        altasRepository.buscarClasificacion('2', idEmpresa),
        altasRepository.buscarPais(codigoPais, idEmpresa)
    ]);

    if (!modelo) {
        throw new Error(
            'El modelo no existe, está inactivo o no corresponde a la marca/rubro del alta.'
        );
    }

    validarAlcanceAlta(
        contextoUsuario,
        alta,
        modelo.LICENCIA
    );
    if (!proveedor) {
        throw new Error(
            `Proveedor ${codigoProveedor} inexistente o inactivo.`
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

    validarEdadSexoClasificacion({
        tipoProducto,
        edad,
        sexo: sexoMaestro,
        clasificacion: clasificacionPrincipal
    });

    const codigoOrigen =
        normalizarTexto(pais.DETALLE_PAIS).toUpperCase() === 'ARGENTINA'
            ? '1'
            : '2';

    const origen =
        await altasRepository.buscarOrigen(codigoOrigen, idEmpresa);

    if (!origen) {
        throw new Error(`No se encontró el origen ${codigoOrigen}.`);
    }

    let modulo = null;
    let tallePrincipal = null;

    if (tipoProducto === 'MODULO') {
        modulo =
            await altasRepository.buscarModulo(codigoModulo, idEmpresa);

        if (!modulo) {
            throw new Error(
                'La curva seleccionada no existe, está inactiva o es inconsistente.'
            );
        }
    } else {
        tallePrincipal =
            await altasRepository.buscarTalle(codigoTalle, idEmpresa);

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
                rubroFactPrincipal,
                idEmpresa
            ),
            altasRepository.buscarRubroFacturacion(
                alta.DETALLE_MARCA,
                rubroFactSuelto,
                idEmpresa
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
            await altasRepository.buscarColor(codigoColor, idEmpresa);

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
                await altasRepository.buscarTalle(columna, idEmpresa);

            /* Fallback por si algún maestro usa el talle visible como código. */
            if (!talleMaestro) {
                talleMaestro =
                    await altasRepository.buscarTalle(talleVisible, idEmpresa);
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
    const relacionesFamilia = [];

    function agregarRelacionFamilia(
        padreTemporal,
        codigoAlfaHijo
    ) {
        if (!padreTemporal || !codigoAlfaHijo) {
            return;
        }

        const existe =
            relacionesFamilia.some(item =>
                item.padreTemporal === padreTemporal &&
                item.codigoAlfaHijo === codigoAlfaHijo
            );

        if (!existe) {
            relacionesFamilia.push({
                padreTemporal,
                codigoAlfaHijo
            });
        }
    }

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

            CODIGO_PROVEEDOR: proveedor.CODIGO,
            PRESEA_PROVEEDOR: proveedor.PRESEA || null,
            RUBRO_PROVEEDOR: proveedor.RUBRO || null,
            DETALLE_PROVEEDOR: proveedor.NVA_RAZON_SOCIAL,

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
            OBSERVACION_VALIDACION: observacionValidacion,
            ...informacionAdicional
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
                codigoAlfa,
                idEmpresa
            );

        codigosGenerados.add(codigoAlfa);

        return existenteERP || null;
    }

    async function agregarAutomaticoSiCorresponde({
        color,
        talle,
        clasificacion,
        padreTemporal,
        sufijoClave,
        codigoRubroCodAlfa = null
    }) {
        const codigoAlfa =
            construirCodigoAlfa({
                alta,
                modelo,
                clasificacion,
                color,
                codigoModulo: null,
                detalleTalle: talle.DETALLE_TALLE,
                tipoProductoDetalle: 'PAR_SUELTO',
                codigoRubroCodAlfa
            });

        if (codigosGenerados.has(codigoAlfa)) {
            /*
             * El producto ya fue generado dentro de esta misma operación,
             * pero la NUEVA familia también debe quedar relacionada con él.
             */
            agregarRelacionFamilia(
                padreTemporal,
                codigoAlfa
            );

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
            /*
             * El CODIGO_ALFA ya existe físicamente una sola vez,
             * pero puede pertenecer a más de una familia/curva.
             */
            agregarRelacionFamilia(
                padreTemporal,
                codigoAlfa
            );

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
                codigoAlfa,
                idEmpresa
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

        agregarRelacionFamilia(
            padreTemporal,
            codigoAlfa
        );

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

    const codigoRubroHijosModulo =
        tipoProducto === 'MODULO'
            ? obtenerRubroCodigoAlfaHijoModulo(
                clasificacionPrincipal
            )
            : null;


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
                    sufijoClave: 'PRI',
                    codigoRubroCodAlfa: codigoRubroHijosModulo
                });

                await agregarAutomaticoSiCorresponde({
                    color,
                    talle,
                    clasificacion: clasificacionSegunda,
                    padreTemporal: claveModulo,
                    sufijoClave: 'SEG',
                    codigoRubroCodAlfa: codigoRubroHijosModulo
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
        omitidos,
        relacionesFamilia
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

function expandirCombinatoriaCurvas(datosEntrada) {
    if (
        !datosEntrada ||
        typeof datosEntrada !== 'object' ||
        Array.isArray(datosEntrada) ||
        Array.isArray(datosEntrada.productos)
    ) {
        return datosEntrada;
    }

    const usaModulos = Array.isArray(datosEntrada.codigosModulo);
    const usaTalles = Array.isArray(datosEntrada.codigosTalle);

    if (!usaModulos && !usaTalles) return datosEntrada;

    if (usaModulos && usaTalles) {
        throw new Error('No se pueden combinar curvas y talles en la misma operación.');
    }

    const codigos = [
        ...new Set(
            (usaModulos
                ? datosEntrada.codigosModulo
                : datosEntrada.codigosTalle)
                .map(normalizarTexto)
                .filter(Boolean)
        )
    ];

    if (codigos.length === 0) {
        throw new Error(
            usaModulos
                ? 'Debe seleccionar al menos una curva/módulo.'
                : 'Debe seleccionar al menos un talle.'
        );
    }

    const {
        codigosModulo: _codigosModulo,
        codigosTalle: _codigosTalle,
        ...datosComunes
    } = datosEntrada;

    return {
        usuario: datosComunes.usuario,
        productos: codigos.map(
            codigo => ({
                ...datosComunes,
                [usaModulos ? 'codigoModulo' : 'codigoTalle']: codigo
            })
        )
    };
}

async function agregarDetalle(
    idAlta,
    datosEntrada,
    contextoUsuario = null
) {

    const id = validarId(idAlta);

    if (!datosEntrada || typeof datosEntrada !== 'object') {
        throw new Error('El cuerpo de la petición es inválido.');
    }

    datosEntrada =
        expandirCombinatoriaCurvas(
            datosEntrada
        );

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
                    prefijoClave: 'P1',
                    contextoUsuario
                }
            );

        const creados =
            await altasRepository.crearDetalles(
                id,
                preparado.detallesAGuardar,
                preparado.usuario,
                preparado.relacionesFamilia
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
    const todasLasRelacionesFamilia = [];
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
                    prefijoClave: `P${i + 1}`,
                    contextoUsuario
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

        todasLasRelacionesFamilia.push(
            ...preparado.relacionesFamilia
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
            usuarioLote,
            todasLasRelacionesFamilia
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

    /*
     * La tabla ALTAS_PRODUCTOS_FAMILIAS_DETALLE es ahora la fuente
     * de verdad para la pertenencia de los automáticos a una familia.
     * El repository:
     * 1) elimina las relaciones de esta familia;
     * 2) conserva los automáticos todavía usados por otra familia;
     * 3) elimina solamente los automáticos que quedaron huérfanos;
     * 4) elimina el principal.
     */
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

    const idEmpresa =
        Number(alta.ID_EMPRESA);

    /*
     * Antes de validar, volvemos a conciliar contra PRODUCTOS.
     * Así ningún producto que ya apareció en Presea queda exportable
     * por haber sido agregado al Alta antes de una sincronización.
     */
    await altasRepository.reconciliarExistenciaERPAlta(id);

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
                codigoAlfa,
                idEmpresa
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

    const cantidadExistentesERP =
        detalles.filter(
            item =>
                normalizarTexto(
                    item.ESTADO_VALIDACION
                ).toUpperCase() === 'EXISTE_ERP'
        ).length;

    const cantidadAExportar =
        detalles.length - cantidadExistentesERP;

    /*
     * Si TODOS los productos ya existen en Presea, el circuito
     * termina aquí. No hay DBI que generar ni sincronización ERP
     * pendiente. Conservamos fecha/usuario de validación para
     * auditoría y usamos un estado explícito de cierre.
     */
    const altaValidada =
        cantidadAExportar === 0
            ? await altasRepository.marcarAltaSinNovedadesERP(
                id,
                usuario
              )
            : await altasRepository.marcarAltaValidada(
                id,
                usuario
              );

    if (!altaValidada) {
        throw new Error(
            'No se pudo validar/cerrar el alta. ' +
            'Es posible que su estado haya cambiado.'
        );
    }

    return {
        alta: altaValidada,
        estadoFinal: altaValidada.ESTADO,
        cerradaSinNovedadesERP:
            altaValidada.ESTADO === 'SIN_NOVEDADES_ERP',
        cantidadProductos: detalles.length,
        cantidadExistentesERP,
        cantidadAExportar
    };
}

/* ============================================================
   ANULAR ALTA
   ============================================================ */

async function anularAlta(
    idAlta,
    datosEntrada = {}
) {

    const id =
        validarId(
            idAlta
        );


    const usuario =
        normalizarTexto(
            datosEntrada.usuario
        ) || 'SISTEMA';


    const motivo =
        normalizarTexto(
            datosEntrada.motivo
        );


    if (!motivo) {

        throw new Error(
            'Debe indicar un motivo para anular el Alta.'
        );
    }


    if (
        motivo.length > 500
    ) {

        throw new Error(
            'El motivo de anulación no puede superar los 500 caracteres.'
        );
    }


    const alta =
        await altasRepository
            .obtenerAltaPorId(
                id
            );


    if (!alta) {

        throw new Error(
            'Alta no encontrada.'
        );
    }


    if (
        normalizarTexto(
            alta.ESTADO
        ).toUpperCase() !==
        'BORRADOR'
    ) {

        throw new Error(
            `El alta no puede anularse desde el estado ${alta.ESTADO}.`
        );
    }


    const altaAnulada =
        await altasRepository
            .marcarAltaAnulada(
                id,
                usuario,
                motivo
            );


    if (!altaAnulada) {

        throw new Error(
            'No se pudo anular el Alta. ' +
            'Es posible que su estado haya cambiado.'
        );
    }


    /*
     * No eliminamos:
     * - detalle del Alta
     * - relaciones de familia
     * - imágenes
     *
     * El Alta queda como histórico.
     *
     * Las validaciones de duplicados ya ignoran Altas ANULADAS,
     * por lo que sus COD_ALFA dejan de bloquear nuevas Altas.
     */
    return {
        alta:
            altaAnulada,

        idAlta:
            altaAnulada.ID_ALTA,

        estado:
            altaAnulada.ESTADO,

        fechaAnulacion:
            altaAnulada.FECHA_ANULACION,

        usuarioAnulacion:
            altaAnulada.USUARIO_ANULACION,

        motivoAnulacion:
            altaAnulada.MOTIVO_ANULACION
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

    validarAlta,

    anularAlta,

    _internals: {
        validarEdadSexoClasificacion,
        normalizarTextoLimitado,
        normalizarCodigoModeloCodigoAlfa,
        determinarRubroFact,
        expandirCombinatoriaCurvas
    }
};
