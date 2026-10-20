/** Decimal arithmetic for cash flows. Fee functions remain the source of fee rules.
 * Their Number outputs are normalized to 10 decimal places (well below a cent),
 * before any subtraction. We never subtract large floating-point cash amounts.
 */
type Decimal = { value: bigint; places: number };
const pow = (n: number) => 10n ** BigInt(n);
function decimal(input: string | number): Decimal {
 const text=String(input).trim();
 if(text.length>80||!Number.isFinite(Number(text))||!/^\+?\d*\.?\d+(?:e[+-]?\d+)?$/i.test(text))throw Error('请输入有效的非负数字');
 const [mantissa,exponent='0']=text.replace(/^\+/,'').toLowerCase().split('e');
 const [whole,frac='']=mantissa.split('.');let places=frac.length-Number(exponent);
 if(Math.abs(places)>40)throw Error('数值精度超出可计算范围');
 let value=BigInt((whole||'0')+frac);if(places<0){value*=pow(-places);places=0;}
 return {value,places};
}
function add(a:Decimal,b:Decimal,sign=1n):Decimal {const places=Math.max(a.places,b.places);return {value:a.value*pow(places-a.places)+sign*b.value*pow(places-b.places),places};}
function multiply(a:Decimal,b:Decimal):Decimal{return {value:a.value*b.value,places:a.places+b.places};}
const integer=(n:number):Decimal=>({value:BigInt(n),places:0});
function number(a:Decimal){return Number(a.value)/10**a.places;}
function text(a:Decimal){const negative=a.value<0n,v=(negative?-a.value:a.value).toString().padStart(a.places+1,'0');return (negative?'-':'')+(a.places?v.slice(0,-a.places)+'.'+v.slice(-a.places):v);}
function ceilRatio(a:Decimal,b:Decimal):bigint {const numerator=a.value*pow(b.places),denominator=b.value*pow(a.places);return (numerator+denominator-1n)/denominator;}
export type TargetMode='percent'|'amount';
export type FeeFunction=(shares:number,price:number)=>number;
export type AdditionInput={shares:string|number;costPerShare:string|number;price:number;mode:TargetMode;rise:string;buyFee:FeeFunction;sellFee:FeeFunction;feesValid:boolean};
export type AdditionResult={status:'ok';shares:number;originalShares:number;originalCost:number;originalTotal:number;price:number;targetPrice:number;targetPriceExact:string;buyAmount:number;buyFee:number;funds:number;totalShares:number;averageCost:number;sellFee:number;net:number;netExact:string;previousNet:number|null;calls:number}
 | {status:'invalid'|'impossible'|'limit';message:string;targetPrice?:number;targetPriceExact?:string};
