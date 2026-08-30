# Pruebas

## Automatizadas

Ejecutar `npm test`. La suite usa `node:test` y no requiere SQL ni FTP.

Cobertura actual:

- Clasificación Edad/Sexo.
- Cálculo y divisibilidad de módulos.
- Tipos de producto.
- Configuración completa/inactiva/incompleta de destinos.
- Ausencia de fallback entre marcas.
- Estados de Altas habilitados para Pedidos.
- Unión de curvas por empresa y código.

## Regresión manual

Por cada marca operativa: crear/usar Alta, validar, exportar DBI, conciliar, crear Pedido, ingresar cantidad, validar y generar los tres archivos. Verificar FTP, respaldo local, historial, usuario y horario.
