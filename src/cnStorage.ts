import {CN_DEFAULT,validCNFees} from './cnTrading.ts';
import {DEFAULT_FEES} from './trading.ts';
export function migrateCNStorage(storage:Pick<Storage,'getItem'>){
 const read=(key:string,fallback:any)=>{try{return JSON.parse(storage.getItem(key)||'null')??fallback;}catch{return fallback;}};
 const settings={...CN_DEFAULT,...read('tcalc_fee_settings',{})};
 const list=read('tcalc_watchlist',[]),records=read('tcalc_history',[]);
 return {cnFees:validCNFees(settings)?settings:CN_DEFAULT,fees:DEFAULT_FEES,
  watchlist:(Array.isArray(list)?list:[]).filter(s=>s&&/^\d{6}$/.test(s.code)).map(s=>({symbol:s.code,name:s.name||s.code,exchange:s.market==='sh'?'沪市':'深市'})),
  history:(Array.isArray(records)?records:[]).filter(r=>r&&Number.isFinite(r.netProfit)).map(r=>({id:String(r.id),time:r.createdAt||0,stock:{symbol:r.stockCode||'600519',name:r.stockName||'未记录股票名称'},direction:r.direction==='reverse'?'reverse':'positive',form:{shares:String(r.shares),buy:String(r.buyPrice),sell:String(r.sellPrice),target:r.targetProfit==null?'':String(r.targetProfit),originalShares:'',originalCost:'',fractional:false,tick:'0.01'},fees:DEFAULT_FEES,cnFees:{...CN_DEFAULT,...r.feeSettings},profit:r.netProfit})).filter(r=>validCNFees(r.cnFees))};
}
