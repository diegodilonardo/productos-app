const ENDPOINTS = {

    marcas:
        '/api/maestros/marcas',

    rubros:
        '/api/maestros/rubros',

    anos:
        '/api/maestros/anos',

    temporadas:
        '/api/maestros/temporadas',

    crearAlta:
        '/api/altas',
};


let altaCreada = null;


document.addEventListener(
    'DOMContentLoaded',
    async () => {

        const form =
            document.getElementById(
                'formNuevaAlta'
            );

        const btnLimpiar =
            document.getElementById(
                'btnLimpiar'
            );


        form.addEventListener(
            'submit',
            crearAlta
        );


        btnLimpiar.addEventListener(
            'click',
            () => {

                setTimeout(
                    () => {

                        ocultarAlerta();


                        for (
                            const id
                            of [
                                'codigoMarca',
                                'codigoRubro',
                                'codigoAno',
                                'codigoTemporada'
                            ]
                        ) {

                            const campo =
                                document.getElementById(
                                    id
                                );


                            if (campo?._limpiarMaestro) {

                                campo._limpiarMaestro(
                                    false
                                );
                            }
                        }


                        form.classList.remove(
                            'was-validated'
                        );
                    },
                    0
                );
            }
        );


        await cargarMaestrosIniciales();
    }
);


/* ============================================================
   MAESTROS
   ============================================================ */

async function cargarMaestrosIniciales() {

    try {

        const [
            marcas,
            rubros,
            anos,
            temporadas,
        ] = await Promise.all([

            obtenerMaestro(
                ENDPOINTS.marcas
            ),

            obtenerMaestro(
                ENDPOINTS.rubros
            ),

            obtenerMaestro(
                ENDPOINTS.anos
            ),

            obtenerMaestro(
                ENDPOINTS.temporadas
            ),

        ]);


        inicializarBuscadorMaestro({
            idCodigo: 'codigoMarca',
            idBuscar: 'buscarMarca',
            idLista: 'listaMarca',
            idSeleccionado: 'marcaSeleccionada',
            idDetalleSeleccionado: 'marcaSeleccionadaDetalle',
            idLimpiar: 'btnLimpiarMarca',
            filas: marcas,
            camposCodigo: ['CODIGO_MARCA', 'codigoMarca', 'codigo'],
            camposDetalle: ['DETALLE_MARCA', 'detalleMarca', 'detalle'],
            etiquetaVacia: 'No hay marcas para mostrar.'
        });


        inicializarBuscadorMaestro({
            idCodigo: 'codigoRubro',
            idBuscar: 'buscarRubro',
            idLista: 'listaRubro',
            idSeleccionado: 'rubroSeleccionado',
            idDetalleSeleccionado: 'rubroSeleccionadoDetalle',
            idLimpiar: 'btnLimpiarRubro',
            filas: rubros,
            camposCodigo: ['CODIGO_RUBRO', 'codigoRubro', 'codigo'],
            camposDetalle: ['DETALLE_RUBRO', 'detalleRubro', 'detalle'],
            etiquetaVacia: 'No hay rubros para mostrar.'
        });


        inicializarBuscadorMaestro({
            idCodigo: 'codigoAno',
            idBuscar: 'buscarAno',
            idLista: 'listaAno',
            idSeleccionado: 'anoSeleccionado',
            idDetalleSeleccionado: 'anoSeleccionadoDetalle',
            idLimpiar: 'btnLimpiarAno',
            filas: anos,
            camposCodigo: ['CODIGO_ANO', 'codigoAno', 'codigo'],
            camposDetalle: ['DETALLE_ANO', 'detalleAno', 'detalle'],
            etiquetaVacia: 'No hay años para mostrar.'
        });


        inicializarBuscadorMaestro({
            idCodigo: 'codigoTemporada',
            idBuscar: 'buscarTemporada',
            idLista: 'listaTemporada',
            idSeleccionado: 'temporadaSeleccionada',
            idDetalleSeleccionado: 'temporadaSeleccionadaDetalle',
            idLimpiar: 'btnLimpiarTemporada',
            filas: temporadas,
            camposCodigo: ['CODIGO_TEMPORADA', 'codigoTemporada', 'codigo'],
            camposDetalle: ['DETALLE_TEMPORADA', 'detalleTemporada', 'detalle'],
            etiquetaVacia: 'No hay temporadas para mostrar.'
        });


    } catch (error) {

        mostrarAlerta(
            error.message,
            'danger'
        );
    }
}


