(() => {
  const header = document.querySelector('[data-header]')
  const toggle = document.querySelector('[data-menu-toggle]')
  const mobile = document.querySelector('[data-mobile-nav]')
  if (header) {
    const onScroll = () => header.classList.toggle('is-scrolled', window.scrollY > 16)
    onScroll(); window.addEventListener('scroll', onScroll, { passive:true })
  }
  if (toggle && mobile) {
    toggle.addEventListener('click', () => mobile.classList.toggle('open'))
    mobile.querySelectorAll('a').forEach(a => a.addEventListener('click', () => mobile.classList.remove('open')))
  }

  const observer = 'IntersectionObserver' in window ? new IntersectionObserver(entries => {
    entries.forEach(entry => { if (entry.isIntersecting) { entry.target.classList.add('in'); observer.unobserve(entry.target) } })
  }, { threshold:.12 }) : null
  document.querySelectorAll('.reveal').forEach(el => observer ? observer.observe(el) : el.classList.add('in'))

  const products = [
    {cat:'corte',name:'Nutrialle Phós 40',desc:'Suplemento mineral para bovinos de corte a pasto, com foco em equilíbrio mineral e desempenho produtivo.',tags:['Pasto','Mineral'],url:'https://nutrialle.com.br/produto/PRD-1AB349'},
    {cat:'corte',name:'Performance@',desc:'Suplemento proteico adensado para cria, recria e engorda a pasto.',tags:['Pasto','Proteico'],url:'https://nutrialle.com.br/produto/PRD-BB3237'},
    {cat:'corte',name:'Protein 30',desc:'Suplemento proteinado com 30% de proteína bruta para recria intensiva e engorda a pasto.',tags:['Recria','Terminação'],url:'https://nutrialle.com.br/produto/PRD-EC39E1'},
    {cat:'corte',name:'Protein 40',desc:'Suplemento proteinado com 40% de proteína bruta para períodos de deficiência proteica.',tags:['Seca','Proteico'],url:'https://nutrialle.com.br/produto/PRD-094EED'},
    {cat:'corte',name:'Max 25/5',desc:'Suplemento proteico energético para recria avançada e terminação.',tags:['Energia','Terminação'],url:'https://nutrialle.com.br/produto/PRD-7C4F3C'},
    {cat:'corte',name:'Confina Prime 70',desc:'Núcleo proteico mineral de alta concentração para sistemas intensivos de produção.',tags:['Confinamento','Núcleo'],url:'https://nutrialle.com.br/produto/PRD-92A3D2'},
    {cat:'corte',name:'Plus 30/3',desc:'Suplemento proteico energético com 30% de proteína bruta para recria e terminação a pasto.',tags:['Pasto','Proteico energético'],url:'https://nutrialle.com.br/produto/PRD-32F3BB'},
    {cat:'corte',name:'Confina Plus',desc:'Núcleo mineral vitamínico para bovinos confinados e semiconfinados.',tags:['Confinamento','Mineral vitamínico'],url:'https://nutrialle.com.br/produto/PRD-898A66'},
    {cat:'corte',name:'Protein Gold 30',desc:'Suplemento proteinado de alta eficiência para recria e engorda.',tags:['Recria','Alta eficiência'],url:'https://nutrialle.com.br/produto/PRD-204407'},
    {cat:'leite',name:'Nutrialle Lacto',desc:'Núcleo mineral vitamínico para vacas leiteiras em produção.',tags:['Lactação','20 kg'],url:'https://nutrialle.com.br/produtos/bovinos-de-leite'},
    {cat:'leite',name:'Lacto ADE',desc:'Suplemento mineral vitamínico para vacas leiteiras em produção.',tags:['Lactação','Mineral'],url:'https://nutrialle.com.br/produtos/bovinos-de-leite'},
    {cat:'leite',name:'Lacto Biomon',desc:'Núcleo mineral vitamínico para bovinos leiteiros em lactação com Biotina e Monensina.',tags:['Lactação','Biotina'],url:'https://nutrialle.com.br/produtos/bovinos-de-leite'},
    {cat:'leite',name:'Lacto Biotin',desc:'Suplemento mineral vitamínico com biotina, voltado à saúde dos cascos.',tags:['Cascos','Biotina'],url:'https://nutrialle.com.br/produtos/bovinos-de-leite'},
    {cat:'leite',name:'Lacto Future',desc:'Núcleo mineral vitamínico para novilhas leiteiras em recria e crescimento.',tags:['Novilhas','Recria'],url:'https://nutrialle.com.br/produtos/bovinos-de-leite'},
    {cat:'leite',name:'Lacto Max',desc:'Núcleo mineral vitamínico tamponado para vacas de média e alta produção.',tags:['Alta produção','Tamponado'],url:'https://nutrialle.com.br/produtos/bovinos-de-leite'},
    {cat:'leite',name:'Lacto Max Control',desc:'Núcleo tamponado para bovinos leiteiros que recebem ração comercial com monensina.',tags:['Controle','Lactação'],url:'https://nutrialle.com.br/produtos/bovinos-de-leite'},
    {cat:'leite',name:'Lacto Pré Parto',desc:'Núcleo mineral vitamínico para vacas leiteiras em fase de pré-parto.',tags:['Transição','Pré-parto'],url:'https://nutrialle.com.br/produtos/bovinos-de-leite'},
    {cat:'leite',name:'Lacto Rumen Pró',desc:'Suplemento com probióticos para equilíbrio da microbiota ruminal e intestinal.',tags:['Rúmen','Probióticos'],url:'https://nutrialle.com.br/produtos/bovinos-de-leite'},
    {cat:'leite',name:'Lacto Sacch',desc:'Suplemento mineral vitamínico com levedura viva Saccharomyces cerevisiae.',tags:['Levedura','Rúmen'],url:'https://nutrialle.com.br/produtos/bovinos-de-leite'},
    {cat:'leite',name:'Lacto Tamp',desc:'Tamponante para estabilidade do pH ruminal em dietas com alto teor de concentrado.',tags:['Tamponante','pH ruminal'],url:'https://nutrialle.com.br/produtos/bovinos-de-leite'},
    {cat:'aditivos',name:'Linha LEV +',desc:'Tecnologia em nutrição voltada a saúde, desempenho e produtividade.',tags:['Tecnologia','Funcional'],url:'https://www.nutrialle.com.br'},
    {cat:'aditivos',name:'Nutrialle Buffer',desc:'Tamponante ruminal para auxiliar na manutenção do equilíbrio do pH do rúmen.',tags:['Rúmen','Tamponante'],url:'https://nutrialle.com.br/blog-conteudo.php?slug=o-que-e-tamponante-ruminal'},
    {cat:'aditivos',name:'Nutrialle Buffer Pro',desc:'Agentes tamponantes e tecnologias complementares para estabilidade fermentativa.',tags:['Rúmen','Eficiência'],url:'https://nutrialle.com.br/blog-conteudo.php?slug=o-que-e-tamponante-ruminal'},
    {cat:'suinos',name:'Nutrição para suínos',desc:'Portfólio voltado às exigências das diferentes fases da produção suína.',tags:['Precisão','Desempenho'],url:'https://www.nutrialle.com.br'}
  ]

  const grid = document.querySelector('[data-product-grid]')
  const tabs = document.querySelector('[data-tabs]')
  const search = document.querySelector('[data-product-search]')
  const empty = document.querySelector('[data-empty]')
  if (grid) {
    let filter = (location.hash || '').replace('#','') || 'all'
    if (!['all','corte','leite','suinos','aditivos'].includes(filter)) filter='all'
    let query = ''
    const labels = {corte:'Bovinos de corte',leite:'Bovinos de leite',suinos:'Suínos',aditivos:'Aditivos & tecnologias'}
    const render = () => {
      const list = products.filter(p => (filter==='all'||p.cat===filter) && (!query || `${p.name} ${p.desc} ${p.tags.join(' ')}`.toLowerCase().includes(query)))
      grid.innerHTML = list.map(p => `<article class="product-card"><span class="pc-cat">${labels[p.cat]}</span><h3>${p.name}</h3><p>${p.desc}</p><div class="pc-tags">${p.tags.map(t=>`<span>${t}</span>`).join('')}</div><a href="${p.url}" target="_blank" rel="noreferrer">Ver detalhes <b>↗</b></a></article>`).join('')
      if(empty) empty.hidden = list.length>0
      if(tabs) tabs.querySelectorAll('button').forEach(b=>b.classList.toggle('active',b.dataset.filter===filter))
    }
    tabs?.addEventListener('click', e => { const b=e.target.closest('button[data-filter]'); if(!b)return; filter=b.dataset.filter; history.replaceState(null,'',filter==='all'?'./produtos.html':`#${filter}`); render() })
    search?.addEventListener('input', e => { query=e.target.value.toLowerCase().trim(); render() })
    render()
  }
})()

