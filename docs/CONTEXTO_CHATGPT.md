# PRODUCTOS_APP — Contexto operativo para continuar el desarrollo

**Snapshot:** 2026-08-19  
**Base entregada por el usuario:** `productos-app.zip`  
**Objetivo de este documento:** permitir retomar el proyecto sin reconstruir el histórico completo de conversaciones.

## 1. Arquitectura actual

- Backend: Node.js + Express.
- Base de datos: SQL Server, base `PRODUCTOS_APP`.
- Frontend: Handlebars + Bootstrap 5 + JavaScript vanilla/fetch.
- Sincronización de maestros: al iniciar el servidor y luego cada 10 minutos.
- Sincronización de productos ERP/Presea: al iniciar y por CRON, por defecto cada 10 minutos.
- Exportación ERP: DBF dBASE III codificado en Windows-1252 y renombrado a `.DBI`.
- Imágenes: JPG/JPEG/PNG, máximo 6 MB, almacenadas fuera de la base.

Comando normal de desarrollo:

```bash
npm run dev
```

No ejecutar simultáneamente el scheduler ERP por separado cuando `server.js` ya está activo.

## 2. Tablas principales

Aplicación:
- `dbo.ALTAS_PRODUCTOS`
- `dbo.ALTAS_PRODUCTOS_DETALLE`
- `dbo.ALTAS_PRODUCTOS_EXPORTADOS`
- `dbo.PRODUCTOS`
- `dbo.PRODUCTOS_ERP_STAGING`
- `dbo.CONTROL_IMPORTACIONES`

Maestros:
- `MAESTRO_ANOS`
- `MAESTRO_CLASIFICACION`
- `MAESTRO_COLORES`
- `MAESTRO_DEPORTES`
- `MAESTRO_EDADES`
- `MAESTRO_GRUPOS`
- `MAESTRO_LINEA`
- `MAESTRO_MARCAS`
- `MAESTRO_MODELOS`
- `MAESTRO_ORIGENES`
- `MAESTRO_PAISES`
- `MAESTRO_RUBROS`
- `MAESTRO_RUBRO_FACT`
- `MAESTRO_SEXO`
- `MAESTRO_SUBGRUPOS`
- `MAESTRO_TALLES`
- `MAESTRO_TALLES_MODULOS`
- `MAESTRO_TEMPORADAS`

## 3. Estados

Cabecera de Alta:
- `BORRADOR`
- `VALIDADO`
- `EXPORTADO`
- `PARCIAL_ERP`
- `GENERADO_OK_EN_ERP`
- `ANULADO`

Detalle:
- `PENDIENTE`
- `VALIDO`
- `EXISTE_ERP`
- `DUPLICADO_LOTE`
- `ERROR`
- `EXPORTADO`

Exportación / conciliación ERP:
- `PENDIENTE_ERP`
- `GENERADO_OK_EN_ERP`
- `ERROR_ERP`

## 4. Regla 1 Alta = 1 Licencia

La primera familia/producto del Alta define la licencia.

- Si el primer producto tiene licencia, el Alta queda ligado a esa licencia.
- Si no tiene licencia, queda como `SIN LICENCIA`.
- Los productos siguientes deben pertenecer a la misma licencia.
- Mientras el Alta BORRADOR no tenga productos, el selector puede cambiarse.
- Al existir productos, el selector se bloquea.
- Si se eliminan todos los productos del BORRADOR, vuelve a liberarse.

## 5. Tipos de producto

### MÓDULO
Genera:
1. el módulo principal;
2. un PAR_SUELTO PRIMERA por cada talle activo de la curva;
3. un PAR_SUELTO SEGUNDA por cada talle activo de la curva.

El módulo es la raíz de la familia.

### PAR_SUELTO
El producto ingresado manualmente genera:
1. PRIMERA;
2. SEGUNDA automática.

La PRIMERA manual es la raíz de la familia.

## 6. Clasificaciones

Regla base backend actual:
- PAR_SUELTO: código `1` — PRIMERA.
- MODULO: códigos permitidos `0,3,4,5,6,7,8,9`.

Regla visual adicional EDAD + SEXO para MÓDULO:

| EDAD | SEXO | CLASIFICACIÓN |
|---|---|---|
| ADULTO | MAS / HOM | MOD.HOM |
| ADULTO | FEM | MOD.MUJ |
| ADULTO | UNI | MOD.UNI |
| BABY | MAS / HOM | MOD.BB |
| BABY | MUJ | MOD.BB |
| BABY | UNI | MOD.BB |
| JUNIOR | MAS / HOM / MUJ / UNI | MOD.JUN |
| KIDS | MAS / HOM / MUJ / UNI | MOD.KID |
| TEEN | MAS / HOM / MUJ / UNI | MOD.TEEN |
| YOUTH | MAS / HOM / MUJ / UNI | MOD.YOUTH |

Comportamiento actual:
- clasificación se bloquea hasta seleccionar Edad + Sexo;
- al cambiar Edad o Sexo se recalcula;
- si queda una sola clasificación válida se autoselecciona.

**Importante:** esta regla EDAD + SEXO está implementada actualmente en frontend. Conviene duplicar la validación en backend antes de considerar el tema definitivamente cerrado, para evitar que una llamada directa a la API la saltee.

## 7. CODIGO_ALFA

Estructura:

```text
CODIGO_ANO
+ CODIGO_TEMPORADA
+ CODIGO_RUBRO
+ CODIGO_MODELO
+ CODIGO_CLASIFICACION
+ CODIGO_COLOR
+ CODIGO_MODULO o DETALLE_TALLE
```

Sin separadores.

