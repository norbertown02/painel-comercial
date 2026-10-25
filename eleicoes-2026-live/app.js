
"use strict";
const $=id=>document.getElementById(id);
const nfmt=x=>new Intl.NumberFormat("pt-BR").format(Math.round(Number(x)||0));
const pf=x=>Number.isFinite(x)?x.toFixed(2).replace(".",",")+"%":"—";
const pp=x=>Number.isFinite(x)?(x>=0?"+":"")+x.toFixed(2).replace(".",",")+" p.p.":"—";
const clamp=(x,a=0.001,b=0.999)=>Math.max(a,Math.min(b,x));
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const UFS="AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO".split(" ");
let calibration=null,latestOutlook=null,latestChance=null,earlyReport=null,odds5Report=null,metroCities=[],historicalZoneStudy=null;
const zoneCache=Object.create(null);let zoneBusy=false,metroScanIndex=0;
const SHADOW_STORE_KEY="eleicoes2026_shadow_zone_v1";
let lastNationalShadowBaseline=null,shadowSnapshots=[];
try{const data=JSON.parse(localStorage.getItem(SHADOW_STORE_KEY)||"[]");
 if(Array.isArray(data))shadowSnapshots=data.filter(x=>x?.model==="shadow-zone-1"&&Number.isFinite(x.baseline)&&Number.isFinite(x.zonal)).slice(-500);
}catch{}
function saveShadowSnapshots(){try{localStorage.setItem(SHADOW_STORE_KEY,JSON.stringify(shadowSnapshots.slice(-500)));}catch{}}
let reference=null,replay=null,cities=[],cityByCode={},byUf={},firstByUf={},results22=[],current=null,selectedCity=null,stageSelected=1;
let refreshBusy=false,batchBusy=false,archiveBusy=false,archiveReady=false,lastArchiveSync=0,clock=30,nextIndex=0,liveReadings=[],sampleOrder=[],citySamples={};
const LS="eleicoes2026_observatorio_v4";
try{const saved=JSON.parse(localStorage.getItem(LS)||"{}");if(Array.isArray(saved.readings))liveReadings=saved.readings.slice(-700);}catch{}
const set=(id,x)=>{if($(id))$(id).textContent=x};
function updateNotice(s,bad=false){const el=$("notice");el.textContent=s;el.className="notice"+(bad?" error":"");}
function saveReadings(){try{localStorage.setItem(LS,JSON.stringify({readings:liveReadings.slice(-700)}));}catch{}}
function initRecords(){
 cities=Object.entries(reference.cities).map(([code,v])=>({code,uf:v[0],name:v[1],ibge:v[2],valid22:v[3],bols22:v[4],lula22:v[5],valid26:v[6],flavio26:v[7],lula26:v[8],electors:v[9],sections:v[10]}));
 cities.sort((a,b)=>b.valid26-a.valid26);cityByCode=Object.fromEntries(cities.map(x=>[x.code,x]));
 for(const uf of UFS){byUf[uf]=[];firstByUf[uf]={valid:0,flavio:0,lula:0};}
 for(const c of cities){if(!byUf[c.uf])continue;byUf[c.uf].push(c);firstByUf[c.uf].valid+=c.valid26;firstByUf[c.uf].flavio+=c.flavio26;firstByUf[c.uf].lula+=c.lula26;}
 for(const uf of UFS){const opt=document.createElement("option");opt.value=uf;opt.textContent=uf;$("ufFilter").appendChild(opt);}
 // Amostragem territorial estratificada e previsível; não é amostra aleatória representativa.
 sampleOrder=[];for(let ix=0;ix<11;ix++)for(const uf of UFS){const group=byUf[uf]||[];const pick=ix<7?group[ix]:group[Math.floor(group.length*(ix-6)/12)];if(pick&&!sampleOrder.some(v=>v.code===pick.code))sampleOrder.push(pick);}
 set("tableStatus",nfmt(cities.length)+" cidades disponíveis");
}
function model22(stage){
 let observed={},state={},sumDelta=0,sumWt=0,B=0,L=0;
 for(const uf of UFS)state[uf]={b:0,l:0};
 for(const [code,z] of Object.entries(stage.data)){const c=cityByCode[code];if(!c)continue;const b=+z[0]||0,l=+z[1]||0,n=b+l;if(!n)continue;observed[code]=[b,l];B+=b;L+=l;state[c.uf].b+=b;state[c.uf].l+=l;
  const q=c.bols22/(c.bols22+c.lula22);if(!Number.isFinite(q))continue;
  const weight=n*Math.min(1,Math.max(0.1,+z[2]||0)*2);sumDelta+=weight*(b/n-q);sumWt+=weight;
 }
 const delta=sumWt?sumDelta/sumWt:0;
 let EB=0,ET=0,MB=0,MT=0;
 for(const c of cities){const q=c.bols22/(c.bols22+c.lula22);if(!Number.isFinite(q))continue;
  const st=state[c.uf],s=(st.b+st.l)?st.b/(st.b+st.l):q;
  EB+=c.valid22*s;ET+=c.valid22;
  const o=observed[c.code]||[0,0],n=o[0]+o[1],remain=Math.max(0,c.valid22-n);
  MB+=o[0]+remain*clamp(q+delta);MT+=n+remain;
 }
 return {observed:100*B/(B+L),regional:100*EB/ET,municipal:100*MB/MT,delta:delta*100,votes:B+L,cities:Object.keys(observed).length};
}
function replayInit(){
 results22=replay.stages.map(model22);
 const holder=$("stageButtons");holder.innerHTML="";
 replay.stages.forEach((st,i)=>{const b=document.createElement("button");b.textContent=st.key;b.onclick=()=>{stageSelected=i;renderReplay();};holder.appendChild(b);});
 renderReplay();
}
function renderReplay(){
 const r=results22[stageSelected],s=replay.stages[stageSelected];
 const final=100*replay.finalDomestic.bolsonaro/(replay.finalDomestic.bolsonaro+replay.finalDomestic.lula);
 [...$("stageButtons").children].forEach((el,i)=>el.classList.toggle("on",i===stageSelected));
 set("rp",pf(r.observed));set("rpSub",nfmt(r.votes)+" votos já presentes no arquivo");
 set("rs",pf(r.regional));set("rsErr","Erro: "+Math.abs(r.regional-final).toFixed(2).replace(".",",")+" p.p.");
 set("rm",pf(r.municipal));set("rmErr","Erro: "+Math.abs(r.municipal-final).toFixed(2).replace(".",",")+" p.p.");
 set("rf",pf(final));set("rCities",nfmt(r.cities));set("rVotes",nfmt(r.votes));
 set("rShift",pp(r.delta));set("rRef",s.ref.slice(0,9));
 drawReplay();
}
function canvas(el){
 const width=el.getBoundingClientRect().width||650,height=el.getBoundingClientRect().height||300,dpr=Math.min(2,window.devicePixelRatio||1);
 el.width=Math.round(width*dpr);el.height=Math.round(height*dpr);
 const ctx=el.getContext("2d");ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,width,height);
 return {ctx,w:width,h:height};
}
function drawReplay(){
 if(!$("replayChart"))return;const {ctx,w,h}=canvas($("replayChart"));
 if(!results22.length)return;
 const fin=100*replay.finalDomestic.bolsonaro/(replay.finalDomestic.bolsonaro+replay.finalDomestic.lula);
 const max=Math.max(2,Math.ceil(Math.max(...results22.flatMap(r=>[Math.abs(r.regional-fin),Math.abs(r.municipal-fin)]))*1.2));
 const pad={l:48,r:18,t:20,b:46};const usable=w-pad.l-pad.r,base=h-pad.b,height=base-pad.t;
 ctx.font="11px sans-serif";ctx.fillStyle="#9fb0c6";ctx.strokeStyle="#314259";ctx.lineWidth=1;
 for(let i=0;i<=4;i++){let val=i*max/4,y=base-val/max*height;ctx.beginPath();ctx.moveTo(pad.l,y);ctx.lineTo(w-pad.r,y);ctx.stroke();ctx.fillText(val.toFixed(1).replace(".",",")+" pp",3,y+3);}
 results22.forEach((r,i)=>{const x=pad.l+(i+.5)*usable/4;const eh=Math.abs(r.regional-fin)/max*height,mh=Math.abs(r.municipal-fin)/max*height;ctx.fillStyle="#58a6fa";ctx.fillRect(x-25,base-eh,19,eh);ctx.fillStyle="#5ad9b2";ctx.fillRect(x+3,base-mh,19,mh);ctx.textAlign="center";ctx.fillStyle="#b7c6d9";ctx.fillText(["6,5%","8,7%","25%","55%"][i],x,base+19);});
 ctx.textAlign="left";
}

