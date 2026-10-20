import React,{useMemo,useState} from 'react';
import {Field} from './Field';
import {solveAddition,type FeeFunction,type TargetMode} from './averaging';
type Props={symbol:string;shares:string;cost:string;onShares:(value:string)=>void;onCost:(value:string)=>void;price:number|null;quoteTime:string;quoteStatus:string;quoteError?:string;loading:boolean;currency:string;buyFee:FeeFunction;sellFee:FeeFunction;feesValid:boolean;PositionField?:typeof Field};
const amount=(n:number,d=2)=>Number.isFinite(n)?n.toLocaleString('en-US',{minimumFractionDigits:d,maximumFractionDigits:d}):'—';
export function AveragingPanel({symbol,shares,cost,onShares,onCost,price,quoteTime,quoteStatus,quoteError,loading,currency,buyFee,sellFee,feesValid,PositionField=Field}:Props){
 const [mode,setMode]=useState<TargetMode>('percent'),[percent,setPercent]=useState(''),[increase,setIncrease]=useState('');
 const rise=mode==='percent'?percent:increase;
 const result=useMemo(()=>solveAddition({shares,costPerShare:cost,price:price??NaN,mode,rise,buyFee,sellFee,feesValid}),[shares,cost,price,mode,rise,buyFee,sellFee,feesValid]);
 const fallbackTarget=price!==null&&rise.trim()!==''&&Number.isFinite(Number(rise))&&Number(rise)>=0?(mode==='percent'?price*(1+Number(rise)/100):price+Number(rise)):NaN;
 const targetPrice=result.targetPrice??fallbackTarget;
 const exactTarget=result.targetPriceExact?.replace(/(\.\d*?)0+$/,'$1').replace(/\.$/,'');
 const success=result.status==='ok'?result:null;
 const rows: [string,string][] = success?[
  ['原持仓股数',amount(success.originalShares,8).replace(/\.?0+$/,'')+' 股'],
  ['原持仓每股成本',currency+amount(success.originalCost,8)],
  ['原持仓总成本',currency+amount(success.originalTotal)],
  ['加仓买入金额',currency+amount(success.buyAmount)],
  ['本次买入手续费',currency+amount(success.buyFee,success.buyFee!==0&&success.buyFee<.01?8:2)],
  ['本次所需资金合计（含买入费）',currency+amount(success.funds)],
  ['加仓后总股数',success.totalShares.toLocaleString('en-US',{maximumFractionDigits:8})+' 股'],
  ['加仓后每股成本（含本次买入费）',currency+amount(success.averageCost,8)],
  ['目标价卖出全部持仓手续费',currency+amount(success.sellFee,success.sellFee!==0&&success.sellFee<.01?8:2)],
  ['目标价清仓预计净收益',currency+amount(success.net,success.net!==0&&success.net<.01?8:2)]
 ]:[];
 return <section className="panel averaging-panel" aria-labelledby="averaging-title">
  <div className="panel-heading"><h3 id="averaging-title">加仓回本计算</h3><span className="badge">{symbol} · 整数股</span></div>
  <p className="micro">沿用已录入的每股持仓成本；原总成本 = 原股数 × 每股成本。历史费用不另行补算或重复计入。</p>
  <div className="averaging-inputs">
   <PositionField label="回本计算 · 原持仓股数" value={shares} onChange={onShares}/>
   <PositionField label={'回本计算 · 原持仓每股成本（'+currency+'）'} value={cost} onChange={onCost}/>
   <label className="field"><span>目标上涨输入方式</span><select aria-label="目标上涨输入方式" value={mode} onChange={e=>setMode(e.target.value as TargetMode)}><option value="percent">上涨百分比</option><option value="amount">每股上涨金额</option></select></label>
   <Field label={mode==='percent'?'从当前报价上涨（%）':'每股上涨金额（'+currency+'）'} value={rise} onChange={mode==='percent'?setPercent:setIncrease} hint={mode==='percent'?'以本次采用的当前报价为基准，不是开盘价或昨收价。':'每股在本次采用的当前报价上增加此金额。'}/>
  </div>
  <div className="averaging-snapshot" role="status">
   <div><span>本次采用的行情报价</span><strong data-testid="addition-quote">{currency}{price!==null?amount(price,8):'—'}</strong><small>行情时间：{quoteTime||'暂无有效行情'}</small></div>
   <div><span>目标股价 · {mode==='percent'?'涨幅 '+(rise||'—')+'%':'每股上涨 '+currency+(rise||'—')}</span><strong data-testid="addition-target">{currency}{Number.isFinite(targetPrice)?exactTarget||amount(targetPrice,8):'—'}</strong><small>{quoteStatus}{loading?' · 正在更新，当前使用上次快照':''}</small></div>
  </div>
  {quoteError&&<p className="error-text">行情更新失败；{price!==null?'以下仍按上次报价计算，数据可能已过期。':'等待有效行情后才能计算。'}</p>}
  {success?<>
   <div className="averaging-answer" role="status"><span>最少需要加仓</span><strong data-testid="addition-shares">{success.shares===0?'无需加仓':amount(success.shares,0)+' 股'}</strong><p>{success.shares===0?'推荐 0 股：原持仓在目标价扣除整仓卖出费后已能回本；不收取本次买入费。':'已复核：该股数可回本，少买 1 股仍亏损 '+currency+amount(-success.previousNet!,8)+'。'}</p></div>
   <dl className="averaging-breakdown">{rows.map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
   </>:<p className="averaging-message" role="status">{result.status!=='ok'?result.message:''}</p>}
  <p className="micro">按当前报价一笔加仓，再按目标价一笔卖出全部持仓计算；实际成交价格变化会影响结果。目标涨幅仅用于模拟测算，不代表股价预测或收益承诺。本功能不下单、不自动交易。</p>
 </section>;
}
