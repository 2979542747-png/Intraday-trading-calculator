export type Side = { perShare: number; percent: number; minimum: number; fixed: number; extraPerShare: number };
export type Fees = { buy: Side; sell: Side; secEnabled: boolean; secRate: number; secMinimum: number; tafEnabled: boolean; tafRate: number; tafCap: number; tafMinimum: number; rounding: 'up'|'nearest'|'none' };
export const DEFAULT_FEES: Fees = { buy: { perShare:0,percent:0,minimum:0,fixed:0,extraPerShare:0 },sell:{perShare:0,percent:0,minimum:0,fixed:0,extraPerShare:0},secEnabled:true,secRate:0.00206,secMinimum:0,tafEnabled:true,tafRate:0.000195,tafCap:9.79,tafMinimum:0,rounding:'up' };
export function validFees(f: Fees): boolean {
 return !!f && ['up','nearest','none'].includes(f.rounding) && [f.buy,f.sell].every(s=>!!s && Object.values(s).every(n=>Number.isFinite(n)&&n>=0&&n<=100000) && s.percent<50) && [f.secRate,f.secMinimum,f.tafRate,f.tafCap,f.tafMinimum].every(n=>Number.isFinite(n)&&n>=0) && f.secRate<10 && f.tafMinimum<=f.tafCap;
}
export function roundFee(n:number,mode:Fees['rounding']) { return mode==='none'?n: mode==='up'?Math.max(0,Math.ceil(n*100-1e-9)/100):Math.round((n+Number.EPSILON)*100)/100; }
export function feesFor(q:number,p:number,side:'buy'|'sell',f:Fees) {
 const s=f[side]; const round=(v:number)=>roundFee(v,f.rounding);
 const commission=round(Math.max(q*s.perShare+q*p*s.percent/100,s.minimum));
 const extra=round(s.fixed+q*s.extraPerShare);
 const sec=side==='sell'&&f.secEnabled?round(Math.max(q*p*f.secRate/100,f.secMinimum)):0;
 const taf=side==='sell'&&f.tafEnabled?Math.min(f.tafCap,round(Math.max(f.tafMinimum,q*f.tafRate))):0;
 return {commission,extra,sec,taf,total:commission+extra+sec+taf};
}
export function net(q:number,buy:number,sell:number,f:Fees) {return q*(sell-buy)-feesFor(q,buy,'buy',f).total-feesFor(q,sell,'sell',f).total;}
// Solve on the selected price grid, including the fee rounding discontinuities.
export function solvePrice(q:number,known:number,direction:'positive'|'reverse',target:number,f:Fees,tick:number):number|null {
 if(!Number.isFinite(q)||q<=0||!Number.isFinite(known)||known<=0||!Number.isFinite(target)||target<0||!validFees(f)||!Number.isFinite(tick)||tick<=0)return null;
 if(direction==='positive'){
  let lo=1,hi=Math.max(2,Math.ceil((known+(target+100)/q)*2/tick));
  while(net(q,known,hi*tick,f)<target && hi<1e12)hi*=2;
  if(hi>=1e12)return null;
  while(lo<hi){const mid=Math.floor((lo+hi)/2);if(net(q,known,mid*tick,f)>=target-1e-8)hi=mid;else lo=mid+1;}
  return Number((lo*tick).toFixed(8));
 }
 let lo=0,hi=Math.ceil(known/tick);
 while(lo<hi){const mid=Math.ceil((lo+hi)/2);if(net(q,mid*tick,known,f)>=target-1e-8)lo=mid;else hi=mid-1;}
 return lo>0?Number((lo*tick).toFixed(8)):null;
}
export type Stock={symbol:string;name:string;exchange?:string};
export type Quote={symbol:string;name:string;currency:string;points:{time:number;price:number;volume:number}[];price:number;previousClose:number|null;sessionStart:number;sessionEnd:number;quoteTime:number;fetchedAt:number;regularStart:number;regularEnd:number;source:string};
export function parseChart(raw:any):Quote {
 const r=raw?.chart?.result?.[0],m=r?.meta,q=r?.indicators?.quote?.[0];
 if(!m||m.currency!=='USD'||!['EQUITY','ETF'].includes(m.instrumentType)||!q||!Array.isArray(r.timestamp))throw new Error('没有可用的美元股票常规时段行情');
 const periods=(m.tradingPeriods||[]).flat().filter((p:any)=>Number.isFinite(p.start)&&Number.isFinite(p.end));
 if(!periods.length&&m.currentTradingPeriod?.regular)periods.push(m.currentTradingPeriod.regular);
 const all=r.timestamp.map((t:number,i:number)=>({time:t,price:q.close?.[i],volume:q.volume?.[i]||0})).filter((p:any)=>Number.isFinite(p.time)&&Number.isFinite(p.price)&&p.price>0);
 const period=[...periods].reverse().find((p:any)=>all.some((v:any)=>v.time>=p.start&&v.time<=p.end));
 if(!period)throw new Error('暂无常规时段分时数据');
 const points=all.filter((p:any)=>p.time>=period.start&&p.time<=period.end);
 const last=points[points.length-1]; const before=all.filter((p:any)=>p.time<period.start).at(-1);
 const previousClose=Number.isFinite(m.previousClose)&&m.regularMarketTime>=period.start&&m.regularMarketTime<=period.end+60 ? m.previousClose : before?.price ?? null;
 return {symbol:m.symbol,name:m.shortName||m.longName||m.symbol,currency:m.currency,points,price:last.price,previousClose,sessionStart:period.start,sessionEnd:period.end,quoteTime:last.time,fetchedAt:Date.now(),regularStart:m.currentTradingPeriod?.regular?.start||period.start,regularEnd:m.currentTradingPeriod?.regular?.end||period.end,source:'Yahoo Finance'};
}
