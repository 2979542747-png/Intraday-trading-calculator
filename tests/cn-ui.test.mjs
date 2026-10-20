import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {CN_DEFAULT,calcNetProfit,cnFeesFor,cnSolvePrice} from '../src/cnTrading.ts';
import {migrateCNStorage} from '../src/cnStorage.ts';
import {parseEastmoney} from '../src/market.ts';
const legacy=fs.readFileSync(new URL('../src/a-share-main.js',import.meta.url),'utf8');
const ctx=vm.createContext({});vm.runInContext(legacy.split('\n').find(s=>s.startsWith('function calcNetProfit(')),ctx);
let cases=0;
for(const q of [1,100,1000,100000])for(const p of [.5,10,100,1500])for(const minimum of [0,5,20]){
 const f={...CN_DEFAULT,minCommission:minimum},old=ctx.calcNetProfit(q,p,p*1.02,f),current=calcNetProfit(q,p,p*1.02,f);
 assert.equal(current.netProfit,old.netProfit);assert.equal(cnFeesFor(q,p,'buy',f).total,old.buyFee);assert.equal(cnFeesFor(q,p*1.02,'sell',f).total,old.sellFee);
 for(const direction of ['positive','reverse']){const r=cnSolvePrice(q,p,direction,0,f,.01);if(r!==null){const net=price=>direction==='positive'?calcNetProfit(q,p,price,f).netProfit:calcNetProfit(q,price,p,f).netProfit;assert(net(r)>=-1e-8);if(direction==='positive'||r>.01)assert(net(r+(direction==='positive'?-.01:.01))<-1e-8);}}
 cases++;
}
const stored=new Map([['tcalc_fee_settings',JSON.stringify({...CN_DEFAULT,minCommission:8})],['tcalc_watchlist',JSON.stringify([{code:'002150',name:'正泰电源',market:'sz'}])],['tcalc_history',JSON.stringify([{id:'old',shares:100,buyPrice:10,sellPrice:11,netProfit:89,feeSettings:CN_DEFAULT,stockCode:'002150',stockName:'正泰电源',createdAt:10}])]]);
const migrated=migrateCNStorage({getItem:k=>stored.get(k)||null});assert.equal(migrated.cnFees.minCommission,8);assert.equal(migrated.watchlist[0].symbol,'002150');assert.equal(migrated.history[0].stock.symbol,'002150');assert.equal(migrated.history[0].form.buy,'10');assert.equal(stored.size,3);
const quote=parseEastmoney({data:{preClose:9,trends:['2026-10-07 09:30,10,10,10,10,1,10,10','2026-10-07 13:00,11,11,11,11,1,11,11','2026-10-07 15:00,12,12,12,12,1,12,12']}},'600519',true);
assert.equal(quote.currency,'CNY');assert.equal(quote.price,12);assert.equal(quote.previousClose,9);assert.equal(new Date(quote.sessionStart*1000).toISOString(),'2026-10-07T01:30:00.000Z');assert.equal(new Date(quote.sessionEnd*1000).toISOString(),'2026-10-07T07:00:00.000Z');
console.log(`PASS: ${cases} legacy A-share fee comparisons, conservative price grid, local-data migration, CNY quote parsing and Shanghai time.`);
