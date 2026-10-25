const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const sandbox={};
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(__dirname,"../metro-engine.js"),"utf8"),sandbox);
const engine=sandbox.MetroZoneEngine;
const metros=Array.from({length:15},(_,i)=>({ibge:"m"+i,name:"Cidade "+i,uf:["SP","RJ","MG","BA","PR","CE"][i%6],firstRoundValid:2000}));
function fixture(){
 const cache={};
 for(const m of metros)cache[m.ibge]={
  zones:["0001","0002"],rows:{
   "0001":{first:{validVotes:1000,flavioVotes:550,lulaVotes:400,sectionsTotal:5,sectionsCounted:5}},
   "0002":{first:{validVotes:1000,flavioVotes:450,lulaVotes:500,sectionsTotal:5,sectionsCounted:5}}
  },
  firstMunicipal:{validVotes:2000}
 };
 return cache;
}
function second(a,b,{total=5,counted=5}={}){return {validVotes:a+b,flavioVotes:a,lulaVotes:b,sectionsTotal:total,sectionsCounted:counted};}
test("15-city election model abstains before enough fully-counted zonal mass",()=>{
 const cache=fixture();cache.m0.rows["0001"].second=second(700,300,{counted:4});
 let e=engine.project({metros,cache});
 assert.equal(e.ready,false);assert.equal(e.observedZones,0);
 cache.m0.rows["0002"].second=second(700,300);
 e=engine.project({metros,cache});
 assert.equal(e.ready,false);assert.equal(e.observedZones,1);
 cache.m1.rows["0002"].second=second(700,300);
 e=engine.project({metros,cache});
 assert.equal(e.ready,true);assert.equal(e.observedZones,2);
 assert.ok(e.coveragePct>5);
});
test("zone-vote accounting returns exact winner and margin at full completion",()=>{
 const cache=fixture();let fv=0,lv=0;
 for(const m of metros)for(const z of cache[m.ibge].zones){
  const a=z==="0001"?490:530,b=z==="0001"?510:470;
  cache[m.ibge].rows[z].second=second(a,b);fv+=a;lv+=b;
 }
 const r=engine.project({metros,cache});
 assert.equal(r.ready,true);
 assert.equal(r.observedZones,30);
 assert.equal(r.observedCities,15);
 assert.equal(r.coveragePct,100);
 assert.ok(Math.abs(r.flavioPct-100*fv/(fv+lv))<1e-10);
 assert.ok(Math.abs(r.estimatedMargin-(fv-lv))<1e-10);
 assert.equal(r.winner,"Flávio Bolsonaro");
});
test("one missing zone or mismatched official municipality blocks provisional winner",()=>{
 const cache=fixture();
 cache.m0.rows["0001"].second=second(550,450);
 cache.m1.rows["0001"].second=second(550,450);
 cache.m0.rows["0002"].first=null;
 let r=engine.project({metros,cache});assert.equal(r.ready,false);
 assert.match(r.reason,/Faltam zonas/);
 cache.m0.rows["0002"].first={validVotes:1000,flavioVotes:450,lulaVotes:500};
 cache.m0.firstMunicipal.validVotes=1900;
 r=engine.project({metros,cache});
 assert.equal(r.ready,false);assert.match(r.reason,/não coincide/);
});
test("model never makes a nationwide win claim or fabricated win probability",()=>{
 const cache=fixture();
 for(const m of metros){
  cache[m.ibge].rows["0001"].second=second(550,450);
 }
 const r=engine.project({metros,cache});
 assert.ok(r.ready);assert.ok(r.estimatedPairTotal>0);
 assert.equal("nationalWinner" in r,false);
 assert.equal("winChance" in r,false);
});
test("2022 zone winner retrospective is backed by audited scenarios and a close final",()=>{
 const j=JSON.parse(fs.readFileSync(path.join(__dirname,"../data/historical-zone-backtest-2014-2018-2022.json"),"utf8"));
 const r=j.years["2022"];assert.ok(r.truth<50);
 for(const [coverage,expectedWrong] of [[5,63],[10,46],[25,25],[50,2]]){
  const sims=r.scenarios.filter(s=>s.coverage===coverage);
  assert.equal(sims.length,4);
  assert.equal(sims.reduce((s,x)=>s+x.n,0),200);
  assert.equal(sims.reduce((s,x)=>s+x.zoneWrongWinner,0),expectedWrong);
 }
});

