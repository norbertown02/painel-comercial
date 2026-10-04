const UFS=["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"];
const BASE="https://resultados.tse.jus.br/oficial/ele2026/6257/dados";
function n(v){return Number(String(v==null?0:v).replace(/\./g,"").replace(",","."))||0}
function norm(s){return String(s||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toUpperCase()}
function allCandidates(j){
  const out=[];
  for(const cargo of (j.carg||[])){
    for(const agr of (cargo.agr||[])){
      for(const par of (agr.par||[])){
        for(const cand of (par.cand||[])) out.push(cand);
      }
    }
  }
  return out;
}
function parse(j,uf){
  const cands=allCandidates(j);
  const find=(term)=>cands.find(c=>{
    const a=norm(c.nmu), b=norm(c.nm);
    return a===term || a.includes(term) || b.includes(term);
  })||{};
  const f=find("FLAVIO BOLSONARO");
  const l=find("LULA");
  const vv=n(j&&j.v&&j.v.vv);
  const out={
    uf,
    validVotes:vv,
    flavioVotes:n(f.vap),
    flavioShare:n(f.pvap),
    lulaVotes:n(l.vap),
    lulaShare:n(l.pvap),
    sectionsPct:n(j&&j.s&&j.s.pst),
    generatedAt:[j.dg,j.hg].filter(Boolean).join(" ")
  };
  if(uf==="BR") console.log("PARSED_BR",JSON.stringify(out),"CANDS",cands.slice(0,20).map(x=>({nm:x.nm,nmu:x.nmu,vap:x.vap,pvap:x.pvap})));
  return out;
}
async function get(uf){
  const u=uf.toLowerCase();
  const r=await fetch(BASE+"/"+u+"/"+u+"-c0001-e006257-u.json?ts="+Date.now(),{cache:"no-store",headers:{"Cache-Control":"no-cache","Pragma":"no-cache"}});
  if(!r.ok) throw new Error(uf+" TSE HTTP "+r.status);
  return parse(await r.json(),uf);
}
module.exports=async(req,res)=>{
  res.setHeader("Cache-Control","no-store");
  try{
    const all=await Promise.all([get("BR"),...UFS.map(get)]);
    res.status(200).json({ok:true,national:all[0],states:all.slice(1),source:"TSE",retrievedAt:new Date().toISOString()});
  }catch(e){
    console.error("TSE fetch error",e);
    res.status(502).json({ok:false,error:String(e&&e.message?e.message:e)});
  }
};