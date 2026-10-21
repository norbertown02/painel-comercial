
"use strict";
const $=id=>document.getElementById(id);
const nfmt=x=>new Intl.NumberFormat("pt-BR").format(Math.round(Number(x)||0));
const pf=x=>Number.isFinite(x)?x.toFixed(2).replace(".",",")+"%":"—";
const pp=x=>Number.isFinite(x)?(x>=0?"+":"")+x.toFixed(2).replace(".",",")+" p.p.":"—";
const clamp=(x,a=0.001,b=0.999)=>Math.max(a,Math.min(b,x));
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const UFS="AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO".split(" ");
let calibration=null,latestOutlook=null;
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
function changeView(view){
 document.querySelectorAll(".view").forEach(el=>el.classList.toggle("hide",el.id!=="view-"+view));
 document.querySelectorAll(".tab").forEach(el=>el.classList.toggle("on",el.dataset.view===view));
 if(view==="replay")drawReplay();if(view==="overview")drawLive();if(view==="cities")renderCityResults();
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
 set("kcdet",ready?"Estimativa experimental: municípios + estratos estaduais; não é resultado oficial":"Aguardando 40 municípios de pelo menos 12 estados");
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
 set("kmdet",Number.isFinite(m.pct)?"Transferência nacional estimada "+pp(m.delta)+" · experimental":"Em coleta: "+m.num+" municípios em "+m.ufs+" UFs");
 set("kp",fmtStat(stateP));
 set("kpdet",Number.isFinite(stateP)?"Parciais oficiais estaduais ponderadas pelo primeiro turno; UFs faltantes estimadas":"Aguardando dados oficiais em 12 estados");
}


