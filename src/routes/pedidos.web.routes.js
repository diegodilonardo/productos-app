const express = require('express');

const router = express.Router();

router.get('/pedidos', (req, res) => {
  res.render('pedidos/index', {
    title: 'Pedidos',
    pagina: 'pedidos',
    style: '/css/pedidos.css',
    script: '/js/pedidos-index.js',
  });
});

router.get('/pedidos/nuevo', (req, res) => {
  res.render('pedidos/nuevo', {
    title: 'Nuevo Pedido',
    pagina: 'pedidos',
    style: '/css/pedidos.css',
    script: '/js/pedido-nuevo.js',
    idAltaPreseleccionada: req.query.alta || '',
  });
});

router.get('/pedidos/:id', (req, res) => {
  res.render('pedidos/detalle', {
    title: 'Detalle Pedido',
    pagina: 'pedidos',
    style: '/css/pedidos.css',
    script: '/js/pedido-detalle.js',
    idPedido: req.params.id,
  });
});

module.exports = router;
