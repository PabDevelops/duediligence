// Project only after validation: rejected originals and provenance belong on the
// detail endpoint, not in every row of the full-universe screener response.
export const SCREENER_FIELDS = [
  'name', 'sector', 'exchange', 'country', 'currentPrice',
  'marketCap', 'pe', 'revGrowth', 'opMargin', 'fcfYield', 'roe', 'grossMargin',
];

export const SCREENER_PROVISIONAL_WARNING = 'Datos provisionales: algunas relaciones fiscales y fuentes siguen sin verificarse. No confundir estas estimaciones con resultados validados.';

export function screenerView(validated) {
  validated = validated || {};
  const result = Object.fromEntries(SCREENER_FIELDS.map(field => [field, validated[field] ?? null]));
  if (validated.financialIntegrity) {
    const { status } = validated.financialIntegrity;
    result.financialIntegrity = { status };
  }
  return result;
}
