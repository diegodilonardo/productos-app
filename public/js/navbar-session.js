document.addEventListener(
  'DOMContentLoaded',
  iniciarNavbarSesion
);

let navbarContextoUsuario = null;
let navbarEmpresas = [];
let navbarAccesoActivo = null;

async function iniciarNavbarSesion() {
  const contenedor =
    document.getElementById(
      'navbarSesion'
    );

  if (!contenedor) {
    return;
  }

  try {
    const response =
      await fetch(
        '/api/auth/me',
        {
          headers: {
            Accept:
              'application/json'
          }
        }
      );

    if (!response.ok) {
      return;
    }

    const data =
      await response.json();

    if (
      !data?.ok ||
      !data?.autenticado ||
      !data?.usuario
    ) {
      return;
    }

    navbarContextoUsuario =
      data.usuario;

    navbarEmpresas =
      Array.isArray(
        data.usuario.empresas
      )
        ? data.usuario.empresas
        : [];

    prepararSelectorEmpresa();

    pintarSesion(
      data.usuario
    );

    document
      .getElementById(
        'btnCerrarSesion'
      )
      ?.addEventListener(
        'click',
        cerrarSesion
      );

  } catch (_) {
    /*
     * La barra no debe impedir
     * la carga de la pantalla.
     */
  }
}

function prepararSelectorEmpresa() {
  const selector =
    document.getElementById(
      'navbarEmpresaSelector'
    );

  if (!selector) {
    return;
  }

  if (navbarEmpresas.length <= 1) {
    selector.classList.add(
      'd-none'
    );

    return;
  }

  selector.innerHTML =
    '<option value="">Empresa...</option>' +
    navbarEmpresas
      .map(
        empresa => {
          const id =
            Number(
              empresa.idEmpresa
            );

          const nombre =
            String(
              empresa.empresa ||
              empresa.codigoEmpresa ||
              id
            ).trim();

          return (
            `<option value="${id}">` +
            `${escNavbar(nombre)}` +
            '</option>'
          );
        }
      )
      .join('');

  const activa =
    obtenerEmpresaActiva(
      navbarContextoUsuario,
      navbarEmpresas
    );

  if (activa) {
    selector.value =
      String(
        activa.idEmpresa
      );
  }

  selector.classList.remove(
    'd-none'
  );

  selector.addEventListener(
    'change',
    cambiarEmpresaNavbar
  );
}

function cambiarEmpresaNavbar(event) {
  const idEmpresa =
    Number(
      event.currentTarget.value
    );

  if (
    !Number.isInteger(idEmpresa) ||
    idEmpresa <= 0
  ) {
    return;
  }

  guardarEmpresaActiva(
    idEmpresa
  );

  if (navbarContextoUsuario) {
    pintarSesion(
      navbarContextoUsuario
    );
  }

  /*
   * Las pantallas migradas actualizan únicamente
   * sus datos y conservan el navbar montado.
   * Las pantallas todavía no migradas mantienen
   * la recarga completa como respaldo seguro.
   */
  const cambioEmpresa =
    new CustomEvent(
      'app:empresa-cambiada',
      {
        cancelable: true,
        detail: {
          idEmpresa
        }
      }
    );

  const actualizarSinRecarga =
    !window.dispatchEvent(
      cambioEmpresa
    );

  if (!actualizarSinRecarga) {
    window.location.reload();
  }
}

function guardarEmpresaActiva(
  idEmpresa
) {
  sessionStorage.setItem(
    'app.idEmpresa',
    String(idEmpresa)
  );

  /*
   * Compatibilidad temporal con
   * Pedidos V2.4.
   */
  sessionStorage.setItem(
    'pedidos.idEmpresa',
    String(idEmpresa)
  );
}

function pintarSesion(usuario) {
  const acceso =
    obtenerEmpresaActiva(
      usuario,
      navbarEmpresas
    );

  navbarAccesoActivo =
    acceso;

  const nombre =
    String(
      usuario.nombre ||
      usuario.usuario ||
      ''
    ).trim();

  const rol =
    usuario.superAdmin
      ? 'SUPER_ADMIN'
      : String(
          acceso?.rol ||
          ''
        )
          .trim()
          .toUpperCase();

  setTextoNavbar(
    'navbarUsuario',
    nombre
  );

  setTextoNavbar(
    'navbarRol',
    rol
  );

  document
    .getElementById(
      'navbarSesion'
    )
    ?.classList.remove(
      'd-none'
    );

  actualizarPermisosNavbar(
    usuario,
    acceso
  );

  pintarIdentidadEmpresa(
    acceso,
    usuario
  );
}