function victoryReading(o){
 if(!o?.ready)return {t1:null,t300:null,t99:null,prob:null,margin:null};
 return {
  t1:Number.isFinite(o.thresholds.one)?o.thresholds.one:null,
  t300:Number.isFinite(o.thresholds.threeHundredThousand)?o.thresholds.threeHundredThousand:null,
  t99:Number.isFinite(o.thresholds.ninetyNine)?o.thresholds.ninetyNine:null,
  prob:Number.isFinite(o.probability)?o.probability:null,
  margin:Number.isFinite(o.projectedMargin)?o.projectedMargin:null
 };
}
function renderVictory(fit){
 const official=current?.national,hasVotes=official?.validVotes>0&&official?.sectionsCounted>0;
 latestOutlook=hasVotes&&window.ElectionEngine?.victoryOutlook?
  window.ElectionEngine.victoryOutlook({forecast:fit,national:official,validation:calibration}):null;
 const o=latestOutlook,prob=o?.probability;
 set("winChance",Number.isFinite(prob)?pf(prob):"—");
 set("winChanceSub",o?.note||"Aguardando apuração e cobertura territorial");
 set("projectedMargin",Number.isFinite(o?.projectedMargin)&&o.ready?
  (o.projectedMargin>=0?"+":"")+nfmt(o.projectedMargin):"—");
 set("projectedMarginSub",o?.ready?"Margem prevista de Flávio contra Lula • votos, não percentual":"Sem projeção de margem válida");
 set("oneVoteNow",Number.isFinite(o?.thresholds?.one)?pf(o.thresholds.one):"—");
 set("threeHundredNow",Number.isFinite(o?.thresholds?.threeHundredThousand)?pf(o.thresholds.threeHundredThousand):"—");
 set("nearCertainNow",Number.isFinite(o?.thresholds?.ninetyNine)?pf(o.thresholds.ninetyNine):"—");
 set("victoryAssumption",o?.ready&&!Number.isFinite(o.remainingShare)?"Resultado oficial concluído":
  o?.ready?"Total estimado: "+nfmt(o.estimatedTotal)+" votos válidos; votos restantes: "+nfmt(Math.max(0,o.estimatedTotal-official.validVotes))+"; restante projetado de Flávio: "+pf(100*o.remainingShare):
  "Aguardando modelo municipal e votos oficiais.");
 const reading=liveReadings.findLast(r=>r.v===official?.validVotes);
 if(reading&&o?.ready){
  Object.assign(reading,victoryReading(o));
  if(Number.isFinite(fit?.pct))reading.h=fit.pct;
  saveReadings();drawLive();
 }
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
 if(!started){latestOutlook=null;renderVictory(null);set("sensitivity","—");
  ["kf","kl","kp","km","kc"].forEach(id=>set(id,"—"));set("quality","Sem votos");set("modelCoverage","—");set("geoBias","—");set("transfer","—");set("modelRange","—");
  set("kfdet","Totalização ainda não iniciada");set("kldet","Totalização ainda não iniciada");
  set("kpdet","Aguardando parciais de pelo menos 24 estados");set("kmdet","Aguardando amostragem de municípios");
  updateNotice("Pré-eleição: os resultados municipais do 1º turno estão disponíveis para consulta. O 2º turno ainda não tem votos totalizados no TSE.");
  drawLive();return;
 }
 set("kf",pf(nt.flavioShare));set("kl",pf(nt.lulaShare));
 set("kfdet",nfmt(nt.flavioVotes)+" votos oficiais");set("kldet",nfmt(nt.lulaVotes)+" votos oficiais");
 const model=calcMunicipalForecast();
 const stateP=calcStateForecast(j.states,model.fit);
 renderEngineModel(model,stateP);
 if(j.failures?.length)updateNotice("Atualização parcial: "+j.failures.length+" UFs temporariamente indisponíveis. A projeção pode estar suspensa.",true);
 else updateNotice("Apuração oficial em andamento. As projeções são experimentais, não constituem resultado oficial ou probabilidade de vitória.");
 const last=liveReadings.at(-1),v=nt.validVotes;
 if(!last||last.v!==v||last.f!==nt.flavioShare){liveReadings.push({v,f:nt.flavioShare,p:stateP,h:model.combined,sec:nt.sectionsPct,at:new Date().toISOString(),...victoryReading(latestOutlook)});liveReadings=liveReadings.slice(-700);saveReadings();}
 drawLive();updateSensitivity();if(selectedCity)fetchSelectedCity(selectedCity);
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
  if(points>0)ctx.stroke();
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
      saveReadings();drawLive();
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
  if(j.national.sectionsCounted>0){if(!archiveReady)pollCities();if(Date.now()-lastArchiveSync>45000)syncArchive();}
 }catch(e){$("apiDot").classList.remove("active");set("apiText","Última leitura indisponível");updateNotice("Não foi possível consultar o TSE agora: "+String(e.message||e)+". Mantendo os últimos números recebidos, sem substituí-los por zeros.",true);}
 finally{refreshBusy=false;clock=30;set("refreshClock","Atualização: "+clock+" s");}
}
async function init(){
 document.querySelectorAll(".tab").forEach(b=>b.addEventListener("click",()=>changeView(b.dataset.view)));
 $("refreshBtn").addEventListener("click",()=>refresh());
 $("ufFilter").addEventListener("change",renderCityResults);$("citySearch").addEventListener("input",renderCityResults);
 window.addEventListener("resize",()=>{drawLive();if(results22.length)drawReplay();});
 try{
  const [a,b,v]=await Promise.all([fetch("/data/reference.json"),fetch("/data/replay2022.json"),fetch("/data/model-validation.json").catch(()=>null)]);
   calibration=v?.ok?await v.json():null;if(!a.ok||!b.ok)throw Error("Base municipal indisponível: "+a.status+"/"+b.status);
  reference=await a.json();replay=await b.json();if(Object.keys(reference.cities||{}).length<5500||replay.stages?.length!==4)throw Error("A base municipal está incompleta.");
  initRecords();replayInit();renderCityResults();makeStateRows([]);
  set("apiText","Bases carregadas • consultando TSE");
  await syncArchive();await refresh();
 }catch(e){updateNotice("Erro ao carregar base eleitoral: "+String(e.message||e),true);set("apiText","Dados históricos indisponíveis");}
 setInterval(()=>{clock=Math.max(0,clock-1);set("refreshClock",clock+" s para atualização");if(clock===0)refresh();},1000);setInterval(()=>{if(reference&&Date.now()-lastArchiveSync>60000)syncArchive();},60000);
}
init();
