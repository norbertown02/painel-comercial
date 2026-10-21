// Fonte oficial: TSE, eleição federal do 2º turno de 2026 (6258).
// Nunca apresenta ausência de dados como resultado zero e nunca inventa votos.
const UFS="AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO".split(" ");
const BASE="https://resultados.tse.jus.br/oficial/ele2026/6258/dados";
const percent=v=>{if(typeof v==="number")return v;return Number(String(v??"0").replace(",", "."))||0};
const int=v=>Number(String(v??"0").replace(/\./g,"").replace(",", "."))||0;
function candidates(j){
 const found=[];
 for(const cargo of j?.carg||[]){
  if(String(cargo.cd)!=="1")continue;
  for(const a of cargo.agr||[])for(const p of a.par||[])for(const c of p.cand||[])found.push(c);
 }
 return found;
}
function parse(j,geo){
 const candidatesList=candidates(j);
 const fav=candidatesList.find(c=>String(c.n)==="22"||/FLAVIO.*BOLSONARO/i.test(c.nmu||""));
 const lul=candidatesList.find(c=>String(c.n)==="13"||/LULA/i.test(c.nmu||""));
 if(!fav||!lul)throw new Error("Candidatos não encontrados no resultado TSE: "+geo);
 const sectionsTotal=int(j?.s?.ts),sectionsCounted=int(j?.s?.st);
 const valid=int(j?.v?.vv);
 const flavio=int(fav.vap),lula=int(lul.vap);
 return {geo,sectionsTotal,sectionsCounted,sectionsPct:sectionsTotal?100*sectionsCounted/sectionsTotal:0,validVotes:valid,flavioVotes:flavio,lulaVotes:lula,flavioShare:valid?100*flavio/valid:null,lulaShare:valid?100*lula/valid:null,generatedAt:[j.dg,j.hg].filter(Boolean).join(" "),idg:j.idg||null,source:"TSE"};
}
async function read(geo,code){
 const lower=geo.toLowerCase(),prefix=code?lower+code:lower;
 const path=BASE+"/"+lower+"/"+prefix+"-c0001-e006258-u.json";
 const ac=new AbortController(),t=setTimeout(()=>ac.abort(),9000);
 try{
  const r=await fetch(path,{signal:ac.signal,headers:{"Accept":"application/json"}});
  if(!r.ok)throw new Error("TSE "+geo+" HTTP "+r.status);
  return parse(await r.json(),geo+(code?":"+code:""));
 }finally{clearTimeout(t);}
}
module.exports=async(req,res)=>{
 res.setHeader("Cache-Control","public, s-maxage=25, stale-while-revalidate=30");
 res.setHeader("X-Content-Type-Options","nosniff");
 const mode=String(req.query?.mode||"overview");
 try{
  if(mode==="city"){
   const uf=String(req.query.uf||"").toUpperCase();
   const code=String(req.query.code||"");
   if(!UFS.includes(uf)||!/^\d{5}$/.test(code))return res.status(400).json({ok:false,error:"Município ou UF inválidos."});
   let one=await read(uf,code);
   return res.status(200).json({ok:true,state:"ready",data:one,retrievedAt:new Date().toISOString()});
  }
  if(mode==="batch"){
   const spec=String(req.query.items||"").split(",").slice(0,16);
   if(!spec.length||spec.some(x=>!/^([A-Z]{2}):\d{5}$/.test(x)||!UFS.includes(x.slice(0,2))))return res.status(400).json({ok:false,error:"Lote inválido."});
   const results=await Promise.allSettled(spec.map(x=>read(x.slice(0,2),x.slice(3))));
   return res.status(200).json({ok:true,results:results.map((r,i)=>({key:spec[i],data:r.status==="fulfilled"?r.value:null,error:r.status==="rejected"?String(r.reason?.message||r.reason).slice(0,160):null})),retrievedAt:new Date().toISOString()});
  }
  if(mode!=="overview")return res.status(400).json({ok:false,error:"Modo desconhecido."});
  const national=await read("BR");
  if(national.sectionsCounted===0)return res.status(200).json({ok:true,state:"awaiting",national,states:[],retrievedAt:new Date().toISOString(),message:"Apuração do segundo turno ainda não iniciada no TSE."});
  const all=await Promise.allSettled(UFS.map(uf=>read(uf)));
  const states=all.filter(x=>x.status==="fulfilled").map(x=>x.value);
  const failures=all.flatMap((x,i)=>x.status==="rejected"?[{uf:UFS[i],error:String(x.reason?.message||x.reason).slice(0,90)}]:[]);
  return res.status(200).json({ok:true,state:failures.length?"partial":"ready",national,states,failures,retrievedAt:new Date().toISOString()});
 }catch(e){
  console.error("TSE fetch error:",e);
  return res.status(502).json({ok:false,state:"unavailable",error:String(e.message||e).slice(0,300),retrievedAt:new Date().toISOString()});
 }
};
