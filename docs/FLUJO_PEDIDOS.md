# Flujo de Pedidos

## Origen

Solo se ofrecen Altas `GENERADO_OK_EN_ERP` o `SIN_NOVEDADES_ERP`. El usuario selecciona Alta, proveedor y orden; los productos se limitan al mismo alcance.

## Cantidades

- Se ingresan pares y FOB/adicional por par.
- MÓDULO exige cantidad entera, positiva y divisible por los pares de la curva.
- PAR_SUELTO no calcula módulos.
- Frontend bloquea Guardar y backend repite la validación.

## Estados

El Pedido se crea `BORRADOR`, puede modificarse y luego pasa a `VALIDADO`. También puede ser `ANULADO`. Solo un Pedido validado se exporta.

## Archivos

- `PEDIDO_<orden>_<proveedor>.xlsx`
- `MASTER_DATA_APP_<marca>_<orden>.xlsx`
- `PREC_FOB_<orden>.DBI`

Cada exportación consulta `PEDIDOS_EXPORT_CONFIG`, guarda respaldo local, envía al FTP y registra usuario, fecha, cantidad y estado. Si falta una ruta o la configuración está inactiva, no existe fallback a otra marca.
