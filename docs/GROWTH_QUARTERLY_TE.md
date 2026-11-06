# Growth: históricos trimestrales de TE

Validación local del 6 de noviembre de 2026 sobre main `02ea008`. Snapshot público de `/api/stock?ticker=TE`, después de que el administrador corrigiera sus metadatos. No se escribieron datos, migraciones ni cambios de caché.

## Recorrido y causa

Los registros se guardan con targets como `history:revHistory:2025:Q2`. `financialOverrideStore` lee la vista `current_financial_overrides`, con caché de 15 segundos, y los aplica a la respuesta pública. `applyQuarterlyFinancialHistory` conserva estos registros en `quarterlyHistories.revHistory`, separados de `revHistory`, los escalares y FY/TTM.

El adaptador del motor solo recogía `data.quarterly`, no `quarterlyHistories`. El momentum general exige además ocho observaciones de ingresos para su ruta trimestral y lee sus series por posiciones. No se conecta el nuevo histórico a esa ruta ni se cambia ese requisito, para evitar alterar otros indicadores y las valoraciones.

Growth ahora selecciona exclusivamente las entradas de su componente de aceleración por identidad fiscal y fechas: dos variaciones interanuales en trimestres consecutivos requieren los dos trimestres actuales y sus dos referencias del año anterior. Los seis trimestres de TE bastan. Q3/Q4 2025 están disponibles, pero no intervienen en esa comparación. No se calcula crecimiento secuencial ni se anualizan importes.

Se conserva la fórmula `(YoY actual − YoY anterior) × 100`, la interpolación y el peso de 15%. La mediana anual continúa usando la metodología anterior, con al menos tres observaciones FY positivas y sus exclusiones de años anómalos.

## Datos observados

En la primera lectura, Q2 2025 terminaba el 30/06/2028 y Q2 2026 tenía perímetro `provider-unspecified`. Ambos impedían comparar. El usuario corrigió los registros: la segunda lectura confirma seis periodos Q independientes, de enero de 2025 a junio de 2026, USD como moneda y unidad base y perímetro consolidado. El código no corrige ni inventa esos metadatos.

| Resultado sobre el mismo snapshot | Antes | Después |
| --- | --- | --- |
| Growth | S+ orientativa; cobertura 60% | A, 81/100; cobertura 75%; confianza baja |
| Crecimiento actual, peso 45% | 100/100 | Sin cambio |
| Mediana anual, peso 25% | N/D | N/D; solo FY2024 y FY2025 positivos |
| Aceleración, peso 15% | N/D | 20/100; −143,9524 puntos porcentuales |
| Evolución FCF, peso 15% | 85/100 | Sin cambio |
| Value, Quality, DCF, escenarios, momentum general | Referencia | Idénticos |

Q1 2026/Q1 2025: +232,3486%. Q2 2026/Q2 2025: +88,3962%. Menor velocidad de crecimiento implica aceleración negativa; recuperar cobertura no implica mejorar la nota. Los ingresos cero FY2023 no completan la mediana ni se incorporan al snapshot anual como una observación inventada.

## Comprobaciones y límites

Los registros ambiguos, duplicados, sin moneda/unidades/perímetro, con fechas inválidas, sin referencias positivas o sin continuidad exacta entre trimestres se conservan, pero no completan la aceleración. Una serie trimestral anterior al último FY tampoco sustituye una señal más reciente. Se admiten ventanas fiscales de 80–100 días y diferencias interanuales de 350–380 días, con duraciones comparables (hasta siete días de diferencia), para calendarios fiscales no naturales.

El desglose muestra los seis registros, cifras, unidades, fechas, perímetro, fuente, selección o descarte y los periodos que faltan. Las entradas manuales no se presentan como verificadas automáticamente. Una falta de cobertura anual no se subsana agregando Q.

Las pruebas cubren el overlay real de correcciones, TE, históricos incompletos, duplicados, datos desordenados, fechas erróneas, cambios de moneda/perímetro/unidades, referencias cero/negativas y regresión con AAPL, Altia y LLOY.L. Se comprueba igualdad completa de `analyzeStock`, DCF y easy mode con y sin el nuevo histórico trimestral en TE. No cambian las fórmulas ni los umbrales o pesos de puntuación.

Resultado: 639 pruebas superadas (35 archivos), build de producción completado y ESLint sin errores en los archivos modificados. Growth mantiene estado provisional cuando utiliza estos ingresos manuales, incluso si el resto de datos estaba verificado. Persisten los avisos previos de deprecación de `middleware` y `module.register`. La validación del desglose es automatizada; no se ha realizado una comprobación visual en navegador de esta rama ni un despliegue de producción.