function actualizarPermisosNavbar(
  usuario,
  acceso
) {
  const puedeEscribir =
    Boolean(usuario?.superAdmin) ||
    [
      'SUPER_ADMIN',
      'ADMIN',
      'OPERADOR'
    ].includes(
      String(
        acceso?.rol || ''
      )
        .trim()
        .toUpperCase()
    );

  document
    .getElementById(
      'navNuevaAlta'
    )
    ?.classList.toggle(
      'd-none',
      !puedeEscribir
    );


  const puedeAdministrarUsuarios =
    Boolean(usuario?.superAdmin) ||
    (Array.isArray(usuario?.empresas) &&
      usuario.empresas.some(item =>
        String(item?.rol || '')
          .trim()
          .toUpperCase() === 'ADMIN'
      ));

  document
    .getElementById(
      'navUsuarios'
    )
    ?.classList.toggle(
      'd-none',
      !puedeAdministrarUsuarios
    );
}

function obtenerEmpresaActiva(
  usuario,
  empresas
) {
  if (!empresas.length) {
    return null;
  }

  if (empresas.length === 1) {
    const unica =
      empresas[0];

    guardarEmpresaActiva(
      Number(
        unica.idEmpresa
      )
    );

    return unica;
  }

  const guardadaApp =
    Number(
      sessionStorage.getItem(
        'app.idEmpresa'
      )
    );

  const guardadaPedidos =
    Number(
      sessionStorage.getItem(
        'pedidos.idEmpresa'
      )
    );

  const idPreferido =
    guardadaApp ||
    guardadaPedidos;

  const encontrada =
    empresas.find(
      item =>
        Number(
          item.idEmpresa
        ) ===
        idPreferido
    );

  if (encontrada) {
    guardarEmpresaActiva(
      Number(
        encontrada.idEmpresa
      )
    );
  }

  return encontrada || null;
}

function pintarIdentidadEmpresa(
  acceso,
  usuario
) {
  const contexto =
    document.getElementById(
      'navbarBrandContext'
    );

  if (!contexto) {
    return;
  }

  if (!acceso) {
    setTextoNavbar(
      'navbarEmpresa',
      usuario.superAdmin
        ? 'MULTIEMPRESA'
        : ''
    );

    const marcas =
      document.getElementById(
        'navbarMarcas'
      );

    if (marcas) {
      marcas.innerHTML = '';
    }

    contexto.classList.toggle(
      'd-none',
      !usuario.superAdmin &&
      navbarEmpresas.length <= 1
    );

    return;
  }

  const empresa =
    String(
      acceso.empresa ||
      acceso.codigoEmpresa ||
      ''
    ).trim();

  setTextoNavbar(
    'navbarEmpresa',
    navbarEmpresas.length > 1
      ? ''
      : empresa
  );

  const marcas =
    acceso.todasMarcas
      ? []
      : (
          Array.isArray(
            acceso.marcas
          )
            ? acceso.marcas
            : []
        );

  const contenedorMarcas =
    document.getElementById(
      'navbarMarcas'
    );

  if (!contenedorMarcas) {
    return;
  }

  if (acceso.todasMarcas) {
    contenedorMarcas.innerHTML =
      '<span class="app-navbar-brand-chip">TODAS LAS MARCAS</span>';
  } else {
    contenedorMarcas.innerHTML =
      marcas
        .map(
          marca =>
            marcaVisual(
              marca,
              acceso
            )
        )
        .join('');
  }

  contexto.classList.remove(
    'd-none'
  );
}

