// Read-only proxy for TSE observatory archive. Secret remains server-side.
const MODES={status:"status",latest:"latest",national_history:"national_history"};
module.exports=async(req,res)=>{
 res.setHeader("Content-Type","application/json; charset=utf-8");
 res.setHeader("Cache-Control","public, s-maxage=15, stale-while-revalidate=30");
 if(req.method!=="GET")return res.status(405).json({ok:false,error:"Only GET is supported."});
 const base=process.env.ELECTION_STORE_URL;
 const token=process.env.ELECTION_STORE_TOKEN;
 if(!base||!token)return res.status(503).json({ok:false,configured:false,error:"Central archive is not configured."});
 const mode=String(req.query?.mode||"status");
 if(!Object.hasOwn(MODES,mode))return res.status(400).json({ok:false,error:"Invalid archive mode."});
 const params=new URLSearchParams({action:MODES[mode]});
 if(mode==="latest"){
  const scope=String(req.query?.scope||"MUN");
  if(!["MUN","UF","BR"].includes(scope))return res.status(400).json({ok:false,error:"Invalid scope."});
  const offset=Number(req.query?.offset||0);
  const limit=Number(req.query?.limit||700);
  if(!Number.isInteger(offset)||offset<0||offset>6000||!Number.isInteger(limit)||limit<1||limit>1000)return res.status(400).json({ok:false,error:"Invalid pagination."});
  params.set("scope",scope);
  params.set("offset",String(offset));
  params.set("limit",String(limit));
 }
 const ctrl=new AbortController();
 const timeout=setTimeout(()=>ctrl.abort(),15000);
 try{
  const r=await fetch(base+"?"+params.toString(),{signal:ctrl.signal,headers:{Authorization:"Bearer "+token,Accept:"application/json"}});
  const data=await r.json();
  if(!r.ok||!data.ok)throw new Error(data.error||("Store HTTP "+r.status));
  return res.status(200).json(data);
 }catch(e){
  console.error("Election archive read error:",String(e.message||e));
  return res.status(502).json({ok:false,error:"Central archive temporarily unavailable."});
 }finally{clearTimeout(timeout)}
};