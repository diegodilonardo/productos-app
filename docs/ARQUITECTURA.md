# Arquitectura

## Capas

`routes` recibe HTTP y aplica autenticación; `services` contiene reglas de negocio; `repositories` ejecuta SQL parametrizado; `views` y `public/js` implementan la interfaz. La conexión está centralizada en `src/config/database.js`.

## Módulos

- Autenticación, recuperación de contraseña y verificación de email.
- Usuarios, empresas, roles, marcas, rubros y licencias.
- Maestros importados desde FTP/archivos.
- Altas, familias automáticas, imágenes, validación y exportación DBI.
- Conciliación de productos con Presea.
- Pedidos, detalle comercial y exportaciones Excel/DBI.

## Procesos en segundo plano

- Maestros: ejecución inicial y cron mediante `importarMaestros.job.js`.
- Productos ERP: cron mediante `productosErpSync.scheduler.js`.
- Los jobs usan control de ejecución para evitar solapamientos.
- FTP incorpora reintentos para errores transitorios y circuit breaker persistente.

## Rutas principales

Web: `/dashboard`, `/altas`, `/altas/nueva`, `/altas/:id/productos`, `/seguimiento`, `/seguimiento/:id`, `/pedidos`, `/pedidos/nuevo`, `/pedidos/:id`, `/usuarios` y `/perfil`.

API: `/api/auth`, `/api/usuarios`, `/api/perfil`, `/api/maestros`, `/api/altas`, `/api/imagenes`, `/api/seguimiento`, `/api/pedidos` y `/api/status`.
