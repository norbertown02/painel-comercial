(() => {
  const VERSION = '2026.08.27.3'
  const body = document.body
  if (!body || body.dataset.ntPainelFixes === VERSION) return
  body.dataset.ntPainelFixes = VERSION

  const $ = id => document.getElementById(id)
  const isManager = () => body.classList.contains('role-gestor-comercial') || body.classList.contains('role-gestao')

  const normalizeStatus = value => String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()

  const isCancelledSale = sale => {
    const status = normalizeStatus(sale?.status)
    return status === 'cancelado' || status === 'cancelada' || status === 'canceled' || status === 'cancelled' || status.includes('cancel')
  }

  const getSaleDateSafe = sale => {
    try {
      if (typeof window.getSaleDate === 'function') return window.getSaleDate(sale)
    } catch {}
    return sale?.sale_date || sale?.date || sale?.created_at?.slice?.(0, 10) || ''
  }

  const getTotalSafe = sale => {
    try {
      if (typeof window.getTotal === 'function') return Number(window.getTotal(sale) || 0)
    } catch {}
    return Number(sale?.total || sale?.amount || 0)
  }

  const compactMoney = value => {
    const n = Number(value || 0)
    if (n >= 1e6) return 'R$ ' + (n / 1e6).toFixed(1).replace('.', ',') + ' mi'
    if (n >= 1e3) return 'R$ ' + (n / 1e3).toFixed(0) + ' mil'
    return 'R$ ' + n.toLocaleString('pt-BR', { maximumFractionDigits: 0 })
  }

  async function refreshValidManagerSales() {
    if (!isManager()) return

    try {
      if (typeof supabaseClient === 'undefined' || !supabaseClient?.from) return

      const now = new Date()
      const start = new Date(now.getFullYear(), now.getMonth() - 5, 1)
      const startISO = start.toISOString().slice(0, 10)

      const { data, error } = await supabaseClient
        .from('sales')
        .select('total,seller_id,sale_date,status')
        .gte('sale_date', startISO)

      if (error) {
        console.warn('Não foi possível recalcular vendas válidas da equipe:', error.message)
        return
      }

      const validSales = (data || []).filter(sale => !isCancelledSale(sale))

      if (typeof window.updateGestorChart === 'function') {
        window.updateGestorChart(validSales)
      }

      const currentMonth = now.getMonth()
      const currentYear = now.getFullYear()
      const currentTotal = validSales
        .filter(sale => {
          const dateStr = getSaleDateSafe(sale)
          if (!dateStr) return false
          const d = new Date(dateStr + 'T12:00:00')
          return d.getFullYear() === currentYear && d.getMonth() === currentMonth
        })
        .reduce((sum, sale) => sum + getTotalSafe(sale), 0)

      if ($('g-total-vendas')) $('g-total-vendas').textContent = compactMoney(currentTotal)
      if ($('g-chart-total')) $('g-chart-total').textContent = compactMoney(currentTotal)

      window.__ntValidManagerSales = validSales
      window.__ntManagerCurrentTotal = currentTotal
    } catch (err) {
      console.warn('Falha ao remover vendas canceladas da visão gerencial:', err)
    }
  }

  function patchManagerReload() {
    if (window.__ntManagerReloadPatched || typeof window.loadGestorData !== 'function') return
    window.__ntManagerReloadPatched = true
    const original = window.loadGestorData

    window.loadGestorData = async function () {
      const result = await original.apply(this, arguments)
      await refreshValidManagerSales()
      return result
    }
  }

  function apply() {
    patchManagerReload()
    refreshValidManagerSales()
  }

  apply()
  ;[350, 900, 1600, 2600].forEach(ms => setTimeout(apply, ms))
})()
