const express = require('express');

const router = express.Router();

const { validarSesionVigente } = require('../middlewares/auth.middleware');

/* ============================================================
   AUTENTICACION WEB GLOBAL
   ============================================================ */

async function requerirAutenticacionWeb(req, res, next) {
  try {
    if (await validarSesionVigente(req)) {
      return next();
    }
  } catch (error) {
    console.error(error);
  }

  return res.redirect(
    '/login?next=' +
    encodeURIComponent(
      req.originalUrl || '/'
    )
  );
}

function accesoEmpresaActiva(req) {
  const contexto =
    req.session?.usuario;

  if (!contexto) {
    return null;
  }

  const empresas =
    Array.isArray(contexto.empresas)
      ? contexto.empresas
      : [];

  if (empresas.length === 1) {
    return empresas[0];
  }

  /*
   * La empresa activa se termina de resolver
   * en el frontend para usuarios multiempresa.
   * Para una ruta web no hacemos suposiciones.
   */
  return null;
}

function rolPermiteEscritura(rol) {
  return [
    'SUPER_ADMIN',
    'ADMIN',
    'OPERADOR'
  ].includes(
    String(rol || '')
      .trim()
      .toUpperCase()
  );
}

function requerirEscrituraWeb(req, res, next) {
  const contexto =
    req.session?.usuario;

  if (!contexto) {
    return res.redirect(
      '/login?next=' +
      encodeURIComponent(
        req.originalUrl || '/'
      )
    );
  }

  if (contexto.superAdmin) {
    return next();
  }

  const acceso =
    accesoEmpresaActiva(req);

  /*
   * Usuario multiempresa:
   * la validación fina de escritura se mantiene
   * en backend/API. En una ruta HTML todavía no
   * conocemos con certeza la empresa elegida.
   */
  if (!acceso) {
    return next();
  }

  if (
    !rolPermiteEscritura(
      acceso.rol
    )
  ) {
    return res
      .status(403)
      .send(
        'Su rol no permite modificar información.'
      );
  }

  return next();
}


function requerirAdminUsuariosWeb(req, res, next) {
  const contexto = req.session?.usuario;

  if (!contexto) {
    return res.redirect(
      '/login?next=' +
      encodeURIComponent(req.originalUrl || '/')
    );
  }

  const esAdmin =
    Boolean(contexto.superAdmin) ||
    (Array.isArray(contexto.empresas) &&
      contexto.empresas.some(item =>
        String(item?.rol || '')
          .trim()
          .toUpperCase() === 'ADMIN'
      ));

  if (!esAdmin) {
    return res
      .status(403)
      .send('Solo ADMIN o SUPER_ADMIN puede administrar usuarios.');
  }

  return next();
}


/* ============================================================
   TODA LA APP WEB REQUIERE SESION
   ============================================================ */

router.use(
  requerirAutenticacionWeb
);


/* ============================================================
   DASHBOARD
   ============================================================ */

router.get('/', (req, res) => {
  res.render('dashboard', {
    title: 'Dashboard',
    pagina: 'dashboard'
  });
});

router.get('/dashboard', (req, res) => {
  res.render('dashboard', {
    title: 'Dashboard',
    pagina: 'dashboard'
  });
});


/* ============================================================
   ALTAS
   ============================================================ */

router.get('/altas', (req, res) => {
  res.render('altas/index', {
    title: 'Altas de Productos',
    pagina: 'altas'
  });
});

router.get(
  '/altas/nueva',
  requerirEscrituraWeb,
  (req, res) => {
    const contexto = req.session?.usuario || {};

    res.render('altas/nueva', {
      title: 'Nueva Alta',
      pagina: 'nueva-alta',
      responsableAlta:
        contexto.nombre ||
        contexto.usuario ||
        'USUARIO',
      responsableLogin:
        contexto.usuario ||
        ''
    });
  }
);

router.get('/altas/:id/productos', (req, res) => {
  const contexto = req.session?.usuario || {};

  res.render('altas/productos', {
    title: 'Productos del Alta',
    pagina: 'altas',
    idAlta: req.params.id,
    responsableProducto:
      contexto.nombre ||
      contexto.usuario ||
      'USUARIO',
    responsableProductoLogin:
      contexto.usuario ||
      ''
  });
});


/* ============================================================
   SEGUIMIENTO
   ============================================================ */

router.get('/seguimiento', (req, res) => {
  res.render('seguimiento/index', {
    title: 'Seguimiento ERP',
    pagina: 'seguimiento'
  });
});

router.get('/seguimiento/:id', (req, res) => {
  res.render('seguimiento/detalle', {
    title: 'Seguimiento ERP',
    pagina: 'seguimiento',
    idAlta: req.params.id
  });
});


/* ============================================================
   MI PERFIL
   ============================================================ */

router.get('/perfil', (req, res) => {
  res.render('perfil', {
    title: 'Mi perfil',
    pagina: 'perfil',
    script: '/js/perfil-v2h.js?v=2'
  });
});

/* ============================================================
   USUARIOS Y PERMISOS
   ============================================================ */

router.get(
  '/usuarios',
  requerirAdminUsuariosWeb,
  (req, res) => {
    res.render('usuarios/index', {
      title: 'Usuarios y Permisos',
      pagina: 'usuarios',
      script: '/js/usuarios-admin-v2f.js?v=3'
    });
  }
);


module.exports = router;
