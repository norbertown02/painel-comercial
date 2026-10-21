(()=>{
"use strict";
let pack=null,style="regional_bias",step=1;
const el=id=>document.getElementById(id);
const fmt=x=>Number(x).toFixed(2).replace(".",",")+"%";
const diff=x=>(x>=0?"+":"")+Number(x).toFixed(2).replace(".",",")+" p.p.";
const er=(x,y)=>Math.abs(x-y).toFixed(2).replace(".",",")+" p.p.";
const integer=x=>new Intl.NumberFormat("pt-BR").format(x);
const pick=()=>pack?.meta?.scenarios?.[style]||[];
function render(){
 if(!pack)return;const p=pick()[step],truth=pack.meta.trueP;
 el("biased2014").classList.toggle("on",style==="regional_bias");
 el("balanced2014").classList.toggle("on",style==="balanced");
 [...el("stage14").children].forEach((b,i)=>b.classList.toggle("on",i===step));
 el("pct14raw").textContent=fmt(p.raw);
 el("pct14state").textContent=fmt(p.state);
 el("pct14mun").textContent=fmt(p.municipal);
 el("error14state").textContent="Erro: "+er(p.state,truth);
 el("error14mun").textContent="Erro: "+er(p.municipal,truth);
 el("error14raw").textContent=er(p.raw,truth);
 el("num14").textContent=integer(p.cityCount)+" / 5.570";
 el("coverage14").textContent=fmt(p.observedFinal);
 el("states14").textContent=p.ufCount+" / 27";
 el("swing14").textContent=diff(p.shift);
 draw();
}
function draw(){
 if(!pack||el("view-replay14").classList.contains("hide"))return;
 const c=el("chart2014"),r=c.getBoundingClientRect(),w=r.width||640,h=r.height||300;
 const dpr=Math.min(2,window.devicePixelRatio||1);
 c.width=Math.round(w*dpr);c.height=Math.round(h*dpr);
 const ctx=c.getContext("2d");ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,h);
 const data=pick(),truth=pack.meta.trueP, values=data.flatMap(x=>[x.raw,x.state,x.municipal]);
 let low=Math.floor(Math.min(truth,...values)-2),high=Math.ceil(Math.max(truth,...values)+2);
 const p={l:45,r:15,t:18,b:41},ww=w-p.l-p.r,hh=h-p.t-p.b;
 const yy=v=>p.t+(high-v)*hh/(high-low),xx=i=>p.l+i*ww/3;
 ctx.font="11px system-ui";ctx.strokeStyle="#354459";ctx.lineWidth=1;ctx.fillStyle="#adbdd0";
 for(let i=0;i<5;i++){const z=low+(high-low)*i/4,y=yy(z);ctx.beginPath();ctx.moveTo(p.l,y);ctx.lineTo(w-p.r,y);ctx.stroke();ctx.fillText(z.toFixed(1)+"%",3,y+3);}
 ctx.strokeStyle="#b7c6d9";ctx.setLineDash([5,5]);ctx.beginPath();ctx.moveTo(p.l,yy(truth));ctx.lineTo(w-p.r,yy(truth));ctx.stroke();ctx.setLineDash([]);
 const path=(key,color)=>{ctx.strokeStyle=color;ctx.lineWidth=2.6;ctx.beginPath();data.forEach((r,i)=>{if(i===0)ctx.moveTo(xx(i),yy(r[key]));else ctx.lineTo(xx(i),yy(r[key]));});ctx.stroke();ctx.fillStyle=color;data.forEach((r,i)=>{ctx.beginPath();ctx.arc(xx(i),yy(r[key]),3.7,0,2*Math.PI);ctx.fill()});};
 path("raw","#58a6fa");path("state","#f4c879");path("municipal","#5ad9b2");
 ctx.fillStyle="#adbdd0";ctx.textAlign="center";["5%","10%","20%","50%"].forEach((t,i)=>ctx.fillText(t,xx(i),h-11));ctx.textAlign="left";
}
function prepare(){
 const m=pack.meta,dist=m.distributions;
 const rows=[["balanced","Ordem equilibrada"],["regional_bias","Sul/Sudeste primeiro"]];
 el("trials14").innerHTML=rows.map(([name,label])=>{const v=dist[name];return '<tr><td>'+label+'</td><td>'+fmt(v.meanCoverage)+'</td><td>'+diff(v.maeRaw).replace("+","")+'</td><td>'+diff(v.maeState).replace("+","")+'</td><td>'+diff(v.maeMunicipal).replace("+","")+'</td><td>'+integer(v.correctMunicipal)+' / '+integer(v.replications)+'</td></tr>';}).join("");
 const wanted=[["SP","SÃO PAULO"],["MG","BELO HORIZONTE"],["RJ","RIO DE JANEIRO"],["PR","CURITIBA"],["BA","SALVADOR"],["PE","RECIFE"],["CE","FORTALEZA"],["AM","MANAUS"]];
 const examples=wanted.map(([uf,city])=>pack.rows.find(x=>x[0]===uf&&x[2]===city)).filter(Boolean);
 el("cities14").innerHTML=examples.map(x=>{const p=100*x[4]/(x[4]+x[5]),q=100*x[6]/(x[6]+x[7]);return '<tr><td>'+x[2]+' ('+x[0]+')</td><td>'+fmt(p)+'</td><td>'+fmt(q)+'</td><td>'+diff(q-p)+'</td></tr>';}).join("");
 for(const [idx,t] of ["5%","10%","20%","50%"].entries()){const b=document.createElement("button");b.textContent=t;b.addEventListener("click",()=>{step=idx;render();});el("stage14").appendChild(b);}
 el("biased2014").addEventListener("click",()=>{style="regional_bias";render();});
 el("balanced2014").addEventListener("click",()=>{style="balanced";render();});
 render();
}
async function boot(){
 try{
  const r=await fetch("/data/replay2014.json",{cache:"no-cache"});if(!r.ok)throw Error("HTTP "+r.status);
  pack=await r.json();
  if(!pack?.meta?.scenarios?.balanced||!pack?.meta?.scenarios?.regional_bias||pack.rows?.length!==5570)throw Error("Dataset incompleto.");
  prepare();
 }catch(e){el("view-replay14").querySelector(".notice").textContent="Não foi possível carregar o teste de 2014: "+String(e.message||e);}
}
document.querySelector('.tab[data-view="replay14"]').addEventListener("click",()=>requestAnimationFrame(draw));
window.addEventListener("resize",draw);
boot();
})();