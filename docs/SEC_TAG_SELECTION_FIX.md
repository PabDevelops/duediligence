# Corrección de selección de etiquetas SEC (FLYW)

Se filtran los formularios admitidos antes de deduplicar las cifras por periodo/unidad. Una declaración DEF 14A posterior con 13.500.000 USD redondeados ya no elimina el beneficio neto FY2025 de 13.497.000 USD del 10-K. Se conservan enmiendas y rechazo de valores contradictorios con la misma fecha de publicación.

Para los alias de ingresos se selecciona una única serie de concepto con la base anual más reciente; en empate, la serie con el cierre más reciente y luego la prioridad original de etiquetas. No se mezclan etiquetas ni monedas para completar el TTM. El resto de familias conserva su prioridad: un beneficio antes de impuestos más reciente no desplaza al EBIT. FLYW utiliza Revenues, que contiene FY2025 y ambos acumulados de nueve meses, en lugar de preferir RevenueFromContractWithCustomerExcludingAssessedTax, que carece del anual FY2025. No se cambia la fórmula FY + YTD actual − YTD previo.

## Comparación FLYW

Datos oficiales descargados el 6/11/2026: https://data.sec.gov/api/xbrl/companyfacts/CIK0001580560.json. El fixture conserva los hechos y metadatos de los conceptos usados, sin incluir los conceptos ajenos a la prueba.

| Partida | Respuesta de producción antes | Reejecución local del endpoint corregido |
| --- | --- | --- |
| Ingresos | 623.025.000 USD, FY2025 | 763.700.000 USD, TTM hasta 30/9/2026 |
| EBIT | 59.806.000 USD, TTM | Igual, mismo periodo que ingresos |
| Beneficio neto | −11.107.000 USD, FY2020 | 78.947.000 USD, TTM hasta 30/9/2026 |
| Margen operativo | N/D | 7,8% |
| Margen neto | N/D | 10,3% |
| ROE | N/D | 8,7% |
| FCF | 134.292.000 USD | Igual |
| ROIC | N/D | Sigue N/D: EBT disponible solo hasta 30/6/2026, frente al resto hasta 30/9/2026 |

Los importes recuperados se verifican en una prueba del endpoint real con proveedor y Supabase simulados. No se asigna una nueva nota Quality ni se promete recuperar ROIC: persisten partidas incompatibles, incluida deuda de septiembre de 2025. El concepto de beneficio antes de impuestos disponible en Company Facts termina en junio de 2026; no se reemplaza por beneficio neto ni por un supuesto.

## Alcance

Sin cambios en Growth, Value, Quality, DCF, escenarios ni política de integridad. Sin modificación de la caché, su TTL, usuarios, autenticación, cartera, proveedores o datos de producción. La selección corregida se aplica al volver a adquirir estados SEC; no repara por sí sola una caché existente aún vigente. Para reflejarla tras una futura integración hará falta la actualización normal de datos, no una migración ni invalidación masiva.

Pruebas: selección de etiqueta completa, formularios antes de deduplicación, enmiendas, contradicciones, ausencia de base anual y reproducción de FLYW; se ejecuta también la suite existente, que incluye AAPL, empresas españolas y LLOY.L. Rama sin despliegues automáticos. PR para revisión, sin merge ni despliegue.
