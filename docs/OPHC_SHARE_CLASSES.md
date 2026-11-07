# OPHC: conciliación de acciones ordinarias con y sin voto

Revisión del 7 de noviembre de 2026 sobre main `a2728f2`. Precio de referencia de la comparación: 8,83 USD. No se modifican fórmulas ni datos de usuarios.

## Fuentes oficiales

- [10-Q, presentado el 10/08/2026, periodo contable 30/06/2026](https://www.sec.gov/Archives/edgar/data/1288855/000149315226036825/form10-q.htm), CIK 0001288855, accession 0001493152-26-036825. Portada: 12.622.470 ordinarias con voto y 11.458.351 sin voto, ambas a 10/08/2026. Total: 24.080.821.
- El balance del mismo 10-Q contiene 12.340.785 con voto y 11.458.351 sin voto a 30/06/2026: total 23.799.136. Es otra fecha; no se mezcla con la portada.
- [Estatutos, exhibit 3.4](https://www.sec.gov/Archives/edgar/data/1288855/000149315226036825/ex3-4.htm), artículo IV: las dos clases comparten derechos económicos y difieren en el voto. Las no votantes son ordinarias, no preferentes pendientes de añadir. El 10-Q explica que las series preferentes B y C se canjearon por las 11.458.351 no votantes; no se suman de nuevo.

La capitalización agregada se estima aplicando la cotización de OPHC a ambas clases. No se dispone de un precio de mercado independiente para la clase no votante; la igualdad de derechos económicos no garantiza que dos clases negociadas separadamente cotizasen siempre al mismo precio.

## Causa y corrección

BullTrace usaba 12.340.785 acciones: coincide exactamente con la clase votante del balance de junio. La ruta SEC parte de CommonStockSharesOutstanding y las comprobaciones posteriores contra Finnhub solo cubrían ciertas discrepancias grandes. No identificaban la segunda clase aquí. No es un problema de moneda.

Se añade evidencia estructurada y revisada de ambas clases, con fecha común, derechos económicos, CIK, accession y fuentes. La adaptación de datos usa el total solo para OPHC/CIK correcto, moneda USD y cuentas parciales conocidas. No se aplica un multiplicador genérico, no se suman observaciones temporales, acciones autorizadas, tesorería, preferentes ni medias ponderadas. Las empresas con otras clases económicas o ADR requieren su propia conciliación.

La conciliación se aplica al validar datos, incluida la lectura de caché. Así llegan los mismos importes a ficha, análisis, watchlist y screener sin migrar ni escribir la base de datos. Se reutilizan exactamente las fórmulas existentes de actualización de precio para capitalización y ratios, extraídas a un único helper. Una corrección manual de acciones tiene prioridad.

## Comparación reproducible

| Magnitud | Antes | Después |
| --- | --- | --- |
| Acciones ordinarias en circulación | 12.340.785 | 24.080.821, a 10/08/2026 |
| Capitalización a 8,83 USD | 108.969.131,55 USD | 212.633.649,43 USD |
| P/valor contable | 0,81x | 1,58x |
| P/E usado por VALUE (capitalización / beneficio neto) | 5,32x | 10,38x |
| VALUE | S, 86/100; cobertura 100% | C, 54/100; cobertura 100% |
| Growth | S, 85/100 | Sin cambio |
| Quality | A, 80/100; cobertura 80% | Sin cambio |
| Valor contable por acción, modelo bancario | 10,89 USD | 5,58 USD |
| Valor razonable central hoy | 21,88 USD | 11,22 USD |
| Valor central por acción a cinco años | 40,41 USD | 20,71 USD |
| Rentabilidad anual central a cinco años | 35,55% | 18,59% |

OPHC usa el modelo bancario de valor contable justificado, no un DCF industrial. Se mantienen ROE objetivo, coste del capital, crecimiento terminal, todos los supuestos de escenarios, beneficios y patrimonio. Las medias ponderadas básicas/diluidas y el BPA publicado de 0,71 USD se conservan: no se recalcula el BPA histórico con acciones de cierre. Por eso el PER publicado de precio/BPA puede diferir del P/E empleado por VALUE; esa distinción ya existía.

## Pruebas y límites

714 pruebas (39 archivos), incluyendo OPHC, ausencia de doble conteo, datos cacheados, screener compacto, precio nuevo o ausente, prioridad administrativa, AAPL/Altia/LLOY.L y rechazo de clases no equivalentes o fechas mezcladas. Se comparan Growth/Quality y todos los supuestos bancarios antes/después. No cambian las funciones de valoración o puntuación.

La evidencia es un registro oficial revisado a 10/08/2026, no un extractor general automático de todas las clases de todos los emisores. No añade consultas a SEC en cada visita ni depende de scraping. Un informe posterior que siga acompañado de una cifra parcial conocida deja el total y la capitalización en N/D, con aviso de revisión, hasta conciliar la nueva información. Las cifras desconocidas no se corrigen mediante suposiciones. Ninguna cifra de esta comparación afirma conocer en tiempo real las acciones emitidas después de la fecha documentada.
