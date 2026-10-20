import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {solveAddition} from '../src/averaging.ts';
import {DEFAULT_FEES,feesFor} from '../src/trading.ts';
const none=()=>0;
const base={shares:'100',costPerShare:'12',price:10,mode:'percent',rise:'10',buyFee:none,sellFee:none,feesValid:true};
const solve=changes=>solveAddition({...base,...changes});
const ok=(r,n)=>{assert.equal(r.status,'ok',JSON.stringify(r));assert.equal(r.shares,n);assert(r.net>=0);if(n>0)assert(r.previousNet<0);};
ok(solve({}),100);ok(solve({mode:'amount',rise:'1'}),100);
ok(solve({costPerShare:'9'}),0);
ok(solve({costPerShare:'12.001'}),101);
ok(solve({buyFee:()=>5,sellFee:()=>5}),110);
ok(solve({shares:'.5',costPerShare:'12',mode:'amount',rise:'1'}),1);
ok(solve({shares:'1',costPerShare:'.3',price:.1,mode:'amount',rise:'.1'}),1);
let calls=0;ok(solve({costPerShare:'9',rise:'0',buyFee:()=>{calls++;return 100;}}),0);assert.equal(calls,0);
assert.equal(solve({rise:'0'}).status,'impossible');
assert.equal(solve({rise:'0',costPerShare:'10',sellFee:()=>.01}).status,'impossible');
for(const changes of [{shares:''},{shares:'0'},{shares:'-1'},{shares:'NaN'},{shares:'Infinity'},{costPerShare:''},{costPerShare:'-1'},{costPerShare:'abc'},{price:0},{price:NaN},{price:Infinity},{rise:''},{rise:'-1'},{rise:'abc'},{rise:'Infinity'},{feesValid:false}])assert.notEqual(solve(changes).status,'ok',JSON.stringify(changes));
assert.notEqual(solve({rise:'1e-100'}).status,'ok');
assert.notEqual(solve({costPerShare:'100000000000'}).status,'ok');
assert.notEqual(solve({mode:'amount',rise:'.000000001'}).status,'ok');
const impossible=solve({buyFee:n=>n*2,mode:'amount',rise:'1'});assert.notEqual(impossible.status,'ok');assert(impossible.message.includes('范围'));
ok(solve({price:10.5}),43);ok(solve({price:10.5,mode:'amount',rise:'1'}),50);
ok(solve({price:11,mode:'amount',rise:'1'}),0);
// A rounded fee can cause several positive/negative transitions. Exhaustive
// independent enumeration tests the GLOBAL minimum, not just the preceding share.
let seed=173,compared=0,nonMonotone=0;
const random=()=>((seed=(seed*1664525+1013904223)>>>0)/2**32);
for(let i=0;i<360;i++){
 const f=structuredClone(DEFAULT_FEES);f.rounding=['up','nearest','none'][i%3];
 f.buy={perShare:[.009,.003,.01][i%3],percent:i%2?.01:0,minimum:i%5===0?.5:0,fixed:i%7===0?.03:0,extraPerShare:.001};
 f.sell={perShare:.002,percent:.01,minimum:i%4===0?.25:0,fixed:0,extraPerShare:.0003};
 f.tafCap=i%2?.04:9.79;f.tafMinimum=i%3===0?.01:0;
 const shares=1+Math.floor(random()*30),price=1+Math.floor(random()*100)/10,rise=Number((.02+random()*.07).toFixed(5)),cost=Number((price+rise+random()*.25).toFixed(5));
 const buyFee=(n,p)=>feesFor(n,p,'buy',f).total,sellFee=(n,p)=>feesFor(n,p,'sell',f).total;
 const r=solve({shares:String(shares),costPerShare:String(cost),price,mode:'amount',rise:String(rise),buyFee,sellFee});
 let first=-1,last=-Infinity;
 for(let n=0;n<=100000;n++){
  const profit=shares*(price+rise-cost)+n*rise-sellFee(shares+n,price+rise)-(n?buyFee(n,price):0);
  if(profit<last-1e-9)nonMonotone++;last=profit;
  if(profit>=-1e-9){first=n;break;}
 }
 assert(first>=0);ok(r,first);compared++;
}
assert(nonMonotone>0,'Must exercise fee-rounding downward jumps');
// Load the actual A-share function, rather than copying its fee model into tests.
const source=fs.readFileSync(new URL('../src/a-share-main.js',import.meta.url),'utf8');
const feeSource=source.slice(source.indexOf('function calcNetProfit('),source.indexOf('\n',source.indexOf('function calcNetProfit(')));
const ctx=vm.createContext({});vm.runInContext(feeSource,ctx);
const aFees={commissionRate:.00025,stampDutyRate:.0005,transferFeeRate:.00001,managementFeeRate:.00002,handlingFeeRate:.0000341,minCommission:5};
const aBuy=(n,p)=>ctx.calcNetProfit(n,p,p,aFees).buyFee,aSell=(n,p)=>ctx.calcNetProfit(n,p,p,aFees).sellFee;
for(const rise of [.01,.05,.1,1,5]){
 const r=solve({shares:'100',costPerShare:'12',mode:'amount',rise:String(rise),buyFee:aBuy,sellFee:aSell});
 let first=-1;for(let n=0;n<100000;n++){const net=(10+rise)*(100+n)-1200-10*n-aSell(100+n,10+rise)-(n?aBuy(n,10):0);if(net>=-1e-8){first=n;break;}}
 if(rise===.01){assert.equal(first,-1);assert.notEqual(r.status,'ok');}else{assert(first>=0);ok(r,first);}compared++;
}
console.log(`PASS: both target modes, zero order, integer minimum, decimal precision, invalid/range/no-solution cases; ${compared} exhaustive comparisons with actual A/US fees, ${nonMonotone} downward fee-rounding jumps.`);
