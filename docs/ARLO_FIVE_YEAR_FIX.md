# ARLO: presentación a cinco años

Captura pública de producción: 6/11/2026, fixture `lib/__fixtures__/arlo-production-2026-11-06.json`.

## Correcciones

Se muestra `(valor razonable hoy − precio actual) / precio actual`, sin modificar `marginOfSafety` del motor ni las reglas de clasificación existentes. Para 2,19 / 14,75: −85,1525%, mostrado −85,2%. Precio positivo y valor cero dan −100%; negativos, ausentes y no finitos dan N/D. Un valor superior al precio da porcentaje positivo, igualdad da cero. La fórmula convencional interna sigue intacta: el cambio de denominador es exclusivamente de presentación solicitado por el usuario.

La caché sin moneda utiliza el camino de cotización Yahoo existente para recuperar moneda y precio conjuntamente; no deduce USD por ticker o bolsa. Conserva monedas identificadas y normalización GBp→GBP existente. No hace una descarga completa de estados para rellenar ese metadato.

Se explica que el DCF a cinco años estima FCFF desde EBIT, impuestos y reinversión, no desde el FCF normalizado. No se modifica DCF, CAGR, Growth, Value, Quality ni ningún archivo de lib/engine.

## Conciliación de la captura

| Entrada / salida | Observado |
| --- | --- |
| Precio | 14,84 USD; distinto del 14,75 indicado por el usuario |
| Ingresos / EBIT | 596.793.000 / 15.761.000 USD TTM hasta 27/9/2026, fuente SEC EDGAR |
| Margen EBIT | 2,64% |
| OCF | 79.284.000 USD TTM hasta 27/9/2026 |
| CAPEX | 5.135.000 USD TTM hasta 30/3/2025: incompatible con OCF |
| FCF, FCF normalizado utilizable y P/FCF | N/D; FCF bruto rechazado 74.149.000 no se reintegra |
| SBC | 80.376.000 USD; no se elimina para favorecer la valoración |
| Acciones actuales | 107.510.546; básicas FY2025 104.203.000 y diluidas 110.156.000 son denominadores diferentes |
| Caja / deuda usadas | 79.587.000 / 5.224.000 USD; no se suman activos sin confirmar clasificación |
| Beneficio neto en caché | −101.251.000 USD de FY2020: antiguo, no se presenta como beneficio TTM; ratios incompatibles bloqueados por la política existente |
| DCF histórico basado en FCF | Bloqueado por integridad; no hay FCF normalizado utilizable |
| DCF FCFF central existente | Valor presente 1,94 USD; valor año 5: 2,74 USD |
| CAGR central | −28,65%; usa `(valor año 5 / precio)^(1/5) − 1`, nunca el valor presente |
| Diferencia mostrada con la captura nueva | Aproximadamente −86,9% respecto a 14,84 |

Supuestos centrales existentes: crecimiento inicial 9,99%, año 5 6,88%, margen operativo final 2,64%, impuesto efectivo 9,3%, descuento 11,73%, crecimiento terminal 3%, ROIC incremental 11,7%, dilución adicional anual 0,43%. Acciones proyectadas 109.820.908; FCFF año 5 10.266.828 USD; 83,1% del valor depende del terminal. La reinversión conserva NOPAT × crecimiento siguiente / ROIC, acotada por el modelo actual.

## Conclusión y límites

2,19 no es reproducible con esta captura; no se certifica como valor razonable fiable. El valor bajo actual es reproducible bajo los supuestos GAAP del modelo, no prueba de que el mercado o la empresa estén equivocados. Su alta dependencia terminal, la estimación de reinversión y las carencias de procedencia exigen mantener provisionalidad. No se sustituye por FCF no GAAP ni se ajustan márgenes para acercarlo a cotización.

El anuncio de la empresa del 5/11/2026 identifica FCF acumulado de nueve meses de 50,6 M USD y caja más inversiones a corto plazo de 144 M USD: no equivalen al FCF TTM ni a la caja estricta del modelo. No se reemplazan por esas cifras sin reconciliar periodos y definiciones. Fuente: https://markets.ft.markitdigital.com/data/announce/detail?dockey=600-202611051605BIZWIRE_USPRX____20261105_BW966842-1 (comunicado de Arlo distribuido por Business Wire). El acceso directo de comprobación a SEC/IR no estuvo disponible; los importes de la tabla proceden del endpoint de BullTrace y su metadato SEC, no de una auditoría independiente del filing. La extracción del beneficio antiguo y del CAPEX discontinuado queda como limitación de cobertura; no altera aquí los flujos FCFF compatibles ni se oculta.

## Validación

332 pruebas: casos de signo, igualdad, cero, ausencias, infinitos, ARLO real y escenarios no vacíos de AAPL, LLOY.L y ALC.MC. Verificación de CAGR contra valor futuro y de que no mutan datos ni salidas del motor. Prueba integrada de recuperación de moneda desde Yahoo en caché sin recurrir a companyfacts. Build completo y CI requeridos antes de integrar.
