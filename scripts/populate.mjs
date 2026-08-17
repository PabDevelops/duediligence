import fetch from 'node-fetch';

const BASE_URL = 'https://bulltrace.app';

const tickers = [
  'AAPL','MSFT','NVDA','GOOGL','AMZN','META','TSLA','AVGO','WMT','JPM',
  'V','MA','UNH','XOM','JNJ','PG','HD','COST','LLY','MRK',
  'ABBV','CVX','PEP','KO','NFLX','ORCL','CRM','AMD','INTC','QCOM',
  'TXN','INTU','AMAT','MU','ADBE','NOW','LRCX','KLAC','MRVL','SNPS',
  'CDNS','ARM','PANW','CRWD','FTNT','ZS','OKTA','SNOW','DDOG','NET',
  'GS','MS','BAC','WFC','C','BLK','SCHW','AXP','COF','USB',
  'BRK.B','MMC','AON','MCO','SPGI','ICE','CME','CB','ALL','TRV',
  'UNP','UPS','FDX','UBER','LYFT','ABNB','CAT','DE','HON','GE',
  'RTX','LMT','NOC','GD','BA','MMM','EMR','ETN','ROK','AME',
  'AMGN','GILD','REGN','VRTX','BIIB','BMY','PFE','MRK','AZN','NVO',
  'TMO','DHR','ABT','MDT','SYK','EW','ISRG','BSX','ZBH','BDX',
  'MCD','SBUX','CMG','YUM','DPZ','QSR','WEN','MKC','GIS','KHC',
  'MDLZ','HSY','CAG','CPB','SJM','HRL','TSN','TAP','STZ','BF.B',
  'DIS','NFLX','PARA','WBD','FOX','NYT','SPOT','TTD','MTCH','IAC',
  'T','VZ','TMUS','CMCSA','CHTR','DISH','LUMN','CNXT','ATUS','FYBR',
  'NEE','DUK','SO','D','AEP','EXC','SRE','PCG','ED','XEL',
  'PLD','AMT','CCI','EQIX','SPG','O','VICI','WPC','DLR','IRM',
  'CVS','WBA','MCK','CAH','ABC','ESRX','HUM','CI','ELV','MOH',
  'GEV','NRG','VST','CEG','AES','ETR','FE','CNP','LNT','PPL',
  'F','GM','STLA','TM','HMC','TSLA','RIVN','LCID','FST','CVNA',
  'AMZN','TGT','LOW','HD','M','KSS','JWN','TJX','ROST','BURL',
  'GDX','SLB','HAL','BKR','OXY','COP','EOG','PXD','DVN','FANG',
  'GOLD','NEM','AEM','WPM','FNV','PAAS','CDE','AG','FSM','HL',
  'MPW','PEAK','VTR','WELL','HCP','HR','DOC','OHI','SBRA','LTC',
  'ASML','TSM','SMCI','ON','TER','LRCX','AMAT','KLA','ACLS','FORM',
  'PYPL','SQ','SOFI','AFRM','UPST','LCID','OPEN','COIN','HOOD','ACHR',
  'SPY','QQQ','IWM','DIA','GLD','SLV','TLT','HYG','VNQ','XLF',
  'MSCI','MORN','FDS','WEX','GDOT','MQ','FARO','RAMP','TYL','DSGX',
  'SHOP','SE','MDB','TEAM','ATLASSIAN','ZM','DOCU','DOCN','ESTC','ELASTIC',
  'VALE','RIO','BHP','FCX','AA','ALB','MP','LTHM','ALTM','SQM',
  'V','MA','PYPL','FI','FIS','GPN','WEX','FLYW','PAYO','RELY',
  'UBER','LYFT','DASH','ABNB','BKNG','EXPE','TRIP','HTZ','CAR','AVIS',
  'VRT','ETN','CARR','TT','JCI','WMS','AAON','LII','TRNE','HASI',
  'IREN','CORZ','MARA','RIOT','BTBT','CLSK','BTDR','CIFR','WGMI','HASH',
  'ASTS','RDW','RKLB','LUNR','SPCE','PL','BRST','MNTS','AAMC','VACQ',
  'AMCO','WEIR','SPX','ASYS','T1','AMPX','MP','SBSW','GMET','TUN',
  'XPEL','BBSI','VRT','POWL','HLIO','MTRN','AAON','SMDI','CEVA','PFIE',
  'CB','AIG','MET','PRU','AFL','UNM','PFG','VOYA','RGA','FGL',
  'GS','MS','JPM','BAC','WFC','C','USB','TFC','RF','HBAN',
  'COST','WMT','TGT','LOW','HD','DLTR','DG','BIG','FIVE','OLLI',
  'ACN','IBM','INFY','WIT','CTSH','EPAM','G','GLOB','FLUT','DXC',
  'NKE','LULU','UAA','PVH','RL','TPR','HBI','VFC','GES','SKX',
  'GOOGL','META','SNAP','PINS','RDDT','TWTR','BMBL','MTCH','MANU','DKNG',
  'PYPL','COIN','SI','HOOD','SOFI','LC','UPST','AFRM','OPEN','CURO',
];

// Deduplicate
const unique = [...new Set(tickers)];

async function populate() {
  console.log(`Populating ${unique.length} tickers...`);
  let ok = 0, fail = 0;

  for (const ticker of unique) {
    try {
      const res = await fetch(`${BASE_URL}/api/stock?ticker=${ticker}&refresh=true`);
      const data = await res.json();
      if (data.error) {
        console.log(`❌ ${ticker}: ${data.error}`);
        fail++;
      } else {
        console.log(`✓ ${ticker}: ${data.name}`);
        ok++;
      }
    } catch (e) {
      console.log(`❌ ${ticker}: ${e.message}`);
      fail++;
    }
    // Espera 800ms entre requests para no saturar Finnhub
    await new Promise(r => setTimeout(r, 800));
  }

  console.log(`\nDone: ${ok} ok, ${fail} failed`);
}

populate();