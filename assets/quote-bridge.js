// Runs only in an opaque-origin iframe sandbox (allow-scripts, no allow-same-origin).
// The parent supplies a public search/quote URL, never holdings or local records.
let started=false;
addEventListener('message',event=>{
 if(started||event.source!==parent||event.data?.type!=='quote-request')return;
 const {id,url}=event.data;if(typeof id!=='string'||typeof url!=='string')return;
 let endpoint;try{endpoint=new URL(url);}catch{return;}
 if(endpoint.protocol!=='https:'||!((endpoint.hostname==='searchapi.eastmoney.com'&&endpoint.pathname==='/api/suggest/get')||(endpoint.hostname==='push2his.eastmoney.com'&&endpoint.pathname==='/api/qt/stock/trends2/get')))return;
 started=true;
 const send=(data,error)=>parent.postMessage({type:'quote-result',id,data,error},event.origin==='null'?'*':event.origin);
 window.__quote_callback=data=>send(data,null);
 const script=document.createElement('script');endpoint.searchParams.set('cb','__quote_callback');script.src=endpoint.href;script.referrerPolicy='no-referrer';script.onerror=()=>send(null,'免费行情暂时不可用，请稍后刷新或手动输入价格');document.head.appendChild(script);
});