export const MAX_ADDITION_SHARES=1_000_000_000;
const MAX_CASH=10_000_000_000,MAX_EVALUATIONS=10000;
export function solveAddition(input:AdditionInput):AdditionResult {
 let target:Decimal|undefined;
 try {
  if(String(input.shares).trim()===''||!(Number(input.shares)>0))return {status:'invalid',message:'请先填写大于 0 的原持仓股数。'};
  if(String(input.costPerShare).trim()==='')return {status:'invalid',message:'请先填写原持仓每股成本。'};
  if(!Number.isFinite(input.price)||input.price<=0)return {status:'invalid',message:'暂无有效行情，等待现有行情更新后计算。'};
  if(input.rise.trim()==='')return {status:'invalid',message:'请输入目标上涨百分比或每股上涨金额。'};
  if(!input.feesValid)return {status:'invalid',message:'请先修正现有手续费设置中的无效数值。'};
  if(!['percent','amount'].includes(input.mode))return {status:'invalid',message:'请选择有效的目标输入模式。'};
  const held=decimal(input.shares),cost=decimal(input.costPerShare),price=decimal(input.price),rise=decimal(input.rise);
  const gain=input.mode==='percent'?{...multiply(price,rise),places:price.places+rise.places+2}:rise;
  target=add(price,gain);
  const targetPrice=number(target),originalTotal=multiply(held,cost);
  if(number(held)>MAX_ADDITION_SHARES||number(originalTotal)>MAX_CASH||targetPrice>MAX_CASH)throw Error('超出计算范围：原持仓最多 10 亿股，各项金额最多 100 亿元（或美元）。');
  const base=add(multiply(target,held),originalTotal,-1n);
  let calls=0;
  function fee(value:number):Decimal {if(!Number.isFinite(value)||value<0||value>MAX_CASH)throw Error('手续费超出可计算范围，请检查费用设置。');return decimal(value.toFixed(10));}
  function evaluate(n:number){
   calls++;const count=integer(n),totalShares=number(add(held,count)),buyAmount=multiply(price,count);
   if(totalShares>MAX_ADDITION_SHARES||number(buyAmount)>MAX_CASH||targetPrice*totalShares>MAX_CASH)throw Error('计算结果超出范围：总股数最多 10 亿股，各项金额最多 100 亿元（或美元）。');
   // No buy order at n=0: do not charge the existing function's minimum/fixed buy fee.
   const buyFee=n===0?integer(0):fee(input.buyFee(n,input.price)),sellFee=fee(input.sellFee(totalShares,targetPrice));
   const net=add(add(add(base,multiply(gain,count)),buyFee,-1n),sellFee,-1n);
   return {buyAmount,buyFee,sellFee,net,totalShares};
  }
  const finish=(n:number):AdditionResult=>{
   // Final independent verification through both original fee functions.
   const v=evaluate(n),previous=n>0?evaluate(n-1):null;
   if(v.net.value<0n||(previous&&previous.net.value>=0n))throw Error('最小股数校验未通过，请检查手续费规则。');
   const funds=add(v.buyAmount,v.buyFee),newCost=add(originalTotal,funds);
   if(number(funds)>MAX_CASH||number(newCost)>MAX_CASH)throw Error('所需资金或持仓总成本超出计算范围。');
   return {status:'ok',shares:n,originalShares:number(held),originalCost:number(cost),originalTotal:number(originalTotal),price:input.price,targetPrice,targetPriceExact:text(target!),buyAmount:number(v.buyAmount),buyFee:number(v.buyFee),funds:number(funds),totalShares:v.totalShares,averageCost:number(newCost)/v.totalShares,sellFee:number(v.sellFee),net:number(v.net),netExact:text(v.net),previousNet:previous?number(previous.net):null,calls};
  };
  let n=0,current=evaluate(0);
  if(current.net.value>=0n)return finish(0);
  if(gain.value===0n)return {status:'impossible',message:'目标涨幅为 0，原持仓扣除卖出费后仍亏损；按现有非递减费用规则，加仓无法回本。',targetPrice,targetPriceExact:text(target)};
  /* Supported A/US fee totals are nondecreasing in quantity, including minima,
   * rounding and the TAF cap. For deficit D at n, every k < ceil(D/gain)
   * still loses even if all incremental fees were zero. This skips only proven
   * failures, so it finds the GLOBAL first solution even when net is not monotone.
   * No binary search and no assumption that the next share increases net profit.
   */
  while(current.net.value<0n){
   if(calls>=MAX_EVALUATIONS)return {status:'limit',message:'费用与涨幅过于接近，已达到安全计算次数上限，暂不能可靠给出最少股数。请调整情景或费用后重试。',targetPrice,targetPriceExact:text(target)};
   const jump=ceilRatio({...current.net,value:-current.net.value},gain);
   const next=BigInt(n)+(jump>0n?jump:1n);
   if(next>BigInt(MAX_ADDITION_SHARES))return {status:'limit',message:'在最多加仓 10 亿股的计算范围内无可行解，或所需股数超过范围。',targetPrice,targetPriceExact:text(target)};
   n=Number(next);current=evaluate(n);
  }
  return finish(n);
 }catch(e){return {status:'invalid',message:e instanceof Error?e.message:'参数无法计算',...(target?{targetPrice:number(target),targetPriceExact:text(target)}:{})};}
}
