export const BYTE = Object.freeze({
 ticker:'BYTE.MC',name:'ByteTravel, S.A.',isin:'ES0105817003',country:'ES',
 market:'BME Growth',marketSince:'2026-07-03',
 source:'https://www.bytetravel.com/wp-content/uploads/2026/10/05817_Aviso_20260701_11.pdf',
 allowedHosts:['www.bytetravel.com','bytetravel.com','www.bolsasymercados.es','www.bmegrowth.es'],
});
export function spanishIdentity(ticker) {
 if(ticker===BYTE.ticker)return BYTE;
 return {ticker,country:ticker?.endsWith('.MC')?'ES-candidate':null,market:'unverified'};
}
