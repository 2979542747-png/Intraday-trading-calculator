import React from 'react';
export function Field({label,value,onChange,step='any',hint,disabled=false}:{label:string;value:string|number;onChange:(v:string)=>void;step?:string;hint?:string;disabled?:boolean}){
 return <label className="field"><span>{label}</span><input aria-label={label} type="number" inputMode="decimal" step={step} min="0" value={value} disabled={disabled} onChange={e=>onChange(e.target.value)} placeholder="请输入"/>{hint&&<small>{hint}</small>}</label>;
}
