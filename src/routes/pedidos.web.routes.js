const express = require('express');

const router = express.Router();

const { validarSesionVigente } = require('../middlewares/auth.middleware');

/* ============================================================
   LOGIN WEB
   ============================================================ */

router.get('/login', async (req, res) => {
  try {
    if (req.session?.usuario && await validarSesionVigente(req)) {
      return res.redirect('/pedidos');
    }
  } catch (error) {
    console.error(error);
  }

  return res.render('auth/login-v2g', {
    title: 'Iniciar sesión',
    pagina: 'login',
    style: '/css/login.css?v=2',
    script: '/js/login.js',
    next: req.query.next || '/pedidos'
  });
});


/* ============================================================
   RECUPERACION DE PASSWORD - PUBLICO
   ============================================================ */

router.get('/recuperar-password', async (req, res) => {
  try {
    if (req.session?.usuario && await validarSesionVigente(req)) {
      return res.redirect('/pedidos');
    }
  } catch (error) {
    console.error(error);
  }

  return res.render('auth/recuperar-password', {
    title: 'Recuperar contraseña',
    pagina: 'login',
    style: '/css/login.css?v=2',
    script: '/js/recuperar-password.js'
  });
});

router.get('/verificar-email', (req, res) => {
  res.set('Referrer-Policy', 'no-referrer');
  return res.render('auth/verificar-email', {
    title: 'Verificar email',
    pagina: 'login',
    style: '/css/login.css?v=2',
    script: '/js/verificar-email-v2h.js',
    token: String(req.query.token || '')
  });
});


router.get('/restablecer-password', async (req, res) => {
  res.set('Referrer-Policy', 'no-referrer');

  try {
    if (req.session?.usuario && await validarSesionVigente(req)) {
      return res.redirect('/pedidos');
    }
  } catch (error) {
    console.error(error);
  }

  return res.render('auth/restablecer-password', {
    title: 'Restablecer contraseña',
    pagina: 'login',
    style: '/css/login.css?v=2',
    script: '/js/restablecer-password.js',
    token: String(req.query.token || '')
  });
});


/* ============================================================
   AUTENTICACION PARA RUTAS WEB
   - La API continúa usando auth.middleware.js.
   - En web redirigimos al login en lugar de devolver JSON 401.
   ============================================================ */

async function requerirAutenticacionWeb(req, res, next) {
  try {
    if (await validarSesionVigente(req)) {
      return next();
    }
  } catch (error) {
    console.error(error);
  }

  const nextUrl =
    req.originalUrl &&
    req.originalUrl.startsWith('/')
      ? req.originalUrl
      : '/pedidos';

  return res.redirect(
    '/login?next=' +
    encodeURIComponent(nextUrl)
  );
}

router.use(requerirAutenticacionWeb);


/* ============================================================
   PEDIDOS
   ============================================================ */

router.get('/pedidos', (req, res) => {
  res.render('pedidos/index', {
    title: 'Pedidos',
    pagina: 'pedidos',
    style: '/css/pedidos.css?v=5',
    script: '/js/pedidos-index.js?v=7',
  });
});

router.get('/pedidos/nuevo', (req, res) => {
  res.render('pedidos/nuevo', {
    title: 'Nuevo Pedido',
    pagina: 'pedidos',
    style: '/css/pedidos.css?v=8',
    script: '/js/pedido-nuevo.js?v=5',
    idAltaPreseleccionada: req.query.alta || '',
  });
});

router.get('/pedidos/:id', (req, res) => {
  res.render('pedidos/detalle', {
    title: 'Detalle Pedido',
    pagina: 'pedidos',
    style: '/css/pedidos.css?v=6',
    script: '/js/pedido-detalle.js?v=4',
    idPedido: req.params.id,
  });
});

module.exports = router;
