const ENDPOINTS = {
  marcas: "/api/maestros/marcas",

  rubros: "/api/maestros/rubros",

  anos: "/api/maestros/anos",

  temporadas: "/api/maestros/temporadas",

  crearAlta: "/api/altas",
};

let altaCreada = null;

document.addEventListener("DOMContentLoaded", async () => {
  const form = document.getElementById("formNuevaAlta");

  const btnLimpiar = document.getElementById("btnLimpiar");

  form.addEventListener("submit", crearAlta);

  btnLimpiar.addEventListener("click", () => {
    setTimeout(() => {
      ocultarAlerta();
    }, 0);
  });

  await cargarMaestrosIniciales();
});

/* ============================================================
   MAESTROS
   ============================================================ */

async function cargarMaestrosIniciales() {
  try {
    const [marcas, rubros, anos, temporadas] = await Promise.all([
      obtenerMaestro(ENDPOINTS.marcas),

      obtenerMaestro(ENDPOINTS.rubros),

      obtenerMaestro(ENDPOINTS.anos),

      obtenerMaestro(ENDPOINTS.temporadas),
    ]);

    cargarSelect(
      "codigoMarca",
      marcas,
      ["CODIGO_MARCA", "codigoMarca", "codigo"],
      ["DETALLE_MARCA", "detalleMarca", "detalle"],
      "Seleccionar marca...",
    );

    cargarSelect(
      "codigoRubro",
      rubros,
      ["CODIGO_RUBRO", "codigoRubro", "codigo"],
      ["DETALLE_RUBRO", "detalleRubro", "detalle"],
      "Seleccionar rubro...",
    );

    cargarSelect(
      "codigoAno",
      anos,
      ["CODIGO_ANO", "codigoAno", "codigo"],
      ["DETALLE_ANO", "detalleAno", "detalle"],
      "Seleccionar año...",
    );

    cargarSelect(
      "codigoTemporada",
      temporadas,
      ["CODIGO_TEMPORADA", "codigoTemporada", "codigo"],
      ["DETALLE_TEMPORADA", "detalleTemporada", "detalle"],
      "Seleccionar temporada...",
    );
  } catch (error) {
    mostrarAlerta(error.message, "danger");
  }
}

async function obtenerMaestro(url) {
  const response = await fetch(url);

  let data = null;

  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    throw new Error(data?.mensaje || `No se pudo consultar ${url}.`);
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

  if (Array.isArray(data?.datos)) {
    return data.datos;
  }

  if (Array.isArray(data?.resultado)) {
    return data.resultado;
  }

  if (Array.isArray(data?.data)) {
    return data.data;
  }

  throw new Error(`La respuesta de ${url} no contiene un listado válido.`);
}

function cargarSelect(id, filas, camposCodigo, camposDetalle, placeholder) {
  const select = document.getElementById(id);

  select.innerHTML = `<option value="">${escaparHtml(placeholder)}</option>`;

  for (const fila of filas) {
    const codigo = obtenerCampo(fila, camposCodigo);

    if (
      codigo === undefined ||
      codigo === null ||
      String(codigo).trim() === ""
    ) {
      continue;
    }

    const detalle = obtenerCampo(fila, camposDetalle);

    const option = document.createElement("option");

    option.value = String(codigo);

    option.textContent = detalle ? `${codigo} - ${detalle}` : String(codigo);

    select.appendChild(option);
  }
}

function obtenerCampo(objeto, candidatos) {
  for (const campo of candidatos) {
    if (Object.prototype.hasOwnProperty.call(objeto, campo)) {
      return objeto[campo];
    }
  }

  return undefined;
}

/* ============================================================
   CREAR ALTA
   ============================================================ */

