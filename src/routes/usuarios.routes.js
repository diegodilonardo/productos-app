const express = require('express');

const router = express.Router();

const usuariosService =
  require('../services/usuarios.service');

const {
  requerirAutenticacion,
  requerirAdminUsuarios
} = require('../middlewares/auth.middleware');


router.use(
  requerirAutenticacion
);


router.get('/catalogos', requerirAdminUsuarios, async (req, res) => {
  try {
    const catalogos =
      await usuariosService.obtenerCatalogos(req.usuario);

    return res.json({
      ok: true,
      catalogos
    });
  } catch (error) {
    console.error(error);

    return res.status(error.status || 500).json({
      ok: false,
      mensaje:
        error.message ||
        'No se pudieron obtener los catálogos de seguridad.'
    });
  }
});


router.get('/', requerirAdminUsuarios, async (req, res) => {
  try {
    const usuarios =
      await usuariosService.listarUsuarios(req.usuario);

    return res.json({
      ok: true,
      usuarios
    });
  } catch (error) {
    console.error(error);

    return res.status(error.status || 500).json({
      ok: false,
      mensaje:
        error.message ||
        'No se pudieron obtener los usuarios.'
    });
  }
});


router.post('/', requerirAdminUsuarios, async (req, res) => {
  try {
    const usuario =
      await usuariosService.crearUsuario(
        req.body,
        req.usuario
      );

    return res.status(201).json({
      ok: true,
      mensaje: 'Usuario creado correctamente.',
      usuario
    });
  } catch (error) {
    console.error(error);

    return res.status(error.status || 500).json({
      ok: false,
      mensaje:
        error.message ||
        'No se pudo crear el usuario.'
    });
  }
});


router.put('/:id/password', requerirAdminUsuarios, async (req, res) => {
  try {
    const resultado =
      await usuariosService.cambiarPasswordUsuario(
        req.params.id,
        req.body,
        req.usuario
      );

    return res.json({
      ok: true,
      mensaje: 'Contraseña actualizada correctamente.',
      resultado
    });
  } catch (error) {
    console.error(error);

    return res.status(error.status || 500).json({
      ok: false,
      mensaje:
        error.message ||
        'No se pudo actualizar la contraseña.'
    });
  }
});


router.get('/:id', requerirAdminUsuarios, async (req, res) => {
  try {
    const usuario =
      await usuariosService.obtenerUsuario(
        req.params.id,
        req.usuario
      );

    return res.json({
      ok: true,
      usuario
    });
  } catch (error) {
    console.error(error);

    return res.status(error.status || 500).json({
      ok: false,
      mensaje:
        error.message ||
        'No se pudo obtener el usuario.'
    });
  }
});


router.put('/:id', requerirAdminUsuarios, async (req, res) => {
  try {
    const usuario =
      await usuariosService.actualizarUsuario(
        req.params.id,
        req.body,
        req.usuario
      );

    return res.json({
      ok: true,
      mensaje: 'Permisos actualizados correctamente.',
      usuario
    });
  } catch (error) {
    console.error(error);

    return res.status(error.status || 500).json({
      ok: false,
      mensaje:
        error.message ||
        'No se pudieron actualizar los permisos del usuario.'
    });
  }
});


module.exports = router;
