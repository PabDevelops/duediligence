import { toScore100 } from './scoreScale';
import { tierForScore } from './engine/tierScale';

// Presentation adapter only. GQS blends ROIC, revenue growth and other adjustments;
// revGrowthScore is the existing revenue-growth sub-score, without that blend.
// CBS and OPPO retain every original sector/cyclicality/capital-discipline adjustment.
export function getCompanyHeaderScores(easyMode, data) {
  const hasGrowth = Number.isFinite(data?.revGrowth) || Number.isFinite(easyMode?.growthCagrPct);
  const hasValue = Number.isFinite(easyMode?.truePfcf) || Number.isFinite(easyMode?.trueFcfYield);
  const hasQuality = [
    easyMode?.roicForScore, data?.grossMargin, data?.opMargin,
    easyMode?.netDebtToEquity, easyMode?.currentRatio, data?.shareDilution,
    easyMode?.cashRunwayYears, data?.insiderOwnershipPct,
  ].some(Number.isFinite) || (Number.isFinite(data?.fcfVal) && data.fcfVal >= 0);

  return [
    { id: 'growth', name: 'GROWTH', source: 'revGrowthScore', available: hasGrowth,
      description: 'Evolución de los ingresos.', missing: 'Faltan datos de crecimiento de ingresos.' },
    { id: 'value', name: 'VALUE', source: 'oppo', available: hasValue,
      description: 'Precio frente a la caja libre.', missing: 'Faltan P/FCF y rentabilidad por FCF.' },
    { id: 'quality', name: 'QUALITY', source: 'cbs', available: hasQuality,
      description: 'Solidez del negocio.', missing: 'Faltan datos del negocio, caja o balance.' },
  ].map(({ available, missing, ...dimension }) => {
    const raw = easyMode?.[dimension.source];
    const valid = typeof raw === 'number' && Number.isFinite(raw) && raw >= 0 && raw <= 5;
    const score100 = available && valid ? toScore100(raw) : null;
    return {
      ...dimension,
      status:score100==null?'unavailable':data?.financialIntegrity?.calculations?.[dimension.id]?.status||'unclassified',
      score100,
      tier: tierForScore(score100),
      description: score100 != null ? dimension.description
        : available ? `Falta la subpuntuación de ${dimension.name.toLowerCase()}.` : missing,
    };
  });
}
