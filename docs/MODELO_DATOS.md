# Modelo de datos

## Identidad multiempresa

`ID_EMPRESA` forma parte del alcance de negocio. Las consultas de datos transaccionales y maestros deben filtrar por empresa. Una marca se identifica mediante `EMPRESAS_MARCAS`; el mismo código de módulo puede existir en empresas distintas.

## Altas

- `ALTAS_PRODUCTOS`: cabecera.
- `ALTAS_PRODUCTOS_DETALLE`: módulo, primera y segunda.
- `ALTAS_PRODUCTOS_FAMILIAS_DETALLE`: relaciones padre/hijo muchos-a-muchos.
- `ALTAS_PRODUCTOS_EXPORTADOS`: trazabilidad y estado ERP por `COD_ALFA`.

## Pedidos

- `PEDIDOS`: cabecera vinculada a Alta y proveedor.
- `PEDIDOS_DETALLE`: productos, cantidades y valores.
- `PEDIDOS_EXPORTACIONES`: historial de archivos.
- `PEDIDOS_EXPORT_CONFIG`: tres destinos por `ID_EMPRESA_MARCA`.

## ERP y maestros

- `PRODUCTOS`: catálogo confirmado por Presea; se preserva al limpiar pruebas.
- `PRODUCTOS_ERP_STAGING`: staging de sincronización.
- `CONTROL_IMPORTACIONES`: trazabilidad de importaciones.
- `MAESTRO_*`: catálogos segmentados por empresa cuando corresponde.

## Regla crítica

Toda unión con `MAESTRO_TALLES_MODULOS` debe usar `ID_EMPRESA + CODIGO_MODULO`. Unir solo por código mezcla curvas entre empresas.
