# PRODUCTOS_APP V2 — BASE ESTABLE 2026-08-19

Este paquete fue preparado a partir del ZIP actual funcionando del proyecto.

## Para retomar el trabajo rápidamente

Leer en este orden:

1. `docs/CONTEXTO_CHATGPT.md`
2. `docs/PLAN_TEST_20_PUNTOS.md`
3. `docs/CHANGELOG.md`
4. `docs/PENDIENTES.md`

## Instalación

```bash
npm install
```

Copiar `.env.example` a `.env` y completar las rutas/credenciales locales.

```bash
npm run dev
```

## Seguridad y tamaño del paquete

Esta base NO incluye:
- `.env` real;
- `node_modules`;
- `.git`;
- archivos de `storage`.

Esto evita distribuir credenciales, dependencias regenerables, historial interno y archivos runtime.

El ZIP original entregado por el usuario sigue siendo la referencia íntegra local de esa máquina.
