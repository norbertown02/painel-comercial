const UFS=["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"];
const BASE="https://resultados.tse.jus.br/oficial/ele2026/6257/dados";
function n(v){return Number(String(v??0).replace(/\./g,"").replace(",","."))||0}
function parse(j,uf){
  const c=Array.isArray(j.cand)?j.cand:[];
  const norm=s=>String(s||"").normalize("NFD").replace(/[\\u0300-\\u036f]/g,"").toUpperCase();
  const byName=name=>c.find(x=>norm(x.nm)===name)||{};
  const f=byName("FLAVIO BOLSONARO"), l=byName("LULA");
  const valid=n(j.vvc)||n(j.vv)||c.reduce((a,x)=>a+n(x.vap),0);
  return {uf,validVotes:valid,flavioVotes:n(f.vap),flavioShare:n(f.pvap),lulaVotes:n(l.vap),lulaShare:n(l.pvap),sectionsPct:n(j.pst),generatedAt:[j.dt,j.ht].filter(Boolean).join(" ")};
}
async function get(uf){
  const u=uf.toLowerCase();
  const r=await fetch(BASE+"/"+u+"/"+u+"-c0001-e006257-u.json",{cache:"no-store"});
  if(!r.ok) throw new Error(uf+" HTTP "+r.status);
  const j=await r.json(); if(uf==="BR") console.log("RAW_BR", JSON.stringify(j).slice(0,12000)); return parse(j,uf);
}
module.exports=async(req,res)=>{
  res.setHeader("Cache-Control","no-store");
  try{
    const all=await Promise.all([get("BR"),...UFS.map(get)]);
    res.status(200).json({ok:true,national:all[0],states:all.slice(1),source:"TSE",retrievedAt:new Date().toISOString()});
  }catch(e){
    res.status(502).json({ok:false,error:String(e.message||e)});
  }
};