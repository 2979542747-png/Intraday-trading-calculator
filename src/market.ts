import type {Quote} from './trading.ts';
const ids=new Map<string,string>();
function jsonp(url:string,signal?:AbortSignal):Promise<any>{return new Promise((resolve,reject)=>{
 const id=crypto.randomUUID(),frame=document.createElement('iframe');let done=false;
 frame.hidden=true;frame.title='Isolated quote transport';frame.setAttribute('sandbox','allow-scripts');frame.referrerPolicy='no-referrer';
 const finish=(error:Error|null,data?:any)=>{if(done)return;done=true;clearTimeout(timer);signal?.removeEventListener('abort',abort);window.removeEventListener('message',receive);frame.remove();error?reject(error):resolve(data);};
 const receive=(event:MessageEvent)=>{if(event.source!==frame.contentWindow||event.origin!=='null'||event.data?.type!=='quote-result'||event.data.id!==id)return;finish(event.data.error?new Error(String(event.data.error)):null,event.data.data);};
 const abort=()=>finish(new DOMException('请求已取消','AbortError')),timer=setTimeout(()=>finish(new Error('行情请求超时，请稍后重试')),12000);
 window.addEventListener('message',receive);if(signal?.aborted){abort();return;}signal?.addEventListener('abort',abort,{once:true});
 frame.onload=()=>{if(!done)frame.contentWindow?.postMessage({type:'quote-request',id,url},'*');};frame.src='./quote-bridge.html';document.body.appendChild(frame);
});}
async function search(q:string,signal?:AbortSignal,cn=false){
 const d=await jsonp('https://searchapi.eastmoney.com/api/suggest/get?type=14&token=D43BF722C8E33BDC906FB84D85E326E8&count=30&input='+encodeURIComponent(q),signal);return (d.QuotationCodeTable?.Data||[]).filter((s:any)=>cn?['0','1'].includes(String(s.MktNum))&&/^\d{6}$/.test(s.Code)&&(/A/.test(s.SecurityTypeName||'')||['1','2'].includes(String(s.SecurityType))):[105,106,107].includes(Number(s.MktNum))&&String(s.TypeUS)==='1').map((s:any)=>{ids.set((cn?'cn:':'us:')+s.Code,s.QuoteID||s.MktNum+'.'+s.Code);return {symbol:s.Code,name:s.Name,exchange:cn?(String(s.MktNum)==='1'?'沪市':'深市'):s.JYS};});
}
export function parseEastmoney(raw:any,symbol:string,cn=false):Quote{
 const d=raw?.data;if(!d?.trends?.length)throw new Error('暂无可用的常规时段行情');
 const points=d.trends.map((s:string)=>{const a=s.split(',');return {time:Date.parse(a[0].replace(' ','T')+':00+08:00')/1000,price:Number(a[2]),volume:Number(a[5])||0};}).filter((p:any)=>Number.isFinite(p.time)&&p.price>0);
 if(!points.length)throw new Error('行情数据不完整');
 const midnight=Date.parse(d.trends[0].slice(0,10)+'T00:00:00+08:00')/1000,b=String(d.beticks||'').split('|').map(Number);
 const sessionStart=cn?midnight+34200:Number.isFinite(b[1])?midnight+b[1]:points[0].time;
 let sessionEnd=cn?midnight+54000:Number.isFinite(b[2])?midnight+b[2]:sessionStart+23400;if(sessionEnd<=sessionStart)sessionEnd+=86400;
 const regular=points.filter((p:any)=>p.time>=sessionStart&&p.time<=sessionEnd),last=regular.at(-1);if(!last)throw new Error('暂无常规时段数据');
 return {symbol,name:d.name||symbol,currency:cn?'CNY':'USD',points:regular,price:last.price,previousClose:Number(d.preClose)>0?Number(d.preClose):null,sessionStart,sessionEnd,regularStart:sessionStart,regularEnd:sessionEnd,quoteTime:last.time,fetchedAt:Date.now(),source:'东方财富（参考行情）'};
}
export async function marketFetch(url:string,options:{signal?:AbortSignal}={}):Promise<Response>{
 const p=new URL(url,'https://local.invalid').searchParams,q=p.get('q')||'',cn=p.get('market')==='cn',key=(cn?'cn:':'us:')+q;
 const signal=options.signal?AbortSignal.any([options.signal,AbortSignal.timeout(12000)]):AbortSignal.timeout(12000);
 try{
  if(p.get('action')==='search')return Response.json({stocks:await search(q,signal,cn)});
  if(!ids.has(key)){const matches=await search(q,signal,cn);if(!matches.some((s:any)=>s.symbol===q))throw new Error('未找到该股票代码，请从搜索结果选择');}
  const d=await jsonp('https://push2his.eastmoney.com/api/qt/stock/trends2/get?secid='+encodeURIComponent(ids.get(key)!)+'&fields1=f1,f2,f3,f4,f5,f6,f7,f8,f9,f10,f11,f12,f13&fields2=f51,f52,f53,f54,f55,f56,f57,f58&iscr=0&ndays=1',signal);
  return Response.json(parseEastmoney(d,q,cn));
 }catch(e){if(options.signal?.aborted)throw e;return Response.json({error:e instanceof Error?e.message:'行情加载失败，请稍后刷新或手动输入价格'},{status:502});}
}