async function obtenerMaestro(url) {

    const response =
        await fetch(url);


    let data = null;

    try {
        data = await response.json();
    } catch {
        data = null;
    }


    if (!response.ok) {

        throw new Error(
            data?.mensaje ||
            `No se pudo consultar ${url}.`
        );
    }


    /*
     * Formatos soportados:
     *
     * [ ... ]
     *
     * { ok:true, datos:[ ... ] }
     *
     * { ok:true, resultado:[ ... ] }
     *
     * { ok:true, data:[ ... ] }
     */

    if (Array.isArray(data)) {
        return data;
    }


    if (
        Array.isArray(
            data?.datos
        )
    ) {
        return data.datos;
    }


    if (
        Array.isArray(
            data?.resultado
        )
    ) {
        return data.resultado;
    }


    if (
        Array.isArray(
            data?.data
        )
    ) {
        return data.data;
    }


    throw new Error(
        `La respuesta de ${url} no contiene un listado válido.`
    );
}


function inicializarBuscadorMaestro(config) {

    const inputCodigo = document.getElementById(config.idCodigo);
    const inputBuscar = document.getElementById(config.idBuscar);
    const lista = document.getElementById(config.idLista);
    const panelSeleccionado = document.getElementById(config.idSeleccionado);
    const detalleSeleccionado = document.getElementById(config.idDetalleSeleccionado);
    const btnLimpiar = document.getElementById(config.idLimpiar);


    const opciones =
        (config.filas || [])
            .map(
                fila => {

                    const codigo =
                        obtenerCampo(
                            fila,
                            config.camposCodigo
                        );


                    const detalle =
                        obtenerCampo(
                            fila,
                            config.camposDetalle
                        );


                    return {

                        codigo:
                            codigo === null ||
                            codigo === undefined
                                ? ''
                                : String(codigo).trim(),

                        detalle:
                            detalle === null ||
                            detalle === undefined
                                ? ''
                                : String(detalle).trim(),
                    };
                }
            )
            .filter(
                item =>
                    item.codigo !== ''
            );


    function textoVisible(item) {

        return item.detalle
            ? `${item.codigo} - ${item.detalle}`
            : item.codigo;
    }


    function renderLista() {

        const termino =
            inputBuscar.value
                .trim()
                .toUpperCase();


        const filtradas =
            opciones.filter(
                item => {

                    if (!termino) {
                        return true;
                    }


                    return (
                        `${item.codigo} ${item.detalle}`
                            .toUpperCase()
                            .includes(
                                termino
                            )
                    );
                }
            );


        lista.innerHTML = '';


        if (filtradas.length === 0) {

            lista.innerHTML =
                `<div class="nueva-alta-master-empty">${escaparHtml(
                    config.etiquetaVacia ||
                    'No hay opciones para mostrar.'
                )}</div>`;

            return;
        }


        const limite = 100;


        for (const item of filtradas.slice(0, limite)) {

            const boton =
                document.createElement(
                    'button'
                );


            boton.type = 'button';
            boton.className = 'nueva-alta-master-item';


            boton.innerHTML =
                `<span class="nueva-alta-master-detail">${escaparHtml(
                    textoVisible(item)
                )}</span>`;


            boton.addEventListener(
                'click',
                () => {

                    inputCodigo.value =
                        item.codigo;


                    inputBuscar.classList.remove(
                        'is-invalid'
                    );


                    detalleSeleccionado.textContent =
                        textoVisible(item);


                    inputBuscar.value = '';


                    inputBuscar.classList.add(
                        'd-none'
                    );


                    lista.classList.add(
                        'd-none'
                    );


                    panelSeleccionado.classList.remove(
                        'd-none'
                    );
                }
            );


            lista.appendChild(
                boton
            );
        }


        if (filtradas.length > limite) {

            const mas =
                document.createElement(
                    'div'
                );


            mas.className =
                'nueva-alta-master-more';


            mas.textContent =
                `Mostrando ${limite} de ${filtradas.length}. Escribí para filtrar.`;


            lista.appendChild(
                mas
            );
        }
    }


    function limpiarSeleccion(enfocar = true) {

        inputCodigo.value = '';
        detalleSeleccionado.textContent = '';

        panelSeleccionado.classList.add(
            'd-none'
        );


        inputBuscar.classList.remove(
            'd-none',
            'is-invalid'
        );


        lista.classList.remove(
            'd-none'
        );


        inputBuscar.value = '';


        renderLista();


        if (enfocar) {
            inputBuscar.focus();
        }
    }


    inputBuscar.addEventListener(
        'input',
        renderLista
    );


    inputBuscar.addEventListener(
        'focus',
        () => {

            if (!inputCodigo.value) {

                lista.classList.remove(
                    'd-none'
                );


                renderLista();
            }
        }
    );


    btnLimpiar.addEventListener(
        'click',
        () => {

            limpiarSeleccion(
                true
            );
        }
    );


    inputCodigo._limpiarMaestro =
        limpiarSeleccion;


    renderLista();
}


