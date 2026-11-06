# Análisis completo: validación de interfaz

Fecha: 6 de noviembre de 2026. Base: main `9f329351756759ac374b5e580797a37dcfcd2399`.

## Cambios

- `/stock/[ticker]/analisis` reúne las seis secciones: resumen, crecimiento, rentabilidad y calidad, valoración, riesgos y estados financieros. La ficha principal mantiene su diseño y ruta.
- `/stock/[ticker]/numbers` responde con 307 hacia `/stock/[ticker]/analisis#estados-financieros`. Los enlaces de la ficha apuntan al análisis o a sus tablas.
- Se reutilizan el panel técnico, sus explicaciones, las notas calibradas y los 36 indicadores anteriores. Se conservan las fuentes y notas del panel y se añaden tablas de las partidas disponibles; no se crean cifras para completar estados ausentes.
- Una instancia de `useStockData`, una de `useEntryPriceProjection` y un cálculo memoizado de `computeEasyMode`. Las secciones reciben los resultados ya calculados, incluido `getCompanyHeaderScores`. No se añade otro DCF ni se recalculan escenarios por sección. Se conserva la revalidación existente al recuperar foco y cada cinco minutos.
- Explicaciones desplegables y navegación interna desplazable en móvil. Las tablas tienen desplazamiento horizontal propio y acceso con teclado.
- El histórico de BPA utiliza `point.eps`: `point.val` contiene beneficio neto en el contrato existente. Ningún cálculo financiero se modifica.
- Las cifras contables muestran la moneda original cuando la conversión está documentada; se revierte exclusivamente ese factor para presentación. Cotización, capitalización y escenarios usan la moneda de cotización. Se preserva GBp frente a GBP y no se infiere moneda desde el ticker. No hay nuevas llamadas de FX.
- El screener retiene el campo compacto `currency` y deja de anteponer dólares a todas las filas. Los formatos compartidos y las tarjetas de cotización usan la misma función de símbolos.
- Se mueve el aviso de provisionalidad de la ficha al final, inmediatamente antes de Actualizar datos; se retiran los rótulos bajo las tres letras, sin quitar el estado interno ni el aviso.

## Pruebas

| Comprobación | Resultado |
| --- | --- |
| `npm.cmd test` | 315 pruebas superadas, 13 archivos; 23 pruebas nuevas |
| `npm.cmd run build -- --webpack` | Build completo correcto con configuración local existente |
| Lint diferencial de los archivos JS modificados y nuevos | Sin hallazgos nuevos; 16 errores previos siguen iguales en archivos existentes |
| Motor, calibración, DCF, política financiera y APIs | Sin diferencias de código respecto de la base; pruebas comparan resultados numéricos, escenarios, notas y ausencia de mutación para ocho empresas |
| Altia ALC.MC, AAPL, SAP.DE y BYTE.MC | Seis secciones accesibles en 1440×900 y 390×844; sin desbordamiento de página |
| Móvil estrecho | Altia comprobada a 320×740, sin desbordamiento de página |
| Contenido anterior | Los 36 indicadores están presentes; se abrieron calidad, crecimiento, valoración, riesgos, escenarios y señal FCF; conversión a caja y fuentes accesibles |
| Monedas | Altia y SAP muestran EUR, incluidas señales y screener; AAPL sin metadato muestra moneda N/D; pruebas cubren USD explícito, EUR, GBP, GBp, CHF, CAD y conversión documentada |
| ByteTravel con datos incompletos | N/D y avisos conservados; los escenarios incompatibles siguen bloqueados; OCF no sustituye FCF ni CAPEX |
| Ruta antigua | HTTP 307 y navegación efectiva a la sección Estados financieros |
| Carga y error | Carga visible con respuesta retrasada; error comprensible con Reintentar y Volver al inicio |
| Ficha principal | Aviso justo antes de Actualizar; letras Growth/Value/Quality sin el rótulo Provisional |
| Screener, 11.232 filas sintéticas sobre fixture AAPL | Antes 3.257.430 bytes; después con EUR 3.448.374 bytes; inferior a 4.500.000 sin compresión |

Los datos de UI son respuestas públicas capturadas de `/api/stock` el 6/11/2026 para ALC.MC, SAP.DE y AAPL y el fixture de integridad existente para BYTE.MC, pasado por el validador actual. Un proxy local de solo lectura sirvió esos datos al build real, sin cambiar endpoints de la aplicación. También sirvió las respuestas de metadatos del layout existente. No se pulsaron acciones de escritura ni sincronización. La combinación elimina el segundo montaje/carga al saltar entre las dos páginas antiguas; los metadatos SSR y la revalidación existentes se mantienen.

## Limitaciones reales

- No es una prueba conectada de autenticación, cuentas, carteras ni proveedores. Supabase staging sigue pausado. Una sesión local antigua intentó renovar sus credenciales y produjo errores de red de autenticación; se continuó en otro origen local sin modificar esa sesión. No se atribuye ese error al nuevo análisis ni se ha cambiado AuthProvider.
- La respuesta heredada capturada de AAPL no contiene `currency`. Yahoo chart identifica USD, pero esta interfaz no añade otra consulta ni inventa la moneda que falta en la caché. Muestra moneda N/D hasta que la respuesta existente aporte el metadato. Las notas y cifras numéricas se conservan.
- Algunas partidas no tienen fuente individual, fecha exacta o perímetro. Se etiquetan como provisionales y se indican las carencias. Las tablas no son informes oficiales nuevos ni sustituyen el importador documental.
- Los históricos disponibles en el endpoint actual son principalmente FY. Las tablas conservan FY/H1/Q/TTM/instant cuando esos metadatos existen; no recuperan observaciones rechazadas por la política vigente.
- El lint global conserva deuda previa. El build emite avisos de middleware y Supabase/Edge ya existentes; no se aborda una migración de Next en este PR.
- Las capturas documentan el estado normal con desplegables cerrados; se verificó aparte la apertura de las explicaciones. Las pruebas del modelo de presentación cubren los registros históricos y sus periodos.

## Capturas completas

Escritorio:

![Altia: análisis completo en escritorio](screenshots/unified-analysis/altia-escritorio-completa.jpg)

Móvil:

![Altia: análisis completo en móvil](screenshots/unified-analysis/altia-movil-completa.jpg)

## Integración

Sin migraciones ni cambios de esquema, políticas de caché, claves, autenticación o datos de usuarios. Sin dependencias nuevas. El importador español y los experimentos permanecen fuera del cambio. La rama `feat/unified-company-analysis` tiene despliegues automáticos deshabilitados en `vercel.json`; se conserva main y sus crons. No se ha hecho merge ni despliegue.
