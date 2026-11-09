# Consultas compartidas y carga acotada

Medición conectada previa: portada 0,33 s; ficha AAPL 10,21 s; API de AAPL y screener superaron 45 s. En una segunda medición, aún con el código anterior en producción, AAPL respondió en 0,64 s y el screener tardó 34,65 s devolviendo cero registros. Parte de la incidencia es intermitente; no se debe atribuir una recuperación general al cambio sin medirla.

Los registros de Supabase mostraron peticiones de enriquecimiento por grupos de 100 tickers con el JSON financiero completo, errores 500 y esperas cercanas a 30 s. También hubo esperas en auth, suscripciones y watchlist. El calendario lanzaba todos esos grupos a la vez. El screener podía repetir la lectura de todo el universo ante varias peticiones simultáneas y retenía los objetos completos hasta finalizarla.

El calendario comparte las solicitudes en curso para la misma consulta, normaliza el orden de los parámetros y mantiene una respuesta legible independiente para cada cliente. El enriquecimiento usa grupos de 50 y dos consultas simultáneas como máximo por instancia, compartidas entre rangos distintos. Se conservan eventos, deduplicación, sorpresas, orden, métricas y TTL de 90 segundos. El límite por instancia no es un semáforo global de la base de datos.

El screener comparte una sola lectura en curso por instancia. Lee páginas de 100, aplica exactamente la validación, las correcciones manuales y la proyección existentes, y libera cada página financiera antes de continuar. Solo las páginas reducidas se almacenan en la caché de datos de Next, reutilizable entre instancias, con revalidación de 60 segundos. No se cachea el universo bruto ni un único objeto que supere el tamaño de la caché. La clave incluye versión, commit, revisión completa de las correcciones, generación de invalidación, tamaño de página y día UTC. Una carga previa a una corrección no puede volver a publicar su caché en memoria. La paginación se ordena por ticker y el resultado conserva el orden de actualización anterior.

Validación: pruebas de visitantes concurrentes, respuesta reutilizable, dos slots compartidos, recuperación tras fallo, invalidación durante una carga y equivalencia de los valores proyectados. La regresión con 11.232 empresas recorre 113 páginas sin omisiones, mantiene los estados financieros y reutiliza la caché caliente. Se ejecuta la suite completa y el build antes de integrar. Las mediciones conectadas posteriores se entregan al cerrar la tarea; la prueba unitaria no sustituye medir Supabase/Vercel.

Sin cambios en fórmulas, notas, fuentes, autenticación, carteras, revisiones manuales, esquema de base de datos o plan contratado. No se reinicia Supabase ni se reactiva staging.

La validación conectada detectó todavía un timeout SQL 57014 en una página con OFFSET. Se sustituye por cursor sobre la clave primaria: cada página empieza después del último ticker leído y no recorre de nuevo las anteriores. Se mantienen páginas reducidas, caché y dos slots compartidos para sus lecturas/revalidaciones. No se amplían los tiempos de espera de Supabase.

El calendario también persiste ventanas públicas en la caché existente de Next durante 90 segundos, separadas por commit y día. No se persiste un fallo como calendario vacío; las peticiones concurrentes reciben objetos de respuesta independientes. Un fallo real del screener responde 503 y la interfaz indica que no se pudieron cargar los datos, en lugar de atribuirlo a los filtros.

Validación final ampliada: 865 pruebas y build completo correctos. ESLint de los módulos de carga y API correcto. La página del screener conserva exactamente los 8 diagnósticos de error y 1 aviso de lint preexistentes, sin introducir nuevos; no se amplía el trabajo a esos componentes.
