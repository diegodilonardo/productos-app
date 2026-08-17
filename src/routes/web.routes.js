const express = require('express');

const router = express.Router();

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

router.get('/altas', (req, res) => {
  res.render('altas/index', {
    title: 'Altas de Productos',
    pagina: 'altas'
  });
});

router.get('/altas/nueva', (req, res) => {
  res.render('altas/nueva', {
    title: 'Nueva Alta',
    pagina: 'nueva-alta'
  });
});

router.get('/altas/:id/productos', (req, res) => {
  res.render('altas/productos', {
    title: 'Productos del Alta',
    pagina: 'altas',
    idAlta: req.params.id
  });
});

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

module.exports = router;
