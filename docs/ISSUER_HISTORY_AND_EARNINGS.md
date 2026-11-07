# Entidad contable, cotización y partidas extraordinarias

## ONEN: separar el vehículo de la empresa operativa

El 8-K de 29/09/2026 distingue expresamente las cuentas de Hennessy Capital Investment Corp. VII de las de ONE Nuclear Energy LLC (Item 9.01). La operación cerró el 23/09/2026; el nuevo título comenzó a cotizar el 24/09/2026. Los 3.687.416 USD de beneficio FY2025 pertenecen al vehículo; el TTM de 2.639.629 USD hasta junio de 2026 tampoco es beneficio del negocio nuclear.

Fuentes: [8-K, cierre y separación de estados](https://www.sec.gov/Archives/edgar/data/1846416/000149315226044924/form8-k.htm), [estados históricos del vehículo](https://www.sec.gov/Archives/edgar/data/1846416/000149315226009187/R8.htm), [cuentas operativas H1 2026, Exhibit 99.1](https://www.sec.gov/Archives/edgar/data/1846416/000149315226044924/ex99-1.htm). El 8-K también remite al histórico operativo desde su constitución en febrero de 2025; ese periodo no se debe presentar como doce meses completos.

La regla no depende del ticker: utiliza el evento acreditado, la entidad contable, las fechas y la fuente de cada cifra. Los datos del vehículo, los pro forma y los periodos mixtos quedan separados en `entityHistory`, accesibles en estados financieros, y fuera de los cálculos. Se aplica en validación, adaptador del motor, correcciones manuales, API, HTML público y screener. Una corrección se sigue guardando; no puede reintroducir datos de otra entidad en los cálculos.

Se conservan históricos operativos anteriores a la cotización cuando su entidad está identificada con fuente, o proceden de un documento operativo inequívoco. No se considera que publicar un dato antiguo después de la fusión lo convierta automáticamente en operativo. Si no se acredita continuidad, permanece separado. Los modelos y sus fórmulas no cambian.

## Cotización reciente

La ficha muestra junto al ticker fecha, tipo verificado y «Cotización reciente» durante 24 meses naturales, sin penalizaciones. Las IPO tradicionales y cotizaciones directas conservan todos sus históricos financieros: la edad del título no interviene en Growth, Value, Quality, DCF o escenarios. Se advierte cuando los históricos previos disponibles son incompletos o no tienen fechas contrastadas.

La fecha `ipo` de Finnhub se conserva como comunicada por el proveedor, con tipo N/D. No se convierte una fecha de registro, un cambio de nombre o la primera vela disponible en fecha de IPO.

Durante la actualización ordinaria de fundamentales, la detección SEC consulta submissions y, como máximo, un documento oficial: prioriza el 8-K con Items 2.01/5.06; para IPO/directa comprueba el 424B4. Solo confirma una frase explícita de inicio efectivo de negociación del símbolo solicitado; rechaza fechas previstas, futuras, ambiguas y documentos sin evidencia. Una salida de sociedad vehículo comunicada por la SEC sin conciliación suficiente queda pendiente; sus datos no se atribuyen al nuevo negocio.

Se utiliza caché en memoria de 24 horas (máximo 500 identificadores), peticiones de 5 segundos y documento máximo de 2 MB. La consulta se inicia en paralelo con la descarga de fundamentales. Los resultados se conservan en la caché existente; no hay consultas adicionales en las lecturas normales. Los registros documentales revisados de ONEN permiten corregir también las cachés ya existentes. Son evidencia de origen, no excepciones de cálculo. La detección genérica reconoce igualmente el 8-K real de ONEN.

No es un censo completo mundial de IPO/SPAC. Si falta documentación o el texto no permite una extracción inequívoca, el tipo o la fecha siguen N/D. Los metadatos nuevos se incorporan con el refresco ordinario; no se fuerza una recarga masiva de proveedores.

## TYGO: beneficio contable y beneficio ajustado

El TTM hasta 30/09/2026 es correcto: -1.880.000 − (-13.597.000) + 785.000 = **12.502.000 USD**. Incluye 14.637.000 USD de venta de patentes en Q4 2025 y otros 355.000 USD en H1 2026: **14.992.000 USD**. El beneficio neto original no se cambia.

Fuentes: [10-K FY2025, estados y nota 14](https://www.sec.gov/Archives/edgar/data/1855447/000119312526115952/tygo-20251231.htm), [10-Q 30/09/2026, estados y notas 13–14](https://investors.tigoenergy.com/node/9471/html). Además existe un beneficio fiscal por reversión de provisión de activos fiscales; no se identifica todo el impuesto agregado como efecto de la venta.

El descarte anterior de P/E procedía del perfil de pérdidas operativas. La regla global permite evaluar beneficio neto anual positivo y comparable aunque el resultado operativo sea negativo, sin reclasificar el negocio ni cambiar sus escenarios. Las bandas y la fórmula P/E no cambian.

La capa de entradas distingue beneficio publicado, partidas especiales y beneficio ajustado. Solo resta efectos netos de impuestos documentados; nunca estima el efecto fiscal con una tasa genérica. Si el beneficio ajustado es negativo y está documentado, el componente vale cero sin calcular un múltiplo negativo. Si falta conciliación, P/E recurrente N/D y explicación. Se muestran el P/E contable y los ajustes identificados en el desglose.

El adaptador usa la descarga SEC ya existente para conceptos explícitos de operaciones interrumpidas netas de impuestos y candidatos por venta de negocios/intangibles. No presume cero si falta una pata FY/YTD ni que todos los ingresos no operativos sean extraordinarios. Los conceptos propios del emisor requieren evidencia documental; los dos eventos de TYGO se registran con periodos, importes y fuentes, sin reglas especiales por símbolo. Esto no certifica que se hayan identificado todos los extraordinarios de cada empresa.

## Comparación y validación

Comparación ejecutada contra las librerías de `main` 82c62b0, con idénticos datos de entrada:

| Caso | Antes | Después |
|---|---|---|
| ONEN FY2025 | Beneficio 3.687.416 USD en histórico principal | Separado como dato del vehículo; N/D para el negocio nuclear |
| ONEN TTM a junio de 2026 | Beneficio 2.639.629 USD | Separado; no se atribuye al negocio nuclear |
| ONEN Quality | N/D, 40 % de cobertura | N/D, 0 %; se retiran componentes de otra entidad |
| TYGO | Beneficio 12.502.000 USD; VALUE F/70 %, P/E excluido por perfil | Mismo beneficio y VALUE F/70 %; P/E contable ≈4,56x con la capitalización de la captura; P/E recurrente pendiente por efecto fiscal no aislado |
| AAPL, Altia, Lloyds | Notas y valoraciones de referencia | Notas, coberturas, DCF y escenarios idénticos |

816 pruebas superadas, 51 nuevas. Cubren entidades, pro formas, periodos mixtos, fuentes operativas legítimas, históricos FY/Q/TTM, correcciones persistentes, salida de vehículo sin fecha verificada, publicación futura, duplicados, periodos fiscales, monedas/unidades, ajustes positivos/negativos y ausencia de impuestos. Se verifica que informar de una IPO reciente no modifica puntuaciones ni escenarios.

Build completo correcto. ESLint correcto en los módulos nuevos/modificados, salvo dos errores preexistentes `set-state-in-effect` en la ficha principal, reproducidos también sobre `main`; con esa regla preexistente apartada, el archivo no añade errores. No se han cambiado esos efectos ajenos al trabajo.

La comprobación visual en navegador no se completó: el control de navegador detuvo el acceso al no poder confirmar la URL. No se afirma validación visual en escritorio/móvil. Se comprueban renderizado estático de componentes, HTML del análisis y respuestas en el entorno local aislado.

No se han editado correcciones ni datos de usuarios. Sin migraciones, dependencias nuevas, cambios de pesos, activación de staging o publicación de documentos españoles.

Limitación independiente detectada al contrastar TYGO: `companyfacts` entrega Revenues FY2025 con una escala distinta del estado financiero publicado (103.536.000.000 frente a 103.536.000 USD). Este cambio de P/E conserva esa entrada y sus fórmulas; mantener Growth/Quality iguales en la regresión no certifica que ese ingreso sea correcto. Se debe conciliar esa discrepancia de origen por separado.
