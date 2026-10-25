
import sys,zipfile,csv,io,random,math,collections,statistics,json
from pathlib import Path
from tse_remote_zip import RR
metro=[('71072','SP'),('60011','RJ'),('97012','DF'),('13897','CE'),('38490','BA'),('41238','MG'),('02550','AM'),('75353','PR'),('25313','PE'),('93734','GO'),('04278','PA'),('88013','RS'),('64777','SP'),('62910','SP'),('09210','MA')]
codes={a for a,b in metro}
cand={2014:(45,13),2018:(17,13),2022:(22,13)}
def read(year,kind):
 url=f"https://cdn.tse.jus.br/estatistica/sead/odsele/{kind}/{kind}_{year}.zip"
 z=zipfile.ZipFile(RR(url))
 body=z.read(f"{kind}_{year}_BR.csv").decode("latin-1")
 f=csv.DictReader(io.StringIO(body),delimiter=";")
 return ((str(r['CD_MUNICIPIO']).zfill(5),int(r['NR_TURNO']),int(r['NR_ZONA']),r) for r in f if r.get("CD_CARGO")=="1" and str(r.get("CD_MUNICIPIO","")).zfill(5) in codes and r.get("NR_TURNO") in ["1","2"])
def num(r,k):return int(r.get(k) or 0)
def build(year):
 ds=collections.defaultdict(lambda:dict(apt=0,turn=0,abst=0,valid=0))
 votes=collections.defaultdict(lambda:collections.defaultdict(int))
 for code,t,z,r in read(year,"detalhe_votacao_munzona"):
  a=ds[(code,t,z)];a['apt']+=num(r,'QT_APTOS');a['turn']+=num(r,'QT_COMPARECIMENTO');a['abst']+=num(r,'QT_ABSTENCOES');a['valid']+=num(r,'QT_TOTAL_VOTOS_VALIDOS') or num(r,'QT_VOTOS_VALIDOS')
 for code,t,z,r in read(year,"votacao_candidato_munzona"):
  n=int(r.get('NR_CANDIDATO') or 0)
  count=num(r,'QT_VOTOS_NOMINAIS_VALIDOS') if 'QT_VOTOS_NOMINAIS_VALIDOS' in r else num(r,'QT_VOTOS_NOMINAIS')
  votes[(code,t,z)][n]+=count
 zone=[];mismatch=0
 for code,uf in metro:
  for z in {k[2] for k in ds if k[0]==code}:
   a=ds.get((code,1,z));b=ds.get((code,2,z))
   if not a or not b:continue
   va=votes[(code,1,z)];vb=votes[(code,2,z)]
   pa,pb=cand[year]
   A1,B1=va[pa],va[pb];A2,B2=vb[pa],vb[pb]
   if min(A1+B1,A2+B2,a['valid'],b['valid'])<=0:continue
   if any(x['apt'] and x['turn']+x['abst']!=x['apt'] for x in [a,b]):mismatch+=1;continue
   if any(x['valid'] and abs(sum(v.values())-x['valid'])>max(3,x['valid']*.005) for x,v in [(a,va),(b,vb)]):mismatch+=1;continue
   zone.append(dict(city=code,uf=uf,z=z,a1=A1,b1=B1,a2=A2,b2=B2,v1=a['valid'],v2=b['valid'],
    att1=a['turn']/a['apt'] if a['apt'] else None,att2=b['turn']/b['apt'] if b['apt'] else None,apt1=a['apt'],apt2=b['apt'],turn1=a['turn'],turn2=b['turn']))
 return zone,mismatch
