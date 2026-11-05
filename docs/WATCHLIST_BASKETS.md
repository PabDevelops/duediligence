# Cestas de seguimiento

La ruta activa es `app/(main)/watchlist/page.js`; `app/_legacy/watchlist/page.js` no se modifica. La pantalla conserva navegación, empresas, precios, veredictos y alta/baja de seguimiento. «Todos» es la vista inicial.

Cada empresa puede estar en una cesta, reutilizando `watchlists.pie`. «Sin cesta» representa `pie = null` o vacío. Mover una empresa cambia solo ese campo; no crea otro seguimiento. Se conservan el identificador, ticker y fecha original. La cesta literal «General» se distingue de los seguimientos sin asignación.

Las cuentas pueden crear cestas vacías, renombrarlas, eliminarlas y añadir empresas directamente a la cesta seleccionada. Borrar una cesta devuelve sus empresas a «Sin cesta». Dejar de seguir una empresa sigue siendo una acción separada. Los visitantes mantienen su lista temporal anterior, sin cestas.

## Datos y API

- `supabase/add_watchlist_baskets.sql` añade únicamente el registro de nombres `watchlist_baskets` y una función transaccional de renombrado/borrado. No cambia las claves ni elimina filas de `watchlists`.
- La migración incorpora los nombres `pie` existentes sin modificar las asignaciones. Se puede ejecutar de nuevo.
- `/api/watchlist/baskets` requiere sesión y toma la identidad del servidor. RLS permite leer solo los propios nombres; las escrituras y la función SQL quedan reservadas al servidor con `service_role`.
- La función SQL actualiza nombres y asignaciones en una transacción. Un nombre de destino existente produce un conflicto, sin fusionar cestas.
- Se mantiene el contrato `tickers` de `/api/watchlist` y su límite gratuito de 20 empresas. Añadir sin `pie` conserva la asignación existente; mover usa el PATCH existente. La interfaz confirma los cambios después de recibir éxito.
- Si no está instalada la migración, la pantalla sigue mostrando los seguimientos y las categorías anteriores, informa del fallo y desactiva la gestión de cestas.

## Publicación futura

Esta PR es un borrador y no aplica SQL ni publica la web. Cuando se autorice su publicación:

1. Guardar una copia de seguridad de la base de datos y probar primero en un entorno de pruebas con una copia de los seguimientos existentes.
2. Confirmar que está aplicado `supabase/add_watchlist_pie.sql`. Aplicar después `supabase/add_watchlist_baskets.sql`.
3. Comparar las filas, identificadores, fechas y tickers de `watchlists` antes/después. Deben coincidir exactamente; comprobar también el backfill de nombres.
4. Completar la compilación y la prueba con sesión real de dos cuentas en el entorno de pruebas antes de publicar.

Volver a la versión anterior de la interfaz no exige borrar la tabla nueva ni revertir asignaciones. El campo `pie` sigue siendo compatible con la versión anterior.

`vercel.json` desactiva los despliegues automáticos exclusivamente para `feat/watchlist-baskets`; las demás ramas conservan su configuración. No subir primero una rama apuntando a un commit sin esta protección. [Documentación de Vercel](https://vercel.com/docs/project-configuration/git-configuration).

## Validación de esta entrega

- `npm test`: 187 pruebas, incluidas 37 nuevas de API, autenticación, aislamiento, compatibilidad, límites y fallos de escritura.
- ESLint de los seis archivos JavaScript afectados: sin errores ni avisos. La revisión global mantiene 98 errores y 60 avisos en archivos no modificados.
- PostgreSQL local mediante PGlite, con datos ficticios: migración y segunda ejecución, backfill, cestas vacías, colisiones con reversión, renombrado, eliminación sin perder seguimientos, fechas/IDs intactos, RLS y permisos de la función.
- Chromium de escritorio y móvil (390 px y nombres de 80 caracteres a 320 px): componente real y handlers reales en un entorno de prueba aislado, con autenticación y transporte PostgREST simulados y SQL ejecutado en PGlite. Crear, persistir al recargar, mover, filtrar, añadir (también a «Sin cesta»), renombrar, borrar, recuperación de errores, ausencia de migración y regresión de invitados: correcto. Sin errores de JavaScript ni desbordamiento horizontal.
- La compilación completa de Next no se pudo verificar en este Windows: Turbopack falla al crear una junction y webpack falla al crear directorios de salida (`EPERM`). No se cambia la configuración de Next para ocultarlo. La prueba aislada de navegador no sustituye esta comprobación ni valida Supabase/alojamiento reales.

Los scripts auxiliares de la prueba aislada y sus dependencias temporales no forman parte de la aplicación. No se han utilizado credenciales de producción, aplicado migraciones reales ni ejecutado despliegues.
