// Official TSE EA12/EA20 zoning reader. Only IBGE 2026 cities above one million residents.
// No unvalidated zones are fed into the national forecasting engine.
"use strict";
const cities=require("../data/metros-2026.json").cities;
const allowed=new Map(cities.map(c=>[c.ibge,c]));
const BASE="https://resultados.tse.jus.br/oficial/ele2026";
const toInt=v=>Number(String(v??"0").replace(/\./g,"").replace(",","."))||0;
function findCandidate(j,number){
 for(const cargo of j?.carg||[]){if(String(cargo.cd)!=="1")continue;
  for(const ag of cargo.agr||[])for(const pa of ag.par||[])for(const c of pa.cand||[]){
   if(String(c.n)===String(number))return toInt(c.vap);
  }
 }
 return null;
}
async function fetchTse(url,timeout=7000){
 const ctrl=new AbortController(),id=setTimeout(()=>ctrl.abort(),timeout);
 try{
  const response=await fetch(url,{signal:ctrl.signal,headers:{"Accept":"application/json"}});
  if(!response.ok)throw Error("TSE HTTP "+response.status);
  return await response.json();
 }finally{clearTimeout(id)}
}
async function config(){
 const j=await fetchTse(BASE+"/6257/config/mun-e006257-cm.json",11500);
 if(!Array.isArray(j.abr))throw Error("Formato EA12 não reconhecido");
 return j;
}
function parseZone(j,turn,zone){
 if(String(j?.ele)!==String(turn===1?6257:6258))throw Error("Eleição diferente da solicitada");
 if(String(j?.tpabr||"").toLowerCase()!=="zona"||String(j?.cdabr||"").padStart(4,"0")!==zone)throw Error("Zona incompatível");
 const a=findCandidate(j,22),b=findCandidate(j,13);
 if(a===null||b===null)throw Error("Candidatos ausentes na zona");
 const n=toInt(j?.v?.vv),sectionsTotal=toInt(j?.s?.ts),sectionsCounted=toInt(j?.s?.st);
 if(!Number.isFinite(n)||n<=0||a+b>n||sectionsCounted>sectionsTotal)throw Error("Totalização não disponível");
 return {validVotes:n,flavioVotes:a,lulaVotes:b,sectionsTotal,sectionsCounted,sectionsPct:sectionsTotal?100*sectionsCounted/sectionsTotal:0,
  generatedAt:[j.dg,j.hg].filter(Boolean).join(" "),idg:j.idg||null};
}
async function resultFor(city,z,turn){
 const elect=turn===1?6257:6258,year=String(elect).padStart(6,"0"),uf=city.uf.toLowerCase();
 const path=BASE+"/"+elect+"/dados/"+uf+"/"+uf+city.tse+"-z"+z+"-c0001-e"+year+"-u.json";
 return parseZone(await fetchTse(path),turn,z);
}
module.exports=async(req,res)=>{
 res.setHeader("X-Content-Type-Options","nosniff");
 const city=allowed.get(String(req.query?.city||""));
 if(!city)return res.status(400).json({ok:false,error:"Cidade fora do conjunto IBGE de 2026 (>1 milhão)."});
 const mode=String(req.query?.mode||"list");
 try{
  if(mode==="list"){
   res.setHeader("Cache-Control","public, s-maxage=86400, stale-while-revalidate=172800");
   const j=await config();
   const area=j.abr.find(a=>String(a.cd).toUpperCase()===city.uf);
   const municipal=area?.mu?.find(m=>String(m.cd)===city.tse&&String(m.cdi)===city.ibge);
   const zones=[...new Set((municipal?.z||[]).map(z=>String(z).padStart(4,"0")))].filter(z=>/^\d{4}$/.test(z)).sort();
   if(!zones.length)throw Error("Cidade não encontrada no cadastro oficial de zonas (EA12).");
   return res.status(200).json({ok:true,city,zones,source:"TSE · EA12 primeiro turno",retrievedAt:new Date().toISOString()});
  }
  if(mode==="batch"){
   res.setHeader("Cache-Control","public, s-maxage=20, stale-while-revalidate=25");
   const raw=String(req.query?.zones||"").split(",").filter(Boolean);
   const zs=[...new Set(raw)].slice(0,8);
   if(!zs.length||raw.length>8||zs.some(z=>!/^\d{4}$/.test(z)))return res.status(400).json({ok:false,error:"Lote inválido; máximo de oito zonas."});
   const results=await Promise.all(zs.map(async z=>{
    const [first,second]=await Promise.allSettled([resultFor(city,z,1),resultFor(city,z,2)]);
    return {zone:z,first:first.status==="fulfilled"?first.value:null,
     second:second.status==="fulfilled"?second.value:null,
     firstError:first.status==="rejected"?String(first.reason?.message||first.reason).slice(0,80):null,
     secondError:second.status==="rejected"?String(second.reason?.message||second.reason).slice(0,80):null};
   }));
   return res.status(200).json({ok:true,city,results,source:"TSE · EA20 6257/6258",retrievedAt:new Date().toISOString()});
  }
  return res.status(400).json({ok:false,error:"Modo inválido"});
 }catch(e){return res.status(502).json({ok:false,error:String(e?.message||e).slice(0,180)});}
};
