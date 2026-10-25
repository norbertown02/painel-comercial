(function(root){
"use strict";
function clamp(x,min,max){return Math.max(min,Math.min(max,x))}
function project({metros=[],cache={},minCoveragePct=5,referenceMode="zone"}={}){
 if(!["zone","municipal"].includes(referenceMode))throw Error("Unknown reference mode");
 const progress={ready:false,reason:"Aguardando referências oficiais por zona das 15 localidades.",knownCities:0,totalCities:metros.length,observedCities:0,
  knownZones:0,totalZones:0,observedZones:0,coveragePct:0,winner:null,flavioPct:null,lulaPct:null,estimatedMargin:null};
 if(!Array.isArray(metros)||metros.length!==15)return {...progress,reason:"A referência das 15 localidades não está completa."};
 const zones=[],byCity=new Map(),observed=[];
 for(const city of metros){
  const state=cache[city.ibge],keys=state?.zones;
  if(!Array.isArray(keys)||!keys.length||new Set(keys).size!==keys.length){
   return {...progress,reason:"Ainda carregando o cadastro das zonas de "+city.name+".",knownCities:progress.knownCities};}
  progress.totalZones+=keys.length;
  const current=[];
  let sum=0;
  for(const id of keys){
   const v=state.rows?.[id],first=v?.first;
   if(!first||!(first.validVotes>0)||!(first.flavioVotes>=0)||!(first.lulaVotes>=0)||
    first.flavioVotes+first.lulaVotes<=0||first.flavioVotes+first.lulaVotes>first.validVotes)continue;
   const f={city:city.ibge,zone:id,first,second:v.second};
   zones.push(f);current.push(f);sum+=first.validVotes;
   progress.knownZones++;
  }
  if(current.length!==keys.length)
   return {...progress,reason:"Faltam zonas do primeiro turno de "+city.name+" ("+current.length+"/"+keys.length+")."};
  const target=Number(state.firstMunicipal?.validVotes)||Number(city.firstRoundValid);
  if(!Number.isFinite(target)||sum!==target)
   return {...progress,reason:"A soma das zonas de "+city.name+" não coincide com o total municipal do TSE."};
  progress.knownCities++;
  byCity.set(city.ibge,current);
 }
 const cityPriors=new Map([...byCity].map(([key,items])=>{
  const a=items.reduce((sum,z)=>sum+z.first.flavioVotes,0),b=items.reduce((sum,z)=>sum+z.first.lulaVotes,0);
  return [key,a/(a+b)];
 }));
 const prior=z=>referenceMode==="municipal"?cityPriors.get(z.city):
  z.first.flavioVotes/(z.first.flavioVotes+z.first.lulaVotes);
 let mass=0,received=0,observedA=0;
 for(const z of zones){
  mass+=z.first.validVotes;
  const s=z.second;
  if(!s||s.sectionsTotal<=0||s.sectionsCounted!==s.sectionsTotal||
   !(s.validVotes>0)||s.flavioVotes<0||s.lulaVotes<0||s.flavioVotes+s.lulaVotes<=0||
   s.flavioVotes+s.lulaVotes>s.validVotes)continue;
  observed.push(z);received+=s.flavioVotes+s.lulaVotes;
  observedA+=s.flavioVotes;progress.observedZones++;
 }
 progress.observedCities=new Set(observed.map(z=>z.city)).size;
 const countedMass=observed.reduce((a,z)=>a+z.first.validVotes,0);
 progress.coveragePct=mass>0?100*countedMass/mass:0;
 if(progress.coveragePct+1e-10<minCoveragePct)return {...progress,reason:"Aguardando "+minCoveragePct+"% da referência de votos em zonas totalmente apuradas."};
 if(!(received>0)||!(countedMass>0))return {...progress,reason:"Aguardando votos oficiais em zonas completas."};
 const ratio=clamp(received/countedMass,.6,1.4);
 const shift=observed.reduce((sum,z)=>{
  const n=z.second.flavioVotes+z.second.lulaVotes;
  return sum+z.second.flavioVotes-n*prior(z);
 },0)/received;
 const cityShifts=new Map();
 for(const [city,cityZones] of byCity){
  const selected=cityZones.filter(z=>observed.includes(z)),n=selected.reduce((a,z)=>a+z.second.flavioVotes+z.second.lulaVotes,0);
  const delta=n>0?selected.reduce((acc,z)=>{
   const nz=z.second.flavioVotes+z.second.lulaVotes;
   return acc+z.second.flavioVotes-nz*prior(z);
  },0)/n:shift;
  const weight=n/(n+20000);
  cityShifts.set(city,weight*delta+(1-weight)*shift);
 }
 const obsKeys=new Set(observed.map(z=>z.city+":"+z.zone));
 let totalA=0,totalN=0;
 for(const z of zones){
  const s=z.second,full=obsKeys.has(z.city+":"+z.zone);
  const n=full?s.flavioVotes+s.lulaVotes:z.first.validVotes*ratio;
  const a=full?s.flavioVotes:n*clamp(prior(z)+cityShifts.get(z.city),.001,.999);
  totalA+=a;totalN+=n;
 }
 if(!(totalN>0))return {...progress,reason:"Total projetado indisponível."};
 const flavioPct=100*totalA/totalN;
 const margin=2*totalA-totalN;
 return {...progress,ready:true,reason:"Cenário territorial exploratório; não representa previsão do resultado nacional.",
  flavioPct,lulaPct:100-flavioPct,referenceMode,winner:flavioPct===50?"Empate técnico":flavioPct>50?"Flávio Bolsonaro":"Lula",
  projectedFlavioVotes:totalA,projectedLulaVotes:totalN-totalA,
  estimatedMargin:margin,estimatedPairTotal:totalN,receivedVotes:received,
  ratioRemaining:ratio,globalShiftPp:100*shift,referenceVotes:mass,observedReferenceVotes:countedMass};
}
/**
 * Shadow-only national correction. The municipal and zone projections consume
 * identical observed official zones and remaining-vote assumptions.
 * The difference isolates the extra value of using a finer spatial prior.
 */
function contrast({metros=[],cache={},nationalPct=null,nationalReferenceValid=null,minCoveragePct=5}={}){
 const zone=project({metros,cache,minCoveragePct,referenceMode:"zone"});
 const municipal=project({metros,cache,minCoveragePct,referenceMode:"municipal"});
 if(!zone.ready||!municipal.ready)return {ready:false,reason:zone.reason||municipal.reason,zone,municipal};
 const mass=metros.reduce((s,m)=>s+Number(cache[m.ibge]?.firstMunicipal?.validVotes||m.firstRoundValid||0),0);
 const denominator=Number(nationalReferenceValid);
 if(!(denominator>mass&&mass>0)||!Number.isFinite(Number(nationalPct))||nationalPct==null)
  return {ready:false,reason:"Aguardando projeção nacional válida e pesos de voto do primeiro turno.",zone,municipal};
 const weight=mass/denominator;
 const deltaMetroPp=zone.flavioPct-municipal.flavioPct;
 const deltaNationalPp=weight*deltaMetroPp;
 const adjustedPct=Number(nationalPct)+deltaNationalPp;
 if(!Number.isFinite(adjustedPct)||adjustedPct<0||adjustedPct>100)
  return {ready:false,reason:"Ajuste nacional fora do intervalo válido.",zone,municipal};
 return {ready:true,version:"shadow-zone-1",nationalPct:Number(nationalPct),adjustedPct,
  deltaMetroPp,deltaNationalPp,weight,metroZonePct:zone.flavioPct,
  metroMunicipalPct:municipal.flavioPct,zoneCoveragePct:zone.coveragePct,
  observedCities:zone.observedCities,observedZones:zone.observedZones,
  totalZones:zone.totalZones,reason:"Ajuste zonal experimental paralelo; não é validação de acurácia."};
}
function evaluate(records,officialFinalPct,{minSecs=0,maxSecs=99.995}={}){
 const final=Number(officialFinalPct);
 if(officialFinalPct==null||!Number.isFinite(final)||final<0||final>100)return {ready:false,reason:"Sem resultado final oficial."};
 const rows=(records||[]).filter(r=>Number.isFinite(r?.baseline)&&Number.isFinite(r?.zonal)&&
  Number.isFinite(r?.sec)&&r.sec>=minSecs&&r.sec<maxSecs);
 if(!rows.length)return {ready:false,reason:"Sem fotografias elegíveis anteriores ao fechamento."};
 const scores=rows.map(r=>({at:r.at,sec:r.sec,baselineError:Math.abs(r.baseline-final),
  zonalError:Math.abs(r.zonal-final),improved:Math.abs(r.zonal-final)<Math.abs(r.baseline-final)-1e-9,
  worsened:Math.abs(r.zonal-final)>Math.abs(r.baseline-final)+1e-9,
  baselineWinner:r.baseline>50,zonalWinner:r.zonal>50,officialWinner:final>50}));
 const average=k=>scores.reduce((s,r)=>s+r[k],0)/scores.length;
 return {ready:true,n:scores.length,baselineMae:average("baselineError"),zonalMae:average("zonalError"),
  improvementPp:average("baselineError")-average("zonalError"),
  improved:scores.filter(x=>x.improved).length,worsened:scores.filter(x=>x.worsened).length,
  tied:scores.filter(x=>!x.improved&&!x.worsened).length,
  baselineWinnerHits:scores.filter(x=>x.baselineWinner===x.officialWinner).length,
  zonalWinnerHits:scores.filter(x=>x.zonalWinner===x.officialWinner).length,scores};
}
root.MetroZoneEngine={version:"1.1.0",project,contrast,evaluate};
})(typeof window!=="undefined"?window:globalThis);