function obtenerCampo(
    objeto,
    candidatos
) {

    for (const campo of candidatos) {

        if (
            Object.prototype.hasOwnProperty.call(
                objeto,
                campo
            )
        ) {
            return objeto[campo];
        }
    }


    return undefined;
}


function validarMaestrosObligatorios() {

    const campos = [

        ['codigoMarca', 'buscarMarca', 'Seleccioná una marca.'],
        ['codigoRubro', 'buscarRubro', 'Seleccioná un rubro.'],
        ['codigoAno', 'buscarAno', 'Seleccioná un año.'],
        ['codigoTemporada', 'buscarTemporada', 'Seleccioná una temporada.']
    ];


    let primero = null;


    for (const [idCodigo, idBuscar, mensaje] of campos) {

        const codigo =
            document.getElementById(
                idCodigo
            );


        const buscar =
            document.getElementById(
                idBuscar
            );


        const valido =
            Boolean(
                codigo?.value
            );


        buscar.classList.toggle(
            'is-invalid',
            !valido
        );


        if (!valido && !primero) {

            primero = {
                buscar,
                mensaje
            };
        }
    }


    if (primero) {

        mostrarAlerta(
            primero.mensaje,
            'danger'
        );


        primero.buscar.focus();


        return false;
    }


    return true;
}


/* ============================================================
   CREAR ALTA
   ============================================================ */

async function crearAlta(event) {

    event.preventDefault();

    ocultarAlerta();


    const form =
        event.currentTarget;


    const maestrosValidos =
        validarMaestrosObligatorios();


    if (
        !maestrosValidos ||
        !form.checkValidity()
    ) {

        form.classList.add(
            'was-validated'
        );

        return;
    }


    const btn =
        document.getElementById(
            'btnCrearAlta'
        );


    const payload = {

        codigoMarca:
            document
                .getElementById(
                    'codigoMarca'
                )
                .value,

        codigoRubro:
            document
                .getElementById(
                    'codigoRubro'
                )
                .value,

        tipoProducto:
            document
                .getElementById(
                    'tipoProducto'
                )
                .value,

        codigoAno:
            document
                .getElementById(
                    'codigoAno'
                )
                .value,

        codigoTemporada:
            document
                .getElementById(
                    'codigoTemporada'
                )
                .value,

        usuario:
            document
                .getElementById(
                    'usuario'
                )
                .value
                .trim()
                .toUpperCase(),
    };


    try {

        btn.disabled = true;
        btn.textContent =
            'Creando...';


        const response =
            await fetch(
                ENDPOINTS.crearAlta,
                {
                    method:
                        'POST',

                    headers: {
                        'Content-Type':
                            'application/json',
                    },

                    body:
                        JSON.stringify(
                            payload
                        ),
                }
            );


        let data = null;

        try {
            data = await response.json();
        } catch {
            data = null;
        }


        if (!response.ok) {

            throw new Error(
                data?.mensaje ||
                'No se pudo crear el alta.'
            );
        }


        altaCreada =
            extraerAltaCreada(
                data
            );


        if (!altaCreada) {

            throw new Error(
                'El alta fue creada, pero la API no devolvió una cabecera reconocible.'
            );
        }


        bloquearFormulario();


        mostrarAltaCreada(
            altaCreada
        );


        mostrarAlerta(
            'Alta creada correctamente.',
            'success'
        );


    } catch (error) {

        mostrarAlerta(
            error.message,
            'danger'
        );


    } finally {

        btn.disabled =
            Boolean(
                altaCreada
            );

        btn.textContent =
            altaCreada
                ? 'Alta creada'
                : 'Crear Alta';
    }
}


