# Conciliación de escala de ingresos SEC

## Origen confirmado en TYGO

En el 10-K FY2025, accession `0001193125-26-115952`, el estado de resultados presenta ingresos de **103.536 miles de USD**, es decir, **103.536.000 USD**.

El mismo contexto fiscal está etiquetado dos veces en el iXBRL:

| Concepto | scale | decimals | Valor en companyfacts |
|---|---:|---:|---:|
| `us-gaap:Revenues` | 3 | −3 | 103.536.000 USD |
| `us-gaap:RevenueFromContractWithCustomerExcludingAssessedTax` | 6 | −6 | 103.536.000.000 USD |

El factor 1.000 ya está en la etiqueta del documento de origen y se transmite a companyfacts. BullTrace no lo multiplicaba de nuevo, pero elegía el segundo alias por prioridad sin conciliar la contradicción. El coste de ventas (59.185.000) más beneficio bruto (44.351.000), del mismo documento, confirma el total `Revenues` de 103.536.000 USD.

Fuente: [10-K FY2025, estados y tabla de ingresos](https://www.sec.gov/Archives/edgar/data/1855447/000119312526115952/tygo-20251231.htm), [companyfacts del emisor](https://data.sec.gov/api/xbrl/companyfacts/CIK0001855447.json). Se conserva un extracto literal de los hechos SEC en `lib/__fixtures__/tygo-revenue-scale-sec.json`.

## Corrección general

`secRevenueScale` detecta discrepancias de potencias de mil entre conceptos de ingresos alternativos. Solo selecciona un importe ya publicado cuando la identidad ingresos = beneficio bruto + coste lo corrobora, con la misma moneda/unidad, periodo y accession/formulario. No mezcla documentos, no presupone CAPEX ni cambia ninguna fórmula financiera.

No divide importes por 1.000, no elige siempre el menor, no reconstruye ingresos a partir de una cifra arbitraria y no interpreta todos los cambios grandes como errores. Conserva variantes legítimas de ventas brutas/netas o impuestos que no son el conflicto de escala. Si la identidad falta o es contradictoria, excluye los hechos ambiguos sin inventar un sustituto.

La selección anual y TTM utiliza el mismo concepto completo conciliado; las fórmulas FY − YTD anterior + YTD actual no cambian. Los periodos y el registro de procedencia se recuperan sobre esos mismos hechos. No hay condición por ticker. El resultado conserva un registro de hechos rechazados, hecho aceptado y componentes de contraste.

Las cachés antiguas con una discrepancia comprobable frente a sus componentes solicitan una revisión ordinaria de fuente una sola vez. Hasta conciliar, se retienen los ingresos afectados y sus derivados dependientes. Se conservan NI, FCF, métricas independientes y correcciones manuales. Si la fuente sigue sin permitir resolverlo, se conserva N/D y un aviso; una versión de comprobación evita refetch continuo. Las cachés sanas no se invalidan ni reciben nuevas consultas. La misma protección se aplica al HTML servido desde la caché y a las entradas directas del motor; los campos retenidos muestran el motivo del conflicto.

## Resultado y regresiones

| Dato | Antes | Después |
|---|---:|---:|
| TYGO ingresos FY2025 | 103.536.000.000 USD | 103.536.000 USD |
| TYGO ingresos TTM a 30/09/2026 | 103.537.135.000 USD | 104.671.000 USD |
| TYGO beneficio neto TTM | 12.502.000 USD | 12.502.000 USD |

El análisis del source completo identifica el mismo problema en otros periodos del emisor, incluidos FY2023 y FY2024. Se seleccionan sus totales reportados corroborados; no se aplica una división general a las series.

838 pruebas superadas (21 nuevas), build completo y ESLint correctos. La prueba de API reproduce la caché dañada, fuerza contraste SEC, verifica la corrección anual/TTM, conserva NI y comprueba que se guarda la caché corregida. También verifica que un conflicto reexaminado no provoca una descarga completa en cada visita.

Regresión con fuentes SEC de AAPL, FLYW, BUDA y ONEN: sin cambios en sus hechos correctos. Comparación de AAPL, Altia y Lloyds contra `main` 00fac52: puntuaciones, DCF y escenarios idénticos. Pruebas adicionales: importe grande legítimo, selección del importe mayor cuando es el corroborado, monedas/unidades/documentos distintos, evidencia ausente/contradictoria, variantes brutas/netas, correcciones manuales y datos malformados.

Sin migraciones, dependencias nuevas, cambios de pesos o fórmulas, edición de datos de usuarios, reactivación de staging ni publicación de documentos españoles. Esta validación no certifica todos los conceptos XBRL ni corrige por intuición errores que carezcan de evidencia suficiente.