function renderEarlyStudy(){
 const r=earlyReport;if(!r){set("earlySnapAudit","Dados históricos indisponíveis.");return;}
 const h=r.history2022,v=r.syntheticValidation||[];
 set("earlyActual5",pf(h.interpolated5SharePct));
 set("earlyFinal2022",pf(h.officialFinalSharePct));
 set("earlyBias5",(h.earlyMinusFinalPp>=0?"−":"+")+Math.abs(h.earlyMinusFinalPp).toFixed(2).replace(".",",")+" p.p.");
 set("earlyTargetOne",pf(h.conditionalThresholds2026.winByAtLeastOneVoteShareAt5));
 set("earlyTarget300",pf(h.conditionalThresholds2026.winBy300000VotesShareAt5));
 set("earlyTarget300Detail",pf(h.conditionalThresholds2026.winBy300000VotesShareAt5));
 set("earlySnapAudit","Antes: "+pf(h.before5.sectionsPct)+" das seções às "+h.before5.date.slice(11,16)+"; depois: "+pf(h.after5.sectionsPct)+" às "+h.after5.date.slice(11,16)+". O ponto a 5% é interpolado, não uma publicação exata do TSE.");
 const ppf=x=>Number.isFinite(x)?x.toFixed(2).replace(".",",")+" p.p.":"—";
 if($("earlyValidationRows"))$("earlyValidationRows").innerHTML=v.map(s=>"<tr><td>"+s.year+" · "+(s.style==="balanced"?"equilibrado":"Sul/Sudeste primeiro")+"</td>"+
 "<td>"+pf(s.actualFinalPct)+"</td><td>"+pf(s.meanRawPct)+"</td><td>"+pf(s.meanForecastPct)+"</td>"+
 "<td>"+ppf(s.meanAbsErrorPp)+"</td><td>"+ppf(s.p90AbsErrorPp)+"</td><td>"+nfmt(s.incorrectWinnerCalls)+" / "+nfmt(s.repetitions)+"</td></tr>").join("");
 drawEarlyStudy();
}

function initOdds5(){
 const el=$("odds5Partial");if(!el)return;
 el.innerHTML="";for(let i=50;i<=65;i++){const opt=document.createElement("option");opt.value=String(i);opt.textContent=i+"%";el.appendChild(opt);}
 el.value="55";el.addEventListener("change",()=>{renderOdds5();drawOdds5();});
}
function renderOdds5(){
 const r=odds5Report;
 if(!r?.table?.length){set("odds5Assumptions","Cenários condicionais indisponíveis; a apuração oficial permanece independente.");return;}
 const selected=+$("odds5Partial")?.value||55,record=r.table.find(x=>x.partialPct===selected)||r.table[5],win=record.winPct;
 const fmt=x=>Number.isFinite(x)?x.toFixed(1).replace(".",",")+"%":"—";
 set("odds5Chance",fmt(win.composite));
 set("odds5Chance300",fmt(record.win300kPct));
 const values=[win.actual2022,win.moderate,win.regional,win.balanced].filter(Number.isFinite);
 set("odds5Sensitivity",fmt(Math.min(...values))+" – "+fmt(Math.max(...values)));
 set("odds5SensitivityLabel","Diferença entre cenários, não margem de confiança.");
 const weights=r.calculation.scenarioWeights,counts=r.calculation.biasDistributionStats;
 set("odds5Assumptions",nfmt((counts.balanced?.simulations||0)+(counts.moderate?.simulations||0)+(counts.regional?.simulations||0))+
 " simulações · erro adicional de "+r.calculation.independentResidualSdPp.toFixed(1).replace(".",",")+
 " p.p. · pesos hipotéticos · não calibrado.");
 const columns=["composite","actual2022","moderate","regional","balanced"];
 if($("odds5Rows"))$("odds5Rows").innerHTML=r.table.map(item=>{
  const selectedRow=item.partialPct===selected;
  return '<tr'+(selectedRow?' style="background:#1e3850"':'')+'><td><strong>'+item.partialPct+'%</strong></td>'+
   '<td><strong>'+fmt(item.winPct.composite)+'</strong></td>'+
   '<td>'+fmt(item.win300kPct)+'</td>'+
   ['actual2022','moderate','regional','balanced'].map(key=>'<td>'+fmt(item.winPct[key])+'</td>').join("")+'</tr>';
 }).join("");
 drawOdds5();
}
function drawOdds5(){
 const el=$("odds5Chart");
 if(!el||!odds5Report?.table?.length||$("view-early")?.classList.contains("hide"))return;
 const {ctx,w,h}=canvas(el),p={l:42,r:17,t:16,b:43},dx=w-p.l-p.r,dy=h-p.t-p.b;
 const data=odds5Report.table,low=data[0].partialPct,high=data.at(-1).partialPct;
 const x=v=>p.l+(v-low)/(high-low)*dx,y=v=>p.t+(100-v)/100*dy;
 ctx.font="11px sans-serif";ctx.lineWidth=1;
 for(let q=0;q<=100;q+=25){const Y=y(q);ctx.strokeStyle="#304056";ctx.beginPath();ctx.moveTo(p.l,Y);ctx.lineTo(w-p.r,Y);ctx.stroke();ctx.fillStyle="#9fb0c6";ctx.textAlign="right";ctx.fillText(q+"%",p.l-7,Y+4);}
 for(let q=50;q<=65;q+=3){const X=x(q);ctx.fillStyle="#9fb0c6";ctx.textAlign="center";ctx.fillText(q+"%",X,h-p.b+17);}
 const lines=[
  {key:"regional",color:"#f58a81",weight:1.7,dash:[5,4]},
  {key:"actual2022",color:"#58a6fa",weight:1.7,dash:[5,4]},
  {key:"moderate",color:"#5ad9b2",weight:1.7,dash:[5,4]},
  {key:"composite",color:"#f4c879",weight:3,dash:[]}
 ];
 for(const line of lines){
  ctx.lineWidth=line.weight;ctx.strokeStyle=line.color;ctx.setLineDash(line.dash);ctx.beginPath();
  data.forEach((d,i)=>{const X=x(d.partialPct),Y=y(d.winPct[line.key]);if(i===0)ctx.moveTo(X,Y);else ctx.lineTo(X,Y)});
  ctx.stroke();
 }
 ctx.setLineDash([]);
 const s=+$("odds5Partial")?.value||55,point=data.find(d=>d.partialPct===s);
 if(point){
  ctx.strokeStyle="#a8bacc";ctx.setLineDash([2,5]);ctx.lineWidth=1.2;ctx.beginPath();ctx.moveTo(x(s),p.t);ctx.lineTo(x(s),h-p.b);ctx.stroke();ctx.setLineDash([]);
  ctx.fillStyle="#f4c879";ctx.beginPath();ctx.arc(x(s),y(point.winPct.composite),5,0,2*Math.PI);ctx.fill();
 }
 ctx.fillStyle="#9fb0c6";ctx.textAlign="center";ctx.font="11px sans-serif";
 ctx.fillText("Parcial hipotética de Flávio com 5% das seções",p.l+dx/2,h-8);
}

function drawEarlyStudy(){
 const el=$("earlyChart");if(!el||!earlyReport||$("view-early")?.classList.contains("hide"))return;
 const {ctx,w,h}=canvas(el),p={l:51,r:18,t:18,b:43},dx=w-p.l-p.r,dy=h-p.t-p.b;
 const x=v=>p.l+Math.max(0,Math.min(12,v))/12*dx;
 const y=v=>p.t+(58-v)/10*dy;
 ctx.font="11px sans-serif";ctx.strokeStyle="#354459";ctx.fillStyle="#aab9ce";ctx.lineWidth=1;
 for(let i=0;i<=5;i++){
  const val=48+i*2,Y=y(val);ctx.beginPath();ctx.moveTo(p.l,Y);ctx.lineTo(w-p.r,Y);ctx.stroke();
  ctx.textAlign="right";ctx.fillText(val.toFixed(0)+"%",p.l-7,Y+4);
 }
 for(let i=0;i<=12;i+=2){const X=x(i);ctx.strokeStyle="#243449";ctx.beginPath();ctx.moveTo(X,p.t);ctx.lineTo(X,h-p.b);ctx.stroke();ctx.textAlign="center";ctx.fillText(i+"%",X,h-p.b+19);}
 const h22=earlyReport.history2022,points=h22.observations.filter(z=>z[0]>0&&z[0]<=12).sort((a,b)=>a[0]-b[0]);
 ctx.setLineDash([4,4]);ctx.strokeStyle="#8d9ead";ctx.beginPath();ctx.moveTo(p.l,y(h22.officialFinalSharePct));ctx.lineTo(w-p.r,y(h22.officialFinalSharePct));ctx.stroke();
 ctx.setLineDash([3,4]);ctx.strokeStyle="#f4c879";ctx.beginPath();ctx.moveTo(x(5),p.t);ctx.lineTo(x(5),h-p.b);ctx.stroke();ctx.setLineDash([]);
 ctx.strokeStyle="#58a6fa";ctx.lineWidth=3;ctx.beginPath();
 points.forEach(([vx,vy],i)=>{i===0?ctx.moveTo(x(vx),y(vy)):ctx.lineTo(x(vx),y(vy));});ctx.stroke();
 ctx.fillStyle="#f4c879";ctx.beginPath();ctx.arc(x(5),y(h22.interpolated5SharePct),4.5,0,2*Math.PI);ctx.fill();
 ctx.font="bold 11px sans-serif";ctx.textAlign="left";ctx.fillText("5% · "+pf(h22.interpolated5SharePct),Math.min(w-117,x(5)+10),y(h22.interpolated5SharePct)-8);
 ctx.textAlign="right";ctx.font="11px sans-serif";ctx.fillStyle="#aab9ce";ctx.fillText("Final: "+pf(h22.officialFinalSharePct),w-p.r,y(h22.officialFinalSharePct)-7);
 ctx.textAlign="center";ctx.fillText("Seções apuradas · 2022",p.l+dx/2,h-7);
}