function marcaVisual(
  marca,
  acceso
) {
  const codigo =
    String(
      marca.codigoMarca ??
      marca.CODIGO_MARCA ??
      ''
    ).trim();

  const detalle =
    String(
      marca.detalleMarca ??
      marca.DETALLE_MARCA ??
      codigo
    ).trim();

  const idEmpresa =
    Number(
      acceso?.idEmpresa ||
      0
    );

  const logoConocido =
    obtenerLogoMarcaConocida(
      codigo,
      detalle
    );

  const claseMarca =
    obtenerClaseVisualMarca(
      codigo,
      detalle
    );

  const logoEmpresa =
    codigo && idEmpresa
      ? (
          `/img/marcas/${idEmpresa}/` +
          `${encodeURIComponent(codigo)}.png`
        )
      : '';

  const logoGlobal =
    codigo
      ? (
          `/img/marcas/` +
          `${encodeURIComponent(codigo)}.png`
        )
      : '';

  const img =
    codigo
      ? (
          `<img class="app-navbar-brand-logo" ` +
          `src="${escNavbar(logoConocido || logoEmpresa || logoGlobal)}" ` +
          `data-fallback="${escNavbar(logoGlobal)}" ` +
          `alt="${escNavbar(detalle)}" ` +
          `onload="this.closest('.app-navbar-brand-chip')?.classList.add('has-logo')" ` +
          `onerror="fallbackLogoMarca(this)">`
        )
      : '';

  return (
    `<span class="app-navbar-brand-chip ${claseMarca}">` +
      img +
      `<span class="app-navbar-brand-name">${escNavbar(detalle)}</span>` +
    '</span>'
  );
}

function obtenerClaseVisualMarca(
  codigo,
  detalle
) {
  const identidad =
    `${codigo} ${detalle}`
      .trim()
      .toUpperCase();

  if (identidad.includes('ATOMIK')) {
    return 'marca-atomik';
  }

  if (identidad.includes('MONTAGNE')) {
    return 'marca-montagne';
  }

  if (
    identidad.includes('47 STREET') ||
    identidad.includes('47_STREET')
  ) {
    return 'marca-47-street';
  }

  if (
    String(codigo).trim() === '101' ||
    identidad.includes('MASSIMO')
  ) {
    return 'marca-massimo';
  }

  if (
    ['34', '5'].includes(String(codigo).trim()) ||
    identidad.includes('WAKE') ||
    identidad.includes('MARCEL')
  ) {
    return 'marca-logo-oscuro';
  }

  return '';
}

function obtenerLogoMarcaConocida(
  codigo,
  detalle
) {
  const identidad =
    `${codigo} ${detalle}`
      .trim()
      .toUpperCase();

  if (identidad.includes('ATOMIK')) {
    return '/img/marcas/0.png';
  }

  if (identidad.includes('MONTAGNE')) {
    return '/img/marcas/10.png';
  }

  if (
    identidad.includes('47 STREET') ||
    identidad.includes('47_STREET')
  ) {
    return '/img/marcas/47.png';
  }

  return '';
}

function fallbackLogoMarca(
  imagen
) {
  const fallback =
    imagen.dataset.fallback;

  if (
    fallback &&
    imagen.src !==
      new URL(
        fallback,
        window.location.origin
      ).href
  ) {
    imagen.src =
      fallback;

    imagen.dataset.fallback =
      '';

    return;
  }

  imagen.style.display =
    'none';

  imagen
    .closest(
      '.app-navbar-brand-chip'
    )
    ?.classList.remove(
      'has-logo'
    );
}

async function cerrarSesion() {
  const boton =
    document.getElementById(
      'btnCerrarSesion'
    );

  try {
    if (boton) {
      boton.disabled = true;
      boton.textContent =
        'Saliendo...';
    }

    await fetch(
      '/api/auth/logout',
      {
        method: 'POST',
        headers: {
          Accept:
            'application/json'
        }
      }
    );

  } finally {
    sessionStorage.removeItem(
      'app.idEmpresa'
    );

    sessionStorage.removeItem(
      'pedidos.idEmpresa'
    );

    window.location.assign(
      '/login'
    );
  }
}

function setTextoNavbar(
  id,
  valor
) {
  const elemento =
    document.getElementById(
      id
    );

  if (elemento) {
    elemento.textContent =
      valor || '';
  }
}

function escNavbar(valor) {
  return String(
    valor ?? ''
  ).replace(
    /[&<>'"]/g,
    caracter => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;'
    })[caracter]
  );
}
