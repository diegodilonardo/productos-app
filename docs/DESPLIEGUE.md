# Despliegue

1. Ejecutar `npm test` y `node --check` sobre archivos modificados.
2. Hacer backup de SQL, imágenes y configuración.
3. Aplicar scripts SQL pendientes una sola vez y verificar resultados.
4. Confirmar empresas, marcas, permisos y destinos activos.
5. Limpiar datos de prueba solo con autorización y backup.
6. Instalar dependencias con lockfile.
7. Configurar `.env` de producción.
8. Iniciar un único proceso web; verificar jobs y `/api/status`.
9. Ejecutar una prueba controlada por empresa sin sobrescribir archivos reales.

Nunca desplegar `.env`, `salidas/`, `tmp/` ni credenciales en Git.