;(() => {
  const A='https://raw.githubusercontent.com/rocharichard507-creator/Nutrialle/main/assets/images'
  const logo=`${A}/logo.webp`
  document.querySelectorAll('.brand').forEach(b=>{
    b.innerHTML=`<span class="brand-mark"><img src="${logo}" alt="" style="width:100%;height:100%;object-fit:contain;display:block"></span><span class="brand-word">NUTRIALLE</span>`
  })
  if(!document.querySelector('link[data-nt-favicon]')){const l=document.createElement('link');l.rel='icon';l.type='image/svg+xml';l.href=`${A}/favicon.svg`;l.dataset.ntFavicon='1';document.head.appendChild(l)}

  const sp=document.querySelector('.spotlight')
  if(sp){
    sp.id='lev'
    sp.innerHTML=`<div class="container spotlight-grid">
      <div class="spotlight-copy reveal in"><span class="eyebrow">Tecnologia em destaque</span><h2>LEV+</h2>
      <p>Uma combinação completa de <strong>levedura viva, parede celular de leveduras, probióticos e colina protegida</strong> para apoiar a saúde digestiva, o equilíbrio ruminal e o desempenho do rebanho.</p>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:1px;background:#ddd7d0;border:1px solid #ddd7d0;border-radius:12px;overflow:hidden;margin:24px 0 25px">
        <span style="background:#fff;padding:13px;font-size:10px">Levedura viva</span><span style="background:#fff;padding:13px;font-size:10px">Parede celular de leveduras</span><span style="background:#fff;padding:13px;font-size:10px">Probióticos</span><span style="background:#fff;padding:13px;font-size:10px">Colina protegida</span>
      </div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:26px"><span style="font-size:8px;border:1px solid #ddd7d0;border-radius:999px;padding:7px 9px">Equilíbrio ruminal</span><span style="font-size:8px;border:1px solid #ddd7d0;border-radius:999px;padding:7px 9px">Saúde intestinal</span><span style="font-size:8px;border:1px solid #ddd7d0;border-radius:999px;padding:7px 9px">Imunidade</span><span style="font-size:8px;border:1px solid #ddd7d0;border-radius:999px;padding:7px 9px">Leite e corte</span></div>
      <a class="btn btn-dark" href="#contato">Fale com um especialista</a></div>
      <div class="spotlight-visual reveal in" style="background:#ece7e1;display:grid;place-items:center;padding:22px"><img src="${A}/lev/lev-01.webp" alt="Nutrialle LEV+, tecnologia para desempenho, saúde intestinal e imunidade" style="width:100%;height:100%;max-height:430px;object-fit:contain;display:block"></div>
    </div>`
  }

  const metrics=document.querySelectorAll('.product-ui .ui-metrics strong')
  ;['Diagnóstico','Plano','Histórico'].forEach((t,i)=>{if(metrics[i]){metrics[i].textContent=t;metrics[i].style.fontSize='12px'}})

  const form=document.querySelector('.contact-form')
  if(form){
    form.removeAttribute('onsubmit')
    const note=form.querySelector('.form-note'); if(note) note.textContent='Ao enviar, abriremos o WhatsApp oficial da Nutrialle com sua mensagem pronta.'
    form.addEventListener('submit',e=>{
      e.preventDefault()
      const inputs=form.querySelectorAll('input'), sel=form.querySelector('select'), ta=form.querySelector('textarea')
      const nome=inputs[0]?.value.trim(), telefone=inputs[1]?.value.trim(), interesse=sel?.value, msg=ta?.value.trim()
      if(!nome||!telefone||!interesse||interesse==='Selecione'||!msg){alert('Preencha os campos para continuar.');return}
      const text=['Olá, equipe Nutrialle!','',`Meu nome é ${nome}.`,`Telefone: ${telefone}.`,`Tenho interesse em: ${interesse}.`,'','Mensagem:',msg].join('\n')
      window.open(`https://wa.me/5545999021287?text=${encodeURIComponent(text)}`,'_blank','noopener,noreferrer')
    })
  }

  const patchLev=()=>document.querySelectorAll('.product-card').forEach(c=>{
    if(!c.querySelector('h3')?.textContent.toUpperCase().includes('LEV'))return
    const p=c.querySelector('p'); if(p)p.textContent='Levedura viva, parede celular de leveduras, probióticos e colina protegida para apoio à saúde digestiva, equilíbrio ruminal e desempenho.'
    const a=c.querySelector('a'); if(a){a.href='./index.html#lev';a.removeAttribute('target');a.removeAttribute('rel');a.innerHTML='Conhecer tecnologia <b>→</b>'}
  })
  patchLev(); const grid=document.querySelector('[data-product-grid]'); if(grid&&'MutationObserver'in window)new MutationObserver(patchLev).observe(grid,{childList:true})
})()
