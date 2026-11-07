# Sugerencias de corrección financiera

Los usuarios con sesión pueden usar «¿Dato incorrecto?» en las cifras corregibles del análisis completo, incluidas tablas históricas y datos N/D. La propuesta contiene empresa, partida, valor observado, valor propuesto, documentación fiscal disponible, fuente y motivo. Los importes se introducen en unidades completas, sin separadores de miles; se admite coma decimal. No hay envío de correos ni descarga automática de fuentes.

En `/admin/financial-suggestions` se comparan observado, actual y propuesto. El administrador puede ajustar y aceptar, o rechazar. Aceptar utiliza `set_financial_override` y su historial/restauración existente; no marca el dato como verificado. Las fórmulas, pesos y política de compatibilidad no cambian. Los rechazos conservan la propuesta sin escribir correcciones.

## Acceso y concurrencia

- Identidad y permisos comprobados en servidor. Solo el administrador consulta la bandeja. La tabla y ambas funciones no tienen permisos para `anon` ni `authenticated`; RLS está habilitado y la mediación utiliza el acceso de servidor existente.
- Máximo 5 envíos por minuto por instancia y 10 en 24 horas por cuenta, este último persistente y serializado en PostgreSQL. Un único pendiente por usuario, empresa y partida.
- Aceptar y registrar la revisión ocurren en una misma transacción. Se bloquea la sugerencia y se exige la versión de la corrección que estaba disponible al abrirla. Un cambio concurrente obliga a recargar. Se invalidan las cachés de correcciones y screener únicamente al aceptar.
- Las fuentes de usuarios se muestran como texto. No se descargan ni se ejecutan. Motivo y referencia quedan privados salvo los metadatos que el administrador publique expresamente al aceptar.
- Tres migraciones acotadas: tabla/funciones, índices de revisión y cierre del acceso a su secuencia (los permisos por defecto de Supabase la exponían separadamente de la tabla). No cambian carteras, autenticación, documentos españoles ni correcciones previas. No se reactiva staging.

## Validación

- 765 pruebas automatizadas superadas (51 nuevas): validación y fechas europeas, valores cero/N/D, FY/Q/TTM, ROA independiente, identidad del servidor, acceso, errores, duplicados, límites, versiones y caché.
- Build completo y ESLint de los archivos modificados.
- Comprobaciones transaccionales en PostgreSQL: envío sin cambios financieros, límite diario, pendiente duplicado, aceptación mediante el historial nativo, rechazo, revisión repetida, conflicto de versión y denegación de acceso directo. Todas revertidas con `ROLLBACK`; cero sugerencias y cero correcciones de prueba persistentes.
- Navegador real: botón en análisis de TE y requisito de sesión. Formulario y revisión administrativa en escritorio y móvil mediante una simulación local en memoria, sin datos reales: envío, ajuste, aceptación y lectura de historial. La simulación usa los componentes reales, pero no acredita una sesión de administrador real en producción.

## Límites

No incluye verificación automática ni notificaciones. El administrador debe consultar la bandeja. Los botones cubren las partidas que admite el sistema de correcciones; las notas y los cálculos derivados se corrigen a través de sus entradas. La protección por cuenta no sustituye una defensa contra muchas cuentas coordinadas.

El aviso de Supabase «RLS sin políticas» es intencionado para esta tabla privada: no hay acceso de cliente. Las claves externas de la nueva tabla tienen índices. No se han modificado avisos ajenos a esta función.
