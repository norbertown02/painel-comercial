(function(root){
"use strict";
// ElectionEngine v1: pre-election municipal reference, two independent transfer estimators,
// state-stratified blend, audit diagnostics and optional state-level convergence anchor.
// No 2nd-round final results or subsequent snapshots are used for fitting.
const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
const valid=x=>Number.isFinite(+x)?+x:0;
const rawObs=(s)=>({
 a:valid(s?.a??s?.flavioVotes), b:valid(s?.b??s?.lulaVotes),
 frac:clamp(valid(s?.frac??(s?.sectionsPct!=null?s.sectionsPct/100:0)),0,1)
});
function estimate({cities,observed={},states=[],national=null,minCities=40,minUfs=12}){
 if(!Array.isArray(cities)||!cities.length)throw Error("Missing baseline");
 const base=[],byUF=Object.create(null),byCode=new Map();
 let firstTotal=0;
 for(const row of cities){
  const id=String(row.id??row.code??""),uf=String(row.uf??"");
  const v=valid(row.validFirst??row.v??row.valid26);
  const a=valid(row.aFirst??row.firstA??row.flavio26);
  const b=valid(row.bFirst??row.firstB??row.lula26);
  if(!id||!uf||v<=0||a+b<=0)continue;
  const q=a/(a+b);
  const c={id,uf,v,q};
  base.push(c);byCode.set(id,c);
  const st=byUF[uf]||(byUF[uf]={mass:0,sumQ:0,obsN:0,obsA:0,obsB:0,weightedShift:0,evidence:0,seen:0});
  st.mass+=v;st.sumQ+=v*q;firstTotal+=v;
 }
 const map=new Map();
 let globalNum=0,globalDen=0,observedA=0,observedN=0,observedCities=0;
 const entries=observed instanceof Map?observed.entries():Object.entries(observed);
 for(const [key,obj] of entries){
  const c=byCode.get(String(key));if(!c)continue;
  const s=rawObs(obj);const n=s.a+s.b;
  if(n<=0)continue;
  const evidence=n*clamp(2*s.frac,.1,1),d=s.a/n-c.q;
  map.set(c.id,s);
  const u=byUF[c.uf];u.obsN+=n;u.obsA+=s.a;u.obsB+=s.b;u.weightedShift+=evidence*d;u.evidence+=evidence;u.seen++;
  globalNum+=evidence*d;globalDen+=evidence;observedA+=s.a;observedN+=n;observedCities++;
 }
 if(!observedN){
  const officialCompleted=valid(national?.sectionsPct)>=99.995&&valid(national?.validVotes)>0;
  if(officialCompleted){
   const final=valid(national.flavioShare);
   return {ready:true,pct:final,reason:"complete",models:{national:null,stratified:null,hybrid:null,stateAnchor:final},
    diagnostics:{observedCities:0,observedStates:0,scenario:{min:final,max:final},hasConflict:false,geographicBiasIndex:0}};
  }
  return {ready:false,pct:null,reason:"no_official_municipal_votes",diagnostics:{observedCities:0,observedStates:0},models:{}};
 }
 const global=globalDen>0?globalNum/globalDen:0;
 let stratNum=0,stratDen=0,tv=0,ufCount=0;
 for(const u of Object.values(byUF)){
  if(u.evidence>0){stratNum+=u.mass*(u.weightedShift/u.evidence);stratDen+=u.mass;ufCount++;}
  tv+=Math.abs(u.obsN/observedN-u.mass/firstTotal);
 }
 const strat=stratDen>0?stratNum/stratDen:global;
 const geographicBias=tv/2;
 const alpha=clamp((geographicBias-.1)/.38,.1,.85);
 const hybrid=global*(1-alpha)+strat*alpha;
 const forecastUf=Object.create(null);
 let aggGlobal=0,aggStrat=0,aggHybrid=0,forecastTotal=0;
 for(const c of base){
  const sample=map.get(c.id),n=sample?sample.a+sample.b:0,remain=Math.max(0,c.v-n);
  const cityD=sample?sample.a/n-c.q:0;
  const cityPart=sample&&sample.frac<.9?sample.frac:0;
  const votes=s=>((sample?.a||0)+remain*clamp(c.q+s*(1-cityPart)+cityD*cityPart,.001,.999));
  const va=votes(global),vs=votes(strat),vh=votes(hybrid),denom=n+remain;
  aggGlobal+=va;aggStrat+=vs;aggHybrid+=vh;forecastTotal+=denom;
  const uf=forecastUf[c.uf]||(forecastUf[c.uf]={a:0,v:0});
  uf.a+=vh;uf.v+=denom;
 }
 const component={
  national:100*aggGlobal/forecastTotal,
  stratified:100*aggStrat/forecastTotal,
  hybrid:100*aggHybrid/forecastTotal
 };
 const stateData=new Map();
 for(const s of states||[]){
  const key=String(s.uf??s.geo??"").replace(/^UF:/,"").toUpperCase();
  const n=valid(s.validVotes??s.valid_votes),a=valid(s.flavioVotes??s.flavio_votes);
  const frac=s.sectionsPct!=null?valid(s.sectionsPct)/100:
      (valid(s.sectionsTotal)>0?valid(s.sectionsCounted)/valid(s.sectionsTotal):0);
  if(key&&byUF[key]&&n>0&&a<=n)stateData.set(key,{p:a/n,n,frac:clamp(frac)});
 }
 let stateWeight=0,weightedState=0,anchoredNum=0,anchorDen=0,anchorCoverage=0;
 for(const [uf,st] of Object.entries(byUF)){
  const forecast=forecastUf[uf]||{v:st.mass,a:st.mass*st.sumQ/st.mass};
  const e=stateData.get(uf);
  const pModel=forecast.v>0?forecast.a/forecast.v:st.sumQ/st.mass;
  const eWeight=e?Math.pow(clamp((e.frac-.2)/.8),2):0;
  const pAnchor=e?pModel*(1-eWeight)+e.p*eWeight:pModel;
  anchoredNum+=pAnchor*st.mass;anchorDen+=st.mass;
  if(e){stateWeight+=st.mass;weightedState+=e.p*st.mass;anchorCoverage+=eWeight*st.mass;}
 }
 component.stateAnchor=100*anchoredNum/anchorDen;
 // National figure is authoritative on completion, and never a substitute for an early forecast.
 const finish=valid(national?.sectionsPct)>=99.995&&valid(national?.validVotes)>0;
 const available=observedCities>=minCities&&ufCount>=minUfs;
 const combined=finish?valid(national.flavioShare):component.stateAnchor;
 const scenarioValues=[component.national,component.stratified,component.stateAnchor].filter(Number.isFinite);
 const scenario={min:Math.min(...scenarioValues),max:Math.max(...scenarioValues)};
 const hasConflict=scenario.min<=50&&scenario.max>=50;
 return {
  ready:available||finish,
  reason:finish?"complete":available?"ready":"insufficient_geographic_coverage",
  pct:available||finish?combined:null,
  models:component,
  diagnostics:{
   observedCities,observedStates:ufCount,totalStates:Object.keys(byUF).length,
   observedValid:observedN,estimatedFirstRoundValid:firstTotal,
   sampleCoveragePct:100*observedN/firstTotal,
   geographicBiasIndex:geographicBias,
   stratifiedWeight:alpha,
   globalTransferPp:100*global,
   stratifiedTransferPp:100*strat,
   stateAnchorWeight:anchorCoverage/firstTotal,
   stateCoverage:stateWeight/firstTotal,
   scenario,
   hasConflict,
   label:hasConflict?"Modelos discordam sobre o vencedor":"Modelos concordam sobre o lado de 50%",
   note:"Faixa de dispersão entre modelos; NÃO é intervalo de confiança calibrado."
  }
 };
}

/* Conditional paths use official national votes and a domestic 1T total-vote scale.
   Probability is illustrative; three elections cannot validate a 99% tail claim. */
const normalCDF=z=>{
 const x=Math.abs(z),t=1/(1+.2316419*x);
 const tail=Math.exp(-x*x/2)/Math.sqrt(2*Math.PI)*t*
  (.319381530+t*(-.356563782+t*(1.781477937+t*(-1.821255978+t*1.330274429))));
 return z>=0?1-tail:tail;
};
function victoryOutlook({forecast,national,validation}={}){
 const blank={ready:false,probability:null,sigmaPct:null,estimatedTotal:null,projectedMargin:null,
  thresholds:{one:null,threeHundredThousand:null,ninetyNine:null},
  note:"Aguardando votos e projeção territorial suficientes."};
 const v=valid(national?.validVotes),a=valid(national?.flavioVotes),b=valid(national?.lulaVotes);
 const sections=valid(national?.sectionsPct),point=forecast?.pct;
 if(v<=0||a+b<=0||!Number.isFinite(point)||sections<=0)return blank;
 const complete=sections>=99.995;
 const old=valid(forecast?.diagnostics?.estimatedFirstRoundValid);
 const total=complete?v:Math.max(v,old);
 if(total<=0)return blank;
 const remaining=Math.max(0,total-v);
 const futureShare=remaining>0?(total*point/100-a)/remaining:null;
 const margin=complete?a-b:total*(2*point/100-1);
 const result={...blank,estimatedTotal:total,projectedMargin:margin,
  remainingShare:futureShare,coverageVotesPct:100*v/total};
 if(complete){
  return {...result,ready:true,probability:a>b?100:a<b?0:50,sigmaPct:0,
   note:"Resultado oficial concluído; margem real em votos."};
 }
 if(remaining<=0||!Number.isFinite(futureShare)||futureShare<0||futureShare>1){
  return {...result,note:"Projeção incompatível com os votos oficiais; cenários suspensos."};
 }
 // Minimum integer votes to win; margin of one vote depends on parity of total.
 const atSnapshot=neededA=>100*(neededA-remaining*futureShare)/v;
 result.thresholds.one=atSnapshot(Math.floor(total/2)+1);
 result.thresholds.threeHundredThousand=atSnapshot(Math.max(Math.floor(total/2)+1,Math.ceil((total+300000)/2)));
 result.ready=true;
 result.note="Linhas condicionais à distribuição prevista dos votos restantes.";
 const errors=Object.values(validation?.scenarios||{})
  .filter(s=>s&&s.repetitions>=50&&Number.isFinite(s.p90CombinedError))
  .map(s=>s.p90CombinedError);
 const d=forecast?.diagnostics||{};
 const historical=errors.length>=4&&Array.isArray(validation?.historical2022)&&validation.historical2022.length>=4;
 if(!historical||sections<10||d.observedStates<23||d.observedCities<100||valid(d.sampleCoveragePct)<5){
  result.note=historical?"Probabilidade aguardando 10% de seções, 100 cidades, 23 UFs e cobertura municipal.":"Probabilidade aguardando relatório histórico.";
  return result;
 }
 const baseSigma=Math.max(...errors)/1.6448536269514722*1.35;
 const coverage=Math.min(.999999,v/total),sc=d.scenario||{};
 const disagree=Number.isFinite(sc.min)&&Number.isFinite(sc.max)?Math.max(0,(sc.max-sc.min)/2):0;
 const sigma=Math.max(.08,baseSigma*Math.sqrt(.1/Math.max(.025,coverage))*Math.pow(Math.max(0,(1-coverage)/.9),.65),disagree);
 result.sigmaPct=sigma;
 result.probability=Math.max(.1,Math.min(99.9,100*normalCDF((point-50)/sigma)));
 result.thresholds.ninetyNine=atSnapshot(total*(.5+2.3263478740408408*sigma/100));
 result.note="Chance indicativa baseada em hipóteses; limiar de 99% não é garantia validada.";
 return result;
}
root.ElectionEngine={version:"1.1.0",estimate,victoryOutlook};
})(typeof window!=="undefined"?window:globalThis);