async function crearAlta(event) {
  event.preventDefault();

  ocultarAlerta();

  const form = event.currentTarget;

  if (!form.checkValidity()) {
    form.classList.add("was-validated");

    return;
  }

  const btn = document.getElementById("btnCrearAlta");

  const payload = {
    codigoMarca: document.getElementById("codigoMarca").value,

    codigoRubro: document.getElementById("codigoRubro").value,

    tipoProducto: document.getElementById("tipoProducto").value,

    codigoAno: document.getElementById("codigoAno").value,

    codigoTemporada: document.getElementById("codigoTemporada").value,

    usuario: document.getElementById("usuario").value.trim().toUpperCase(),
  };

  try {
    btn.disabled = true;
    btn.textContent = "Creando...";

    const response = await fetch(ENDPOINTS.crearAlta, {
      method: "POST",

      headers: {
        "Content-Type": "application/json",
      },

      body: JSON.stringify(payload),
    });

    let data = null;

    try {
      data = await response.json();
    } catch {
      data = null;
    }

    if (!response.ok) {
      throw new Error(data?.mensaje || "No se pudo crear el alta.");
    }

    altaCreada = extraerAltaCreada(data);

    if (!altaCreada) {
      throw new Error(
        "El alta fue creada, pero la API no devolvió una cabecera reconocible.",
      );
    }

    bloquearFormulario();

    mostrarAltaCreada(altaCreada);

    mostrarAlerta("Alta creada correctamente.", "success");
  } catch (error) {
    mostrarAlerta(error.message, "danger");
  } finally {
    btn.disabled = Boolean(altaCreada);

    btn.textContent = altaCreada ? "Alta creada" : "Crear Alta";
  }
}

function extraerAltaCreada(data) {
  if (!data) {
    return null;
  }

  if (data.ID_ALTA || data.idAlta) {
    return data;
  }

  if (
    data.datos &&
    typeof data.datos === "object" &&
    !Array.isArray(data.datos)
  ) {
    return data.datos;
  }

  if (data.resultado && typeof data.resultado === "object") {
    return data.resultado;
  }

  if (data.alta && typeof data.alta === "object") {
    return data.alta;
  }

  return null;
}

function bloquearFormulario() {
  const controles = document.querySelectorAll(
    "#formNuevaAlta input, " +
      "#formNuevaAlta select, " +
      "#formNuevaAlta button",
  );

  for (const control of controles) {
    control.disabled = true;
  }
}

/* ============================================================
   RESULTADO
   ============================================================ */

function mostrarAltaCreada(alta) {
  const idAlta = alta.ID_ALTA ?? alta.idAlta ?? alta.IdAlta ?? "-";

  const codigoAlta = alta.CODIGO_ALTA ?? alta.codigoAlta ?? "-";

  const marca =
    alta.DETALLE_MARCA ??
    alta.detalleMarca ??
    obtenerTextoSelect("codigoMarca");

  const rubro =
    alta.DETALLE_RUBRO ??
    alta.detalleRubro ??
    obtenerTextoSelect("codigoRubro");

  const estado = alta.ESTADO ?? alta.estado ?? "BORRADOR";

  document.getElementById("altaId").textContent = idAlta;

  document.getElementById("altaCodigo").textContent = codigoAlta;

  document.getElementById("altaMarca").textContent = marca;

  document.getElementById("altaRubro").textContent = rubro;

  document.getElementById("estadoAltaCreada").textContent = estado;

  const panel = document.getElementById("panelAltaCreada");

  panel.classList.remove("d-none");

  const btnContinuar =
    document.getElementById('btnContinuarProductos');

btnContinuar.disabled = false;

btnContinuar.onclick = () => {
    const idAlta =
        alta.ID_ALTA ??
        alta.idAlta ??
        alta.IdAlta;

    if (!idAlta) {
        mostrarAlerta(
            'No se pudo determinar el ID del alta.',
            'danger'
        );
        return;
    }

    window.location.href =
        `/altas/${idAlta}/productos`;
};
}

function obtenerTextoSelect(id) {
  const select = document.getElementById(id);

  return select.options[select.selectedIndex]?.textContent || "-";
}

/* ============================================================
   ALERTAS
   ============================================================ */

function mostrarAlerta(mensaje, tipo) {
  const alerta = document.getElementById("alertaAlta");

  alerta.className = `alert alert-${tipo}`;

  alerta.textContent = mensaje;
}

function ocultarAlerta() {
  const alerta = document.getElementById("alertaAlta");

  alerta.className = "alert d-none";

  alerta.textContent = "";
}

function escaparHtml(valor) {
  return String(valor ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
