document.addEventListener('DOMContentLoaded', iniciarUsuariosAdmin);

let usuariosAdmin = [];
let usuarioSeleccionado = null;
let usuarioDetalleActual = null;
let catalogosAdmin = {
  capacidades: {
    puedeCrear: false,
    puedeEditar: false,
    puedeResetearPassword: false,
    superAdmin: false
  },
  roles: [],
  empresas: [],
  marcas: [],
  rubros: [],
  licencias: []
};
let secuenciaAcceso = 0;
let vistaUsuarios = sessionStorage.getItem('usuarios.vista') === 'tarjetas' ? 'tarjetas' : 'tabla';


async function iniciarUsuariosAdmin() {
  document
    .getElementById('btnActualizarUsuarios')
    ?.addEventListener('click', refrescarPantalla);

  document
    .getElementById('btnNuevoUsuario')
    ?.addEventListener('click', pintarNuevoUsuario);

  document.getElementById('btnVistaTablaUsuarios')?.addEventListener('click', () => aplicarVistaUsuarios('tabla'));
  document.getElementById('btnVistaTarjetasUsuarios')?.addEventListener('click', () => aplicarVistaUsuarios('tarjetas'));
  aplicarVistaUsuarios(vistaUsuarios);

  await Promise.all([
    cargarCatalogos(),
    cargarUsuarios()
  ]);
}


async function refrescarPantalla() {
  await Promise.all([
    cargarCatalogos(),
    cargarUsuarios()
  ]);
}


