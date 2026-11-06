# Edición financiera desde el análisis completo

Solo una cuenta aceptada por el control de administración existente puede editar. Los datos corregidos son globales: se muestran a todos. No se alteran los datos del proveedor ni los de carteras, cuentas o watchlists.

## Uso

En Análisis completo, pulsar una cifra o N/D abre el editor. Permite indicar valor, escala (unidades/miles/millones), moneda, tipo y fechas fiscales, perímetro, fuente opcional y justificación obligatoria. No se inventan fechas: «Sin verificar» conserva un dato provisional. Guardar vacío fija un N/D intencional; no lo convierte en cero.

Se pueden corregir partidas actuales, ejercicios históricos y ratios publicados. En un cálculo como I+D/ingresos, P/FCF o capitalización se edita la partida base (importe de I+D, FCF o acciones), no un resultado cosmético. El BPA y el FCF históricos conducen al beneficio y al flujo operativo que los originan; CAPEX y acciones se pueden corregir en sus propias filas. Los precios de mercado, notas, DCF y resultados de escenarios no se editan directamente. Las fórmulas y la política de puntuación no cambian.

La corrección permanece aunque el proveedor cambie su valor o se actualice su caché. También conserva su periodo original: un FY antiguo no pasa a ser TTM. «Restaurar proveedor» añade una reversión y vuelve al dato automático disponible; no borra el historial.

Los importes incompatibles pueden guardarse como correcciones documentadas, pero siguen bloqueados para los cálculos afectados. Introducir FCF no permite prescindir de OCF y CAPEX compatibles. Las partidas manuales y sus resultados se consideran provisionales, no verificados automáticamente.

## Escudo de la ficha

- «Con correcciones manuales»: hay al menos una corrección activa. No afirma que todas las cuentas estén verificadas.
- «Cobertura alta»: las tres notas tienen al menos un 90% de cobertura cada una, están disponibles y no se detectan contradicciones bloqueantes. No equivale a una auditoría.
- La explicación se despliega tanto en escritorio como en móvil.

## Persistencia, acceso y rendimiento

La migración crea un registro de revisiones inmutable para las operaciones normales del servicio, una vista del último estado por ticker/partida y una función transaccional. La función usa security invoker; las tablas tienen RLS y no conceden acceso directo a anon/authenticated. Solo el servidor, con los permisos ya existentes del servicio y tras comprobar el administrador, puede escribir. Se registra el actor autenticado; no se publica su identificador.

Cada escritura compara la revisión leída y bloquea una clave por transacción. Una segunda sesión con una versión antigua recibe 409 y debe recargar. El origen de la petición se comprueba y los campos editables están limitados por lista explícita; no se aceptan propiedades arbitrarias ni resultados del motor.

Las correcciones se aplican al servir datos, después de leer la caché del proveedor. No se guardan dentro de stock_cache ni se pierden en sus actualizaciones. La ficha y el screener comparten la capa. La caché de correcciones dura 15 segundos, agrupa lecturas simultáneas y pagina de 1000 en 1000. El screener mantiene su proyección compacta y su ventana de 60 segundos. Tras un guardado se invalidan las cachés locales; otras instancias pueden tardar hasta 15 segundos en la ficha y hasta 60 segundos en el screener. No se añaden llamadas SEC/Yahoo/Finnhub al guardar.

Si la función está activada y no se pueden leer sus correcciones, el endpoint informa del fallo en lugar de presentar silenciosamente el dato del proveedor como si no hubiera correcciones.

## Activación pendiente: no realizada por este PR

1. Revisar y aplicar `supabase/migrations/20261106133037_admin_financial_overrides.sql` al proyecto correcto. Requiere PostgreSQL 15 o superior por la vista security_invoker. No requiere reactivar staging ni modificar usuarios existentes.
2. Comprobar los permisos y el funcionamiento de guardar/restaurar con una empresa de prueba controlada antes de activar el acceso público al código.
3. Configurar `FINANCIAL_OVERRIDES_ENABLED=true` exclusivamente como variable del servidor. No lleva prefijo NEXT_PUBLIC ni contiene credenciales. Mantener ADMIN_EMAILS como configuración de autorización existente.
4. Integrar/publicar el código solo después de aprobación. La rama tiene el preview automático deshabilitado. Hasta activar la variable, las lecturas actuales no hacen consultas nuevas y la edición informa de que no está habilitada.

Para desactivar, cambiar la variable a false y desplegar de forma controlada. Las revisiones permanecen guardadas; no se eliminan datos. Para revertir una cifra concreta, usar «Restaurar proveedor».

## Pruebas

Pruebas automatizadas de persistencia sobre actualizaciones del proveedor, restauración, N/D, periodos y monedas, cálculos dependientes, aislamiento por ticker, notas originales sin cambios cuando no hay correcciones, permisos, identidad del servidor, origen, errores de almacenamiento y conflicto 409. Pruebas de ambos significados del escudo y caché/paginación.

`scripts/verify-financial-overrides.mjs` ejecuta la migración en PostgreSQL PGlite en memoria, con roles y un usuario ficticio. Comprueba permisos, RLS, invoker, escritura, conflicto y conservación del historial. PGlite solo se instaló en herramientas locales externas al proyecto, no en las dependencias de BullTrace. Para reproducir, resolver @electric-sql/pglite o indicar la URL file absoluta del módulo en BULLTRACE_SQL_TEST_MODULE y ejecutar el script. No usa conexiones remotas ni claves.

Prueba visual local con datos públicos de BUDA y guardado simulado: N/D → I+D manual, recarga, visibilidad del dato para un usuario normal sin botones de edición y restauración al proveedor. Vista de escritorio y móvil de 390 px. La ruta auxiliar y los servidores de prueba se retiraron. Los permisos y la persistencia real alojada quedan pendientes de activar y comprobar después de aplicar la migración; las pruebas locales no demuestran ese paso.
