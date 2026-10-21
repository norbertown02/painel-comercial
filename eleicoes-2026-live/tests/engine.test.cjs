const test=require("node:test");
const assert=require("node:assert/strict");
const path=require("node:path");
const fs=require("node:fs");
require("../engine.js");
const engine=globalThis.ElectionEngine;
const load=file=>JSON.parse(fs.readFileSync(path.join(__dirname,"../data",file),"utf8"));
test("does not issue a forecast without second-round votes",()=>{
 const r=engine.estimate({cities:[{id:"A",uf:"SP",validFirst:100,aFirst:60,bFirst:40}],observed:{}});
 assert.equal(r.ready,false);
 assert.equal(r.pct,null);
});
test("official completed national tally overrides an incomplete municipal sample",()=>{
 const r=engine.estimate({cities:[{id:"A",uf:"SP",validFirst:100,aFirst:60,bFirst:40}],observed:{},
  national:{sectionsPct:100,validVotes:105,flavioShare:51.23}});
 assert.equal(r.ready,true);assert.equal(r.pct,51.23);assert.equal(r.reason,"complete");
});
test("2022 historical replay uses only the first round and each partial snapshot",()=>{
 const r=load("reference.json"),h=load("replay2022.json");
 const cities=Object.entries(r.cities).map(([id,x])=>({id,uf:x[0],validFirst:x[3],aFirst:x[4],bFirst:x[5]}));
 const target=100*h.finalDomestic.bolsonaro/(h.finalDomestic.bolsonaro+h.finalDomestic.lula);
 for(const stage of h.stages){
  const sample=Object.fromEntries(Object.entries(stage.data).map(([id,x])=>[id,{a:x[0],b:x[1],frac:x[2]}]));
  const result=engine.estimate({cities,observed:sample,minCities:1,minUfs:1});
  assert.equal(result.ready,true);
  assert.ok(Number.isFinite(result.pct));
  assert.ok(Math.abs(result.pct-target)<1,"historical error was unexpectedly large: "+stage.key);
  assert.ok(result.diagnostics.geographicBiasIndex>=0&&result.diagnostics.geographicBiasIndex<=1);
 }
});
test("does not drop the weight of an unreported state",()=>{
 const cities=[{id:"A",uf:"SP",validFirst:200,aFirst:110,bFirst:90},{id:"B",uf:"BA",validFirst:600,aFirst:160,bFirst:440}];
 const r=engine.estimate({cities,observed:{A:{a:44,b:36,frac:.4}},minCities:1,minUfs:1});
 assert.ok(r.ready);assert.ok(Number.isFinite(r.pct));assert.ok(r.pct<55);
 assert.equal(r.diagnostics.totalStates,2);
});
test("validation manifest contains each historical test class",()=>{
 const m=load("model-validation.json");
 for(const key of ["2014/balanced","2014/regional_bias","2018/balanced","2018/regional_bias"]) {
  assert.equal(m.scenarios[key].repetitions,100);
  assert.ok(m.scenarios[key].combinedMae<2);
 }
 assert.equal(m.historical2022.length,4);
});