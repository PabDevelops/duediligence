# VALUE: datos ausentes frente a resultados negativos

Revisión del 7 de noviembre de 2026 sobre main `8e2ecac`.

## Conflictos identificados antes de implementar

La nota independiente VALUE recogía solo los métodos que `computeValuation` podía puntuar. `methodsForProfile` descarta P/E, P/FCF y EV/EBIT con denominadores negativos. Eso es correcto para calcular múltiplos, pero no distingue ausencia de datos de resultados negativos en la cobertura de VALUE.

Se separan ambas decisiones: un componente negativo documentado puede recibir 0/100 en VALUE sin convertirse en un múltiplo ni en un método adicional de valoración. No se cambia `lib/engine`, el DCF, escenarios, las bandas de múltiplos positivos ni la clasificación del negocio. La valoración del motor general puede seguir sin ser calculable; la F de VALUE por resultados negativos no afirma que el precio sea excesivo.

Se mantienen los pesos sectoriales y las exclusiones: no se incorpora P/FCF a bancos, REIT o utilities donde no corresponde. En cíclicas se conserva el EBIT normalizado; un EBIT puntual negativo no obtiene un cero por esta nueva vía. Los ceros no son denominadores negativos y no reciben este tratamiento.

## Criterios de la nueva evidencia

La evaluación negativa exige capitalización positiva y moneda conocida, entradas numéricas y no bloqueadas, FY/TTM con fechas válidas, moneda compatible, fuente y perímetro documentados. No se anualizan H1/Q. Se comprueban las unidades explícitas y cualquier conversión monetaria documentada. La antigüedad usa el límite duro existente de cuatro años de HISTORY_STALE; los avisos anteriores a ese límite conservan su tratamiento previo. Tampoco se admiten cierres futuros.

P/FCF ajustado requiere FCF y SBC del mismo periodo, moneda y perímetro, sin asumir SBC cero. Se reutiliza el selector de parejas históricas existente. EV/EBIT requiere EBIT y los saldos de deuda/caja compatibles con su cierre, moneda y perímetro. No se obliga a que indicadores independientes usen todos el mismo ejercicio, pero cada operación conserva su base y la muestra.

Los métodos positivos ya puntuados conservan su resultado. Esta ampliación aplica controles explícitos a la nueva evidencia negativa; no reescribe la política provisional heredada de los métodos positivos.

## TE: observación real frente a escenario de prueba

El snapshot público de `/api/stock?ticker=TE` contiene FCF TTM de −184.810.000 USD, SBC de 14.707.000 USD sin periodo documentado, beneficio neto manual H1 2026 de −63.955.000 USD y EBIT TTM de −222.894.000 USD. Deuda y caja son saldos consolidados de 30/06/2026, compatibles con el cierre del EBIT. La resta nominal FCF−SBC no se presenta como importe ajustado válido mientras falte la documentación de SBC.

| Componente | Peso | Antes | Después con los registros reales |
| --- | --- | --- | --- |
| P/FCF después de SBC | 40% | N/D | N/D: falta el periodo de SBC |
| P/E | 30% | N/D | N/D: beneficio manual H1, no FY/TTM |
| EV/EBIT | 30% | N/D | Evaluado: 0/100 por EBIT negativo |
| VALUE | 100% | N/D; cobertura 0% | N/D; cobertura 30% |

No corresponde una F normal ni orientativa con un único componente y cobertura del 30%. No se sustituyen las correcciones manuales con datos automáticos ni se construye una pérdida anual a partir de H1. Para completar esta evaluación faltan una base FY/TTM de beneficio neto y una SBC documentada y compatible con FCF, o una pareja histórica anual válida. No se inventan sus cifras ni fechas.

Una copia exclusivamente sintética, con las tres bases compatibles y negativas, produce F, 0/100 y cobertura 100%. No es el estado real de TE. La interfaz distingue «Sin rentabilidad actual», «Incluye resultados negativos», «Resultados negativos parciales» y «Múltiplos elevados». Cada componente negativo indica que se evalúa rentabilidad, no un múltiplo calculado.

## Conservación y pruebas

Sin migraciones, cambios de caché, escrituras de base de datos ni cambios a las correcciones. El recorrido de almacenamiento sigue siendo `current_financial_overrides` → `applyFinancialOverrides` → API → adaptador → selector de caja → VALUE. La nueva evidencia se calcula solo en memoria.

668 pruebas superadas (37 archivos), build completo y ESLint de los archivos modificados. Casos: TE real, TE sintético completo, tres negativos, dos negativos y un positivo, negativos y ausentes, denominadores cero, metadatos/FX/unidades incompatibles, periodos futuros y antiguos, datos manuales, selección histórica y exclusiones sectoriales. Regresión AAPL, Altia y LLOY.L. Se verifica igualdad de Growth, Quality, el resultado completo de `analyzeStock`, DCF y escenarios con la nueva política activada y desactivada.
