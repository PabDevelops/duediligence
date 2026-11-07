// Shared existing price refresh formulas. Share-count reconciliation uses this
// same path so market cap and its dependent ratios cannot disagree.
export function recomputeFinancialPriceRatios(data,newPrice){
  if(!data||newPrice==null)return {};
  const out={};
  if(data.sharesOutstanding)out.marketCap=newPrice*data.sharesOutstanding;
  const marketCap=out.marketCap??data.marketCap;
  if(data.eps)out.pe=+(newPrice/data.eps).toFixed(2);
  if(marketCap!=null&&data.fcfVal){
    out.pfcf=data.fcfVal>0?+(marketCap/data.fcfVal).toFixed(1):null;
    out.fcfYield=+(data.fcfVal/marketCap*100).toFixed(2);
  }
  if(marketCap!=null&&data.equityVal&&data.equityVal>0)out.priceToBook=+(marketCap/data.equityVal).toFixed(2);
  if(marketCap!=null&&data.evEbitda&&data.marketCap!=null&&data.netDebt!=null){
    const impliedEbitda=(data.marketCap+data.netDebt)/data.evEbitda;
    if(impliedEbitda)out.evEbitda=+((marketCap+data.netDebt)/impliedEbitda).toFixed(1);
  }
  return out;
}
