# Decisiones vigentes

- Presea asigna código ERP/EAN; la aplicación concilia por `COD_ALFA`.
- Un Alta sin novedades ERP puede originar re-orders.
- Un Pedido de módulo se carga en pares, pero exige módulos exactos.
- Altas y Pedidos tienen configuraciones FTP separadas.
- La falta de configuración bloquea; no se usa una ruta predeterminada de otra marca.
- PRODUCTOS y maestros se preservan al limpiar transacciones.
- KEVINGSTON se conserva como marca histórica inactiva.
- Fechas SQL `DATETIME2` se presentan como hora local, sin reinterpretarlas como UTC.
