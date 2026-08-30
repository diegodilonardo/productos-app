# Productos App

Aplicación interna para gestionar Altas de productos, conciliarlas con Presea y generar Pedidos comerciales. Soporta múltiples empresas y marcas, permisos por alcance, exportaciones DBI/Excel y envío FTP.

## Tecnología

- Node.js 22 + Express 5
- Handlebars + Bootstrap + JavaScript
- SQL Server (`PRODUCTOS_APP`)
- `basic-ftp`, `mssql`, `xlsx`, `exceljs` y `node-cron`

## Inicio rápido

1. Instalar dependencias: `npm install`.
2. Crear `.env` usando [CONFIGURACION.md](docs/CONFIGURACION.md). Nunca versionar credenciales.
3. Verificar SQL Server y las migraciones de `sql/`.
4. Iniciar: `npm run dev` o `npm start`.
5. Comprobar `GET /api/status`.

El servidor valida SQL antes de escuchar. Los jobs de maestros y productos ERP se inician después; un fallo FTP no debe apagar la aplicación.

## Verificación

```powershell
npm test
node --check src/server.js
```

## Documentación

- [Arquitectura](docs/ARQUITECTURA.md)
- [Configuración](docs/CONFIGURACION.md)
- [Modelo de datos](docs/MODELO_DATOS.md)
- [Flujo de Altas](docs/FLUJO_ALTAS.md)
- [Flujo de Pedidos](docs/FLUJO_PEDIDOS.md)
- [Multiempresa y seguridad](docs/MULTIEMPRESA.md)
- [Operación](docs/OPERACION.md)
- [Pruebas](docs/PRUEBAS.md)
- [Despliegue](docs/DESPLIEGUE.md)
- [Decisiones](docs/DECISIONES.md)
- [Pendientes](docs/PENDIENTES.md)