Para PAR_SUELTO, el CODIGO_ALFA usa el `DETALLE_TALLE` visible; el frontend envía al backend el `CODIGO_TALLE` real del maestro.

El código numérico interno de Presea/ERP no se exporta en el DBI. Lo asigna Presea y luego se concilia por `COD_ALFA`.

## 8. Detalle

Longitud máxima ERP: 50 caracteres.

Concepto:
- MÓDULO: modelo + color + clasificación/curva en formato compacto.
- PAR_SUELTO: modelo + color + PRIMERA/SEGUNDA + talle.

Ejemplos conceptuales:
- `WEST GRIS 31-37 (1,2,3,3,2,2,2) 15P`
- `WEST GRIS PRIMERA 31`
- `WEST GRIS SEGUNDA 31`

## 9. NIVEL

- MÓDULO: `950`
- PAR_SUELTO: `900`

## 10. RUBRO_FACT — reglas Atomik conocidas

CALZADO:
- módulo: `MOD_CALZ_ATK`
- pares sueltos PRIMERA/SEGUNDA: `CALZ_ATK`

INDUMENTARIA:
- módulo: `MOD_INDU_ATK`
- pares sueltos: `INDU_ATK`

ACCESORIOS:
- módulo: `MOD_ACCE_ATK`
- pares sueltos: `ACCE_ATK`

POP:
- par suelto: `POP_ATK`
- actualmente no existe regla de módulo POP.

## 11. Talles por rubro

CALZADO:
- utiliza talles cuyo código contiene `T_`;
- excluye las variantes de indumentaria configuradas en frontend.

INDUMENTARIA:
- talles de indumentaria.

ACCESORIOS:
- `T00,T01,T02,T03,XS,S,M,L,XL,2X,3X`.

POP:
- `T00`.

## 12. Existencia en Presea

Cada registro generado se evalúa individualmente por `CODIGO_ALFA`.

- Si ya existe en `PRODUCTOS` → `EXISTE_ERP`.
- Si no existe → puede quedar exportable como `VALIDO`.
- Un `EXISTE_ERP` se muestra en el lote, pero no se exporta nuevamente al DBI.

La existencia del módulo y de cada PRIMERA/SEGUNDA se trata por separado.

## 13. Imágenes

- formatos: JPG/JPEG/PNG;
- máximo: 6 MB;
- una imagen activa por Año + Temporada + Modelo + Color;
- nombre físico basado en Año + Temporada + Modelo + Color;
- el módulo principal / producto manual principal es propietario visual de la imagen;
- hijos automáticos comparten la imagen;
- borrar una familia o anular un Alta no borra físicamente la imagen;
- se permite modificar imagen en `BORRADOR` y `VALIDADO`.

## 14. Mensajes visuales

En `Productos del Alta`, los mensajes transitorios están unificados como toast flotante:
- `success`: verde;
- `warning`: amarillo;
- `danger`: rojo;
- `info`: azul.

No deben desplazar la página al inicio.

Se mantienen como mensajes estructurales inline:
- estado del lote;
- motivo de anulación;
- paneles persistentes del flujo.

Las acciones que requieren decisión mantienen `confirm()` / `prompt()`.

## 15. Familias y filtros

- familias desplegables/plegables;
- principal visible;
- hijos ocultables;
- filtros por texto, estado, tipo y origen;
- con filtros activos se pueden mostrar hijos automáticos directamente;
- `Ver familia` devuelve al modo familiar.

## 16. Anulación

- disponible en BORRADOR;
- requiere confirmación y motivo;
- el motivo queda visible posteriormente;
- un Alta ANULADA es de solo lectura;
- se conservan sus productos históricos.

## 17. Exportación DBI

El writer genera dBASE III en Windows-1252 para preservar acentos y luego renombra DBF → DBI.

Cantidad actual de campos ERP: **38**.

Campos:
`DETALLE, NIVEL, FECHA_ALTA, COD_ALFA, MARCA, COD_SUBG, COD_TEM, COD_GRUPOC, SEXO, CLASIFIC, COLORC, LINEA, MODC, NOMB_ART, ORIG_PRO, RUBROS, RUBRO, TALLC, PARES, COD_ANO, COD_EDAD, RUBRO_FACT, PAIS, COD_DISCIP, LICENCIAS, DCLASIFIC, DCOD_TEM, DCOLORC, , DET_LINEA, DET_ORIGEN, DGRUPO, DISCIPLINA, DMARCA, DMODC, DSUBG, DTALLC, EDAD`.

## 18. Rutas principales

Web:
- `/`
- `/dashboard`
- `/altas`
- `/altas/nueva`
- `/altas/:id/productos`
- `/seguimiento`
- `/seguimiento/:id`

API:
- `/api/status`
- `/api/maestros/...`
- `/api/altas/...`
- `/api/seguimiento/...`
- `/api/imagenes/...`

## 19. Regla para futuras modificaciones

Antes de tocar un archivo:
1. usar esta snapshot como base;
2. modificar solo los archivos involucrados;
3. conservar las reglas aprobadas;
4. ejecutar `node --check` sobre JavaScript de Node/front cuando corresponda;
5. verificar balance de HTML/HBS si se modifica una vista;
6. entregar ZIP incremental con nombres/rutas exactas a reemplazar.

## 20. Advertencia Git de esta snapshot

El ZIP recibido contiene un repositorio Git cuyo último tag visible es:

`v1.0-flujo-estable`

y commit visible:

`ee34c53 Version estable - flujo completo Presea y sincronizacion ERP`

Sin embargo, la versión actual contiene numerosos cambios posteriores sin commit. Por lo tanto, **el contenido del ZIP recibido debe considerarse la fuente de verdad actual**, no el último commit/tag histórico.
