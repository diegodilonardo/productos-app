# Flujo de Altas

## Estados

`BORRADOR` → `VALIDADO` → `EXPORTADO` → `PARCIAL_ERP` o `GENERADO_OK_EN_ERP`. Si todos los productos ya existen se cierra como `SIN_NOVEDADES_ERP`. Un borrador puede quedar `ANULADO` con motivo.

## Familias

- MÓDULO: principal + PRIMERA y SEGUNDA por cada talle activo.
- PAR_SUELTO: PRIMERA principal + SEGUNDA automática.
- La relación explícita vive en `ALTAS_PRODUCTOS_FAMILIAS_DETALLE`.

## Reglas

- Un Alta utiliza una sola licencia.
- `COD_ALFA` es la identidad de conciliación con Presea.
- `EDAD + SEXO` determina la clasificación de MÓDULO; se valida en frontend y backend.
- Existencia en ERP se evalúa registro por registro.
- La imagen pertenece visualmente al principal y se comparte con la familia.

## Exportación

La validación bloquea cambios. Preview no impacta. Exportar genera DBI locales en Windows-1252, envía todos los archivos requeridos al FTP de la empresa/marca y recién entonces marca el Alta como exportada. Los archivos locales se conservan para reintento.