async function cargarCatalogos() {
  try {
    const response = await fetch('/api/usuarios/catalogos', {
      headers: { Accept: 'application/json' }
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok || !data.ok) {
      throw new Error(
        data.mensaje ||
        'No se pudieron obtener los catálogos de seguridad.'
      );
    }

    catalogosAdmin = data.catalogos || catalogosAdmin;
  } catch (error) {
    mostrarAlertaUsuarios(error.message, 'danger');
  }
}


async function cargarUsuarios() {
  ocultarAlertaUsuarios();

  const tabla = document.getElementById('tablaUsuarios');
  if (tabla) {
    tabla.innerHTML =
      '<tr><td colspan="3" class="text-center py-5 text-secondary">Cargando...</td></tr>';
  }
  const tarjetas = document.getElementById('tarjetasUsuarios');
  if (tarjetas) tarjetas.innerHTML = '<div class="usuarios-card-message">Cargando...</div>';

  try {
    const response = await fetch('/api/usuarios', {
      headers: { Accept: 'application/json' }
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok || !data.ok) {
      throw new Error(data.mensaje || 'No se pudieron obtener los usuarios.');
    }

    usuariosAdmin = Array.isArray(data.usuarios) ? data.usuarios : [];
    pintarUsuarios();

    if (usuarioSeleccionado) {
      const sigue = usuariosAdmin.some(
        item => Number(item.idUsuario) === Number(usuarioSeleccionado)
      );

      if (sigue) {
        await cargarDetalleUsuario(usuarioSeleccionado);
      } else {
        usuarioSeleccionado = null;
        usuarioDetalleActual = null;
        pintarDetalleVacio();
      }
    }
  } catch (error) {
    mostrarAlertaUsuarios(error.message, 'danger');

    if (tabla) {
      tabla.innerHTML =
        '<tr><td colspan="3" class="text-center py-5 text-danger">No se pudieron cargar los usuarios.</td></tr>';
    }
    if (tarjetas) tarjetas.innerHTML = '<div class="usuarios-card-message text-danger">No se pudieron cargar los usuarios.</div>';
  }
}


function pintarUsuarios() {
  const tabla = document.getElementById('tablaUsuarios');
  const cantidad = document.getElementById('cantidadUsuarios');

  if (cantidad) {
    cantidad.textContent = String(usuariosAdmin.length);
  }

  pintarTarjetasUsuarios();
  if (!tabla) return;

  if (!usuariosAdmin.length) {
    tabla.innerHTML =
      '<tr><td colspan="3" class="text-center py-5 text-secondary">No hay usuarios registrados.</td></tr>';
    return;
  }

  tabla.innerHTML = usuariosAdmin.map(usuario => {
    const activo = Boolean(usuario.activo);
    const superAdmin = Boolean(usuario.superAdmin);
    const nombre = textoSeguro(usuario.nombre || usuario.usuario);
    const login = textoSeguro(usuario.usuario);
    const seleccionado =
      Number(usuario.idUsuario) === Number(usuarioSeleccionado);

    return `
      <tr role="button"
          class="${seleccionado ? 'table-primary' : ''}"
          data-id-usuario="${Number(usuario.idUsuario)}">
        <td>
          <div class="fw-semibold">${nombre}</div>
          <div class="small text-secondary">${login}</div>
          ${superAdmin ? '<span class="badge text-bg-dark mt-1">SUPER_ADMIN</span>' : ''}
        </td>
        <td>
          <span class="badge ${activo ? 'text-bg-success' : 'text-bg-secondary'}">
            ${activo ? 'ACTIVO' : 'INACTIVO'}
          </span>
        </td>
        <td>${Number(usuario.cantidadAccesos || 0)}</td>
      </tr>
    `;
  }).join('');

  tabla.querySelectorAll('[data-id-usuario]').forEach(fila => {
    fila.addEventListener('click', () => {
      cargarDetalleUsuario(Number(fila.dataset.idUsuario));
    });
  });
}

function aplicarVistaUsuarios(vista) {
  vistaUsuarios = vista === 'tarjetas' ? 'tarjetas' : 'tabla';
  sessionStorage.setItem('usuarios.vista', vistaUsuarios);
  const tarjetas = vistaUsuarios === 'tarjetas';
  document.getElementById('tarjetasUsuarios')?.classList.toggle('d-none', !tarjetas);
  document.getElementById('vistaTablaUsuarios')?.classList.toggle('d-none', tarjetas);
  const btnTabla = document.getElementById('btnVistaTablaUsuarios');
  const btnTarjetas = document.getElementById('btnVistaTarjetasUsuarios');
  btnTabla?.classList.toggle('is-active', !tarjetas);
  btnTarjetas?.classList.toggle('is-active', tarjetas);
  btnTabla?.setAttribute('aria-pressed', String(!tarjetas));
  btnTarjetas?.setAttribute('aria-pressed', String(tarjetas));
}

function pintarTarjetasUsuarios() {
  const contenedor = document.getElementById('tarjetasUsuarios');
  if (!contenedor) return;
  if (!usuariosAdmin.length) {
    contenedor.innerHTML = '<div class="usuarios-card-message">No hay usuarios registrados.</div>';
    return;
  }
  contenedor.innerHTML = usuariosAdmin.map(usuario => {
    const activo = Boolean(usuario.activo);
    const superAdmin = Boolean(usuario.superAdmin);
    const seleccionado = Number(usuario.idUsuario) === Number(usuarioSeleccionado);
    return `<button type="button" class="usuario-summary-card${seleccionado ? ' is-selected' : ''}" data-card-id-usuario="${Number(usuario.idUsuario)}">
      <span class="usuario-summary-avatar" aria-hidden="true">${textoSeguro(String(usuario.nombre || usuario.usuario || '?').trim().charAt(0).toUpperCase())}</span>
      <span class="usuario-summary-body"><strong>${textoSeguro(usuario.nombre || usuario.usuario)}</strong><small>${textoSeguro(usuario.usuario)}</small><span class="usuario-summary-badges"><span class="badge ${activo ? 'text-bg-success' : 'text-bg-secondary'}">${activo ? 'ACTIVO' : 'INACTIVO'}</span>${superAdmin ? '<span class="badge text-bg-dark">SUPER_ADMIN</span>' : ''}</span></span>
      <span class="usuario-summary-access"><strong>${Number(usuario.cantidadAccesos || 0)}</strong><small>accesos</small></span>
    </button>`;
  }).join('');
  contenedor.querySelectorAll('[data-card-id-usuario]').forEach(tarjeta => {
    tarjeta.addEventListener('click', () => cargarDetalleUsuario(Number(tarjeta.dataset.cardIdUsuario)));
  });
}


async function cargarDetalleUsuario(idUsuario) {
  usuarioSeleccionado = Number(idUsuario);
  pintarUsuarios();

  const contenedor = document.getElementById('detalleUsuario');
  if (contenedor) {
    contenedor.innerHTML =
      '<div class="text-secondary text-center py-5">Cargando permisos...</div>';
  }

  try {
    const response = await fetch(`/api/usuarios/${usuarioSeleccionado}`, {
      headers: { Accept: 'application/json' }
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok || !data.ok) {
      throw new Error(data.mensaje || 'No se pudo obtener el usuario.');
    }

    usuarioDetalleActual = data.usuario;
    pintarDetalleUsuario(data.usuario);
  } catch (error) {
    mostrarAlertaUsuarios(error.message, 'danger');
    usuarioDetalleActual = null;
    pintarDetalleVacio();
  }
}


function pintarDetalleUsuario(usuario) {
  const contenedor = document.getElementById('detalleUsuario');
  if (!contenedor) return;

  const rolesGlobales = Array.isArray(usuario.rolesGlobales)
    ? usuario.rolesGlobales
    : [];

  const accesos = Array.isArray(usuario.accesos)
    ? usuario.accesos
    : [];

  const rolesHtml = rolesGlobales.length
    ? rolesGlobales
        .map(item => `<span class="badge text-bg-dark me-1">${textoSeguro(item.codigoRol)}</span>`)
        .join('')
    : '<span class="text-secondary">Sin roles globales</span>';

  const accesosHtml = accesos.length
    ? accesos.map(acceso => pintarAcceso(acceso)).join('')
    : '<div class="alert alert-light border mb-0">Este usuario no tiene accesos activos por empresa.</div>';

  const puedeEditar = Boolean(catalogosAdmin.capacidades?.puedeEditar) &&
    Boolean(usuario.puedeEditarPermisos);
  const puedeResetearPassword = Boolean(
    catalogosAdmin.capacidades?.puedeResetearPassword
  );

  contenedor.innerHTML = `
    <div class="d-flex flex-wrap justify-content-between gap-3 mb-4">
      <div>
        <h2 class="h5 mb-1">${textoSeguro(usuario.nombre || usuario.usuario)}</h2>
        <div class="text-secondary">${textoSeguro(usuario.usuario)}</div>
        ${usuario.email ? `<div class="small text-secondary">${textoSeguro(usuario.email)}</div>` : ''}
      </div>
      <div class="d-flex gap-2 align-items-start">
        <span class="badge ${usuario.activo ? 'text-bg-success' : 'text-bg-secondary'} mt-2">
          ${usuario.activo ? 'ACTIVO' : 'INACTIVO'}
        </span>
        ${puedeResetearPassword ? `
          <button id="btnCambiarPasswordUsuario" class="btn btn-outline-secondary btn-sm" type="button">
            Cambiar contraseña
          </button>
        ` : ''}
        ${puedeEditar ? `
          <button id="btnEditarUsuario" class="btn btn-outline-primary btn-sm" type="button">
            Editar permisos
          </button>
        ` : ''}
      </div>
    </div>

    <div class="row g-3 mb-4">
      <div class="col-sm-6">
        <div class="small text-uppercase text-secondary fw-semibold">Último login</div>
        <div>${formatearFecha(usuario.fechaUltimoLogin)}</div>
      </div>
      <div class="col-sm-6">
        <div class="small text-uppercase text-secondary fw-semibold">Creación</div>
        <div>${formatearFecha(usuario.fechaCreacion)}</div>
      </div>
      <div class="col-12">
        <div class="small text-uppercase text-secondary fw-semibold mb-1">Roles globales</div>
        <div>${rolesHtml}</div>
      </div>
    </div>

    <div class="small text-uppercase text-secondary fw-semibold mb-2">Accesos por empresa</div>
    <div class="d-grid gap-3">${accesosHtml}</div>
  `;

  document
    .getElementById('btnCambiarPasswordUsuario')
    ?.addEventListener('click', () => pintarCambioPasswordUsuario(usuario));

  document
    .getElementById('btnEditarUsuario')
    ?.addEventListener('click', () => pintarEdicionUsuario(usuario));
}


function pintarAcceso(acceso) {
  const marcas = acceso.todasMarcas
    ? '<span class="badge text-bg-primary">TODAS</span>'
    : listaChips(acceso.marcas, item => item.detalleMarca || item.codigoMarca);

  const rubros = acceso.todosRubros
    ? '<span class="badge text-bg-primary">TODOS</span>'
    : listaChips(acceso.rubros, item => item.detalleRubro || item.codigoRubro);

  const licencias = acceso.todasLicencias
    ? '<span class="badge text-bg-primary">TODAS</span>'
    : listaChips(acceso.licencias, item => item);

  return `
    <div class="border rounded-3 p-3">
      <div class="d-flex flex-wrap justify-content-between align-items-start gap-2 mb-3">
        <div>
          <div class="fw-semibold">${textoSeguro(acceso.empresa || acceso.codigoEmpresa)}</div>
          <div class="small text-secondary">Empresa ${textoSeguro(acceso.codigoEmpresa)}</div>
        </div>
        <span class="badge text-bg-info">${textoSeguro(acceso.rol)}</span>
      </div>

      <div class="row g-3 small">
        <div class="col-12">
          <div class="text-secondary fw-semibold mb-1">Marcas</div>
          <div>${marcas}</div>
        </div>
        <div class="col-12">
          <div class="text-secondary fw-semibold mb-1">Rubros</div>
          <div>${rubros}</div>
        </div>
        <div class="col-12">
          <div class="text-secondary fw-semibold mb-1">Licencias</div>
          <div>${licencias}</div>
        </div>
      </div>
    </div>
  `;
}


function pintarCambioPasswordUsuario(usuario) {
  ocultarAlertaUsuarios();

  const contenedor = document.getElementById('detalleUsuario');
  if (!contenedor) return;

  contenedor.innerHTML = `
    <form id="formCambiarPasswordUsuario">
      <div class="d-flex flex-wrap justify-content-between align-items-start gap-3 mb-4">
        <div>
          <h2 class="h5 mb-1">Cambiar contraseña</h2>
          <div class="text-secondary">${textoSeguro(usuario.nombre || usuario.usuario)}</div>
          <div class="small text-secondary">${textoSeguro(usuario.usuario)}</div>
        </div>
        <div class="d-flex gap-2">
          <button id="btnCancelarPasswordUsuario" class="btn btn-outline-secondary btn-sm" type="button">
            Cancelar
          </button>
          <button id="btnGuardarPasswordUsuario" class="btn btn-primary btn-sm" type="submit">
            Guardar contraseña
          </button>
        </div>
      </div>

      <div class="alert alert-warning small">
        La contraseña actual nunca se muestra. La nueva contraseña se aplicará en el próximo inicio de sesión del usuario.
        Si ya tiene una sesión abierta, esa sesión no se cierra automáticamente en este paso.
      </div>

      <div class="row g-3">
        <div class="col-md-6">
          <label class="form-label" for="passwordNuevaUsuario">Nueva contraseña</label>
          <input id="passwordNuevaUsuario" class="form-control" type="password"
                 minlength="8" maxlength="200" autocomplete="new-password" required>
          <div class="form-text">Mínimo 8 caracteres.</div>
        </div>
        <div class="col-md-6">
          <label class="form-label" for="passwordConfirmarUsuario">Confirmar contraseña</label>
          <input id="passwordConfirmarUsuario" class="form-control" type="password"
                 minlength="8" maxlength="200" autocomplete="new-password" required>
        </div>
      </div>
    </form>
  `;

  document
    .getElementById('btnCancelarPasswordUsuario')
    ?.addEventListener('click', () => pintarDetalleUsuario(usuario));

  document
    .getElementById('formCambiarPasswordUsuario')
    ?.addEventListener('submit', event => cambiarPasswordUsuario(event, usuario));
}


async function cambiarPasswordUsuario(event, usuario) {
  event.preventDefault();
  ocultarAlertaUsuarios();

  const password = document.getElementById('passwordNuevaUsuario')?.value || '';
  const confirmar = document.getElementById('passwordConfirmarUsuario')?.value || '';

  if (password.length < 8) {
    mostrarAlertaUsuarios('La nueva contraseña debe tener al menos 8 caracteres.', 'danger');
    return;
  }

  if (password !== confirmar) {
    mostrarAlertaUsuarios('La confirmación de contraseña no coincide.', 'danger');
    return;
  }

  const boton = document.getElementById('btnGuardarPasswordUsuario');
  if (boton) {
    boton.disabled = true;
    boton.textContent = 'Guardando...';
  }

  try {
    const response = await fetch(`/api/usuarios/${Number(usuario.idUsuario)}/password`, {
      method: 'PUT',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ password })
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok || !data.ok) {
      throw new Error(data.mensaje || 'No se pudo actualizar la contraseña.');
    }

    pintarDetalleUsuario(usuario);
    mostrarAlertaUsuarios('Contraseña actualizada correctamente.', 'success');
  } catch (error) {
    mostrarAlertaUsuarios(error.message, 'danger');
  } finally {
    if (boton && document.body.contains(boton)) {
      boton.disabled = false;
      boton.textContent = 'Guardar contraseña';
    }
  }
}


function pintarNuevoUsuario() {
  ocultarAlertaUsuarios();

  const contenedor = document.getElementById('detalleUsuario');
  if (!contenedor) return;

  if (!Boolean(catalogosAdmin.capacidades?.puedeCrear)) {
    mostrarAlertaUsuarios('Su rol no permite crear usuarios.', 'danger');
    return;
  }

  usuarioSeleccionado = null;
  usuarioDetalleActual = null;
  secuenciaAcceso = 0;
  pintarUsuarios();

  contenedor.innerHTML = `
    <form id="formNuevoUsuario">
      <div class="d-flex flex-wrap justify-content-between align-items-start gap-3 mb-4">
        <div>
          <h2 class="h5 mb-1">Nuevo usuario</h2>
          <div class="text-secondary">Creación de cuenta y permisos iniciales.</div>
        </div>
        <div class="d-flex gap-2">
          <button id="btnCancelarNuevoUsuario" class="btn btn-outline-secondary btn-sm" type="button">
            Cancelar
          </button>
          <button id="btnCrearUsuario" class="btn btn-primary btn-sm" type="submit">
            Crear usuario
          </button>
        </div>
      </div>

      <div class="row g-3 mb-4">
        <div class="col-md-6">
          <label class="form-label" for="nuevoNombre">Nombre</label>
          <input id="nuevoNombre" class="form-control" type="text" maxlength="150" required>
        </div>
        <div class="col-md-6">
          <label class="form-label" for="nuevoUsuario">Usuario</label>
          <input id="nuevoUsuario" class="form-control" type="text" maxlength="100"
                 autocomplete="off" required>
          <div class="form-text">Letras, números, punto, guion o guion bajo.</div>
        </div>
        <div class="col-md-6">
          <label class="form-label" for="nuevoEmail">Email <span class="text-secondary">(opcional)</span></label>
          <input id="nuevoEmail" class="form-control" type="email" maxlength="200" autocomplete="off">
        </div>
        <div class="col-md-6">
          <label class="form-label" for="nuevoPassword">Contraseña inicial</label>
          <input id="nuevoPassword" class="form-control" type="password" minlength="8" maxlength="200"
                 autocomplete="new-password" required>
          <div class="form-text">Mínimo 8 caracteres.</div>
        </div>
      </div>

      <div class="form-check form-switch mb-4">
        <input class="form-check-input" type="checkbox" role="switch" id="nuevoUsuarioActivo" checked>
        <label class="form-check-label fw-semibold" for="nuevoUsuarioActivo">
          Usuario activo desde la creación
        </label>
      </div>

      <div class="alert alert-info small">
        Solo ADMIN y SUPER_ADMIN pueden crear usuarios. Un ADMIN únicamente puede otorgar empresas,
        marcas, rubros y licencias que estén dentro de su propio alcance.
      </div>

      <div class="d-flex justify-content-between align-items-center mb-2">
        <div class="small text-uppercase text-secondary fw-semibold">Accesos por empresa</div>
        <button id="btnAgregarAcceso" class="btn btn-outline-primary btn-sm" type="button">
          + Agregar empresa
        </button>
      </div>

      <div id="accesosEdicion" class="d-grid gap-3">
        <div id="sinAccesosEdicion" class="alert alert-light border mb-0">
          Agregá al menos un acceso por empresa.
        </div>
      </div>
    </form>
  `;

  document
    .getElementById('btnCancelarNuevoUsuario')
    ?.addEventListener('click', () => {
      if (usuarioDetalleActual) {
        pintarDetalleUsuario(usuarioDetalleActual);
      } else {
        pintarDetalleVacio();
      }
    });

  document
    .getElementById('btnAgregarAcceso')
    ?.addEventListener('click', agregarAccesoVacio);

  document
    .getElementById('formNuevoUsuario')
    ?.addEventListener('submit', crearUsuario);
}


async function crearUsuario(event) {
  event.preventDefault();
  ocultarAlertaUsuarios();

  const boton = document.getElementById('btnCrearUsuario');
  if (boton) {
    boton.disabled = true;
    boton.textContent = 'Creando...';
  }

  try {
    const accesos = leerAccesosFormulario();

    if (!accesos.length) {
      throw new Error('Debe agregar al menos un acceso por empresa.');
    }

    const payload = {
      nombre: document.getElementById('nuevoNombre')?.value || '',
      usuario: document.getElementById('nuevoUsuario')?.value || '',
      email: document.getElementById('nuevoEmail')?.value || '',
      password: document.getElementById('nuevoPassword')?.value || '',
      activo: Boolean(document.getElementById('nuevoUsuarioActivo')?.checked),
      accesos
    };

    const response = await fetch('/api/usuarios', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok || !data.ok) {
      throw new Error(data.mensaje || 'No se pudo crear el usuario.');
    }

    mostrarAlertaUsuarios('Usuario creado correctamente.', 'success');

    usuarioSeleccionado = Number(data.usuario?.idUsuario || 0) || null;
    await cargarUsuarios();

    if (usuarioSeleccionado) {
      await cargarDetalleUsuario(usuarioSeleccionado);
    }
  } catch (error) {
    mostrarAlertaUsuarios(error.message, 'danger');
  } finally {
    if (boton) {
      boton.disabled = false;
      boton.textContent = 'Crear usuario';
    }
  }
}


function pintarEdicionUsuario(usuario) {
  const contenedor = document.getElementById('detalleUsuario');
  if (!contenedor) return;

  secuenciaAcceso = 0;

  const esPerfilPropioAdmin = Boolean(usuario.esPropio) &&
    !Boolean(catalogosAdmin.capacidades?.superAdmin);

  const accesos = Array.isArray(usuario.accesos)
    ? usuario.accesos
    : [];

  const accesosHtml = usuario.superAdmin
    ? `
      <div class="alert alert-info mb-0">
        Este usuario posee el rol global <strong>SUPER_ADMIN</strong>.
        En este paso no se modifican roles globales ni sus alcances por empresa.
      </div>
    `
    : accesos.map(acceso => crearTarjetaAcceso(acceso, {
        bloquearEstructura: esPerfilPropioAdmin
      })).join('');

  contenedor.innerHTML = `
    <form id="formEditarUsuario">
      <div class="d-flex flex-wrap justify-content-between align-items-start gap-3 mb-4">
        <div>
          <h2 class="h5 mb-1">Editar ${textoSeguro(usuario.nombre || usuario.usuario)}</h2>
          <div class="text-secondary">${textoSeguro(usuario.usuario)}</div>
        </div>
        <div class="d-flex gap-2">
          <button id="btnCancelarEdicionUsuario" class="btn btn-outline-secondary btn-sm" type="button">
            Cancelar
          </button>
          <button id="btnGuardarUsuario" class="btn btn-primary btn-sm" type="submit">
            Guardar cambios
          </button>
        </div>
      </div>

      ${Boolean(catalogosAdmin.capacidades?.puedeCambiarEstado) ? `
        <div class="form-check form-switch mb-4">
          <input class="form-check-input" type="checkbox" role="switch"
                 id="usuarioActivo" ${usuario.activo ? 'checked' : ''}>
          <label class="form-check-label fw-semibold" for="usuarioActivo">
            Usuario activo
          </label>
        </div>
      ` : `
        <div class="alert alert-light border small mb-4">
          Como ADMIN podés editar permisos dentro de tus empresas administradas.
          El estado global ACTIVO/INACTIVO solo puede modificarlo un SUPER_ADMIN.
        </div>
      `}

      <div class="alert alert-warning small">
        Los cambios de permisos se aplican al construir una nueva sesión del usuario.
        Si el usuario ya está conectado, deberá cerrar sesión y volver a ingresar para recibir el nuevo alcance.
      </div>

      ${!Boolean(catalogosAdmin.capacidades?.superAdmin) ? `
        <div class="alert alert-info small">
          ${esPerfilPropioAdmin
            ? 'Estás editando tu propio perfil ADMIN. Podés ajustar marcas, rubros y licencias dentro de tu alcance actual; empresa y rol quedan protegidos.'
            : 'Solo se muestran y modifican los accesos de las empresas donde sos ADMIN. Si este usuario también posee permisos en otras empresas, permanecerán intactos.'}
        </div>
      ` : ''}

      ${usuario.superAdmin ? '' : `
        <div class="d-flex justify-content-between align-items-center mb-2">
          <div class="small text-uppercase text-secondary fw-semibold">Accesos por empresa</div>
          ${esPerfilPropioAdmin ? '' : `
            <button id="btnAgregarAcceso" class="btn btn-outline-primary btn-sm" type="button">
              + Agregar empresa
            </button>
          `}
        </div>
      `}

      <div id="accesosEdicion" class="d-grid gap-3">
        ${accesosHtml || (!usuario.superAdmin
          ? '<div id="sinAccesosEdicion" class="alert alert-light border mb-0">Sin accesos por empresa. Podés agregar uno.</div>'
          : '')}
      </div>
    </form>
  `;

  document
    .getElementById('btnCancelarEdicionUsuario')
    ?.addEventListener('click', () => pintarDetalleUsuario(usuario));

  document
    .getElementById('btnAgregarAcceso')
    ?.addEventListener('click', agregarAccesoVacio);

  document
    .getElementById('formEditarUsuario')
    ?.addEventListener('submit', guardarUsuario);

  instalarEventosAccesos();
}


function crearTarjetaAcceso(acceso = {}, opciones = {}) {
  const indice = ++secuenciaAcceso;
  const bloquearEstructura = Boolean(opciones.bloquearEstructura);
  const idEmpresa = Number(acceso.idEmpresa || 0);
  const idRol = Number(acceso.idRol || 0);

  const empresasOptions = opcionesSelect(
    catalogosAdmin.empresas,
    item => Number(item.idEmpresa),
    item => `${item.empresa} (${item.codigoEmpresa})`,
    idEmpresa
  );

  const rolesOptions = opcionesSelect(
    catalogosAdmin.roles,
    item => Number(item.idRol),
    item => item.codigoRol,
    idRol
  );

  return `
    <div class="border rounded-3 p-3 acceso-edicion" data-indice-acceso="${indice}">
      <div class="d-flex justify-content-between align-items-center mb-3">
        <strong>Acceso por empresa</strong>
        ${bloquearEstructura ? '' : '<button class="btn btn-outline-danger btn-sm btn-quitar-acceso" type="button">Quitar</button>'}
      </div>

      <div class="row g-3 mb-3">
        <div class="col-md-7">
          <label class="form-label">Empresa</label>
          <select class="form-select campo-empresa" required ${bloquearEstructura ? 'disabled' : ''}>
            <option value="">Seleccionar...</option>
            ${empresasOptions}
          </select>
        </div>
        <div class="col-md-5">
          <label class="form-label">Rol</label>
          <select class="form-select campo-rol" required ${bloquearEstructura ? 'disabled' : ''}>
            <option value="">Seleccionar...</option>
            ${rolesOptions}
          </select>
        </div>
      </div>

      ${crearBloqueScope(
        'marcas',
        'Marcas',
        Boolean(acceso.todasMarcas),
        obtenerMarcasEmpresa(idEmpresa),
        item => item.idEmpresaMarca,
        item => item.detalleMarca || item.codigoMarca,
        new Set((acceso.marcas || []).map(item => String(item.idEmpresaMarca)))
      )}

      ${crearBloqueScope(
        'rubros',
        'Rubros',
        Boolean(acceso.todosRubros),
        obtenerRubrosEmpresa(idEmpresa),
        item => item.codigoRubro,
        item => item.detalleRubro || item.codigoRubro,
        new Set((acceso.rubros || []).map(item => String(item.codigoRubro)))
      )}

      ${crearBloqueScope(
        'licencias',
        'Licencias',
        Boolean(acceso.todasLicencias),
        obtenerLicenciasEmpresa(idEmpresa),
        item => item.licencia,
        item => item.licencia,
        new Set((acceso.licencias || []).map(item => String(item)))
      )}
    </div>
  `;
}


function crearBloqueScope(clave, titulo, todos, opciones, obtenerValor, obtenerTexto, seleccionados) {
  const checks = opciones.length
    ? opciones.map(item => {
        const valor = String(obtenerValor(item));
        const marcado = seleccionados.has(valor);

        return `
          <label class="form-check me-3 mb-2">
            <input class="form-check-input scope-item scope-${clave}"
                   type="checkbox"
                   value="${atributoSeguro(valor)}"
                   ${marcado ? 'checked' : ''}
                   ${todos ? 'disabled' : ''}>
            <span class="form-check-label">${textoSeguro(obtenerTexto(item))}</span>
          </label>
        `;
      }).join('')
    : '<span class="text-secondary small">No hay opciones para la empresa seleccionada.</span>';

  return `
    <div class="mb-3 bloque-scope" data-scope="${clave}">
      <div class="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-2">
        <div class="fw-semibold">${titulo}</div>
        <label class="form-check mb-0">
          <input class="form-check-input scope-todos" type="checkbox" ${todos ? 'checked' : ''}>
          <span class="form-check-label">TODAS</span>
        </label>
      </div>
      <div class="d-flex flex-wrap scope-opciones">${checks}</div>
    </div>
  `;
}


function opcionesSelect(lista, obtenerValor, obtenerTexto, seleccionado) {
  return (Array.isArray(lista) ? lista : [])
    .map(item => {
      const valor = obtenerValor(item);
      return `<option value="${atributoSeguro(valor)}" ${String(valor) === String(seleccionado) ? 'selected' : ''}>${textoSeguro(obtenerTexto(item))}</option>`;
    })
    .join('');
}


function agregarAccesoVacio() {
  document.getElementById('sinAccesosEdicion')?.remove();

  const contenedor = document.getElementById('accesosEdicion');
  if (!contenedor) return;

  contenedor.insertAdjacentHTML('beforeend', crearTarjetaAcceso({
    todasMarcas: false,
    todosRubros: false,
    todasLicencias: true,
    marcas: [],
    rubros: [],
    licencias: []
  }));

  instalarEventosAccesos();
}


function instalarEventosAccesos() {
  document.querySelectorAll('.acceso-edicion').forEach(tarjeta => {
    if (tarjeta.dataset.eventosInstalados === '1') return;
    tarjeta.dataset.eventosInstalados = '1';

    tarjeta.querySelector('.btn-quitar-acceso')?.addEventListener('click', () => {
      tarjeta.remove();

      if (!document.querySelector('.acceso-edicion')) {
        document.getElementById('accesosEdicion')?.insertAdjacentHTML(
          'beforeend',
          '<div id="sinAccesosEdicion" class="alert alert-light border mb-0">Sin accesos por empresa. Podés agregar uno.</div>'
        );
      }
    });

    tarjeta.querySelector('.campo-empresa')?.addEventListener('change', event => {
      reconstruirScopesTarjeta(tarjeta, Number(event.target.value || 0));
    });

    tarjeta.querySelectorAll('.scope-todos').forEach(check => {
      check.addEventListener('change', () => {
        const bloque = check.closest('.bloque-scope');
        bloque?.querySelectorAll('.scope-item').forEach(item => {
          item.disabled = check.checked;
          if (check.checked) item.checked = false;
        });
      });
    });
  });
}


function reconstruirScopesTarjeta(tarjeta, idEmpresa) {
  const configuraciones = [
    ['marcas', 'Marcas', obtenerMarcasEmpresa(idEmpresa), item => item.idEmpresaMarca, item => item.detalleMarca || item.codigoMarca],
    ['rubros', 'Rubros', obtenerRubrosEmpresa(idEmpresa), item => item.codigoRubro, item => item.detalleRubro || item.codigoRubro],
    ['licencias', 'Licencias', obtenerLicenciasEmpresa(idEmpresa), item => item.licencia, item => item.licencia]
  ];

  for (const [clave, titulo, opciones, valor, detalle] of configuraciones) {
    const bloque = tarjeta.querySelector(`[data-scope="${clave}"]`);
    if (!bloque) continue;

    const todosPorDefecto = clave === 'licencias';
    bloque.outerHTML = crearBloqueScope(
      clave,
      titulo,
      todosPorDefecto,
      opciones,
      valor,
      detalle,
      new Set()
    );
  }

  tarjeta.dataset.eventosInstalados = '0';
  instalarEventosAccesos();
}


function obtenerMarcasEmpresa(idEmpresa) {
  return (catalogosAdmin.marcas || []).filter(
    item => Number(item.idEmpresa) === Number(idEmpresa)
  );
}


function obtenerRubrosEmpresa(idEmpresa) {
  return (catalogosAdmin.rubros || []).filter(
    item => Number(item.idEmpresa) === Number(idEmpresa)
  );
}


function obtenerLicenciasEmpresa(idEmpresa) {
  return (catalogosAdmin.licencias || []).filter(
    item => Number(item.idEmpresa) === Number(idEmpresa)
  );
}


async function guardarUsuario(event) {
  event.preventDefault();
  ocultarAlertaUsuarios();

  if (!usuarioDetalleActual) return;

  const boton = document.getElementById('btnGuardarUsuario');
  if (boton) {
    boton.disabled = true;
    boton.textContent = 'Guardando...';
  }

  try {
    const payload = {
      activo: document.getElementById('usuarioActivo')
        ? Boolean(document.getElementById('usuarioActivo')?.checked)
        : Boolean(usuarioDetalleActual.activo),
      accesos: usuarioDetalleActual.superAdmin
        ? []
        : leerAccesosFormulario()
    };

    const response = await fetch(`/api/usuarios/${usuarioDetalleActual.idUsuario}`, {
      method: 'PUT',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok || !data.ok) {
      throw new Error(data.mensaje || 'No se pudieron guardar los permisos.');
    }

    mostrarAlertaUsuarios(
      'Permisos actualizados correctamente. El usuario deberá volver a iniciar sesión para tomar el nuevo alcance.',
      'success'
    );

    usuarioDetalleActual = data.usuario;
    await cargarUsuarios();
  } catch (error) {
    mostrarAlertaUsuarios(error.message, 'danger');
  } finally {
    if (boton) {
      boton.disabled = false;
      boton.textContent = 'Guardar cambios';
    }
  }
}


function leerAccesosFormulario() {
  const accesos = [];

  document.querySelectorAll('.acceso-edicion').forEach((tarjeta, indice) => {
    const idEmpresa = Number(tarjeta.querySelector('.campo-empresa')?.value || 0);
    const idRol = Number(tarjeta.querySelector('.campo-rol')?.value || 0);

    if (!idEmpresa) {
      throw new Error(`Debe seleccionar la empresa del acceso ${indice + 1}.`);
    }

    if (!idRol) {
      throw new Error(`Debe seleccionar el rol del acceso ${indice + 1}.`);
    }

    const scope = clave => {
      const bloque = tarjeta.querySelector(`[data-scope="${clave}"]`);
      const todos = Boolean(bloque?.querySelector('.scope-todos')?.checked);
      const valores = todos
        ? []
        : Array.from(
            bloque?.querySelectorAll('.scope-item:checked') || []
          ).map(item => item.value);

      return { todos, valores };
    };

    const marcas = scope('marcas');
    const rubros = scope('rubros');
    const licencias = scope('licencias');

    accesos.push({
      idEmpresa,
      idRol,
      todasMarcas: marcas.todos,
      marcas: marcas.valores.map(Number),
      todosRubros: rubros.todos,
      rubros: rubros.valores,
      todasLicencias: licencias.todos,
      licencias: licencias.valores
    });
  });

  return accesos;
}


function listaChips(items, obtenerTexto) {
  const lista = Array.isArray(items) ? items : [];

  if (!lista.length) {
    return '<span class="text-secondary">Sin permisos específicos</span>';
  }

  return lista
    .map(item => `<span class="badge text-bg-light border me-1 mb-1">${textoSeguro(obtenerTexto(item))}</span>`)
    .join('');
}


function pintarDetalleVacio() {
  const contenedor = document.getElementById('detalleUsuario');
  if (!contenedor) return;

  contenedor.innerHTML =
    '<div class="text-secondary text-center py-5">Seleccioná un usuario para consultar sus permisos.</div>';
}


function mostrarAlertaUsuarios(mensaje, tipo) {
  const alerta = document.getElementById('alertaUsuarios');
  if (!alerta) return;

  alerta.className = `alert alert-${tipo || 'danger'}`;
  alerta.textContent = String(mensaje || 'Error.');
}


function ocultarAlertaUsuarios() {
  const alerta = document.getElementById('alertaUsuarios');
  if (!alerta) return;

  alerta.className = 'alert d-none';
  alerta.textContent = '';
}


function textoSeguro(valor) {
  return String(valor ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}


function atributoSeguro(valor) {
  return textoSeguro(valor);
}


function formatearFecha(valor) {
  if (!valor) return '-';

  const fecha = new Date(valor);
  if (Number.isNaN(fecha.getTime())) return '-';

  return fecha.toLocaleString('es-AR');
}
