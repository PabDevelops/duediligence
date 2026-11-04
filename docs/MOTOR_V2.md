# Motor de análisis V2 de BullTrace

Código en `lib/engine/`. Puro y determinista: mismos datos, mismo resultado. Se alimenta del objeto que devuelve `/api/stock` y no hace llamadas de red.

## 1. Auditoría del motor anterior (hallazgos)

Severidad: CRÍTICO (invalida un resultado mostrado), ALTO (cifra o texto engañoso), MEDIO (supuesto discutible), BAJO.

| # | Sev. | Hallazgo | Dónde | Impacto |
|---|------|----------|-------|---------|
| 1 | CRÍTICO | La proyección a 5 años hacía derivar el **precio** de la acción con la media de tres señales: crecimiento implícito en el precio actual (circular), CAGR del precio del último año (acotado a ±25%) y objetivo de analistas frente al precio. Luego tomaba la mediana de un movimiento browniano. | `computeProjectionDrift`, `useEntryPriceProjection` | El "precio máximo de entrada" y el CAGR seguían a la cotización, no al negocio. Tras un +47% en un día, la deriva y el resultado cambian sin que cambie la empresa. |
| 2 | CRÍTICO | "Margen de seguridad" se calculaba como `(precio máximo de entrada - precio) / precio`. Es la distancia a un precio objetivo de rentabilidad, no un descuento sobre valor intrínseco. | página de ficha | Etiqueta financieramente incorrecta. |
| 3 | CRÍTICO | La "nota de calidad" (CBS/OPPO/GQS) incluye la valoración (OPPO: P/FCF y rentabilidad por FCF, 25-30% del peso). | `computeEasyMode` | Calidad y precio no eran independientes: un gran negocio caro "perdía calidad". |
| 4 | ALTO | Valores neutros silenciosos (2,5 sobre 5) cuando falta ROIC, margen bruto, margen operativo, deuda, liquidez, dilución, propiedad de insiders o valoración. Solo se exige que exista un campo cualquiera. | `computeEasyMode` | Se genera una puntuación con datos ausentes. |
| 5 | ALTO | El texto del veredicto describía el ROIC según la nota compuesta: con ROIC 20,8% podía decir "rentabilidad floja". | `lib/verdict.js` | Interpretación absurda de un dato bueno. |
| 6 | ALTO | `netDebt = (deuda ?? 0) - (caja ?? 0)` y `deuda = 0` si hay patrimonio pero no deuda. Un dato ausente se convierte en cero. | `app/api/stock/route.js` | Apalancamiento mal medido. |
| 7 | ALTO | La deuda toma el **máximo** entre etiquetas XBRL (deuda a largo plazo, convertibles, arrendamientos...), no su suma ni la parte corriente. | `latestInstantMax` | Deuda subestimada o mezclada con arrendamientos según la empresa. |
| 8 | ALTO | EV/EBITDA es el de Yahoo (definición y periodo desconocidos) y se reconstruye algebraicamente al mover el precio. Un valor negativo (por ejemplo -1,5x) se muestra sin tratamiento. | `route.js` | Posible incoherencia con el resultado operativo y el ROIC mostrados. |
| 9 | ALTO | Dos P/FCF distintos con la misma etiqueta: el mostrado (sin restar remuneración en acciones) y el puntuado (restándola). | `route.js` y `computeEasyMode` | El usuario ve una cifra y se puntúa otra. |
| 10 | ALTO | Periodos mezclados: escalares TTM o último 10-K según lo disponible, históricos anuales, ROE/ROA/ROIC con renta TTM y balance del último trimestre; el periodo no se expone. | `ttmVal`, `latestInstant` | No se puede saber a qué periodo corresponde cada cifra. |
| 11 | ALTO | ROIC sobre (activos - pasivo corriente): incluye caja y fondo de comercio y no se compara con el coste del capital (existe `computeWACC` pero el score no lo usa). | `route.js`, `computeEasyMode` | ROIC no interpretable frente al coste del capital. |
| 12 | MEDIO | Dilución nula por defecto (suelo en 0) en el DCF y sustitución silenciosa de BPA por crecimiento de ingresos si el CAGR del BPA no es válido. | `computeHistoricalDilutionPct`, `epsCagr` | Sesgos ocultos. |
| 13 | MEDIO | "Moat" ancho si ROIC y margen operativo son altos. | `computeEasyMode` | Confunde calidad financiera con ventaja competitiva. |
| 14 | MEDIO | Clasificación por subcadenas del sector (`'gas'`, `'tech'`, `'financial'`). | `computeEasyMode`, `sectorMapping` | Falsos positivos (gas natural frente a utilities, "fintech"). |
| 15 | MEDIO | Pesos por tamaño (CBS/OPPO/GQS) sin prueba de sensibilidad. | `lib/marketCap.js` | Ponderaciones arbitrarias. |
| 16 | MEDIO | Resultados trimestrales solo para una insignia QoQ; sin interanual trimestral ni ajuste de estacionalidad en el cálculo. | `buildQuarterlySnapshot` | Un giro reciente tarda en verse. |
| 17 | BAJO | El DCF a 10 años (`computeDCFValue`) descuenta FCF apalancado con WACC, suma `surplusCash` derivado del FCF (cuenta un año dos veces) y no resta deuda neta. No se usa en rutas activas (solo en `_legacy`). | `stockScoring.js` | Código inactivo con errores conceptuales; no modificado. |
| 18 | BAJO | `ProjectionChart` (abanico Monte Carlo del precio) sigue usando deriva del precio, solo en `_legacy` (no enrutado). | `app/_legacy` | No modificado, anotado. |

