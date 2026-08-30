const express = require('express');

const router =
  express.Router();

const authService =
  require('../services/auth.service');

const passwordResetService =
  require('../services/password-reset.service');


const intentosRecuperacion = new Map();

function permitirSolicitudRecuperacion(req) {
  const ventanaMs = 15 * 60 * 1000;
  const maxIntentos = 3;
  const ahora = Date.now();
  const identificador = String(req.body?.identificador || '').trim().toLowerCase();
  const clave = `${req.ip || 'sin-ip'}|${identificador}`;
  const anteriores = (intentosRecuperacion.get(clave) || [])
    .filter(fecha => ahora - fecha < ventanaMs);

  if (anteriores.length >= maxIntentos) {
    intentosRecuperacion.set(clave, anteriores);
    return false;
  }

  anteriores.push(ahora);
  intentosRecuperacion.set(clave, anteriores);

  if (intentosRecuperacion.size > 5000) {
    for (const [k, fechas] of intentosRecuperacion.entries()) {
      const vigentes = fechas.filter(fecha => ahora - fecha < ventanaMs);
      if (vigentes.length) intentosRecuperacion.set(k, vigentes);
      else intentosRecuperacion.delete(k);
    }
  }

  return true;
}


router.post(
  '/login',
  async (
    req,
    res
  ) => {

    try {

      const contexto =
        await authService.login({
          usuario:
            req.body?.usuario,

          password:
            req.body?.password
        });


      if (!contexto) {
        return res.status(401).json({
          ok: false,
          mensaje:
            'Usuario o contraseña incorrectos.'
        });
      }


      req.session.usuario =
        contexto;


      req.session.save(
        error => {

          if (error) {

            console.error(
              error
            );

            return res.status(500).json({
              ok: false,
              mensaje:
                'No se pudo iniciar la sesión.'
            });
          }


          return res.json({
            ok: true,
            usuario:
              contexto
          });
        }
      );


    } catch (error) {

      console.error(error);

      return res.status(400).json({
        ok: false,
        mensaje:
          error.message
      });
    }
  }
);


router.get(
  '/me',
  async (
    req,
    res
  ) => {

    if (!req.session?.usuario) {
      return res.status(401).json({
        ok: false,
        autenticado: false
      });
    }

    try {
      const vigente =
        await authService.validarContextoSesion(
          req.session.usuario
        );

      if (!vigente) {
        await new Promise(resolve => {
          req.session.destroy(() => resolve());
        });

        return res.status(401).json({
          ok: false,
          autenticado: false,
          mensaje: 'La sesión ya no es válida. Inicie sesión nuevamente.'
        });
      }

      return res.json({
        ok: true,
        autenticado: true,
        usuario: req.session.usuario
      });
    } catch (error) {
      console.error(error);
      return res.status(500).json({
        ok: false,
        autenticado: false,
        mensaje: 'No se pudo validar la sesión.'
      });
    }
  }
);


router.post('/recuperar-password', async (req, res) => {
  const respuestaNeutra = {
    ok: true,
    mensaje: 'Si el usuario existe y tiene un correo configurado, recibirá un enlace para restablecer su contraseña.'
  };

  try {
    if (!permitirSolicitudRecuperacion(req)) {
      return res.json(respuestaNeutra);
    }

    const resultado = await passwordResetService.solicitarRecuperacion({
      identificador: req.body?.identificador,
      ip: req.ip,
      userAgent: req.get('user-agent')
    });

    return res.json(resultado);
  } catch (error) {
    /*
     * Respuesta neutra para no revelar si la cuenta existe.
     * El error real queda en log para diagnóstico SMTP/configuración.
     */
    console.error('[PASSWORD RESET] No se pudo procesar la solicitud:', error.message);
    return res.json(respuestaNeutra);
  }
});


router.post('/restablecer-password', async (req, res) => {
  try {
    const resultado = await passwordResetService.restablecerPassword({
      token: req.body?.token,
      password: req.body?.password
    });

    return res.json(resultado);
  } catch (error) {
    console.error('[PASSWORD RESET]', error.message);
    return res.status(error.status || 400).json({
      ok: false,
      mensaje: error.message || 'No se pudo restablecer la contraseña.'
    });
  }
});


router.post(
  '/logout',
  (
    req,
    res
  ) => {

    if (!req.session) {
      return res.json({
        ok: true
      });
    }


    req.session.destroy(
      error => {

        if (error) {

          console.error(error);

          return res.status(500).json({
            ok: false,
            mensaje:
              'No se pudo cerrar la sesión.'
          });
        }


        res.clearCookie(
          'productos.sid'
        );


        return res.json({
          ok: true
        });
      }
    );
  }
);


module.exports =
  router;