def backtest(year,zone):
 cities=collections.defaultdict(list)
 for x in zone:cities[x['city']].append(x)
 for x in zone:
  group=cities[x['city']]
  a=sum(z['a1'] for z in group);b=sum(z['b1'] for z in group)
  x['qm']=a/(a+b);x['qz']=x['a1']/(x['a1']+x['b1'])
 n0=sum(x['v1'] for x in zone)
 actual=100*sum(x['a2'] for x in zone)/sum(x['a2']+x['b2'] for x in zone)
 size={city:sum(z['v1'] for z in gr) for city,gr in cities.items()}
 def forecast(seen,model):
  selected=[x for x in zone if (x['city'],x['z']) in seen]
  n=sum(x['a2']+x['b2'] for x in selected)
  mass=sum(x['v1'] for x in selected)
  if not n or not mass:return None
  ratio=max(.6,min(1.4,n/mass))
  q='qm' if model=='municipal' else 'qz'
  globalShift=sum((x['a2']-(x['a2']+x['b2'])*x[q]) for x in selected)/n
  shift={}
  for city,group in cities.items():
   sel=[x for x in group if (x['city'],x['z']) in seen]
   nn=sum(x['a2']+x['b2'] for x in sel)
   if nn:
    d=sum(x['a2']-(x['a2']+x['b2'])*x[q] for x in sel)/nn
    w=nn/(nn+20000)
    shift[city]=w*d+(1-w)*globalShift
   else:shift[city]=globalShift
  AA=NN=0
  for x in zone:
   if (x['city'],x['z']) in seen:aa=x['a2'];nn=x['a2']+x['b2']
   else:
    nn=x['v1']*ratio
    aa=nn*max(.001,min(.999,x[q]+shift[x['city']]))
   AA+=aa;NN+=nn
  return 100*AA/NN
 rows=[]
 for fraction in [5,10,25,50]:
  for style in ['balanced','largest_city_first','first_A_strong_zone_first','first_B_strong_zone_first']:
   aeM=[];aeZ=[];deltaM=[];deltaZ=[]
   for i in range(50):
    rnd=random.Random(year*1000000+fraction*1000+i*53+['balanced','largest_city_first','first_A_strong_zone_first','first_B_strong_zone_first'].index(style)*100000)
    def score(x):
     w=1
     if style=='largest_city_first':w=math.sqrt(size[x['city']]/100000)
     if style=='first_A_strong_zone_first':w=math.exp(6*(x['qz']-.5))
     if style=='first_B_strong_zone_first':w=math.exp(-6*(x['qz']-.5))
     return -math.log(max(rnd.random(),1e-10))/w
    order=sorted(zone,key=score)
    seen=set();counted=0
    for x in order:
     if counted>=n0*fraction/100:break
     seen.add((x['city'],x['z']));counted+=x['v1']
    m=forecast(seen,'municipal');z=forecast(seen,'zonal')
    aeM.append(abs(m-actual));aeZ.append(abs(z-actual))
    deltaM.append(m-actual);deltaZ.append(z-actual)
   rows.append(dict(coverage=fraction,style=style,n=50,munMae=round(statistics.mean(aeM),4),zoneMae=round(statistics.mean(aeZ),4),munP90=round(sorted(aeM)[44],4),zoneP90=round(sorted(aeZ)[44],4)))
 return actual,rows
output={'methodology':'Real TSE 2014/2018/2022 zone-level presidential final returns; hypothetical sequential zone reveal, fixed forecasting formula and same vote volume model in both methods. NOT true historical 5% sectional-time replays.','years':{}}
for year in [2014,2018,2022]:
 print('START',year,flush=True)
 zone,mismatch=build(year)
 print('LOADED',year,len(zone),'mismatch',mismatch,flush=True)
 if not zone:continue
 actual,rows=backtest(year,zone)
 apt1=sum(x['apt1'] for x in zone);apt2=sum(x['apt2'] for x in zone)
 r1=sum(x['turn1'] for x in zone)/apt1 if apt1 else None
 r2=sum(x['turn2'] for x in zone)/apt2 if apt2 else None
 avgM=statistics.mean(x['munMae'] for x in rows);avgZ=statistics.mean(x['zoneMae'] for x in rows)
 output['years'][str(year)]=dict(zones=len(zone),cities=len(set(x['city'] for x in zone)),mismatch=mismatch,truth=round(actual,5),firstOtherCandidateVotes=sum(x['v1']-x['a1']-x['b1'] for x in zone),firstVotesA=sum(x['a1'] for x in zone),secondVotesA=sum(x['a2'] for x in zone),firstVotesB=sum(x['b1'] for x in zone),secondVotesB=sum(x['b2'] for x in zone),firstValid=sum(x['v1'] for x in zone),secondValid=sum(x['v2'] for x in zone),attendance1=round(100*r1,3),attendance2=round(100*r2,3),abstentionDeltaPp=round(100*(r1-r2),3),MAE_municipal=round(avgM,4),MAE_zone=round(avgZ,4),zonalGainPct=round(100*(avgM-avgZ)/avgM,2),scenarios=rows)
 print('RESULT',year,json.dumps({k:v for k,v in output['years'][str(year)].items() if k!='scenarios'}),flush=True)
out_path=Path(__file__).resolve().parents[1]/'data'/'historical-zone-backtest-2014-2018-2022.json'
with open(out_path,'w') as f:json.dump(output,f,ensure_ascii=False,indent=2)
print('FINISHED',flush=True)

