const express = require('express');
const router = express.Router();
const perfilService = require('../services/perfil.service');
const { requerirAutenticacion, obtenerContextoUsuario } = require('../middlewares/auth.middleware');

router.post('/verificar-email', async (req, res) => {
  try {
    const resultado = await perfilService.confirmarEmail(req.body?.token);
    return res.json({
      ok: true,
      mensaje: 'Email verificado correctamente. Por seguridad, las sesiones anteriores fueron cerradas. Inicie sesión nuevamente.',
      email: resultado.email
    });
  } catch (error) {
    return res.status(error.status || 400).json({ ok: false, mensaje: error.message });
  }
});

router.use(requerirAutenticacion);

router.get('/me', async (req, res) => {
  try {
    const perfil = await perfilService.obtenerPerfil(obtenerContextoUsuario(req));
    return res.json({ ok: true, perfil });
  } catch (error) {
    return res.status(error.status || 400).json({ ok: false, mensaje: error.message });
  }
});

router.put('/nombre', async (req, res) => {
  try {
    const contexto = obtenerContextoUsuario(req);
    const resultado = await perfilService.actualizarNombre(contexto, req.body?.nombre);
    req.session.usuario.nombre = resultado.nombre;
    req.usuario.nombre = resultado.nombre;
    req.session.save(error => {
      if (error) {
        return res.status(500).json({ ok: false, mensaje: 'El nombre se actualizó, pero no se pudo refrescar la sesión.' });
      }
      return res.json({ ok: true, mensaje: 'Nombre actualizado correctamente.', nombre: resultado.nombre });
    });
  } catch (error) {
    return res.status(error.status || 400).json({ ok: false, mensaje: error.message });
  }
});

router.post('/email', async (req, res) => {
  try {
    const resultado = await perfilService.solicitarCambioEmail(
      obtenerContextoUsuario(req),
      {
        email: req.body?.email,
        ip: req.ip,
        userAgent: req.get('user-agent') || ''
      }
    );
    return res.json(resultado);
  } catch (error) {
    console.error('[EMAIL VERIFY]', error.message);
    return res.status(error.status || 400).json({ ok: false, mensaje: error.message });
  }
});

module.exports = router;