Los datos de CRCT y MNTN citados en el encargo se comprobaron contra el motor antiguo por inspección de código (no se pudieron recalcular con datos reales: ver sección 6).

## 2. Arquitectura

```
lib/engine/
  util.js           utilidades (div segura, cagr, interp, formato)
  benchmarks.js     rangos sectoriales orientativos [barato, razonable, exigente]
  input.js          adaptador de /api/stock a entrada normalizada con procedencia
  profile.js        clasificación del modelo de negocio y métodos aplicables
  validation.js     validaciones de coherencia de datos
  cost_of_capital.js WACC (reutiliza computeWACC) y tipo impositivo efectivo
  quality.js        A. Calidad (0-100)
  momentum.js       B. Crecimiento y momentum (clasificación)
  valuation.js      C. Valoración (0-100)
  risk.js           D. Riesgo (confirmado / potencial / no evaluable)
  scenarios.js      motor de valoración a 5 años
  signals.js        señales fundamentales tempranas
  potential.js      E. Potencial de inversión
  explain.js        explicaciones para principiantes
  backtest.js       arnés de backtest sin sesgo de anticipación
  index.js          analyzeStock(data, opts)
```

La interfaz usa `app/components/workspace/stock/EngineV2Panel.js`. `useEntryPriceProjection` mantiene su forma de salida (`maxEntryPrice`, `cagr5y`, `priceCentral5y`) pero ahora delega en el motor.

## 3. Fórmulas

### A. Calidad (independiente del precio)
Media ponderada de los componentes calculables, reponderada sobre los pesos disponibles; `null` si la cobertura es menor del 55% o faltan datos esenciales. Pesos: rendimientos 0,22; margen operativo 0,14; margen bruto 0,06; caja libre 0,14; conversión en caja 0,10; estabilidad de márgenes 0,10; balance 0,14; reinversión 0,05; evolución del capital 0,05.
- Rendimientos: `ROIC - WACC` (en financieras, `ROE - 10%`). Un ROIC de 20,8% frente a un WACC de ~10% puntúa más de 85.
- Márgenes frente a referencia orientativa del sector.
- Caja libre y conversión en caja restan la remuneración en acciones (media entre la cifra con y sin resta).
- ROIC que contradice un resultado operativo negativo se descarta (posible mezcla de periodos).
- Moat: siempre "no puede determinarse con confianza"; la evidencia financiera solo se describe como "compatible", "no concluyente" o "insuficiente".

### B. Crecimiento y momentum
Una instantánea por periodo (interanual trimestral si hay 8 o más trimestres, si no anual). Siete indicadores con umbral fijo: crecimiento de ingresos (>+5% / <-3%), aceleración (±2 puntos), margen operativo (±1 punto), beneficio operativo, BPA diluido, FCF (±10%), número de acciones (<-1% / >+3%). Compuesto = media de los disponibles. Clasificación (el último periodo c0 y el anterior c1): mejora confirmada si c0 ≥ 0,4 y c1 ≥ 0,2; posible mejora si solo c0 ≥ 0,4 o 0,2 ≤ c0 < 0,4 sin negativos; simétrico para deterioro; estabilidad si |c0| < 0,2 con a lo sumo una señal; señales mixtas en el resto; información insuficiente con menos de 3 indicadores. Un solo periodo nunca da "confirmada".

### C. Valoración (0-100, más alto = más barata)
Métodos según modelo de negocio (los demás se listan como descartados con motivo). Puntuación de cada múltiplo: posición en la banda sectorial orientativa [barato, razonable, exigente]. Rentabilidad implícita = rentabilidad por FCF (tras remuneración en acciones) + crecimiento sostenible (máx. 8%) frente al coste del capital. Final = 0,65 · media de múltiplos + 0,35 · rentabilidad implícita. Ajustes: deuda neta > 4x EBITDA, -8; cíclicas con margen sobre su mediana, tope 60. `null` si hay menos de dos señales o el negocio es estructuralmente deficitario. Un EV/EBITDA negativo nunca se usa.

### D. Riesgo
13 categorías; cada una es confirmada, potencial, sin detectar o **no evaluable**. El nivel global solo se calcula sobre las evaluables y es "no concluyente" si se evalúan menos de la mitad. "Riesgo bajo" significa "bajo entre los evaluables".

### E. Potencial
`0,35·valoración + 0,30·calidad + 0,20·(100-riesgo) + 0,15·momentum`, con topes: valoración < 30 → máx. 60; calidad < 40 → máx. 55; riesgo alto → máx. 50; CAGR central < 0 → máx. 45; CAGR central < 4% → máx. 64. Se recalcula con cuatro juegos de pesos y se avisa si la diferencia supera 15 puntos. No se calcula si falta calidad o valoración, o si hay errores de datos.