function shadowResult(){
 const n=current?.national;
 if(!(n?.validVotes>0&&n.sectionsCounted>0))return {ready:false,reason:"Aguardando votação oficial."};
 if(n.sectionsPct>=99.995)return {ready:false,reason:"Apuração concluída. Verificando o histórico contra o resultado final oficial."};
 const nationalFirstVotes=UFS.reduce((sum,uf)=>sum+(firstByUf[uf]?.valid||0),0);
 return window.MetroZoneEngine?.contrast?.({
  metros:metroCities,cache:zoneCache,
  nationalPct:lastNationalShadowBaseline,
  nationalReferenceValid:nationalFirstVotes
 })||{ready:false,reason:"Modelo de contraste indisponível."};
}
function shadowFinalResult(){
 const n=current?.national;
 if(!(n?.sectionsPct>=99.995&&n?.flavioVotes>=0&&n?.lulaVotes>=0&&n.flavioVotes+n.lulaVotes>0))return null;
 return 100*n.flavioVotes/(n.flavioVotes+n.lulaVotes);
}
function recordShadowSnapshot(result){
 const n=current?.national;
 if(!result.ready||!(n?.validVotes>0)||!(n.sectionsPct>=5&&n.sectionsPct<99.995))return;
 // A snapshot is frozen ONLY at a new official nationwide count.
 // Later zone data must NEVER backfill that national count.
 if(shadowSnapshots.some(s=>s.nationalVotes===n.validVotes))return;
 if(shadowSnapshots.length&&n.validVotes<shadowSnapshots.at(-1).nationalVotes)return;
 const row={model:"shadow-zone-1",at:new Date().toISOString(),
  nationalVotes:n.validVotes,nationalSourceTime:n.generatedAt||null,
  sec:Number(n.sectionsPct),baseline:result.nationalPct,zonal:result.adjustedPct,
  delta:result.deltaNationalPp,metroCoverage:result.zoneCoveragePct,
  observedCities:result.observedCities,observedZones:result.observedZones,
  eligibleCities:result.eligibleCities,eligibleUFs:result.eligibleUFs,
  metroWeight:result.weight};
 shadowSnapshots.push(Object.freeze(row));
 shadowSnapshots=shadowSnapshots.slice(-500);saveShadowSnapshots();
}
function exportShadowCsv(){
 if(!shadowSnapshots.length)return;
 const cols=["at","nationalSourceTime","nationalVotes","sec","baseline","zonal","delta","metroCoverage",
  "metroWeight","eligibleCities","eligibleUFs","observedCities","observedZones","model"];
 const csv=cols.join(";")+"\n"+shadowSnapshots.map(r=>cols.map(k=>{
  const v=r[k]==null?"":String(r[k]);return '"'+v.replace(/"/g,'""')+'"';
 }).join(";")).join("\n");
 const link=document.createElement("a");
 const blob=new Blob(["\uFEFF"+csv],{type:"text/csv;charset=utf-8"});
 const href=URL.createObjectURL(blob);
 link.href=href;link.download="metodologia-norberto-auditoria-zonas-2026.csv";
 document.body.appendChild(link);link.click();link.remove();
 setTimeout(()=>URL.revokeObjectURL(href),1000);
}
function renderShadowComparison(record=false){
 const r=shadowResult();
 if(record)recordShadowSnapshot(r);
 const finish=shadowFinalResult();
 const scores=finish==null?{ready:false}:window.MetroZoneEngine.evaluate(shadowSnapshots,finish);
 const fmtSigned=x=>Number.isFinite(x)?(x>=0?"+":"")+x.toFixed(3).replace(".",",")+" p.p.":"—";
 const result=r.ready?r:null;
 set("shadowBaseline",result?pf(result.nationalPct):"—");
 set("shadowAdjusted",result?pf(result.adjustedPct):"—");
 set("shadowDelta",result?fmtSigned(result.deltaNationalPp):"—");
 set("shadowCount",nfmt(shadowSnapshots.length));
 set("shadowZoneCoverage",result?pf(result.zoneCoveragePct)+" · "+result.eligibleCities+"/15 cidades · "+nfmt(result.observedZones)+" zonas concluídas":"—");
 set("shadowNationalWeight",result?pf(result.weight*100):"—");
 set("shadowZoneBase",result?pf(result.nationalPct):"—");
 set("shadowZoneAdjusted",result?pf(result.adjustedPct):"—");
 set("shadowZoneDifference",result?fmtSigned(result.deltaNationalPp):"—");
 const message=result?"Estimativa paralela, não incorporada à projeção principal. "+
  "Correção puramente espacial calculada com os mesmos dados observados.":
  (r.reason||"Aguardando dados oficiais e referência por zona.");
 set("shadowStatus",scores.ready?
  "Resultado oficial final disponível: comparação calculada sobre as fotografias anteriores à conclusão.":message);
 set("shadowZoneNote",message);
 set("shadowOriginalError",scores.ready?pf(scores.baselineMae).replace("%"," p.p."):"Aguardando resultado final");
 set("shadowZonalError",scores.ready?pf(scores.zonalMae).replace("%"," p.p."):"Aguardando resultado final");
 set("shadowBetter",scores.ready?
  scores.improved+" de "+scores.n+" fotografias · "+(scores.improvementPp>=0?"redução":"aumento")+" de "+
  Math.abs(scores.improvementPp).toFixed(3).replace(".",",")+" p.p. no erro médio":
  "Aguardando resultado final");
 const ranges=[[5,10,"5–10%"],[10,25,"10–25%"],[25,50,"25–50%"],[50,99.995,"50–100%"]];
 if($("shadowStageRows"))$("shadowStageRows").innerHTML=ranges.map(([start,end,label])=>{
  const sample=scores.ready?scores.scores.filter(x=>x.sec>=start&&x.sec<end):[];
  if(!sample.length)return "<tr><td>"+label+"</td><td>—</td><td>—</td><td>—</td><td>"+
   (scores.ready?"Sem amostra":"Aguardando resultado final")+"</td></tr>";
  const a=sample.reduce((s,x)=>s+x.baselineError,0)/sample.length,
   b=sample.reduce((s,x)=>s+x.zonalError,0)/sample.length,
   verdict=b<a-1e-9?"Melhorou":b>a+1e-9?"Piorou":"Equivalente";
  return "<tr><td>"+label+"</td><td>"+sample.length+"</td><td>"+pf(a).replace("%"," p.p.")+"</td>"+
   "<td>"+pf(b).replace("%"," p.p.")+"</td><td>"+verdict+"</td></tr>";
 }).join("");
 const scored=new Map((scores.scores||[]).map(s=>[s.at,s]));
 const recent=shadowSnapshots.slice(-10).reverse();
 if($("shadowHistoryRows"))$("shadowHistoryRows").innerHTML=recent.length?recent.map(s=>{
  const z=scored.get(s.at);
  const verdict=!z?"—":z.improved?"Melhorou":z.worsened?"Piorou":"Empatou";
  return "<tr><td>"+pf(s.sec)+"</td><td>"+pf(s.baseline)+"</td>"+
  "<td>"+pf(s.zonal)+"</td><td>"+fmtSigned(s.delta)+"</td>"+
  "<td>"+pf(s.metroCoverage)+"</td><td>"+verdict+"</td></tr>";
 }).join(""):'<tr><td colspan="6">Aguardando leituras reais com ambos os modelos disponíveis.</td></tr>';
}

function renderMetroWinner(){
 const data=window.MetroZoneEngine?.project?.({metros:metroCities,cache:zoneCache});
 if(!data)return;
 const scanned=metroCities.filter(m=>{
  const st=zoneCache[m.ibge],rows=st?.zones?.map(z=>st.rows?.[z]?.first);
  if(!rows?.length||rows.some(r=>!r?.validVotes))return false;
  const total=rows.reduce((s,r)=>s+r.validVotes,0);
  return total===(st.firstMunicipal?.validVotes||m.firstRoundValid);
 }).length;
 const knownZones=metroCities.reduce((s,m)=>{
  const st=zoneCache[m.ibge];return s+(st?.zones||[]).filter(z=>st.rows?.[z]?.first?.validVotes>0).length;
 },0);
 const seenZones=metroCities.reduce((s,m)=>{
  const st=zoneCache[m.ibge];return s+(st?.zones||[]).filter(z=>{
   const r=st.rows?.[z]?.second;return r?.sectionsTotal>0&&r.sectionsCounted===r.sectionsTotal&&r.validVotes>0;
  }).length;
 },0);
 const knownCityStatuses=metroCities.filter(m=>{
  const st=zoneCache[m.ibge];return st?.zones?.some(z=>st.rows?.[z]?.second?.sectionsTotal>0&&
    st.rows[z].second.sectionsCounted===st.rows[z].second.sectionsTotal);
 }).length;
 const label=data.ready?data.winner:"—";
 set("metroWinner",label);set("metroWinnerZone",label);
 for(const id of ["metroWinner","metroWinnerZone"]){
  const el=$(id);if(el)el.className="n "+(data.ready&&data.winner==="Flávio Bolsonaro"?"blue":data.ready&&data.winner==="Lula"?"red":"green");
 }
 const percent=data.ready?"Flávio "+pf(data.flavioPct)+" · Lula "+pf(data.lulaPct):"Aguardando referência completa e cobertura ≥ 5%";
 set("metroWinnerPct",percent);set("metroWinnerZonePct",percent);
 set("metroWinnerZones",nfmt(seenZones)+" zonas");
 set("metroWinnerCoverage",data.ready?pf(data.coveragePct)+" dos votos de referência":"Aguardando");
 set("metroWinnerVerified",scanned+" / "+metroCities.length);
 set("metroWinnerCityCoverage",knownCityStatuses+" / "+metroCities.length);
 set("metroWinnerMargin",data.ready?(data.estimatedMargin>=0?"Flávio":"Lula")+": "+nfmt(Math.abs(data.estimatedMargin))+" votos":"—");
 const hist=historicalZoneStudy?.years?.["2022"],stage=[50,25,10,5].find(v=>data.coveragePct>=v)||5;
 const modeled=hist?.scenarios?.filter(x=>x.coverage===stage)||[],
  warning=modeled.length?Math.max(...modeled.map(x=>x.zoneP90)):null;
 const gap=data.ready?Math.abs(data.flavioPct-50):null;
 const caution=data.ready&&Number.isFinite(warning)?
  (gap<=warning?" Atenção: vantagem menor que os maiores erros P90 simulados em 2022 nessa etapa.":" Estimativa não calibrada em nova eleição."):"";
 const note=data.ready?"Somente as 15 localidades · peso de "+pf(data.coveragePct)+" dos votos de referência do 1º turno em zonas concluídas."+caution:
  scanned+" / 15 localidades conciliadas · "+nfmt(knownZones)+" zonas do primeiro turno recebidas. "+data.reason;
 set("metroWinnerStatus",note);set("metroWinnerZoneStatus",note);
 renderShadowComparison(false);
}
async function backgroundMetroRefresh(){
 if(zoneBusy||!metroCities.length||!reference||!current)return;
 // Refresh the 15 selected localities in round-robin order; at most 16 zones
 // per iteration so election-night requests never flood the TSE.
 const pending=metroCities.filter(m=>{
  const st=zoneCache[m.ibge];
  return !st?.loaded||st.zones.some(z=>!st.rows?.[z]?.first);
 });
 const choices=pending.length?pending:metroCities;
 const metro=choices[metroScanIndex++%choices.length];
 await loadMetroZones(false,metro.ibge);
}
function renderHistoricalZoneStudy(){
 const info=historicalZoneStudy?.years, fmt=x=>Number.isFinite(x)?x.toFixed(2).replace(".",","):"—";
 if(!info){set("zoneHistoricalRows","Estudo indisponível.");return;}
 const order=["2014","2018","2022"];
 if($("zoneHistoricalRows"))$("zoneHistoricalRows").innerHTML=order.map(year=>{
  const r=info[year];if(!r)return "";
  return "<tr><td><strong>"+year+"</strong></td><td>"+nfmt(r.zones)+"</td>"+
   "<td>"+fmt(r.MAE_municipal)+" p.p.</td><td>"+fmt(r.MAE_zone)+" p.p.</td>"+
   "<td class='green'>"+fmt(r.zonalGainPct)+"%</td><td>"+pp(r.abstentionDeltaPp)+"</td></tr>";
 }).join("");
 const people={"2014":["Aécio","Dilma"],"2018":["Bolsonaro","Haddad"],"2022":["Bolsonaro","Lula"]};
 const signed=x=>x>=0?"+"+nfmt(x):"−"+nfmt(-x);
 if($("zoneHistoricalNetRows"))$("zoneHistoricalNetRows").innerHTML=order.map(year=>{
  const r=info[year],names=people[year];if(!r||r.firstOtherCandidateVotes==null)return "";
  return "<tr><td>"+year+"</td><td>"+nfmt(r.firstOtherCandidateVotes)+"</td>"+
   "<td>"+esc(names[0])+": "+signed(r.netCandidateAGain)+"</td>"+
   "<td>"+esc(names[1])+": "+signed(r.netCandidateBGain)+"</td>"+
   "<td>"+signed(r.netValidVoteChange)+"</td></tr>";
 }).join("");
 const review=info["2022"];
 if($("zoneWinnerReplay2022")){
  const ordered=[5,10,25,50];
  $("zoneWinnerReplay2022").innerHTML=ordered.map(p=>{
   const sims=review?.scenarios?.filter(x=>x.coverage===p)||[];
   const n=sims.reduce((sum,s)=>sum+s.n,0),
    wrong=sims.reduce((sum,s)=>sum+(s.zoneWrongWinner||0),0),
    err=sims.length?sims.reduce((sum,s)=>sum+s.zoneMae,0)/sims.length:null;
   if(!n||!sims.every(x=>Number.isFinite(x.zoneWrongWinner)))return "";
   return "<tr><td>"+p+"%</td><td>"+fmt(err)+" p.p.</td>"+
    "<td class='green'>"+nfmt(n-wrong)+" / "+nfmt(n)+" ("+pf(100*(n-wrong)/n)+")</td>"+
    "<td>"+nfmt(wrong)+"</td></tr>";
  }).join("");
 }
 const coverage=Number($("zoneHistoricalCoverage")?.value||5);
 if($("zoneHistoricalCoverageRows"))$("zoneHistoricalCoverageRows").innerHTML=order.map(year=>{
  const r=info[year],tests=r?.scenarios?.filter(x=>x.coverage===coverage)||[];
  if(!tests.length)return "";
  const m=tests.reduce((s,x)=>s+x.munMae,0)/tests.length,
   z=tests.reduce((s,x)=>s+x.zoneMae,0)/tests.length;
  return "<tr><td>"+year+"</td><td>"+fmt(m)+" p.p.</td><td>"+fmt(z)+" p.p.</td>"+
   "<td class='green'>"+fmt(m>0?100*(m-z)/m:null)+"%</td></tr>";
 }).join("");
}

function setMetroCities(raw){
 metroCities=Array.isArray(raw?.cities)?raw.cities:[];
 const select=$("metroSelect");if(!select)return;
 select.innerHTML="";
 for(const m of metroCities){
  const opt=document.createElement("option");opt.value=m.ibge;opt.textContent=m.name+" · "+m.uf+" ("+nfmt(m.pop)+" hab.)";select.appendChild(opt);
 }
 if(metroCities.length)select.value=metroCities[0].ibge;
}
function zoneActive(){return $("metroSelect")?.value||"";}
function pairPct(a,b){return a+b>0?100*a/(a+b):null;}
async function loadMetroZones(force=false,idOverride=null){
 const id=idOverride||zoneActive();if(!id||zoneBusy)return;
 const metro=metroCities.find(c=>c.ibge===id);
 if(!metro)return;
 const state=zoneCache[id]||(zoneCache[id]={zones:[],rows:{},next:0,error:"",loaded:false});
 if(force)state.next=0;
 zoneBusy=true;if(id===zoneActive())set("zoneStatus","Consultando cadastro e resultados por zona no TSE...");
 try{
  if(!state.loaded){
   const r=await fetch("/api/zones?mode=list&city="+encodeURIComponent(id),{cache:"no-store"});
   const j=await r.json();if(!r.ok||!j.ok||!Array.isArray(j.zones)||!j.zones.length)throw Error(j.error||"Cadastro de zonas indisponível");
   state.zones=j.zones;state.firstMunicipal=j.firstMunicipal||null;state.loaded=true;state.next=0;
  }
  if(state.zones.length){
   // Two small batches per reading; avoid an unbounded request burst at the TSE.
   const groups=[];for(let k=0;k<2;k++){
    const list=[];for(let ix=0;ix<8&&ix<state.zones.length;ix++)list.push(state.zones[(state.next++)%state.zones.length]);
    if(list.length)groups.push(list);
   }
   const reports=await Promise.allSettled(groups.map(async group=>{
    const turn=current?.national?.sectionsCounted===0?"first":
     group.every(z=>!!state.rows[z]?.first)?"second":"both";
    const r=await fetch("/api/zones?mode=batch&city="+encodeURIComponent(id)+"&zones="+group.join(",")+"&turn="+turn,{cache:"no-store"});
    const j=await r.json();if(!r.ok||!j.ok)throw Error(j.error||"Falha ao consultar zonas");
    return j.results||[];
   }));
   let successful=0;
   for(const res of reports)if(res.status==="fulfilled"){
    successful++;
    for(const item of res.value){
     const old=state.rows[item.zone]||{};
     state.rows[item.zone]={zone:item.zone,first:item.first||old.first||null,
      second:item.second||old.second||null,firstError:item.firstError,secondError:item.secondError};
    }
   }else state.error=String(res.reason?.message||res.reason);
   if(!successful)throw Error(state.error||"Consulta indisponível");
  }
  state.error="";
 }catch(e){state.error=String(e?.message||e);}
 finally{zoneBusy=false;if(zoneActive()===id)renderMetroZones();renderMetroWinner();}
}

function renderZoneParticipation(m,rows,known,verified){
 const sums=new Map();
 let valid=0,eligible=0,turnout=0,blank=0,nullVotes=0;
 for(const z of known){
  const first=z.first;valid+=first.validVotes;eligible+=first.registeredVoters||0;
  turnout+=first.turnoutVotes||0;blank+=first.blankVotes||0;nullVotes+=first.nullVotes||0;
  for(const cc of first.candidates||[]){
   if(!sums.has(cc.number))sums.set(cc.number,{number:cc.number,name:cc.name,votes:0});
   sums.get(cc.number).votes+=cc.votes;
  }
 }
 const fullCandidates=verified&&known.length===rows.length&&
  known.every(z=>Array.isArray(z.first.candidates)&&
    z.first.candidates.reduce((s,a)=>s+a.votes,0)===z.first.validVotes);
 const candidates=[...sums.values()].sort((a,b)=>b.votes-a.votes);
 const select=$("zoneCandidateFilter");
 if(select){
  const old=select.value||"22";
  select.innerHTML=candidates.map(z=>'<option value="'+esc(z.number)+'">'+esc(z.name)+" · "+esc(z.number)+"</option>").join("");
  if(candidates.some(z=>z.number===old))select.value=old;
  else if(candidates.length)select.value=candidates[0].number;
 }
 if($("zoneCandidates"))$("zoneCandidates").innerHTML=candidates.length?
  candidates.map(z=>"<tr><td>"+esc(z.name)+" ("+esc(z.number)+")</td><td>"+nfmt(z.votes)+"</td><td>"+
   (valid>0?pf(100*z.votes/valid):"—")+"</td></tr>").join(""):
  '<tr><td colspan="3">Aguardando votos do 1º turno por zona.</td></tr>';
 const others=candidates.filter(z=>!["13","22"].includes(z.number)).reduce((s,z)=>s+z.votes,0);
 set("zoneOtherVotes",fullCandidates?nfmt(others):"—");
 set("zoneBlankNull",verified?nfmt(blank+nullVotes):"—");
 const firstTurnout=verified&&eligible>0&&turnout<=eligible?100*turnout/eligible:null;
 const second=rows.filter(z=>z.second?.sectionsCounted>0&&
  z.second.registeredProcessed>0&&z.second.turnoutVotes>=0&&
  z.second.turnoutVotes<=z.second.registeredProcessed);
 const eligibleSecond=second.reduce((s,z)=>s+z.second.registeredProcessed,0);
 const turnoutSecond=second.reduce((s,z)=>s+z.second.turnoutVotes,0);
 const secondTurnout=eligibleSecond>0?100*turnoutSecond/eligibleSecond:null;
 const firstMatched=second.filter(z=>z.first?.registeredVoters>0);
 const firstMatchedEligible=firstMatched.reduce((s,z)=>s+z.first.registeredVoters,0);
 const firstMatchedTurnout=firstMatched.reduce((s,z)=>s+z.first.turnoutVotes,0);
 const matchedFirstRate=firstMatchedEligible>0?100*firstMatchedTurnout/firstMatchedEligible:null;
 set("zoneTurnoutFirst",firstTurnout!=null?pf(firstTurnout)+" · "+nfmt(turnout)+" eleitores":"—");
 set("zoneAbstentionFirst",firstTurnout!=null?pf(100-firstTurnout)+" · "+nfmt(eligible-turnout)+" eleitores":"—");
 set("zoneTurnoutSecond",secondTurnout!=null?pf(secondTurnout)+" · "+second.length+" zonas com dados":"—");
 set("zoneTurnoutDelta",matchedFirstRate!=null&&secondTurnout!=null?pp(secondTurnout-matchedFirstRate):"—");
 const delta=Number($("zoneTurnoutAssumption")?.value||0),
  participation=Number($("zoneOtherParticipation")?.value||0);
 set("zoneTurnoutAssumptionValue",(delta>=0?"+":"")+delta.toFixed(1).replace(".",",")+" p.p.");
 set("zoneOtherParticipationValue",participation.toFixed(0)+"%");
 set("zoneScenarioAttendance",firstTurnout!=null?nfmt(Math.round(eligible*Math.max(0,Math.min(100,firstTurnout+delta))/100)-turnout)+" eleitores":"—");
 set("zoneScenarioPool",fullCandidates?nfmt(Math.round(others*participation/100))+" votos":"—");
 return {firstValid:valid,available:fullCandidates,selected:select?.value||"22"};
}

function renderMetroZones(){
 const id=zoneActive(),m=metroCities.find(c=>c.ibge===id),state=zoneCache[id];
 if(!m){set("zoneStatus","Aguardando a lista de cidades.");return;}
 if(!state?.loaded){set("zoneStatus",state?.error||"Clique em atualizar para consultar as zonas.");return;}
 const zs=state.zones,rows=zs.map(z=>state.rows[z]||{zone:z}),known=rows.filter(z=>z.first?.validVotes>0),
  counted=rows.filter(z=>z.second?.sectionsCounted>0&&z.second?.validVotes>0);
 const knownTotal=known.reduce((s,z)=>s+z.first.validVotes,0),whole=known.length===zs.length;
 // The TSE first-turn municipal result must match the sum of all zones before
 // any separate zone-based projection becomes eligible.
 const officialReference=state.firstMunicipal?.validVotes||null;
 const expectedFirstValid=officialReference||m.firstRoundValid;
 // Official EA20 municipal reconciliation must match exactly; never permit
 // an arbitrary percentage tolerance to label different vote totals valid.
 const verified=whole&&knownTotal===expectedFirstValid;
 const countedSections=counted.reduce((s,z)=>s+z.second.sectionsCounted,0),
  allSections=rows.reduce((s,z)=>s+(z.second?.sectionsTotal||z.first?.sectionsTotal||0),0);
 const coverage=allSections>0?100*countedSections/allSections:0;
 set("zoneTotal",zs.length.toString());set("zoneCounted",counted.length+" / "+zs.length);
 set("zoneCoverage",whole?pf(coverage):"—");
 set("zoneVerified",verified?(officialReference?"EA20 validada":"Base conciliada"):
  whole?"Diferença: "+nfmt(knownTotal-expectedFirstValid):known.length+"/"+zs.length);
 set("zoneStatus",state.error?"Última consulta: "+state.error:
  "TSE · "+m.name+"/"+m.uf+" · referência de "+known.length+"/"+zs.length+" zonas carregada(s)");
 const zoneDiagnostics=renderZoneParticipation(m,rows,known,verified);
 const selectedCandidate=zoneDiagnostics.selected;
 const f=x=>Number.isFinite(x)?pf(x):"—";
 if($("zoneRows"))$("zoneRows").innerHTML=rows.map(z=>{
  const first=z.first,second=z.second,p1=first?pairPct(first.flavioVotes,first.lulaVotes):null,
   p2=second&&second.sectionsCounted>0?pairPct(second.flavioVotes,second.lulaVotes):null;
  const shift=p1!=null&&p2!=null?p2-p1:null;
  const cand=first?.candidates?.find(q=>q.number===selectedCandidate);
  const candidatePct=cand&&first.validVotes>0?100*cand.votes/first.validVotes:null;
  return "<tr><td><strong>"+esc(Number(z.zone))+"</strong></td><td>"+(second&&second.sectionsCounted>0?second.sectionsCounted+" / "+second.sectionsTotal:"—")+"</td>"+
   "<td>"+f(p1)+"</td><td>"+f(candidatePct)+"</td><td>"+f(p2)+"</td><td class='"+(shift>=0?"green":"red")+"'>"+pp(shift)+"</td><td>"+
   (p2!=null?nfmt(second.validVotes):"—")+"</td></tr>";
 }).join("");
 set("zoneSummary","Zonas com apuração: "+counted.length+" de "+zs.length+" · primeiro turno carregado em "+known.length+
  " zonas. "+(verified?"Total conciliado com "+(officialReference?"EA20 municipal.":"base de referência."):"Aguardando conciliação exata."));
 const zoneShiftNum=counted.reduce((s,z)=>{
  const first=z.first;return s+(first?z.second.validVotes*(pairPct(z.second.flavioVotes,z.second.lulaVotes)-pairPct(first.flavioVotes,first.lulaVotes))/100:0);
 },0);
 const countedN=counted.filter(z=>z.first).reduce((s,z)=>s+z.second.validVotes,0),globalShift=countedN>0?zoneShiftNum/countedN:0;
 set("zoneShift",countedN>0?pp(globalShift*100):"—");
 if(!verified||counted.length<3||coverage<10){
  set("zoneProjection","—");
  set("zoneProjectionNote",!verified?"Aguardando a referência oficial de todas as zonas, reconciliada com o município.":
   "Projeção aguardando três zonas com votos e pelo menos 10% das seções totalizadas. Não entra no motor nacional.");
  return;
 }
 let projectedA=0,projectedN=0;
 for(const z of rows){
  const first=z.first,second=z.second,obsN=second?.sectionsCounted>0?second.validVotes:0,
   obsA=obsN>0?second.flavioVotes:0,frac=second?.sectionsTotal>0?Math.min(1,second.sectionsCounted/second.sectionsTotal):0,
   q=pairPct(first.flavioVotes,first.lulaVotes)/100,
   local=obsN?obsA/Math.max(1,second.flavioVotes+second.lulaVotes)-q:globalShift,
   sh=globalShift+Math.min(.35,frac*.35)*(local-globalShift),
   remaining=Math.max(0,first.validVotes*(1-frac));
  projectedA+=obsA+remaining*clamp(q+sh);projectedN+=obsN+remaining;
 }
 const proj=projectedN>0?100*projectedA/projectedN:null;
 set("zoneProjection",proj==null?"—":pf(proj));
 set("zoneProjectionNote","Cenário experimental: referência por zona do 1º turno, votos já recebidos e deslocamento territorial suavizado. Não calibrado; não altera a projeção nacional.");
}

function changeView(view){
 document.querySelectorAll(".view").forEach(el=>el.classList.toggle("hide",el.id!=="view-"+view));
 document.querySelectorAll(".tab").forEach(el=>el.classList.toggle("on",el.dataset.view===view));
 if(view==="replay")drawReplay();if(view==="early"){drawEarlyStudy();drawOdds5();}if(view==="overview"){drawLive();drawProbability();}if(view==="cities")renderCityResults();if(view==="zones"){renderMetroZones();loadMetroZones();}
}
function showCity(c,shouldFetch=true){
 selectedCity=c;set("selectedCity",c.name+" · "+c.uf);
 const fl=100*c.flavio26/c.valid26,lu=100*c.lula26/c.valid26,bol=100*c.bols22/c.valid22;
 const pair=100*c.flavio26/(c.flavio26+c.lula26),s=citySamples[c.code];
 const lines=[
  ["Votos válidos no 1º turno de 2026",nfmt(c.valid26)],
  ["Flávio no 1º turno · todos os válidos",pf(fl)+" · "+nfmt(c.flavio26)+" votos"],
  ["Lula no 1º turno · todos os válidos",pf(lu)+" · "+nfmt(c.lula26)+" votos"],
  ["Flávio entre Flávio e Lula no 1º turno",pf(pair)],
  ["Bolsonaro no 1º turno de 2022",pf(bol)],
  ["Diferença 2026 contra Bolsonaro 2022",pp(fl-bol)],
  ["Seções cadastradas em 2026",nfmt(c.sections)]
 ];
 if(s&&s.sectionsCounted>0){lines.push(["2º turno 2026 · apuração na cidade",pf(s.sectionsPct)+" das seções"],["Flávio · apuração oficial na cidade",pf(s.flavioShare)+" · "+nfmt(s.flavioVotes)+" votos"],["Lula · apuração oficial na cidade",pf(s.lulaShare)+" · "+nfmt(s.lulaVotes)+" votos"]);}
 else lines.push(["2º turno 2026","Sem parcial municipal recebida neste navegador"]);
 $("cityDetail").innerHTML=lines.map(x=>'<div class="pair"><span class="muted">'+esc(x[0])+'</span><strong>'+esc(x[1])+'</strong></div>').join("")+'<p class="mini">Código TSE: '+esc(c.code)+' · IBGE: '+esc(c.ibge)+'. Comparação não prevê automaticamente a transferência de votos.</p>';
 if(metroCities.some(m=>m.ibge===c.ibge)){
  const b=document.createElement("button");b.textContent="Ver zonas eleitorais de "+c.name;
  b.style.marginTop="12px";b.onclick=()=>{
   $("metroSelect").value=c.ibge;changeView("zones");
  };
  $("cityDetail").appendChild(b);
 }
 if(shouldFetch&&current?.national?.sectionsCounted>0)fetchSelectedCity(c);
}
async function fetchSelectedCity(c){
 try{const r=await fetch("/api/tse?mode=city&uf="+encodeURIComponent(c.uf)+"&code="+encodeURIComponent(c.code),{cache:"no-store"});const j=await r.json();
 if(j.ok&&j.data?.sectionsCounted>0){citySamples[c.code]=j.data;if(selectedCity?.code===c.code)showCitySilent(c);}
 }catch{}
}
function showCitySilent(c){if(citySamples[c.code])showCity(c,false);}
function renderCityResults(){
 if(!cities.length)return;
 const uf=$("ufFilter").value,search=$("citySearch").value.normalize("NFD").replace(/[\u0300-\u036f]/g,"").trim().toUpperCase();
 let pool=uf?byUf[uf]||[]:cities;
 if(search)pool=pool.filter(c=>c.name.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toUpperCase().includes(search));
 pool=pool.slice(0,24);
 const box=$("cityResults");box.innerHTML="";for(const c of pool){const btn=document.createElement("button");const ref=100*c.flavio26/c.valid26;btn.textContent=c.name+" · "+c.uf+" — Flávio "+pf(ref);btn.onclick=()=>showCity(c);box.appendChild(btn);}
 if(!pool.length)box.textContent="Nenhuma cidade encontrada.";
}
function makeStateRows(states){
 let src=Object.fromEntries((states||[]).map(x=>[x.geo,x]));
 let count=0;
 const rows=UFS.map(uf=>{
  const old=firstByUf[uf],data=src[uf],has=data?.sectionsCounted>0&&data?.validVotes>0;
  if(has)count++;
  const baseline=old.flavio/(old.flavio+old.lula)*100;
  const pct=has?data.flavioShare:null;
  const delta=has?pct-baseline:null;
  return '<tr><td><strong>'+uf+'</strong></td><td>'+(has?pf(data.sectionsPct):"—")+'</td><td>'+(has?nfmt(data.validVotes):"—")+'</td><td class="blue">'+(has?pf(pct):"—")+'</td><td>'+pf(baseline)+'</td><td class="'+(delta>=0?"green":"red")+'">'+pp(delta)+'</td></tr>';
 }).join("");
 $("stateRows").innerHTML=rows;
 set("statesReady",count+" / 27");
 return count;
}

function runElectionModel(){
 if(!window.ElectionEngine||!cities.length)return {ready:false,models:{},diagnostics:{},pct:null};
 const baseline=cities.map(c=>({id:c.code,uf:c.uf,validFirst:c.valid26,aFirst:c.flavio26,bFirst:c.lula26}));
 return window.ElectionEngine.estimate({cities:baseline,observed:citySamples,states:current?.states||[],national:current?.national||null});
}
function calcStateForecast(states,analysis){
 const m=Object.fromEntries((states||[]).filter(s=>s.validVotes>0).map(s=>[s.geo,s]));
 const available=UFS.filter(uf=>m[uf]);
 if(available.length<12)return null;
 const shift=(analysis?.diagnostics?.globalTransferPp||0)/100;
 let sum=0,den=0;
 for(const uf of UFS){
  const s=m[uf],ref=firstByUf[uf],w=ref.valid;
  const q=ref.flavio/(ref.flavio+ref.lula);
  if(!Number.isFinite(q)||w<=0)continue;
  const estimate=s?s.flavioShare/100:clamp(q+shift);
  sum+=w*estimate;den+=w;
 }
 return den>0?100*sum/den:null;
}
function calcMunicipalForecast(){
 const fit=runElectionModel();
 const d=fit.diagnostics||{},b=fit.models||{};
 return {pct:fit.ready?b.national:null,combined:fit.ready?fit.pct:null,
  fit,num:d.observedCities||0,ufs:d.observedStates||0,delta:d.globalTransferPp,
  geographicBias:d.geographicBiasIndex,alpha:d.stratifiedWeight};
}
function renderEngineModel(m,stateP){
 const d=m.fit?.diagnostics||{};
 const fmtStat=x=>Number.isFinite(x)?pf(x):"—";
 const ready=Number.isFinite(m.combined);
 set("kc",ready?pf(m.combined):"—");
 set("kcdet",ready?"Estimativa territorial · não oficial":"Aguardando amostra municipal");
 set("modelCoverage",nfmt(m.num)+" cidades / "+m.ufs+" UFs");
 set("geoBias",Number.isFinite(d.geographicBiasIndex)?pf(100*d.geographicBiasIndex)+" de concentração territorial":"—");
 set("transfer",Number.isFinite(d.globalTransferPp)?pp(d.globalTransferPp)+" na amostra":"—");
 const range=d.scenario;
 set("modelRange",ready&&range?pf(range.min)+" – "+pf(range.max):"—");
 if(!ready) set("quality","Dados insuficientes");
 else if(d.hasConflict)set("quality","<50% e >50% nos modelos: divergência");
 else if(d.geographicBiasIndex>.3)set("quality","Amostra regional concentrada");
 else if(m.ufs<23)set("quality","Cobertura estadual incompleta");
 else set("quality","Modelos convergentes*");
 set("sensitivity",ready&&range?pf(range.min)+" – "+pf(range.max):"—");
 renderVictory(m.fit);
 // Keep side diagnostics consistent with the headline rather than using an arbitrary +/-3pp range.
 set("km",fmtStat(m.pct));
 set("kmdet",Number.isFinite(m.pct)?"Desvio: "+pp(m.delta):"Em coleta · "+m.num+" municípios");
 set("kp",fmtStat(stateP));
 set("kpdet",Number.isFinite(stateP)?"Projeção por estado":"Aguardando 12 UFs");
 lastNationalShadowBaseline=ready?m.combined:null;
 renderShadowComparison(false);
}



function victoryReading(o,l){
 const valid=!!o?.ready,prob=l?.ready&&Number.isFinite(l?.probability)?l.probability:null;
 return {
  t1:valid&&Number.isFinite(o.thresholds.one)?o.thresholds.one:null,
  t300:valid&&Number.isFinite(o.thresholds.threeHundredThousand)?o.thresholds.threeHundredThousand:null,
  t99:valid&&Number.isFinite(o.thresholds.ninetyNine)?o.thresholds.ninetyNine:null,
  prob,margin:valid&&Number.isFinite(o.projectedMargin)?o.projectedMargin:null,
  chanceVersion:prob!=null?"geo-live-1.2":null,chancePhase:l?.phase||null
 };
}
function renderVictory(fit){
 const official=current?.national,hasVotes=official?.validVotes>0&&official?.sectionsCounted>0;
 latestOutlook=hasVotes&&window.ElectionEngine?.victoryOutlook?
  window.ElectionEngine.victoryOutlook({forecast:fit,national:official,validation:calibration}):null;
 latestChance=hasVotes&&window.ElectionEngine?.liveVictoryChance?
  window.ElectionEngine.liveVictoryChance({national:official,states:current?.states||[],
   referenceByUf:firstByUf,scenario5:odds5Report,forecast:fit,validation:calibration}):null;
 const o=latestOutlook,l=latestChance,prob=l?.ready?l.probability:null;
 set("winChance",Number.isFinite(prob)?pf(prob):"—");
 set("winChanceSub",l?.ready?(l.phase==="official"?"Resultado concluído":"Estimativa experimental · não calibrada"):
  l?.phase==="insufficient"?"Aguardando dados municipais":
  l?.phase==="outside"?"Fora da faixa estudada":"Aguardando 5% das seções");
 set("winPhase",l?.ready?l.method:"Aguardando cobertura");
 set("winRange",l?.range?.length===2?pf(l.range[0])+" – "+pf(l.range[1]):"—");
 set("winGeography",Number.isFinite(l?.geoBiasPp)&&Number.isFinite(l?.ufCoveragePct)?
  pp(l.geoBiasPp)+" · "+pf(l.ufCoveragePct)+" de cobertura":
  "Dados regionais ainda insuficientes");
 set("projectedMargin",Number.isFinite(o?.projectedMargin)&&o.ready?
  (o.projectedMargin>=0?"+":"")+nfmt(o.projectedMargin):"—");
 set("projectedMarginSub",o?.ready?"Votos de vantagem previstos":"Aguardando projeção territorial");
 const showThreshold=x=>!Number.isFinite(x)?"—":x<0?"≤ 0%":x>100?"> 100%":pf(x);
 set("oneVoteNow",showThreshold(o?.thresholds?.one));
 set("threeHundredNow",showThreshold(o?.thresholds?.threeHundredThousand));
 set("nearCertainNow",showThreshold(o?.thresholds?.ninetyNine));
 set("victoryAssumption",o?.ready&&!Number.isFinite(o.remainingShare)?"Resultado oficial concluído":
  o?.ready?"Faltam aproximadamente "+nfmt(Math.max(0,o.estimatedTotal-official.validVotes))+" votos · Flávio nos restantes: "+pf(100*o.remainingShare):
  "Margem em votos disponível com projeção territorial.");
 const reading=liveReadings.findLast(r=>r.v===official?.validVotes);
 if(reading&&hasVotes){
  Object.assign(reading,victoryReading(o,l));
  if(Number.isFinite(fit?.pct))reading.h=fit.pct;
  saveReadings();drawLive();drawProbability();
 }
}
function drawProbability(){
 const el=$("winProbabilityChart");if(!el)return;const {ctx,w,h}=canvas(el);
 const p={l:43,r:18,t:18,b:40},dx=w-p.l-p.r,dy=h-p.t-p.b;
 const x=s=>p.l+Math.max(0,Math.min(100,s))/100*dx;
 const y=v=>p.t+(100-v)/100*dy;
 ctx.strokeStyle="#304056";ctx.font="11px sans-serif";ctx.lineWidth=1;
 for(let i=0;i<=4;i++){
  const pct=i*25,Y=y(pct);ctx.beginPath();ctx.moveTo(p.l,Y);ctx.lineTo(w-p.r,Y);ctx.stroke();
  ctx.fillStyle="#9fb0c6";ctx.textAlign="right";ctx.fillText(pct+"%",p.l-6,Y+4);
 }
 for(const pct of [0,5,25,50,75,100]){
  const X=x(pct);ctx.fillStyle="#9fb0c6";ctx.textAlign="center";
  ctx.fillText(pct+"%",X,h-p.b+17);
 }
 ctx.strokeStyle="#657586";ctx.setLineDash([4,5]);ctx.beginPath();
 ctx.moveTo(p.l,y(50));ctx.lineTo(w-p.r,y(50));ctx.stroke();ctx.setLineDash([]);
 const rows=liveReadings.filter(r=>r.chanceVersion==="geo-live-1.2"&&
  Number.isFinite(r.sec)&&r.sec>=5&&Number.isFinite(r.prob)).sort((a,b)=>a.sec-b.sec||a.v-b.v);
 if(!rows.length){
  ctx.textAlign="center";ctx.fillStyle="#b6c7dc";
  ctx.fillText("Aguardando 5% das seções e dados oficiais para o cenário.",p.l+dx/2,p.t+dy/2);
 }else{
  ctx.beginPath();ctx.strokeStyle="#f4c879";ctx.lineWidth=2.8;
  rows.forEach((r,i)=>{if(i===0)ctx.moveTo(x(r.sec),y(r.prob));else ctx.lineTo(x(r.sec),y(r.prob));});ctx.stroke();
  const last=rows.at(-1);ctx.fillStyle="#f4c879";ctx.beginPath();ctx.arc(x(last.sec),y(last.prob),4,0,2*Math.PI);ctx.fill();
 }
 ctx.fillStyle="#9fb0c6";ctx.textAlign="center";ctx.font="11px sans-serif";
 ctx.fillText("Seções oficialmente totalizadas",p.l+dx/2,h-7);
}

function updateLiveUI(j){
 const nt=j.national,started=nt?.validVotes>0&&nt.sectionsCounted>0;
 $("apiDot").classList.toggle("active",started);
 set("apiText",started?"TSE · apuração iniciada":"TSE · aguardando 2º turno");
 set("lastSource",nt?.generatedAt||"—");set("lastUpdate",new Date().toLocaleTimeString("pt-BR"));
 set("sections",started?pf(nt.sectionsPct):"—");set("votesvalid",started?nfmt(nt.validVotes):"—");
 const ready=makeStateRows(j.states);
 const sample=Object.values(citySamples).filter(s=>s.validVotes>0&&s.sectionsCounted>0).length;
 set("citiesReady",nfmt(sample)+" coletadas");
 if(!started){latestOutlook=null;latestChance=null;renderVictory(null);set("sensitivity","—");
  ["kf","kl","kp","km","kc"].forEach(id=>set(id,"—"));set("quality","Sem votos");set("modelCoverage","—");set("geoBias","—");set("transfer","—");set("modelRange","—");
  set("kfdet","Totalização ainda não iniciada");set("kldet","Totalização ainda não iniciada");
  set("kpdet","Aguardando parciais de pelo menos 24 estados");set("kmdet","Aguardando amostragem de municípios");
  updateNotice("Aguardando apuração do 2º turno no TSE.");
  drawLive();return;
 }
 set("kf",pf(nt.flavioShare));set("kl",pf(nt.lulaShare));
 set("kfdet",nfmt(nt.flavioVotes)+" votos oficiais");set("kldet",nfmt(nt.lulaVotes)+" votos oficiais");
 const model=calcMunicipalForecast();
 const stateP=calcStateForecast(j.states,model.fit);
 renderEngineModel(model,stateP);
 if(j.failures?.length)updateNotice("Atualização parcial: "+j.failures.length+" UFs temporariamente indisponíveis. A projeção pode estar suspensa.",true);
 else updateNotice("TSE em apuração · projeções experimentais.");
 const last=liveReadings.at(-1),v=nt.validVotes;
 if(!last||last.v!==v||last.f!==nt.flavioShare){liveReadings.push({v,f:nt.flavioShare,p:stateP,h:model.combined,sec:nt.sectionsPct,at:new Date().toISOString(),...victoryReading(latestOutlook,latestChance)});liveReadings=liveReadings.slice(-700);saveReadings();}
 drawLive();drawProbability();updateSensitivity();if(selectedCity)fetchSelectedCity(selectedCity);
}

function drawLive(){
 const el=$("liveChart");if(!el)return;const {ctx,w,h}=canvas(el);
 const pad={l:w<530?43:55,r:16,t:22,b:54},xs=w-pad.l-pad.r,ys=h-pad.t-pad.b;
 ctx.font="11px sans-serif";ctx.fillStyle="#9fb0c6";
 const readings=liveReadings.filter(r=>Number.isFinite(r.sec)&&r.sec>0&&Number.isFinite(r.f)).sort((a,b)=>a.sec-b.sec||a.v-b.v);
 if(!readings.length){ctx.fillText("Aguardando dados oficiais do segundo turno.",25,h/2);return;}
 const series=[
  {key:"f",color:"#58a6fa",width:3.2},
  {key:"t1",color:"#8d9ead",width:2},
  {key:"t300",color:"#f0a45f",width:2.4},
  {key:"t99",color:"#5ad9b2",width:2.7,dash:[6,4]},
  {key:"h",color:"#f4c879",width:2,dash:[2,5]}
 ];
 const shown=readings.flatMap(r=>series.map(s=>r[s.key]).filter(v=>Number.isFinite(v)&&v>=0&&v<=100));
 let min=Math.max(0,Math.min(47,...shown)-2),max=Math.min(100,Math.max(53,...shown)+2);
 if(max-min<9){min=Math.max(0,min-4);max=Math.min(100,max+4);}
 const x=sec=>pad.l+Math.max(0,Math.min(100,sec))/100*xs;
 const y=v=>pad.t+(max-v)/(max-min)*ys;
 ctx.strokeStyle="#304056";ctx.lineWidth=1;ctx.setLineDash([]);
 for(let i=0;i<=4;i++){
  const value=min+(max-min)*i/4,Y=y(value);
  ctx.beginPath();ctx.moveTo(pad.l,Y);ctx.lineTo(w-pad.r,Y);ctx.stroke();
  ctx.fillStyle="#9fb0c6";ctx.textAlign="right";ctx.fillText(value.toFixed(1).replace(".",",")+"%",pad.l-7,Y+4);
 }
 for(const pct of [0,25,50,75,100]){
  const X=x(pct);ctx.strokeStyle="#243349";ctx.beginPath();ctx.moveTo(X,pad.t);ctx.lineTo(X,h-pad.b);ctx.stroke();
  ctx.fillStyle="#9fb0c6";ctx.textAlign="center";ctx.fillText(pct+"%",X,h-pad.b+18);
 }
 // 50% is a reference for final vote share, not a win threshold for a biased partial.
 if(min<=50&&max>=50){ctx.strokeStyle="#5a6575";ctx.setLineDash([3,6]);ctx.beginPath();ctx.moveTo(pad.l,y(50));ctx.lineTo(w-pad.r,y(50));ctx.stroke();ctx.setLineDash([]);}
 for(const s of series){
  ctx.strokeStyle=s.color;ctx.lineWidth=s.width;ctx.setLineDash(s.dash||[]);
  ctx.beginPath();let connected=false,points=0;
  for(const r of readings){
   const value=r[s.key];if(!Number.isFinite(value)||value<min||value>max){connected=false;continue;}
   connected?ctx.lineTo(x(r.sec),y(value)):ctx.moveTo(x(r.sec),y(value));
   connected=true;points++;
  }
  if(points>0){
   ctx.stroke();
   const lastPoint=[...readings].reverse().find(r=>Number.isFinite(r[s.key])&&r[s.key]>=min&&r[s.key]<=max);
   if(lastPoint){ctx.setLineDash([]);ctx.fillStyle=s.color;ctx.beginPath();ctx.arc(x(lastPoint.sec),y(lastPoint[s.key]),3,0,2*Math.PI);ctx.fill();}
  }
 }
 ctx.setLineDash([]);ctx.fillStyle="#b8c7d8";ctx.textAlign="center";ctx.font="11px sans-serif";
 ctx.fillText("Seções apuradas · evolução em %",pad.l+xs/2,h-10);
 const last=readings.at(-1);ctx.fillStyle="#58a6fa";ctx.beginPath();ctx.arc(x(last.sec),y(last.f),3.5,0,2*Math.PI);ctx.fill();
 ctx.textAlign="left";
}

async function pollCities(){
 if(batchBusy||!sampleOrder.length||!current?.national?.sectionsCounted)return;
 batchBusy=true;
 try{
  let picks=[];for(let z=0;z<16;z++){picks.push(sampleOrder[(nextIndex+z)%sampleOrder.length]);}nextIndex=(nextIndex+16)%sampleOrder.length;
  const items=picks.map(c=>c.uf+":"+c.code).join(",");
  const response=await fetch("/api/tse?mode=batch&items="+encodeURIComponent(items),{cache:"no-store"});
  if(!response.ok)throw Error("Lote TSE indisponível");
  const data=await response.json();
  for(const r of data.results||[]){if(r.data?.sectionsCounted>0&&r.data.validVotes>0){const id=r.key.split(":")[1];citySamples[id]=r.data;}}
  set("citiesReady",nfmt(Object.keys(citySamples).length)+" coletadas");
  updateMunicipalMetric();
  if(selectedCity&&citySamples[selectedCity.code])showCitySilent(selectedCity);
 }catch(e){console.warn("Coleta municipal parcial:",e?.message||e);}finally{batchBusy=false;}
}

// Shared, read-only archive: the authorization token never leaves the server.
function fromArchive(row){
 const v=Number(row.valid_votes)||0;
 return {
  geo:row.scope==="UF"?"UF:"+row.uf:row.scope==="BR"?"BR":("MUN:"+row.uf+":"+row.city_code),
  sectionsCounted:+row.sections_counted||0,sectionsTotal:+row.sections_total||0,
  sectionsPct:(+row.sections_total)>0?100*(+row.sections_counted)/(+row.sections_total):0,
  validVotes:v,flavioVotes:+row.flavio_votes||0,lulaVotes:+row.lula_votes||0,
  flavioShare:v?100*(+row.flavio_votes)/v:null,lulaShare:v?100*(+row.lula_votes)/v:null,
  generatedAt:row.tse_generated_at||""
 };
}
async function archived(path){
 const r=await fetch("/api/archive?"+path,{cache:"no-store"});
 if(!r.ok)throw Error("Arquivo central HTTP "+r.status);
 const j=await r.json();if(!j.ok)throw Error(j.error||"Arquivo central indisponível");return j;
}
function updateSensitivity(){
 if(!current?.national?.sectionsCounted){set("sensitivity","—");return;}
 const m=calcMunicipalForecast();renderEngineModel(m,calcStateForecast(current.states,m.fit));
}
async function syncArchive(){
 if(archiveBusy||!cities.length)return;
 archiveBusy=true;
 try{
  const status=await archived("mode=status");
  archiveReady=true;
  const cs=status.collector||{};
  const last=cs.last_success||cs.last_run;
  set("archiveStatus","Histórico central: "+(last?"gravando resultados":"conectado"));
  set("archiveLatest",last?new Date(last).toLocaleString("pt-BR"):"Ainda não iniciou");
  if(status.national?.valid_votes>0){
    const hist=await archived("mode=national_history");
    const localByVotes=new Map(liveReadings.map(r=>[r.v,r]));
    const fromDB=(hist.rows||[]).map(r=>{
      const v=+r.valid_votes;
      return {...(localByVotes.get(v)||{}),v,f:100*r.flavio_votes/v,
       sec:r.sections_total?100*r.sections_counted/r.sections_total:0,
       at:r.captured_at,source:r.generation_id};
    }).filter(r=>Number.isFinite(r.f));
    if(fromDB.length){
      // Preserve the analysis saved for the same official vote count. Never backfill
      // historical thresholds using information from a later snapshot.
      const all=new Map(liveReadings.map(r=>[r.v,r]));
      fromDB.forEach(r=>all.set(r.v,r));
      liveReadings=[...all.values()].sort((x,y)=>new Date(x.at)-new Date(y.at)).slice(-700);
      saveReadings();drawLive();drawProbability();
    }
    let offset=0;const pageSize=1000;
    // At most six pages, enough for all 5,570 municipalities.
    for(let i=0;i<6;i++){
      const page=await archived("mode=latest&scope=MUN&offset="+offset+"&limit="+pageSize);
      const rows=page.rows||[];
      for(const row of rows) {
       if(row.uf&&row.city_code&&row.valid_votes>0&&row.sections_counted>0){
        const id=String(row.city_code).padStart(5,"0");
        if(cityByCode[id])citySamples[id]=fromArchive(row);
       }
      }
      offset+=rows.length;if(rows.length<pageSize)break;
    }
    set("citiesReady",nfmt(Object.keys(citySamples).length)+" cadastradas");
    updateMunicipalMetric();updateSensitivity();
    if(selectedCity&&citySamples[selectedCity.code])showCitySilent(selectedCity);
  }
  lastArchiveSync=Date.now();
 }catch(e){
  archiveReady=false;
  set("archiveStatus","Histórico central: indisponível");
  console.warn("Archive sync failed:",e?.message||e);
 }finally{archiveBusy=false;}
}

function updateMunicipalMetric(){
 if(!current?.national?.sectionsCounted)return;
 const m=calcMunicipalForecast();renderEngineModel(m,calcStateForecast(current.states,m.fit));
}
async function refresh(){
 if(refreshBusy)return;refreshBusy=true;set("refreshClock","Buscando dados...");
 try{
  const r=await fetch("/api/tse?mode=overview",{cache:"no-store"});
  if(!r.ok)throw Error("HTTP "+r.status);
  const j=await r.json();if(!j.ok)throw Error(j.error||"Retorno do TSE inválido");
  current=j;updateLiveUI(j);
  renderShadowComparison(true);
  if(j.national.sectionsCounted>0){if(!archiveReady)pollCities();if(Date.now()-lastArchiveSync>45000)syncArchive();}
 }catch(e){$("apiDot").classList.remove("active");set("apiText","Última leitura indisponível");updateNotice("Não foi possível consultar o TSE agora: "+String(e.message||e)+". Mantendo os últimos números recebidos, sem substituí-los por zeros.",true);}
 finally{refreshBusy=false;clock=30;set("refreshClock","Atualização: "+clock+" s");}
}
async function init(){
 document.querySelectorAll(".tab").forEach(b=>b.addEventListener("click",()=>changeView(b.dataset.view)));
 document.querySelectorAll("[data-method-link]").forEach(a=>a.addEventListener("click",e=>{e.preventDefault();changeView("methods");window.scrollTo({top:0,behavior:"smooth"});}));
 $("refreshBtn").addEventListener("click",()=>refresh());
 $("metroSelect").addEventListener("change",()=>{renderMetroZones();loadMetroZones();});
 $("zoneRefreshBtn").addEventListener("click",()=>loadMetroZones(true));
 $("zoneHistoricalCoverage").addEventListener("change",renderHistoricalZoneStudy);
 $("metroWinnerDetails").addEventListener("click",()=>changeView("zones"));
 $("shadowExportCsv").addEventListener("click",exportShadowCsv);
 $("zoneCandidateFilter").addEventListener("change",renderMetroZones);
 $("zoneTurnoutAssumption").addEventListener("input",renderMetroZones);
 $("zoneOtherParticipation").addEventListener("input",renderMetroZones);
 $("ufFilter").addEventListener("change",renderCityResults);$("citySearch").addEventListener("input",renderCityResults);
 window.addEventListener("resize",()=>{drawLive();drawProbability();if(results22.length)drawReplay();drawEarlyStudy();drawOdds5();});
 try{
  const [a,b,v,t,o,met,zh]=await Promise.all([fetch("/data/reference.json"),fetch("/data/replay2022.json"),fetch("/data/model-validation.json").catch(()=>null),fetch("/data/early-count-5pct.json").catch(()=>null),fetch("/data/odds-5pct-2026.json").catch(()=>null),fetch("/data/metros-2026.json").catch(()=>null),fetch("/data/historical-zone-backtest-2014-2018-2022.json").catch(()=>null)]);
   calibration=v?.ok?await v.json():null;
   earlyReport=t?.ok?await t.json():null;
   odds5Report=o?.ok?await o.json():null;
   setMetroCities(met?.ok?await met.json():null);
   historicalZoneStudy=zh?.ok?await zh.json():null;
   renderHistoricalZoneStudy();renderMetroWinner();renderShadowComparison(false);if(!a.ok||!b.ok)throw Error("Base municipal indisponível: "+a.status+"/"+b.status);
  reference=await a.json();replay=await b.json();if(Object.keys(reference.cities||{}).length<5500||replay.stages?.length!==4)throw Error("A base municipal está incompleta.");
  initRecords();replayInit();renderCityResults();makeStateRows([]);initOdds5();renderEarlyStudy();renderOdds5();
  set("apiText","Bases carregadas • consultando TSE");
  await syncArchive();await refresh();
  backgroundMetroRefresh();
 }catch(e){updateNotice("Erro ao carregar base eleitoral: "+String(e.message||e),true);set("apiText","Dados históricos indisponíveis");}
 setInterval(()=>{clock=Math.max(0,clock-1);set("refreshClock",clock+" s para atualização");if(clock===0)refresh();},1000);setInterval(()=>{if(reference&&Date.now()-lastArchiveSync>60000)syncArchive();},60000);
 setInterval(()=>{if($("view-zones")&&!$("view-zones").classList.contains("hide"))loadMetroZones();},30000);
 setInterval(()=>{if(reference&&!zoneBusy)backgroundMetroRefresh();},8000);
}
init();
