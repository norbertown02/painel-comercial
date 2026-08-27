(() => {
  const VERSION = '2026.08.27.4'
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

  async function loadFiscalReturnsBySale(saleIds) {
    const result = new Map()
    if (!saleIds.length) return result

    const { data: links, error: linksError } = await supabaseClient
      .from('sales_fiscal_links')
      .select('sale_id,fiscal_document_id,link_type')
      .in('sale_id', saleIds)

    if (linksError) throw linksError

    const returnLinks = (links || []).filter(link => {
      const type = normalizeStatus(link?.link_type)
      return type.includes('devol') || type.includes('revers') || type.includes('estorn')
    })

    const documentIds = [...new Set(returnLinks.map(link => link.fiscal_document_id).filter(Boolean))]
    if (!documentIds.length) return result

    const { data: documents, error: documentsError } = await supabaseClient
      .from('fiscal_documents')
      .select('ultra_document_id,document_total,is_reversal,movement_type,operation_nature')
      .in('ultra_document_id', documentIds)

    if (documentsError) throw documentsError

    const docsById = new Map((documents || []).map(doc => [String(doc.ultra_document_id), doc]))

    returnLinks.forEach(link => {
      const doc = docsById.get(String(link.fiscal_document_id))
      if (!doc) return

      const movement = normalizeStatus(doc.movement_type)
      const nature = normalizeStatus(doc.operation_nature)
      const isReturn = doc.is_reversal === true || movement.includes('devol') || movement.includes('revers') || movement.includes('estorn') || nature.includes('devol')
      if (!isReturn) return

      const amount = Math.abs(Number(doc.document_total || 0))
      if (!amount) return

      const saleId = String(link.sale_id)
      result.set(saleId, (result.get(saleId) || 0) + amount)
    })

    return result
  }

  async function refreshNetManagerSales() {
    if (!isManager()) return

    try {
      if (typeof supabaseClient === 'undefined' || !supabaseClient?.from) return

      const now = new Date()
      const start = new Date(now.getFullYear(), now.getMonth() - 5, 1)
      const startISO = start.toISOString().slice(0, 10)

      const { data, error } = await supabaseClient
        .from('sales')
        .select('id,total,seller_id,sale_date,status')
        .gte('sale_date', startISO)

      if (error) {
        console.warn('Não foi possível recalcular vendas líquidas da equipe:', error.message)
        return
      }

      const activeSales = (data || []).filter(sale => !isCancelledSale(sale))
      const returnBySale = await loadFiscalReturnsBySale(activeSales.map(sale => sale.id).filter(Boolean))

      const netSales = activeSales.map(sale => {
        const gross = getTotalSafe(sale)
        const returned = returnBySale.get(String(sale.id)) || 0
        const net = Math.max(0, gross - returned)
        return {
          ...sale,
          total: net,
          __ntGrossTotal: gross,
          __ntReturnedTotal: returned,
          __ntNetTotal: net
        }
      })

      if (typeof window.updateGestorChart === 'function') {
        window.updateGestorChart(netSales)
      }

      const currentMonth = now.getMonth()
      const currentYear = now.getFullYear()
      const currentTotal = netSales
        .filter(sale => {
          const dateStr = getSaleDateSafe(sale)
          if (!dateStr) return false
          const d = new Date(dateStr + 'T12:00:00')
          return d.getFullYear() === currentYear && d.getMonth() === currentMonth
        })
        .reduce((sum, sale) => sum + getTotalSafe(sale), 0)

      if ($('g-total-vendas')) $('g-total-vendas').textContent = compactMoney(currentTotal)
      if ($('g-chart-total')) $('g-chart-total').textContent = compactMoney(currentTotal)

      window.__ntValidManagerSales = netSales
      window.__ntManagerCurrentTotal = currentTotal
      window.__ntFiscalReturnsBySale = returnBySale
    } catch (err) {
      console.warn('Falha ao aplicar devoluções fiscais na visão gerencial:', err)
    }
  }

  function patchManagerReload() {
    if (window.__ntManagerReloadPatched || typeof window.loadGestorData !== 'function') return
    window.__ntManagerReloadPatched = true
    const original = window.loadGestorData

    window.loadGestorData = async function () {
      const result = await original.apply(this, arguments)
      await refreshNetManagerSales()
      return result
    }
  }

  function apply() {
    patchManagerReload()
    refreshNetManagerSales()
  }

  apply()
  ;[350, 900, 1600, 2600].forEach(ms => setTimeout(apply, ms))
})()
