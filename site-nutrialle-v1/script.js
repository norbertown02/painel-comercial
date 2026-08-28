(() => {
  const LOGO = './assets/logo-nutrialle.webp';
  const LEV = './assets/lev.webp';
  const LEV_PLUS = './assets/lev-plus.webp';

  const setLogo = () => {
    document.querySelectorAll('.brand').forEach((brand) => {
      brand.innerHTML = `<img class="nt-official-logo" src="${LOGO}" alt="Nutrialle" />`;
      brand.setAttribute('aria-label', 'Nutrialle');
    });
  };

  const preStyle = document.createElement('style');
  preStyle.textContent = `
    .spotlight{visibility:hidden}
    .nt-official-logo{display:block;width:176px;height:auto;max-height:58px;object-fit:contain;object-position:left center}
    .footer .nt-official-logo{width:205px;max-height:none}
    @media(max-width:760px){.nt-official-logo{width:148px}}
  `;
  document.head.appendChild(preStyle);
  setLogo();

  const core = document.createElement('script');
  core.src = './script-core.js';
  core.async = false;
  core.onload = () => {
    setLogo();

    const style = document.createElement('style');
    style.id = 'nt-final-visual-refinement';
    style.textContent = `
      .spotlight{visibility:visible}
      .brand{gap:0!important;min-width:176px}
      .brand-mark,.brand-word{display:none!important}
      .nt-official-logo{display:block;width:176px;height:auto;max-height:58px;object-fit:contain;object-position:left center}
      .footer .nt-official-logo{width:205px;max-height:none}
      .hero-copy p{max-width:580px}
      .intro-copy p{max-width:550px}
      .lev-showcase{background:#090909;color:#fff;padding:88px 0 96px;border-top:1px solid rgba(255,255,255,.06)}
      .lev-showcase-head{display:flex;align-items:end;justify-content:space-between;gap:54px;margin-bottom:31px}
      .lev-showcase-head h2{font-family:Archivo,Inter,sans-serif;font-size:clamp(40px,4.5vw,62px);line-height:.98;letter-spacing:-2.8px;margin:0}
      .lev-showcase-head p{max-width:420px;margin:0 0 4px;color:rgba(255,255,255,.56);font-size:12px;line-height:1.6}
      .lev-gallery{display:grid;grid-template-columns:1fr 1fr;gap:14px}
      .lev-art{margin:0;background:#050505;border:1px solid rgba(255,255,255,.11);border-radius:15px;overflow:hidden;box-shadow:0 26px 68px rgba(0,0,0,.28);transition:transform .25s ease,border-color .25s ease}
      .lev-art:hover{transform:translateY(-3px);border-color:rgba(232,101,30,.36)}
      .lev-art img{display:block;width:100%;aspect-ratio:1672/941;object-fit:cover}
      .lev-art figcaption{display:flex;align-items:center;justify-content:space-between;gap:15px;padding:13px 16px 14px;border-top:1px solid rgba(255,255,255,.07)}
      .lev-art figcaption strong{font-family:Archivo,Inter,sans-serif;font-size:13px;color:#fff}
      .lev-art figcaption span{font-size:8px;letter-spacing:.55px;text-transform:uppercase;color:rgba(255,255,255,.43);text-align:right}
      .lev-actions{display:flex;align-items:center;justify-content:space-between;gap:24px;margin-top:24px}
      .lev-actions p{margin:0;color:rgba(255,255,255,.48);font-size:10px;line-height:1.5}
      .lev-actions .btn{flex:0 0 auto}
      .science-note{max-width:760px}
      .company-card p{max-width:430px}
      @media(max-width:1050px){
        .nt-official-logo{width:158px}.brand{min-width:158px}
        .lev-showcase-head{display:block}.lev-showcase-head p{margin-top:14px}
        .lev-gallery{grid-template-columns:1fr}
      }
      @media(max-width:760px){
        .nt-official-logo{width:145px}.brand{min-width:145px}
        .lev-showcase{padding:68px 0 74px}.lev-showcase-head h2{font-size:39px;letter-spacing:-1.8px}
        .lev-art figcaption{display:block}.lev-art figcaption span{display:block;text-align:left;margin-top:6px}
        .lev-actions{display:block}.lev-actions .btn{width:100%;margin-top:18px}
      }
    `;
    document.head.appendChild(style);

    const heroText = document.querySelector('.hero-copy p');
    if (heroText) heroText.textContent = 'Ciência nutricional, acompanhamento técnico e dados de campo para decisões mais precisas em bovinos e suínos.';

    const intro = document.querySelector('.intro-copy');
    if (intro) intro.innerHTML = '<p>A recomendação começa pelo diagnóstico: sistema, animal, dieta, objetivo e custo. Técnica e acompanhamento orientam a decisão.</p>';

    const scienceLead = document.querySelector('.science-head > p');
    if (scienceLead) scienceLead.textContent = 'Animal, dieta, manejo e economia precisam ser lidos em conjunto antes de definir a estratégia.';

    const solutionLead = document.querySelector('.solutions .section-head > p');
    if (solutionLead) solutionLead.textContent = 'Soluções para diferentes fases, objetivos e sistemas de produção.';

    const performanceText = document.querySelector('.performance-copy > p');
    if (performanceText) performanceText.textContent = 'A formulação precisa chegar ao cocho com consistência e ser acompanhada por indicadores simples de consumo, desempenho e custo.';
    const performanceItems = document.querySelectorAll('.performance-copy .check-list li');
    if (performanceItems[0]) performanceItems[0].innerHTML = '<span></span>Estratégia ajustada à fase e ao objetivo';
    if (performanceItems[1]) performanceItems[1].innerHTML = '<span></span>Consumo, desempenho e custo acompanhados';
    if (performanceItems[2]) performanceItems[2].innerHTML = '<span></span>Suporte técnico próximo ao produtor';
    if (performanceItems[3]) performanceItems[3].remove();

    const techText = document.querySelector('.tech-copy > p');
    if (techText) techText.textContent = 'Ferramentas próprias conectam fazendas, lotes, planos e histórico técnico em uma única leitura.';

    const companyText = document.querySelector('.company-card > p');
    if (companyText) companyText.textContent = 'Conhecimento técnico, proximidade e inovação para construir relações de longo prazo com quem produz.';

    const contactText = document.querySelector('.contact-copy > p');
    if (contactText) contactText.textContent = 'Conte seu sistema e o desafio. Nosso time direciona a conversa técnica.';

    const spotlight = document.querySelector('.spotlight');
    if (spotlight) {
      spotlight.className = 'lev-showcase';
      spotlight.id = 'lev';
      spotlight.innerHTML = `
        <div class="container">
          <div class="lev-showcase-head reveal in">
            <div><span class="eyebrow eyebrow-light">Tecnologia nutricional funcional</span><h2>LEV &amp; LEV+</h2></div>
            <p>Duas tecnologias Nutrialle apresentadas com uma linguagem visual mais científica, direta e coerente com a marca.</p>
          </div>
          <div class="lev-gallery">
            <figure class="lev-art reveal in">
              <img src="${LEV}" alt="Nutrialle LEV — tecnologia nutricional funcional" loading="lazy" />
              <figcaption><strong>LEV</strong><span>Equilíbrio digestivo · desempenho · eficiência</span></figcaption>
            </figure>
            <figure class="lev-art reveal in">
              <img src="${LEV_PLUS}" alt="Nutrialle LEV+ — tecnologia avançada em nutrição" loading="lazy" />
              <figcaption><strong>LEV+</strong><span>Levedura viva · probióticos · colina protegida</span></figcaption>
            </figure>
          </div>
          <div class="lev-actions reveal in">
            <p>Saúde digestiva · equilíbrio ruminal · desempenho</p>
            <a class="btn btn-orange" href="#contato">Falar com o time técnico</a>
          </div>
        </div>`;
    }

    let icon = document.querySelector('link[rel="icon"]');
    if (!icon) { icon = document.createElement('link'); icon.rel = 'icon'; document.head.appendChild(icon); }
    icon.href = LOGO;
    icon.type = 'image/webp';

    const oldForm = document.querySelector('.contact-form');
    if (oldForm) {
      const form = oldForm.cloneNode(true);
      oldForm.replaceWith(form);
      form.removeAttribute('onsubmit');
      const note = form.querySelector('.form-note');
      if (note) note.textContent = 'A mensagem será aberta no WhatsApp oficial da Nutrialle.';
      form.addEventListener('submit', (event) => {
        event.preventDefault();
        const inputs = form.querySelectorAll('input');
        const select = form.querySelector('select');
        const textarea = form.querySelector('textarea');
        const nome = inputs[0]?.value.trim();
        const telefone = inputs[1]?.value.trim();
        const interesse = select?.value;
        const mensagem = textarea?.value.trim();
        if (!nome || !telefone || !interesse || interesse === 'Selecione' || !mensagem) {
          alert('Preencha os campos para continuar.');
          return;
        }
        const text = ['Olá, equipe Nutrialle!', '', `Meu nome é ${nome}.`, `Telefone: ${telefone}.`, `Tenho interesse em: ${interesse}.`, '', 'Mensagem:', mensagem].join('\n');
        window.open(`https://wa.me/5545999021287?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer');
      });
    }

    const patchCatalog = () => document.querySelectorAll('.product-card').forEach((card) => {
      const title = card.querySelector('h3')?.textContent.toUpperCase() || '';
      if (!title.includes('LEV')) return;
      const description = card.querySelector('p');
      if (description) description.textContent = 'Tecnologia funcional voltada ao equilíbrio digestivo, saúde ruminal e desempenho.';
      const link = card.querySelector('a');
      if (link) {
        link.href = './index.html#lev';
        link.removeAttribute('target');
        link.removeAttribute('rel');
        link.innerHTML = 'Conhecer tecnologia <b>→</b>';
      }
    });
    patchCatalog();
    const grid = document.querySelector('[data-product-grid]');
    if (grid && 'MutationObserver' in window) new MutationObserver(patchCatalog).observe(grid, { childList: true });
  };
  document.body.appendChild(core);
})();
