# Operación

## Inicio

1. Verificar SQL Server y `.env`.
2. Ejecutar `npm start`.
3. Consultar `/api/status` y logs de jobs.
4. No iniciar schedulers independientes junto con `server.js`.

## Incidentes FTP

Los errores transitorios se reintentan. El circuit breaker abre después del umbral y bloquea temporalmente nuevas operaciones. Una exportación fallida conserva archivos locales. No cambiar rutas para sortear permisos: corregir la configuración de la marca.

## Limpieza de pruebas

`sql/Limpiar BD Productos y Pedidos.sql` elimina Altas y Pedidos de todas las empresas, reinicia identities y preserva PRODUCTOS, maestros, usuarios y configuraciones. Requiere backup previo. No elimina archivos locales, imágenes ni FTP.

## Backup mínimo

- Base `PRODUCTOS_APP`.
- `.env` mediante almacenamiento seguro.
- Carpetas de imágenes.
- Configuración y estado de FTP/circuit breaker.
