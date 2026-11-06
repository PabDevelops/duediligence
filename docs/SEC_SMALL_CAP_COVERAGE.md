# Cobertura SEC: BUDA y ONEN

Revisión del 6 de noviembre de 2026. Cambios de entradas y validación; sin cambios en fórmulas, pesos o umbrales de Growth, Value, Quality, DCF o escenarios. Sin despliegue, cambios de usuarios ni migraciones.

## BUDA: recuperación automática comprobada

| Dato | Captura de producción | Reproducción local corregida |
| --- | --- | --- |
| Caja | N/D | 18.819.000 USD, instantánea 30/06/2026 |
| FCF | N/D | 2.904.000 USD, FY 01/01/2025–31/12/2025 |
| P/FCF | N/D | 28,3x con la cotización capturada de 6,55 USD |
| OCF | 2.257.000 USD, TTM a junio de 2026 | Conservado |
| CAPEX | 325.000 USD, TTM a marzo de 2026 | Conservado |
| Growth | B orientativa, cobertura 60% | Sin cambio |
| Value | N/D, cobertura 30% | F, cobertura 100% |
| Quality | A orientativa, cobertura 55% | Sin cambio |
| DCF | Bloqueado | Bloqueado: FCF anual e ingresos TTM incompatibles |

La comparación de notas utiliza el mismo sector, industria, cotización y demás datos bursátiles de la captura pública. Es una reproducción local, no una lectura de producción tras desplegar. La confianza de las notas no equivale a una auditoría de las cuentas.

El FCF FY2025 es 3.150.000 de OCF menos 246.000 de CAPEX. El dato existe en companyfacts y se ocultaba al validarlo contra componentes TTM más recientes con fechas distintas. Se conservan los componentes y periodos propios de ese FCF mediante `cashFlowInputs`; los escalares OCF y CAPEX más recientes no se sustituyen. No se usa este FCF anual para márgenes/conversión de caja contra ingresos o beneficio de otro periodo. El adaptador de calidad descarta su entrada FCF cuando alguno de esos denominadores o SBC tiene un periodo incompatible; el dato independiente permanece visible y disponible para su múltiplo.

La caja se recupera mediante el concepto CashEquivalentsAtCarryingValue solo si coincide con el total de caja de la misma fecha y accession. Un total que incluya caja restringida por sí solo no basta. Se rechaza también el fallback si hay caja restringida positiva en esa fecha. No se añaden consultas externas ni dependencias.

Limitaciones: el CAPEX H1 2026 de 688.000 USD está publicado en el 10-Q, pero no aparece en el concepto estándar de PP&E de companyfacts; los 100.000 de PaymentsToAcquireProductiveAssets corresponden a una adquisición distinta y no sustituyen ese CAPEX. No se fuerza un FCF TTM nuevo. BUDA pasó de LLC a corporación el 01/01/2026: el FY2025 era anterior al impuesto federal corporativo. El FCF histórico no es una estimación normalizada para ejercicios futuros.

Fuentes:

- https://data.sec.gov/api/xbrl/companyfacts/CIK0002079720.json
- https://www.sec.gov/Archives/edgar/data/2079720/000149315226012988/form10-k.htm
- https://www.sec.gov/Archives/edgar/data/2079720/000149315226038347/form10-q.htm (F-1, F-4 y nota 1)

## ONEN: límite de perímetro todavía pendiente

Companyfacts aún identifica Hennessy Capital Investment Corp. VII. Sus cuentas anteriores a la combinación no representan las cuentas del negocio energético adquirido ni el grupo combinado actual. El 8-K de septiembre documenta la combinación cerrada el 23/09/2026 y separa las cuentas históricas de ambas entidades y los pro forma.

El anexo 99.1 contiene las cuentas de ONE Nuclear Energy LLC, no auditadas, de H1 2026: pérdida operativa de 1.720.432 USD, pérdida neta de 1.802.923 USD, salida operativa de caja de 164.517 USD y caja/activos de 2.588 USD a 30/06/2026. No son cifras del grupo combinado tras la operación. La nota 9 confirma que todavía no había ingresos. Se han localizado, pero no incorporado automáticamente: este PR no implementa un reconciliador de combinaciones empresariales ni un extractor de anexos.

Se corrige un defecto independiente verificable: un hecho etiquetado como balance del 31/12/2026 se publicó el 13/05/2026. No puede ser un balance histórico a esa fecha. Al descartarlo se selecciona el patrimonio de la SPAC del 30/06/2026 de -10.742.722 USD en lugar de -10.084.981 USD, y la fecha del informe pasa a 12/08/2026. Esto corrige la selección temporal, pero NO resuelve la atribución de las cuentas a la entidad actual. Las notas y el DCF siguen sin estar disponibles. No se considera ONEN resuelta ni apta para valorar con esas cuentas anteriores.

Fuentes:

- https://data.sec.gov/api/xbrl/companyfacts/CIK0001846416.json
- https://data.sec.gov/submissions/CIK0001846416.json
- https://www.sec.gov/Archives/edgar/data/1846416/000149315226044924/form8-k.htm
- https://www.sec.gov/Archives/edgar/data/1846416/000149315226044924/ex99-1.htm (pp. 2, 3, 5 y nota 9)

## Validación y publicación

Los JSON de prueba son capturas de los endpoints oficiales companyfacts obtenidas el 06/11/2026. Pruebas del endpoint con respuestas SEC reales reproducidas y base de datos simulada; no se han escrito filas reales. Incluyen BUDA, ONEN, FLYW y AAPL; la batería completa incluye los casos británicos y españoles existentes.

La descarga programática directa de los HTML de Archives devolvió 403 en este entorno, aunque sus documentos pudieron consultarse mediante búsqueda web. No se ha intentado evadir la restricción ni añadido un scraping alternativo. El acceso JSON de data.sec.gov funcionó.

El PR no cambia TTL ni hace refrescos masivos. Tras aprobar y desplegar, las filas antiguas necesitarán su actualización normal o un refresco explícito controlado. La revisión de ONEN debe continuar con los anexos del negocio adquirido y el balance posterior al cierre, sin mezclar cuentas históricas y pro forma.