function extraerAltaCreada(data) {

    if (!data) {
        return null;
    }


    if (
        data.ID_ALTA ||
        data.idAlta
    ) {
        return data;
    }


    if (
        data.datos &&
        typeof data.datos ===
            'object' &&
        !Array.isArray(data.datos)
    ) {
        return data.datos;
    }


    if (
        data.resultado &&
        typeof data.resultado ===
            'object'
    ) {
        return data.resultado;
    }


    if (
        data.alta &&
        typeof data.alta ===
            'object'
    ) {
        return data.alta;
    }


    return null;
}


function bloquearFormulario() {

    const controles =
        document.querySelectorAll(
            '#formNuevaAlta input, ' +
            '#formNuevaAlta select, ' +
            '#formNuevaAlta button'
        );


    for (
        const control
        of controles
    ) {
        control.disabled = true;
    }
}


/* ============================================================
   RESULTADO
   ============================================================ */

function mostrarAltaCreada(alta) {

    const idAlta =
        alta.ID_ALTA ??
        alta.idAlta ??
        alta.IdAlta ??
        '-';


    const codigoAlta =
        alta.CODIGO_ALTA ??
        alta.codigoAlta ??
        '-';


    const marca =
        alta.DETALLE_MARCA ??
        alta.detalleMarca ??
        obtenerTextoSelect(
            'codigoMarca'
        );


    const rubro =
        alta.DETALLE_RUBRO ??
        alta.detalleRubro ??
        obtenerTextoSelect(
            'codigoRubro'
        );


    const estado =
        alta.ESTADO ??
        alta.estado ??
        'BORRADOR';


    document.getElementById(
        'altaId'
    ).textContent =
        idAlta;


    document.getElementById(
        'altaCodigo'
    ).textContent =
        codigoAlta;


    document.getElementById(
        'altaMarca'
    ).textContent =
        marca;


    document.getElementById(
        'altaRubro'
    ).textContent =
        rubro;


    document.getElementById(
        'estadoAltaCreada'
    ).textContent =
        estado;


    const panel =
        document.getElementById(
            'panelAltaCreada'
        );


    panel.classList.remove(
        'd-none'
    );


    const btnContinuar =
        document.getElementById(
            'btnContinuarProductos'
        );


    btnContinuar.disabled = false;

    btnContinuar.onclick = () => {
        window.location.href =
            `/altas/${encodeURIComponent(idAlta)}/productos`;
    };


    panel.scrollIntoView({
        behavior:
            'smooth',

        block:
            'start',
    });
}


function obtenerTextoSelect(id) {

    const mapa = {

        codigoMarca:
            'marcaSeleccionadaDetalle',

        codigoRubro:
            'rubroSeleccionadoDetalle',

        codigoAno:
            'anoSeleccionadoDetalle',

        codigoTemporada:
            'temporadaSeleccionadaDetalle'
    };


    const idDetalle =
        mapa[
            id
        ];


    if (idDetalle) {

        return (
            document
                .getElementById(
                    idDetalle
                )
                ?.textContent
                ?.trim() ||
            '-'
        );
    }


    const select =
        document.getElementById(
            id
        );


    if (
        !select ||
        select.tagName !== 'SELECT'
    ) {

        return '-';
    }


    return (
        select.options[
            select.selectedIndex
        ]?.textContent ||
        '-'
    );
}


/* ============================================================
   ALERTAS
   ============================================================ */

function mostrarAlerta(
    mensaje,
    tipo
) {

    const alerta =
        document.getElementById(
            'alertaAlta'
        );


    alerta.className =
        `alert alert-${tipo}`;


    alerta.textContent =
        mensaje;
}


function ocultarAlerta() {

    const alerta =
        document.getElementById(
            'alertaAlta'
        );


    alerta.className =
        'alert d-none';


    alerta.textContent =
        '';
}


function escaparHtml(valor) {

    return String(
        valor ?? ''
    )
        .replaceAll(
            '&',
            '&amp;'
        )
        .replaceAll(
            '<',
            '&lt;'
        )
        .replaceAll(
            '>',
            '&gt;'
        )
        .replaceAll(
            '"',
            '&quot;'
        )
        .replaceAll(
            "'",
            '&#039;'
        );
}