### Valoración a 5 años (sustituye a la proyección del precio)
Por escenario (conservador / central / optimista, sin probabilidades):
```
ingresos_t   = ingresos_{t-1} · (1 + g_t),  g baja linealmente de g0 (año 1) a gT (año 10)
margen_t     = rampa lineal al margen objetivo en el año 5, luego constante
NOPAT_t      = ingresos_t · margen_t · (1 - impuestos)      (EBIT GAAP: la remuneración en acciones ya es coste)
reinversión  = NOPAT_t · min(1, g_{t+1} / ROIC incremental)
FCFF_t       = NOPAT_t - reinversión
VT_5         = valor en el año 5 de los FCFF 6-10 + Gordon en el año 10 [o EBIT_5 · múltiplo terminal si es cíclica]
deuda neta_t = deuda neta_{t-1} - (FCFF_t - intereses·(1 - impuestos))   (toda la caja se retiene)
valor_5      = (VT_5 - deuda neta_5) / acciones_5
valor hoy    = (VA(FCFF 1-5) + VA(VT_5) - deuda neta_0) / acciones_0
precio máximo= valor_5 / (1 + rentabilidad exigida)^5          (15% configurable)
margen seg.  = (valor hoy - precio) / valor hoy
CAGR         = (valor_5 / precio)^(1/5) - 1
```
- Caja y deuda se cuentan una sola vez (en el puente de valor de empresa a valor por acción).
- No se mezclan métodos: DCF para rentables, múltiplo terminal sobre márgenes normalizados para cíclicas, P/valor contable justificado simplificado para bancos; REIT y negocios deficitarios devuelven "no hay información suficiente" (en deficitarios se calcula qué tendría que ocurrir para ganar el 15%).
- Acciones: la remuneración en acciones ya está restada del beneficio, por eso solo se proyecta la emisión **por encima** de la remuneración en acciones (conservador: observada; central: la mitad; optimista: ninguna) y las ampliaciones necesarias si se agota la caja.
- Se informa del peso del valor terminal, del múltiplo EV/EBIT implícito y de una sensibilidad (crecimiento y margen ±3 puntos; tasa de descuento y crecimiento terminal ±1 punto).
- Si el valor sale negativo (por ejemplo, deuda de una financiera cautiva), se rechaza y se explica.

## 4. Validaciones automáticas
Capitalización frente a precio x acciones, EV construido una sola vez, deuda neta, EV/EBITDA publicado frente al calculado, BPA frente a beneficio / acciones, ROIC positivo con resultado operativo negativo, coherencia del historial (resultado operativo mayor que ingresos), valores imposibles, financiera cautiva sospechosa, caducidad del último informe. Los negativos legítimos (pérdidas, FCF negativo, patrimonio negativo) son información, no errores. Con errores no se calculan escenarios ni potencial.

## 5. Pruebas
`npm test` (vitest). `lib/engine/engine.test.js` y `lib/engine/backtest.test.js`, con perfiles sintéticos (software maduro, retail diversificado, bebidas, automóvil cíclico, banco, REIT, EBITDA negativo, FCF negativo, dilución fuerte) y los casos CRCT y MNTN. Los perfiles son **sintéticos** (`lib/engine/__fixtures__/companies.js`): imitan la forma de cada modelo de negocio y no son estados financieros reales.

## 6. Limitaciones conocidas
- Sin acceso de red desde el entorno de desarrollo, CRCT y MNTN no se recalcularon con sus estados financieros reales. Se probaron con las cifras citadas en el encargo y con completados sintéticos etiquetados. Hay que abrir `/stock/CRCT` y `/stock/MNTN` con datos vivos.
- Las referencias sectoriales (`benchmarks.js`) son rangos orientativos fijos, no datos de mercado en vivo; no hay historial de múltiplos propios.
- La API no expone la fecha de publicación por métrica ni distingue TTM de último año fiscal; el motor lo declara en vez de suponerlo. No hay series trimestrales en el objeto actual (el motor las admite si se aportan en `data.quarterly`).
- Sin guía de la dirección, retención de clientes, ingresos recurrentes, crecimiento orgánico, concentración de clientes, calendario de vencimientos, FFO/AFFO ni ratios regulatorios de bancos: se muestran como no disponibles.
- La deuda de `route.js` sigue calculándose con el máximo entre etiquetas XBRL (hallazgo 7); el motor lo señala pero no lo corrige para no alterar la ingesta de datos.
- Un backtest válido necesita un conjunto de datos con fecha real de publicación y universo con exclusiones de cotización. No existe en el repositorio; el arnés (`backtest.js`) está listo y rechaza etiquetar como válido lo que no pueda demostrarlo.
- El WACC usa pesos de mercado (práctica estándar): con deuda, el precio influye de forma marginal (<4% en las pruebas) en la tasa de descuento; sin deuda, nada.
- Bancos: modelo simplificado sin ratios de capital ni morosidad.