test("matched-zone comparator has zero national correction if all zones share the same first-round preference",()=>{
 const cache=fixture();
 for(const city of metros)for(const zone of cache[city.ibge].zones){
  cache[city.ibge].rows[zone].first.flavioVotes=500;
  cache[city.ibge].rows[zone].first.lulaVotes=500;
  cache[city.ibge].rows[zone].second=second(560,440);
 }
 const r=engine.contrast({metros,cache,nationalPct:52,nationalReferenceValid:100000});
 assert.equal(r.ready,true);
 assert.ok(Math.abs(r.deltaNationalPp)<1e-10);
 assert.ok(Math.abs(r.adjustedPct-r.nationalPct)<1e-10);
});
test("zonal lift is weighted by metros' actual first-round weight, not extrapolated to all Brazil",()=>{
 const cache=fixture();
 for(const city of metros){
  const z1=cache[city.ibge].rows["0001"],z2=cache[city.ibge].rows["0002"];
  z1.first.flavioVotes=800;z1.first.lulaVotes=200;
  z2.first.flavioVotes=200;z2.first.lulaVotes=800;
  // Zonas where candidate is weaker arrive later, creating a geographic correction.
  z1.second=second(700,300);
 }
 const r=engine.contrast({metros,cache,nationalPct:51,nationalReferenceValid:100000});
 assert.equal(r.ready,true);
 assert.equal(r.weight,.3);
 assert.ok(Math.abs(r.adjustedPct-r.nationalPct-r.weight*(r.metroZonePct-r.metroMunicipalPct))<1e-10);
 assert.ok(Math.abs(r.adjustedPct-r.nationalPct)<=30);
});
test("no adjustment is offered without national forecast or valid nationwide electoral denominator",()=>{
 const cache=fixture();for(const city of metros)cache[city.ibge].rows["0001"].second=second(500,500);
 for(const input of [
  {metros,cache,nationalReferenceValid:100000},
  {metros,cache,nationalPct:51,nationalReferenceValid:10000}
 ]){
  const r=engine.contrast(input);
  assert.equal(r.ready,false);
 }
});
test("retrospective scoring is strictly limited to eligible pre-final, immutable snapshots",()=>{
 const frozen=[
  Object.freeze({at:"t1",sec:10,baseline:53,zonal:51,model:"shadow-zone-1"}),
  Object.freeze({at:"t2",sec:20,baseline:51,zonal:50.2,model:"shadow-zone-1"}),
  Object.freeze({at:"t3",sec:100,baseline:50,zonal:50,model:"shadow-zone-1"})
 ];
 const result=engine.evaluate(frozen,50.1);
 assert.equal(result.ready,true);
 assert.equal(result.n,2);
 assert.ok(result.zonalMae<result.baselineMae);
 assert.equal(result.improved,2);
 assert.equal(result.zonalWinnerHits,2);
 assert.equal(result.baselineWinnerHits,2);
 assert.deepEqual(frozen.map(x=>x.baseline),[53,51,50]);
});
test("final-result error cannot be claimed before actual final official share exists",()=>{
 const inputs=[null,undefined,NaN,Number.POSITIVE_INFINITY,-1,101];
 for(const v of inputs)assert.equal(engine.evaluate([],v).ready,false);
});

test("shadow starts on 5 verified cities in 4 UFs but weights only those five",()=>{
 const cache=fixture();
 for(let i=5;i<15;i++)delete cache[metros[i].ibge];
 for(let i=0;i<5;i++)for(const z of cache[metros[i].ibge].zones)
  cache[metros[i].ibge].rows[z].second=second(530,470);
 const r=engine.contrast({metros,cache,nationalPct:51,nationalReferenceValid:100000});
 assert.equal(r.ready,true);assert.equal(r.eligibleCities,5);assert.equal(r.eligibleUFs,5);
 assert.equal(r.weight,.10);assert.equal(r.observedCities,5);
 assert.equal(r.observedUFs,5);
});
test("shadow abstains from extrapolating one city's zonal preference to the country",()=>{
 const cache=fixture();
 for(let i=0;i<15;i++)cache[metros[i].ibge].rows["0001"].second=null;
 cache[metros[0].ibge].rows["0001"].second=second(800,200);
 const r=engine.contrast({metros,cache,nationalPct:51,nationalReferenceValid:100000});
 assert.equal(r.ready,false);assert.match(r.reason,/3 cidades|5% da referência/);
});
