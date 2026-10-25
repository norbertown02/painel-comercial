const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const j=JSON.parse(fs.readFileSync(path.join(__dirname,"../data/historical-zone-backtest-2014-2018-2022.json"),"utf8"));
const mean=arr=>arr.reduce((s,v)=>s+v,0)/arr.length;
test("official TSE historical zonal report covers 2014, 2018 and 2022",()=>{
  assert.deepEqual(Object.keys(j.years),["2014","2018","2022"]);
  for(const [year,r] of Object.entries(j.years)){
    assert.equal(r.cities,15);
    assert.ok(r.zones>=250 && r.zones<=350);
    assert.equal(r.scenarios.length,16);
    assert.ok(r.scenarios.every(s=>s.n===50));
    assert.ok(r.attendance1>50 && r.attendance1<100);
    assert.ok(r.attendance2>50 && r.attendance2<100);
    assert.ok(Math.abs((r.attendance1-r.attendance2)-r.abstentionDeltaPp)<.002);
    assert.equal(r.MAE_municipal,+mean(r.scenarios.map(s=>s.munMae)).toFixed(4));
    assert.equal(r.MAE_zone,+mean(r.scenarios.map(s=>s.zoneMae)).toFixed(4));
    assert.ok(j.sources.some(s=>s.includes("_"+year+".zip")));
  }
});
test("zonal advantage is measured on identical pseudo-arrival samples, not mislabeled actual timestamps",()=>{
  assert.match(j.methodology,/hypothetical sequential zone reveal/i);
  assert.ok(j.caveats.some(s=>/not.*chronological|chronological.*not/i.test(s)));
  const types=new Set(["balanced","largest_city_first","first_A_strong_zone_first","first_B_strong_zone_first"]);
  for(const [year,r] of Object.entries(j.years)){
    for(const c of [5,10,25,50]){
      const s=r.scenarios.filter(x=>x.coverage===c);
      assert.equal(s.length,4);
      for(const item of s){
        assert.ok(types.has(item.style));
        assert.ok(Number.isFinite(item.munMae) && Number.isFinite(item.zoneMae));
        assert.ok(item.zoneMae>=0 && item.munMae>=0);
      }
    }
  }
});
test("do not use selected-metro retrospective results to claim Brazil-wide certainty",()=>{
  assert.ok(j.caveats.some(c=>c.includes("not Brazil-wide")));
  assert.ok(j.caveats.some(c=>/No inference of individual/.test(c)));
});
