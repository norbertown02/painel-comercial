(() => {
  const VERSION = '2026.08.27.2'
  const body = document.body
  if (!body || body.dataset.ntPainelEnhance === VERSION) return
  body.dataset.ntPainelEnhance = VERSION

  const $ = id => document.getElementById(id)
  const money = value => Number(value || 0).toLocaleString('pt-BR', {
    style: 'currency', currency: 'BRL', maximumFractionDigits: 0
  })

  const isGestorComercial = () => body.classList.contains('role-gestor-comercial')

  function buildScopeHeader(id, type, kicker, title, description, badge) {
    let el = $(id)
    if (!el) {
      el = document.createElement('div')
      el.id = id
      el.className = `nt-scope-header nt-scope-${type}`
      el.innerHTML = `
        <div class="nt-scope-copy">
          <span class="nt-scope-kicker"></span>
          <h2></h2>
          <p></p>
        </div>
        <span class="nt-scope-badge"></span>
      `
    }
    el.querySelector('.nt-scope-kicker').textContent = kicker
    el.querySelector('h2').textContent = title
    el.querySelector('p').textContent = description
    el.querySelector('.nt-scope-badge').textContent = badge
    return el
  }

  function clarifyManagerScopes() {
    if (!isGestorComercial()) return

    const sellerHero = document.querySelector('.seller-dashboard-block.hero')
    if (sellerHero) {
      const eyebrow = sellerHero.querySelector('.eyebrow')
      const subtitle = sellerHero.querySelector('p')
      if (eyebrow) eyebrow.textContent = 'Painel comercial'
      if (subtitle) subtitle.textContent = 'Acompanhe primeiro o seu resultado individual e, abaixo, a visão consolidada da equipe comercial.'
    }

    const personalKpis = document.querySelector('.kpi-grid.seller-only.seller-dashboard-block')
    if (personalKpis?.parentNode) {
      const personalHeader = buildScopeHeader(
        'nt-personal-scope',
        'personal',
        'Seu resultado',
        'Meu desempenho',
        'Indicadores calculados somente com as suas vendas, cotações, clientes e meta.',
        'Individual'
      )
      personalKpis.parentNode.insertBefore(personalHeader, personalKpis)
    }

    const personalSales = $('kpi-sales')?.closest('.kpi')?.querySelector('small')
    if (personalSales) personalSales.textContent = 'Minhas vendas no mês'

    const secGestor = $('sec-gestor')
    const gestorFrame = secGestor?.querySelector(':scope > .gestor-frame') || secGestor
    if (gestorFrame) {
      const teamHeader = buildScopeHeader(
        'nt-team-scope',
        'team',
        'Gestão comercial',
        'Visão da equipe',
        'Números consolidados de todos os vendedores sob a visão gerencial.',
        'Equipe'
      )
      gestorFrame.insertBefore(teamHeader, gestorFrame.firstChild)
    }

    const managerHero = secGestor?.querySelector('.manager-hero')
    if (managerHero) managerHero.classList.add('nt-manager-hero-hidden')

    const teamLabels = [
      ['g-total-vendas', 'Vendas totais da equipe'],
      ['g-cotacoes', 'Cotações abertas da equipe'],
      ['g-visitas', 'Visitas da equipe no mês'],
      ['g-conv', 'Conversão da equipe']
    ]
    teamLabels.forEach(([id, label]) => {
      const small = $(id)?.closest('.gestor-kpi')?.querySelector('small')
      if (small) small.textContent = label
    })

    const teamChartTitle = secGestor?.querySelector('.gestor-chart-head > div:first-child > strong')
    const teamChartSubtitle = secGestor?.querySelector('.gestor-chart-head > div:first-child > span')
    if (teamChartTitle) teamChartTitle.textContent = 'Evolução das vendas da equipe'
    if (teamChartSubtitle) teamChartSubtitle.textContent = 'Faturamento consolidado do time nos últimos 6 meses'
  }

  function cleanDashboardCopy() {
    const eyebrow = document.querySelector('.seller-dashboard-block.hero .eyebrow')
    if (eyebrow && !isGestorComercial() && eyebrow.textContent.trim() === 'Portal Nutrialle') {
      eyebrow.textContent = 'Visão geral'
    }
  }

  function bindLegendInteractions() {
    document.querySelectorAll('.chart-legend').forEach(legend => {
      if (legend.dataset.ntInteractive === 'true') return
      const card = legend.closest('.card')
      if (!card?.querySelector('.chart-svg')) return

      const items = Array.from(legend.querySelectorAll('.chart-legend-item'))
      if (items.length < 2) return
      legend.dataset.ntInteractive = 'true'

      items.forEach((item, index) => {
        item.setAttribute('role', 'button')
        item.setAttribute('tabindex', '0')
        item.title = 'Clique para mostrar ou ocultar esta série'

        const toggle = () => {
          const cls = index === 0 ? 'nt-hide-sales' : 'nt-hide-quotes'
          const otherCls = index === 0 ? 'nt-hide-quotes' : 'nt-hide-sales'
          const currentlyHidden = card.classList.contains(cls)

          if (!currentlyHidden && card.classList.contains(otherCls)) return

          card.classList.toggle(cls)
          item.classList.toggle('is-off', !currentlyHidden)
        }

        item.addEventListener('click', toggle)
        item.addEventListener('keydown', e => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            toggle()
          }
        })
      })
    })
  }

  function animatePath(path) {
    if (!path || !path.getAttribute('d')) return
    try {
      const length = path.getTotalLength()
      if (!Number.isFinite(length) || length <= 0) return
      path.style.transition = 'none'
      path.style.strokeDasharray = `${length}`
      path.style.strokeDashoffset = `${length}`
      path.getBoundingClientRect()
      requestAnimationFrame(() => {
        path.style.transition = 'stroke-dashoffset .58s cubic-bezier(.2,.75,.25,1), opacity .18s ease, stroke-width .18s ease'
        path.style.strokeDashoffset = '0'
      })
    } catch {}
  }

  function animateCharts() {
    document.querySelectorAll('#chart-line, #chart-line-quotes, #chart-line-ind, #chart-line-quotes-ind, #g-chart-line').forEach(path => {
      if (path.dataset.ntAnimatedD === path.getAttribute('d')) return
      path.dataset.ntAnimatedD = path.getAttribute('d') || ''
      animatePath(path)
    })
  }

  function managerChartData(sales) {
    const now = new Date()
    const months = []
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      months.push({
        year: d.getFullYear(),
        month: d.getMonth(),
        label: d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', ''),
        full: d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
      })
    }

    const getDate = sale => {
      if (typeof window.getSaleDate === 'function') return window.getSaleDate(sale)
      return sale?.sale_date || sale?.date || sale?.created_at?.slice?.(0, 10) || ''
    }
    const getTotal = sale => {
      if (typeof window.getTotal === 'function') return Number(window.getTotal(sale) || 0)
      return Number(sale?.total || sale?.amount || 0)
    }

    const values = months.map(m => sales
      .filter(s => {
        const dateStr = getDate(s)
        if (!dateStr) return false
        const d = new Date(dateStr + 'T12:00:00')
        return d.getFullYear() === m.year && d.getMonth() === m.month
      })
      .reduce((acc, s) => acc + getTotal(s), 0)
    )

    return { months, values }
  }

  function enhanceManagerChart(sales) {
    if (!Array.isArray(sales)) return
    const wrap = document.querySelector('.gestor-chart-wrap')
    const svg = wrap?.querySelector('.gestor-chart-svg')
    const pointsEl = $('g-chart-points')
    if (!wrap || !svg || !pointsEl) return

    const { months, values } = managerChartData(sales)
    const W = 760
    const H = 260
    const P = 36
    const max = Math.max(...values, 1)
    const points = values.map((v, i) => {
      const x = P + (i / Math.max(1, values.length - 1)) * (W - P * 2)
      const y = H - P - (v / max) * (H - P * 2)
      return [x, y]
    })

    let hoverLine = $('nt-g-hover-line')
    if (!hoverLine) {
      hoverLine = document.createElementNS('http://www.w3.org/2000/svg', 'line')
      hoverLine.id = 'nt-g-hover-line'
      hoverLine.setAttribute('class', 'nt-manager-hover-line')
      hoverLine.setAttribute('y1', P)
      hoverLine.setAttribute('y2', H - P)
      svg.appendChild(hoverLine)
    }

    let hitGroup = $('nt-g-hit-zones')
    if (!hitGroup) {
      hitGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g')
      hitGroup.id = 'nt-g-hit-zones'
      svg.appendChild(hitGroup)
    }
    hitGroup.innerHTML = ''

    let tooltip = $('nt-g-chart-tooltip')
    if (!tooltip) {
      tooltip = document.createElement('div')
      tooltip.id = 'nt-g-chart-tooltip'
      tooltip.className = 'nt-manager-chart-tooltip'
      tooltip.innerHTML = '<strong></strong><div class="nt-manager-tooltip-row"><span>Vendas da equipe</span><b></b></div>'
      wrap.appendChild(tooltip)
    }

    const slice = W / months.length
    const circles = Array.from(pointsEl.querySelectorAll('circle'))

    months.forEach((month, i) => {
      const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect')
      rect.setAttribute('x', i * slice)
      rect.setAttribute('y', 0)
      rect.setAttribute('width', slice)
      rect.setAttribute('height', H)
      rect.setAttribute('class', 'nt-manager-hit-zone')

      const enter = () => {
        const [x, y] = points[i]
        hoverLine.setAttribute('x1', x)
        hoverLine.setAttribute('x2', x)
        hoverLine.classList.add('visible')

        circles.forEach((circle, ci) => {
          circle.setAttribute('r', ci === i ? '5.5' : (ci === circles.length - 1 ? '4.2' : '2.6'))
          circle.style.opacity = ci === i ? '1' : '.46'
        })

        tooltip.querySelector('strong').textContent = month.full
        tooltip.querySelector('b').textContent = money(values[i])
        tooltip.style.left = `${(x / W) * 100}%`
        tooltip.style.top = `${Math.max(7, (y / H) * 100)}%`
        tooltip.classList.add('visible')
      }

      const leave = () => {
        hoverLine.classList.remove('visible')
        tooltip.classList.remove('visible')
        circles.forEach((circle, ci) => {
          circle.setAttribute('r', ci === circles.length - 1 ? '5' : '2.6')
          circle.style.opacity = '1'
        })
      }

      rect.addEventListener('mouseenter', enter)
      rect.addEventListener('mouseleave', leave)
      hitGroup.appendChild(rect)
    })

    const card = wrap.closest('.gestor-chart-card')
    if (card) card.dataset.ntInteractive = 'true'
    animateCharts()
  }

  function patchManagerChart() {
    if (window.__ntManagerChartPatched) return
    if (typeof window.updateGestorChart !== 'function') return
    window.__ntManagerChartPatched = true

    const original = window.updateGestorChart
    window.updateGestorChart = function (sales) {
      const result = original.apply(this, arguments)
      window.__ntLastManagerSales = Array.isArray(sales) ? sales : []
      enhanceManagerChart(window.__ntLastManagerSales)
      return result
    }
  }

  function refreshEnhancements() {
    cleanDashboardCopy()
    clarifyManagerScopes()
    bindLegendInteractions()
    patchManagerChart()
    animateCharts()

    if (Array.isArray(window.__ntLastManagerSales)) {
      enhanceManagerChart(window.__ntLastManagerSales)
    }
  }

  refreshEnhancements()

  const observer = new MutationObserver(() => {
    window.clearTimeout(window.__ntPainelEnhanceTimer)
    window.__ntPainelEnhanceTimer = window.setTimeout(refreshEnhancements, 40)
  })
  observer.observe(body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] })

  ;[120, 450, 900, 1600].forEach(ms => setTimeout(refreshEnhancements, ms))

  /* Se o carregamento gerencial terminou antes do patch, refaz somente essa leitura uma vez
     para habilitar tooltip/hover sem alterar regra de negocio. */
  setTimeout(() => {
    if (!isGestorComercial() && !body.classList.contains('role-gestao')) return
    if (Array.isArray(window.__ntLastManagerSales)) return
    if ($('g-chart-points')?.children?.length && typeof window.loadGestorData === 'function') {
      window.loadGestorData().catch?.(() => {})
    }
  }, 1800)
})()
