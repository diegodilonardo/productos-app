# Multiempresa y seguridad

## Alcance

La sesión contiene empresas habilitadas y, por acceso, rol, marcas, rubros y licencias. Los middlewares resuelven la empresa y verifican el Alta/Pedido antes de ejecutar el servicio.

Roles operativos: `SUPER_ADMIN`, `ADMIN`, `OPERADOR` y perfiles de consulta. Solo roles con escritura pueden crear, modificar, validar, anular o exportar.

## Marcas operativas

- VICBOR / ATOMIK → Pedidos `PEDIDOS\VICBOR`.
- MIDING / MONTAGNE → `PEDIDOS\MIDING\MONTAGNE`.
- MIDING / 47 STREET → `PEDIDOS\MIDING\47_STREET`.
- MIDING / KEVINGSTON permanece inactiva: ya no comercializa productos.

Las rutas de Altas y Pedidos son circuitos separados. Ninguna configuración debe heredarse entre empresas o marcas.
