(function(root){
"use strict";
function clamp(x,min,max){return Math.max(min,Math.min(max,x))}
function project({metros=[],cache={},minCoveragePct=5}={}){
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
  const q=z.first.flavioVotes/(z.first.flavioVotes+z.first.lulaVotes);
  return sum+z.second.flavioVotes-n*q;
 },0)/received;
 const cityShifts=new Map();
 for(const [city,cityZones] of byCity){
  const selected=cityZones.filter(z=>observed.includes(z)),n=selected.reduce((a,z)=>a+z.second.flavioVotes+z.second.lulaVotes,0);
  const delta=n>0?selected.reduce((acc,z)=>{
   const nz=z.second.flavioVotes+z.second.lulaVotes;
   return acc+z.second.flavioVotes-nz*z.first.flavioVotes/(z.first.flavioVotes+z.first.lulaVotes);
  },0)/n:shift;
  const weight=n/(n+20000);
  cityShifts.set(city,weight*delta+(1-weight)*shift);
 }
 const obsKeys=new Set(observed.map(z=>z.city+":"+z.zone));
 let totalA=0,totalN=0;
 for(const z of zones){
  const s=z.second,full=obsKeys.has(z.city+":"+z.zone);
  const n=full?s.flavioVotes+s.lulaVotes:z.first.validVotes*ratio;
  const a=full?s.flavioVotes:n*clamp(z.first.flavioVotes/(z.first.flavioVotes+z.first.lulaVotes)+cityShifts.get(z.city),.001,.999);
  totalA+=a;totalN+=n;
 }
 if(!(totalN>0))return {...progress,reason:"Total projetado indisponível."};
 const flavioPct=100*totalA/totalN;
 const margin=2*totalA-totalN;
 return {...progress,ready:true,reason:"Cenário territorial exploratório; não representa previsão do resultado nacional.",
  flavioPct,lulaPct:100-flavioPct,winner:flavioPct===50?"Empate técnico":flavioPct>50?"Flávio Bolsonaro":"Lula",
  projectedFlavioVotes:totalA,projectedLulaVotes:totalN-totalA,
  estimatedMargin:margin,estimatedPairTotal:totalN,receivedVotes:received,
  ratioRemaining:ratio,globalShiftPp:100*shift,referenceVotes:mass,observedReferenceVotes:countedMass};
}
root.MetroZoneEngine={version:"1.0.0",project};
})(typeof window!=="undefined"?window:globalThis);
