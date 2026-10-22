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

test("victory thresholds preserve the exact 300,000-vote margin",()=>{
 const forecast={pct:51,diagnostics:{estimatedFirstRoundValid:120000000,observedCities:125,
  observedStates:25,sampleCoveragePct:10,scenario:{min:50.7,max:51.2}}};
 const national={validVotes:12000000,flavioVotes:6000000,lulaVotes:6000000,sectionsPct:10};
 const p=engine.victoryOutlook({forecast,national,validation:load("model-validation.json")});
 assert.ok(p.ready);assert.equal(p.estimatedTotal,120000000);
 assert.ok(Math.abs((p.thresholds.threeHundredThousand-p.thresholds.one)-1.25)<.0001);
 assert.ok(Number.isFinite(p.probability)&&p.probability>50&&p.probability<100);
 assert.ok(p.thresholds.ninetyNine>p.thresholds.threeHundredThousand);
});
test("no pre-election win probability or invented trajectory",()=>{
 const p=engine.victoryOutlook({forecast:{pct:51},national:{validVotes:0,sectionsPct:0},
  validation:load("model-validation.json")});
 assert.equal(p.ready,false);assert.equal(p.probability,null);
 assert.equal(p.thresholds.one,null);
});
test("unvalidated model and insufficient geographic coverage never claim odds",()=>{
 const forecast={pct:51,diagnostics:{estimatedFirstRoundValid:120000000,
  observedCities:50,observedStates:12,sampleCoveragePct:10}};
 const nat={validVotes:12000000,flavioVotes:6000000,lulaVotes:6000000,sectionsPct:10};
 const low=engine.victoryOutlook({forecast,national:nat,validation:load("model-validation.json")});
 const missing=engine.victoryOutlook({forecast:{...forecast,diagnostics:{...forecast.diagnostics,observedCities:110,observedStates:25}},
  national:nat});
 assert.ok(low.ready);assert.equal(low.probability,null);
 assert.ok(missing.ready);assert.equal(missing.probability,null);
 assert.equal(missing.thresholds.ninetyNine,null);
});
test("mismatch between forecast and official tally suspends misleading paths",()=>{
 const p=engine.victoryOutlook({
  forecast:{pct:20,diagnostics:{estimatedFirstRoundValid:120000000}},
  national:{validVotes:108000000,flavioVotes:102000000,lulaVotes:6000000,sectionsPct:90}});
 assert.equal(p.ready,false);assert.equal(p.probability,null);
 assert.equal(p.thresholds.one,null);
});
test("complete official count replaces provisional chance by result",()=>{
 const base={pct:49,diagnostics:{estimatedFirstRoundValid:150}};
 const lose=engine.victoryOutlook({forecast:base,national:{validVotes:100,flavioVotes:49,lulaVotes:51,sectionsPct:100}});
 const win=engine.victoryOutlook({forecast:base,national:{validVotes:101,flavioVotes:51,lulaVotes:50,sectionsPct:100}});
 assert.equal(lose.probability,0);assert.equal(lose.projectedMargin,-2);
 assert.equal(win.probability,100);assert.equal(win.projectedMargin,1);
 assert.equal(win.thresholds.ninetyNine,null);
});


test("five-percent 2022 TSE timeline is interpolated from bracketing snapshots",()=>{
 const d=load("early-count-5pct.json"),h=d.history2022;
 assert.equal(d.schema,"early-count-validation-v1");
 assert.equal(h.before5.sectionsPct,4.82);assert.equal(h.after5.sectionsPct,5.61);
 const t=(5-h.before5.sectionsPct)/(h.after5.sectionsPct-h.before5.sectionsPct);
 const interpolated=h.before5.candidateSharePct+t*(h.after5.candidateSharePct-h.before5.candidateSharePct);
 assert.ok(Math.abs(interpolated-h.interpolated5SharePct)<1e-10);
 assert.ok(Math.abs((h.interpolated5SharePct-h.officialFinalSharePct)-h.earlyMinusFinalPp)<1e-10);
 assert.ok(Math.abs(h.conditionalThresholds2026.winBy300000VotesShareAt5-
  h.conditionalThresholds2026.winByAtLeastOneVoteShareAt5-.125)<1e-10);
});
test("synthetic 5pct studies identify sampling and never claim official chronology",()=>{
 const d=load("early-count-5pct.json");
 assert.equal(d.syntheticValidation.length,4);
 for(const row of d.syntheticValidation){
  assert.equal(row.repetitions,300);
  assert.ok(row.coverageMeanPct>=5&&row.coverageMeanPct<6);
  assert.ok(Number.isFinite(row.meanAbsErrorPp)&&row.meanAbsErrorPp>0);
  assert.ok(row.p90AbsErrorPp>=row.meanAbsErrorPp);
 }
 assert.ok(d.rules.syntheticMethodCautions.includes("NOT calibrated probabilities"));
 assert.ok(d.interpretation.validationGaps.some(s=>s.includes("2014")));
});


test("5pct conditional scenario probabilities are monotonic, auditable, and non-calibrated",()=>{
 const d=load("odds-5pct-2026.json");
 assert.equal(d.schema,"conditional-election-odds-5pct-v1");
 assert.equal(d.table.length,16);
 assert.ok(d.epistemicStatus.includes("NOT EMPIRICALLY CALIBRATED"));
 const w=d.calculation.scenarioWeights;
 assert.ok(Math.abs(Object.values(w).reduce((s,x)=>s+x,0)-1)<1e-12);
 assert.equal(d.calculation.independentResidualSdPp,1.5);
 const expected=["balanced","actual2022","moderate","regional"];
 for(let i=0;i<d.table.length;i++){
  const v=d.table[i];assert.equal(v.partialPct,50+i);
  const composite=expected.reduce((sum,key)=>sum+w[key]*v.winPct[key],0);
  assert.ok(Math.abs(composite-v.winPct.composite)<.02);
  assert.ok(v.win300kPct<=v.winPct.composite+.01);
  if(i>0)assert.ok(d.table[i-1].winPct.composite<=v.winPct.composite);
 }
 assert.ok(d.table.find(row=>row.partialPct===57).winPct.composite>70);
 assert.ok(d.table.find(row=>row.partialPct===57).winPct.regional<50);
 assert.ok(d.calculation.simulatedSampleDefinition.includes("rather than sampling actual ballot-box"));
});
