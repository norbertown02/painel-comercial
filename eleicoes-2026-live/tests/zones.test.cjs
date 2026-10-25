const test=require("node:test");
const assert=require("node:assert/strict");
const path=require("node:path");
const handler=require("../api/zones.js");
const cities=require("../data/metros-2026.json").cities;
function res(){
 const r={code:200,headers:{},body:null};r.setHeader=(k,v)=>{r.headers[k]=v;return r};
 r.status=(n)=>{r.code=n;return r};r.json=x=>{r.body=x;return r};return r;
}
function candidate(number,votes){return {n:String(number),vap:String(votes)}}
function zoneDoc(ele,zone,{a,b,valid=200,sections=4,counted=4}){
 return {ele:String(ele),tpabr:"zona",cdabr:zone,
  v:{vv:String(valid)},s:{ts:String(sections),st:String(counted)},
  carg:[{cd:"1",agr:[{par:[{cand:[candidate(22,a),candidate(13,b)]}]}]}]};
}
async function withMock(mock,fn){
 const old=global.fetch;
 global.fetch=async url=>mock(String(url));
 try{return await fn();}finally{global.fetch=old;}
}
test("eligible locality registry has exactly 15 IBGE-mapped million population places",()=>{
 assert.equal(cities.length,15);
 assert.equal(new Set(cities.map(c=>c.ibge)).size,15);
 assert.ok(cities.every(c=>c.pop>1000000&&/^\d{5}$/.test(c.tse)&&/^\d{7}$/.test(c.ibge)));
 assert.ok(cities.some(c=>c.name==="Belém"&&c.uf==="PA"&&c.ibge==="1501402"));
});
test("API refuses out-of-scope locality before any external fetch",async()=>{
 await withMock(()=>{throw Error("should not fetch")},async()=>{
  const r=res();await handler({query:{city:"3509503",mode:"list"}},r);
  assert.equal(r.code,400);assert.equal(r.body.ok,false);
 });
});
test("official EA12 config validates municipality code and returns zone IDs",async()=>{
 const fake=()=>({ok:true,json:async()=>({abr:[{cd:"sp",mu:[
  {cd:"71072",cdi:"3550308",nm:"SÃO PAULO",z:["1","0002","2"]}
 ]}]})});
 await withMock(fake,async()=>{
  const r=res();await handler({query:{city:"3550308",mode:"list"}},r);
  assert.equal(r.code,200);assert.deepEqual(r.body.zones,["0001","0002"]);
  assert.equal(r.body.city.tse,"71072");
 });
});
test("batch separates first and second turn official EA20 counts",async()=>{
 const urls=[];
 const mock=url=>{urls.push(url);
  const first=url.includes("/6257/"),ele=first?6257:6258;
  return {ok:true,json:async()=>zoneDoc(ele,"0001",first?{a:75,b:65,valid:180}:{a:92,b:88,valid:180,counted:3})};
 };
 await withMock(mock,async()=>{
  const r=res();await handler({query:{city:"3550308",mode:"batch",zones:"0001"}},r);
  assert.equal(r.code,200);assert.equal(r.body.results.length,1);
  assert.equal(r.body.results[0].first.flavioVotes,75);
  assert.equal(r.body.results[0].second.flavioVotes,92);
  assert.equal(r.body.results[0].second.sectionsCounted,3);
  assert.ok(urls.some(u=>u.includes("sp71072-z0001-c0001-e006257-u.json")));
  assert.ok(urls.some(u=>u.includes("sp71072-z0001-c0001-e006258-u.json")));
 });
});
test("an unavailable second turn never becomes fabricated zero votes",async()=>{
 const mock=url=>url.includes("/6258/")?{ok:false,status:404}:
 {ok:true,json:async()=>zoneDoc(6257,"0001",{a:70,b:60})};
 await withMock(mock,async()=>{
  const r=res();await handler({query:{city:"3550308",mode:"batch",zones:"0001"}},r);
  assert.equal(r.code,200);
  assert.ok(r.body.results[0].first);
  assert.equal(r.body.results[0].second,null);
  assert.equal(r.body.results[0].secondError,"TSE HTTP 404");
 });
});


test("first-round zone returns ALL candidates and auditable turnout/abstention",async()=>{
 const mock=url=>{
  const first=url.includes("/6257/");
  const all=first?[candidate(13,90),candidate(22,75),candidate(14,20),candidate(55,15)]:
   [candidate(13,90),candidate(22,100)];
  return {ok:true,json:async()=>({
   ele:first?"6257":"6258",tpabr:"zona",cdabr:"0001",
   s:{ts:"5",st:first?"5":"3"},v:{vv:first?"200":"190",vb:"5",tvn:"6"},
   e:{te:"300",esi:first?"300":"260",c:first?"220":"200",a:first?"80":"60"},
   carg:[{cd:"1",agr:[{par:[{cand:all}]}]}]
  })};
 };
 await withMock(mock,async()=>{
  const r=res();await handler({query:{city:"3550308",mode:"batch",zones:"0001"}},r);
  assert.equal(r.code,200);
  const {first,second}=r.body.results[0];
  assert.equal(first.candidates.length,4);
  assert.deepEqual(first.candidates.map(x=>x.number),["13","22","14","55"]);
  assert.equal(first.candidates.reduce((n,x)=>n+x.votes,0),200);
  assert.equal(first.candidatesTotal,200);
  assert.equal(first.registeredVoters,300);
  assert.equal(first.turnoutVotes,220);
  assert.equal(first.abstentionVotes,80);
  assert.ok(Math.abs(first.turnoutPct-73.33333333333333)<1e-9);
  assert.equal(second.candidates.length,0);
  assert.ok(Math.abs(second.turnoutPct-200/260*100)<1e-9);
  assert.equal(second.fullyCounted,false);
 });
});
test("inconsistent candidate totals are rejected instead of creating invented transfers",async()=>{
 const mock=url=>({ok:true,json:async()=>({
  ele:url.includes("/6257/")?"6257":"6258",tpabr:"zona",cdabr:"0001",
  s:{ts:"2",st:"2"},v:{vv:"100"},
  carg:[{cd:"1",agr:[{par:[{cand:[candidate(22,88),candidate(13,55)]}]}]}]
 })});
 await withMock(mock,async()=>{
  const r=res();await handler({query:{city:"3550308",mode:"batch",zones:"0001"}},r);
  assert.equal(r.code,200);
  assert.equal(r.body.results[0].first,null);
  assert.equal(r.body.results[0].second,null);
  assert.match(r.body.results[0].firstError,/Totalização não disponível/);
 });
});
