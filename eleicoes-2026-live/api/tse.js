const UFS=["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"];
const BASE="https://resultados.tse.jus.br/oficial/ele2026/6257/dados";
function num(v){if(v===null||v===undefined)return 0;return Number(String(v).replace(/\./g,"").replace(",","."))||0}
function parseCandidate(j,name){
  const all=[];
  for(const cg of (j.carg||[]))for(const ag of (cg.agr||[]))for(const pa of (ag.par||[]))for(const cd of (pa.cand||[]))all.push(cd);
  const c=all.find(x=>String(x.nm||"").toUpperCase()===name)||{};
  const vv=num(j?.v?.vv); const votes=num(c.vap);
  return {votes,share:vv?votes/vv*100:num(c.pvap)}
}
function parse(j,uf){
  const f=parseCandidate(j,"FLAVIO BOLSONARO"),l=parseCandidate(j,"LULA");
  const ts=num(j?.s?.ts),st=num(j?.s?.st);
  return {uf,validVotes:num(j?.v?.vv),flavioVotes:f.votes,flavioShare:f.share,lulaVotes:l.votes,lulaShare:l.share,sectionsPct:ts?st/ts*100:0,generatedAt:[j.dg,j.hg].filter(Boolean).join(" ")};
}
async function get(uf){
  const u=uf.toLowerCase(),url=`${BASE}/${u}/${u}-c0001-e006257-u.json`;
  const r=await fetch(url,{headers:{"accept":"application/json","user-agent":"apuracao-2026-live/1.0"},cache:"no-store"});
  if(!r.ok)throw new Error(`${uf}: TSE HTTP ${r.status}`);
  return parse(await r.json(),uf);
}
module.exports=async(req,res)=>{
  res.setHeader("Cache-Control","no-store, max-age=0");
  res.setHeader("Access-Control-Allow-Origin","*");
  try{
    const [national,...states]=await Promise.all([get("BR"),...UFS.map(get)]);
    res.status(200).json({ok:true,national,states,source:"TSE",retrievedAt:new Date().toISOString()});
  }catch(e){res.status(502).json({ok:false,error:e.message})}
};