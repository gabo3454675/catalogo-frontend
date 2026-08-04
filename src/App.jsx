import { useCallback, useEffect, useRef, useState } from 'react'

const apiUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api/v1'
const PAGE_SIZE = 24

function adminFetch(url, options = {}) {
  return fetch(url, {
    ...options,
    credentials: 'include',
    headers: {
      ...options.headers,
      'X-Requested-With': 'XMLHttpRequest',
    },
  })
}
const SESSION_STORAGE_KEY = 'kronos-session-id'
const advisors = [
  { label: 'Asesor 1', number: '04241362318' },
  { label: 'Asesor 2', number: '04264125187' },
]

const money = (value) => `$${Math.round(Number(value))}`
const moneyBs = (value) => `Bs. ${Math.round(Number(value)).toLocaleString('es-VE')}`
const whatsappUrl = (advisor, message) => `https://wa.me/58${advisor.number.slice(1)}?text=${encodeURIComponent(message)}`
const catalogOrigin = () => window.location.origin

/** SKU interno sin prefijo de proveedor (ECKO/LUA) para el cliente. */
function publicSku(sku) {
  if (!sku) return ''
  return String(sku).replace(/^(ECKO|LUA)-/i, '')
}

/** Evita fotos viejas en caché del teléfono tras reimportar. */
function productImageSrc(url, updatedAt) {
  if (!url) return url
  const stamp = updatedAt ? new Date(updatedAt).getTime() : 0
  if (!stamp) return url
  return `${url}${url.includes('?') ? '&' : '?'}v=${stamp}`
}

/** Quita teléfonos / WhatsApp de proveedores en descripciones públicas. */
function publicDescription(text) {
  if (!text) return ''
  return text
    .replace(/\b(wha?ts?app|whasap|wsp)\b[^.\n]{0,100}/gi, '')
    .replace(/\b0?4\d{2}[-.\s]?\d{3}[-.\s]?\d{4}\b/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

function buildProductWhatsApp(product, advisor) {
  const ref = publicSku(product.sku)
  const lines = [
    `Hola ${advisor.label},`,
    '',
    'Vengo del *catálogo KRONOS* y quiero consultar este producto:',
    '',
    `*${product.name}*`,
    ref ? `Ref: ${ref}` : null,
    product.brand?.name ? `Marca: ${product.brand.name}` : null,
    product.category?.name ? `Categoría: ${categoryLabel(product.category)}` : null,
    `Precio: ${money(product.price)}${product.priceBs != null ? ` · ${moneyBs(product.priceBs)}` : ''}`,
    product.imageUrl ? `Foto: ${product.imageUrl}` : null,
    '',
    `Catálogo: ${catalogOrigin()}`,
  ]
  return lines.filter((line) => line !== null).join('\n')
}

function buildCartWhatsApp(cart, advisor, total, totalBs) {
  const lines = [
    `Hola ${advisor.label},`,
    '',
    'Vengo del *catálogo KRONOS* y quiero realizar este pedido:',
    '',
    ...cart.map((item, index) => {
      const lineTotal = Number(item.price) * item.quantity
      const lineBs = item.priceBs != null ? Number(item.priceBs) * item.quantity : null
      const ref = publicSku(item.sku)
      return `${index + 1}. *${item.name}*${ref ? ` (Ref ${ref})` : ''}\n   Cant: ${item.quantity} · ${money(lineTotal)}${lineBs != null ? ` · ${moneyBs(lineBs)}` : ''}`
    }),
    '',
    `*Total: ${money(total)}${totalBs ? ` · ${moneyBs(totalBs)}` : ''}*`,
    '',
    `Catálogo: ${catalogOrigin()}`,
  ]
  return lines.join('\n')
}

function buildGeneralWhatsApp(advisor) {
  return [
    `Hola ${advisor.label},`,
    '',
    'Vengo del *catálogo KRONOS* y quiero información sobre sus productos.',
    '',
    `Catálogo: ${catalogOrigin()}`,
  ].join('\n')
}

/**
 * Mensaje corto optimizado para tráfico de Facebook Marketplace.
 * Los textos son configurables y deben ajustarse a la política real del negocio.
 */
function buildMarketplaceWhatsApp(product) {
  const productName = product.brand?.name
    ? `${product.brand.name} ${product.name}`
    : product.name
  const ref = publicSku(product.sku)
  const skuLine = ref ? ` (Ref: ${ref})` : ''
  const productUrl = `${window.location.origin}/#/producto/${product.slug}`
  const lines = [
    `Hola, estoy interesado en el ${productName}${skuLine} que vi en la página.`,
    '',
    `Ficha del producto: ${productUrl}`,
  ]
  return lines.join('\n')
}

async function fetchProductBySlug(slug) {
  const response = await fetch(`${apiUrl}/products/${slug}`)
  if (!response.ok) throw new Error('not-found')
  return response.json()
}

function ProductGallery({ product, selectedImage, onSelectImage }) {
  const images = (product.images?.length
    ? product.images
    : product.imageUrl
      ? [{ id: 'main', url: product.imageUrl }]
      : []
  ).map((image) => ({
    ...image,
    displayUrl: productImageSrc(image.url, product.updatedAt),
  }))
  const currentIndex = Math.max(0, images.findIndex((image) => image.url === selectedImage || image.displayUrl === selectedImage))
  const safeIndex = currentIndex >= 0 ? currentIndex : 0
  const imageKey = images.map((image) => image.displayUrl).join('|')

  useEffect(() => {
    if (images.length < 2) return undefined
    const timer = window.setInterval(() => {
      const next = images[(safeIndex + 1) % images.length]
      onSelectImage(next.url)
    }, 3500)
    return () => window.clearInterval(timer)
  }, [imageKey, onSelectImage, safeIndex, images])

  if (!images.length) {
    return <div className="modal-media"><div className="image-placeholder large">KRONOS</div></div>
  }

  const go = (delta) => {
    const next = images[(safeIndex + delta + images.length) % images.length]
    onSelectImage(next.url)
  }

  return (
    <div className="modal-media">
      <div className="media-stage">
        {images.length > 1 && <button type="button" className="media-nav prev" onClick={() => go(-1)} aria-label="Imagen anterior">‹</button>}
        <img className="modal-main-image" src={productImageSrc(selectedImage || images[0].url, product.updatedAt)} alt={product.name} />
        {images.length > 1 && <button type="button" className="media-nav next" onClick={() => go(1)} aria-label="Imagen siguiente">›</button>}
        {images.length > 1 && <span className="media-count">{safeIndex + 1} / {images.length}</span>}
      </div>
      {images.length > 1 && (
        <div className="image-gallery">
          {images.map((image, index) => (
            <button
              key={image.id}
              type="button"
              className={selectedImage === image.url ? 'active' : ''}
              onClick={() => onSelectImage(image.url)}
              aria-label={`Ver imagen ${index + 1}`}
            >
              <img src={image.displayUrl} alt="" />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function truncateLabel(value, max = 22) {
  const text = String(value || '')
  return text.length > max ? `${text.slice(0, max - 1)}…` : text
}

/**
 * Sección de garantía / confianza visible en el modal de producto.
 * Textos configurables — deben ajustarse a la política real del negocio.
 */
function ProductWarranty() {
  return (
    <div className="product-warranty">
      <p className="warranty-title">Tu compra está protegida</p>
      <ul className="warranty-items">
        <li className="warranty-item">
          <span className="warranty-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              <path d="M9 12l2 2 4-4" />
            </svg>
          </span>
          <span>Garantía de 30 días por maquinaria</span>
        </li>
        <li className="warranty-item">
          <span className="warranty-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
              <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
              <line x1="12" y1="22.08" x2="12" y2="12" />
            </svg>
          </span>
          <span>Incluye caja de calidad</span>
        </li>
        <li className="warranty-item">
          <span className="warranty-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="1" y="3" width="15" height="13" />
              <polygon points="16 8 20 8 23 11 23 16 16 16 16 8" />
              <circle cx="5.5" cy="18.5" r="2.5" />
              <circle cx="18.5" cy="18.5" r="2.5" />
            </svg>
          </span>
          <span>Entrega segura en Caracas, Guatire y Guarenas</span>
        </li>
      </ul>
    </div>
  )
}

function ActivityChart({ series }) {
  const width = 640
  const height = 220
  const pad = { top: 18, right: 16, bottom: 28, left: 36 }
  const points = series?.length ? series : []
  const maxY = Math.max(1, ...points.flatMap((day) => [day.pageViews, day.productViews, day.addToCart]))
  const innerW = width - pad.left - pad.right
  const innerH = height - pad.top - pad.bottom
  const x = (index) => pad.left + (points.length <= 1 ? innerW / 2 : (index / (points.length - 1)) * innerW)
  const y = (value) => pad.top + innerH - (value / maxY) * innerH
  const pathFor = (key) => points.map((day, index) => `${index === 0 ? 'M' : 'L'}${x(index)},${y(day[key])}`).join(' ')
  const areaFor = (key) => {
    if (!points.length) return ''
    return `${pathFor(key)} L${x(points.length - 1)},${pad.top + innerH} L${x(0)},${pad.top + innerH} Z`
  }
  const ticks = [0, 0.5, 1].map((ratio) => Math.round(maxY * ratio))

  return (
    <div className="chart-wrap">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Actividad diaria de los últimos 30 días">
        {ticks.map((tick) => (
          <g key={`tick-${tick}`}>
            <line x1={pad.left} x2={width - pad.right} y1={y(tick)} y2={y(tick)} className="chart-grid" />
            <text x={pad.left - 8} y={y(tick) + 4} className="chart-axis" textAnchor="end">{tick}</text>
          </g>
        ))}
        <path d={areaFor('pageViews')} className="chart-area-views" />
        <path d={pathFor('pageViews')} className="chart-line-views" fill="none" />
        <path d={pathFor('productViews')} className="chart-line-products" fill="none" />
        <path d={pathFor('addToCart')} className="chart-line-cart" fill="none" />
        {points.length > 0 && (
          <>
            <text x={pad.left} y={height - 8} className="chart-axis">{points[0].date.slice(5)}</text>
            <text x={width - pad.right} y={height - 8} className="chart-axis" textAnchor="end">{points[points.length - 1].date.slice(5)}</text>
          </>
        )}
      </svg>
      <div className="chart-legend">
        <span><i className="swatch views" />Visitas</span>
        <span><i className="swatch products" />Clicks producto</span>
        <span><i className="swatch cart" />Carrito</span>
      </div>
    </div>
  )
}

function BarChart({ items, labelKey = 'productName', valueKey = 'count', empty = 'Sin datos todavía.', formatValue, barClass }) {
  const rows = (items || []).slice(0, 8)
  const max = Math.max(1, ...rows.map((item) => Number(item[valueKey]) || 0))
  if (!rows.length) return <p className="admin-empty">{empty}</p>
  return (
    <ul className="bar-chart" aria-label="Ranking de productos">
      {rows.map((item) => {
        const value = Number(item[valueKey]) || 0
        return (
          <li key={`${item.productId || item[labelKey]}-${value}`}>
            <div className="bar-meta">
              <span>{truncateLabel(item[labelKey])}</span>
              <strong>{formatValue ? formatValue(item) : value}</strong>
            </div>
            <div className="bar-track" aria-hidden="true"><span className={barClass || undefined} style={{ width: `${(value / max) * 100}%` }} /></div>
          </li>
        )
      })}
    </ul>
  )
}

function FunnelChart({ summary }) {
  const steps = [
    { label: 'Visitas', value: summary.pageViews, tone: 'views' },
    { label: 'Clicks', value: summary.productViews, tone: 'products' },
    { label: 'Carrito', value: summary.addToCart, tone: 'cart' },
    { label: 'Ventas', value: summary.salesCount, tone: 'sales' },
  ]
  const max = Math.max(1, ...steps.map((step) => step.value))
  return (
    <ul className="funnel-chart" aria-label="Embudo de conversión">
      {steps.map((step) => (
        <li key={step.label}>
          <div className="funnel-meta"><span>{step.label}</span><strong>{step.value}</strong></div>
          <div className={`funnel-bar ${step.tone}`} style={{ width: `${Math.max(12, (step.value / max) * 100)}%` }} />
        </li>
      ))}
    </ul>
  )
}

function StockDonut({ total, unavailable }) {
  const available = Math.max(0, total - unavailable)
  const size = 160
  const stroke = 18
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const availableLength = total > 0 ? (available / total) * circumference : 0
  const unavailableLength = total > 0 ? (unavailable / total) * circumference : 0
  return (
    <div className="donut-chart">
      <svg viewBox={`0 0 ${size} ${size}`} role="img" aria-label="Disponibilidad de stock">
        <circle cx={size / 2} cy={size / 2} r={radius} className="donut-track" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          className="donut-available"
          strokeWidth={stroke}
          strokeDasharray={`${availableLength} ${circumference}`}
          strokeDashoffset={0}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          className="donut-unavailable"
          strokeWidth={stroke}
          strokeDasharray={`${unavailableLength} ${circumference}`}
          strokeDashoffset={-availableLength}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
        <text x="50%" y="48%" textAnchor="middle" className="donut-value">{total}</text>
        <text x="50%" y="62%" textAnchor="middle" className="donut-label">productos</text>
      </svg>
      <div className="chart-legend">
        <span><i className="swatch available" />Disponibles {available}</span>
        <span><i className="swatch unavailable" />Sin stock {unavailable}</span>
      </div>
    </div>
  )
}

function getSessionId() {
  try {
    const existing = localStorage.getItem(SESSION_STORAGE_KEY)
    if (existing) return existing
    const created = crypto.randomUUID()
    localStorage.setItem(SESSION_STORAGE_KEY, created)
    return created
  } catch {
    return `session-${Date.now()}`
  }
}

function trackEvent(type, payload = {}) {
  const body = {
    type,
    sessionId: getSessionId(),
    path: window.location.pathname + window.location.hash,
    ...payload,
  }
  fetch(`${apiUrl}/analytics`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    keepalive: true,
  }).catch(() => {})
}

function useAccessibleDialog(open, onClose, dialogRef) {
  const previousFocus = useRef(null)

  useEffect(() => {
    if (!open) return undefined
    previousFocus.current = document.activeElement
    const oldOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const dialog = dialogRef.current
    const focusable = dialog?.querySelector('button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), [tabindex]:not([tabindex="-1"])')
    focusable?.focus()

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
        return
      }
      if (event.key !== 'Tab' || !dialog) return
      const elements = [...dialog.querySelectorAll('button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), [tabindex]:not([tabindex="-1"])')]
      if (!elements.length) return
      const first = elements[0]
      const last = elements[elements.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = oldOverflow
      previousFocus.current?.focus?.()
    }
  }, [open, onClose, dialogRef])
}

function PriceBlock({ price, priceBs, className = '' }) {
  return (
    <div className={`price-block ${className}`.trim()}>
      <strong>{money(price)}</strong>
      {priceBs != null && <span className="price-bs">{moneyBs(priceBs)}</span>}
    </div>
  )
}

/** Etiquetas públicas para separar imitación vs originales. */
function categoryLabel(category) {
  if (!category) return ''
  if (category.slug === 'relojes') return 'Relojes estilo'
  if (category.slug === 'relojeria-original') return 'Relojería original'
  return category.name
}

/** Etiqueta clara para el cliente: imitación vs original. */
function collectionBadge(category) {
  if (!category?.slug) return null
  if (category.slug === 'relojeria-original') return { tone: 'original', label: 'Original' }
  if (category.slug === 'relojes') return { tone: 'style', label: 'Imitación' }
  return null
}

function productMetaLine(product) {
  const collection = categoryLabel(product.category)
  // En relojes la colección (imitación/original) manda; el tipo queda para filtros.
  if (product.category?.slug === 'relojeria-original' || product.category?.slug === 'relojes') {
    return [product.brand?.name, collection].filter(Boolean).join(' · ')
  }
  return [product.brand?.name, collection, product.productType].filter(Boolean).join(' · ')
}

function productRefLine(product) {
  const ref = publicSku(product.sku)
  return ref ? ` · Ref ${ref}` : ''
}

function AdminPanel({ onLogout }) {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [reclassifying, setReclassifying] = useState(false)
  const [syncingOriginal, setSyncingOriginal] = useState(false)
  const [repricing, setRepricing] = useState(false)
  const [adminTab, setAdminTab] = useState('resumen')
  const [saleSearch, setSaleSearch] = useState('')
  const [saleResults, setSaleResults] = useState([])
  const [saleNote, setSaleNote] = useState('')
  const [savingSale, setSavingSale] = useState(false)
  const [stockoutSearch, setStockoutSearch] = useState('')
  const [productSearch, setProductSearch] = useState('')
  const [productPage, setProductPage] = useState(1)
  const [productData, setProductData] = useState({ data: [], meta: { total: 0, page: 1, pageSize: 24, totalPages: 0 } })
  const [productLoading, setProductLoading] = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    setError('')
    adminFetch(`${apiUrl}/admin/overview`)
      .then((response) => {
        if (!response.ok) throw new Error(response.status === 401 ? 'Token inválido' : 'No se pudo cargar el panel')
        return response.json()
      })
      .then(setData)
      .catch((requestError) => setError(requestError.message))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (saleSearch.trim().length < 2) {
      setSaleResults([])
      return undefined
    }
    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      adminFetch(`${apiUrl}/admin/products?search=${encodeURIComponent(saleSearch.trim())}`, {
        signal: controller.signal,
      })
        .then((response) => response.ok ? response.json() : [])
        .then(setSaleResults)
        .catch((requestError) => {
          if (requestError.name !== 'AbortError') setSaleResults([])
        })
    }, 280)
    return () => {
      controller.abort()
      window.clearTimeout(timer)
    }
  }, [saleSearch])

  useEffect(() => {
    if (adminTab !== 'productos') return undefined
    const controller = new AbortController()
    setProductLoading(true)
    const params = new URLSearchParams()
    const q = productSearch.trim()
    if (q.length >= 2) params.set('search', q)
    params.set('page', String(productPage))
    params.set('pageSize', '24')
    adminFetch(`${apiUrl}/admin/products?${params}`, {
      signal: controller.signal,
    })
      .then((response) => {
        if (!response.ok) throw new Error('No se pudieron cargar productos')
        return response.json()
      })
      .then(setProductData)
      .catch((requestError) => {
        if (requestError.name !== 'AbortError') setProductData({ data: [], meta: { total: 0, page: 1, pageSize: 24, totalPages: 0 } })
      })
      .finally(() => setProductLoading(false))
    return () => controller.abort()
  }, [adminTab, productSearch, productPage])

  const reclassify = async () => {
    setReclassifying(true)
    try {
      const response = await adminFetch(`${apiUrl}/admin/reclassify`, {
        method: 'POST',
      })
      if (!response.ok) throw new Error('No se pudo reclasificar')
      await response.json()
      load()
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setReclassifying(false)
    }
  }

  const reprice = async () => {
    setRepricing(true)
    try {
      const response = await adminFetch(`${apiUrl}/admin/reprice`, {
        method: 'POST',
      })
      if (!response.ok) throw new Error('No se pudo actualizar precios')
      const result = await response.json()
      setError('')
      load()
      window.alert(`Precios actualizados: ${result.updated ?? 0} de ${result.total ?? '?'}`)
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setRepricing(false)
    }
  }

  const syncOriginal = async () => {
    setSyncingOriginal(true)
    try {
      const response = await adminFetch(`${apiUrl}/admin/sync-original`, {
        method: 'POST',
      })
      if (!response.ok) throw new Error('No se pudo iniciar la sincronización original')
      setError('')
      window.alert('Sincronización de Relojería original iniciada (Lua + Ecko). Puede tardar varios minutos; luego pulsa Actualizar.')
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setSyncingOriginal(false)
    }
  }

  const markSold = async (product) => {
    setSavingSale(true)
    try {
      const response = await adminFetch(`${apiUrl}/admin/sales`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          productId: product.id,
          quantity: 1,
          note: saleNote.trim() || undefined,
        }),
      })
      if (!response.ok) throw new Error('No se pudo registrar la venta')
      setSaleNote('')
      setSaleSearch('')
      setSaleResults([])
      load()
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setSavingSale(false)
    }
  }

  const removeSale = async (saleId) => {
    const response = await adminFetch(`${apiUrl}/admin/sales/${saleId}`, {
      method: 'DELETE',
    })
    if (response.ok) load()
  }

  if (loading) return <section className="admin-panel"><p className="admin-loading">Cargando panel…</p></section>
  if (error && !data) return <section className="admin-panel"><p className="status-message" role="alert">{error}</p><button onClick={onLogout}>Salir</button></section>
  if (!data) return null

  const exportMetricsCSV = () => {
    const rows = [
      ['Métrica', 'Valor'],
      ['Visitas', String(data.summary.pageViews)],
      ['Sesiones', String(data.summary.uniqueSessions)],
      ['Clicks', String(data.summary.productViews)],
      ['Carrito', String(data.summary.addToCart)],
      ['Ventas', String(data.summary.salesCount)],
      ['Revenue', String(data.revenue ?? 0)],
      ['Ticket promedio', String(data.averageTicket ?? 0)],
    ]
    const csv = rows.map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `kronos-metricas-${new Date().toISOString().slice(0, 10)}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  const filteredUnavailable = (data.unavailableProducts || []).filter((product) => {
    const q = stockoutSearch.trim().toLowerCase()
    if (!q) return true
    return [product.name, product.sku, product.brand, product.category, product.productType]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(q))
  })

  return (
    <section className="admin-panel">
      <div className="admin-hero-bar">
        <div>
          <p className="eyebrow">CONTROL PRIVADO</p>
          <h1>Panel KRONOS</h1>
          <p className="admin-meta">{data.adminEmail} · últimos {data.periodDays} días · {data.summary.productsTotal} productos</p>
        </div>
        <div className="admin-actions">
          <button type="button" onClick={exportMetricsCSV}>Exportar CSV</button>
          <button type="button" onClick={load}>Actualizar</button>
          <button type="button" onClick={reprice} disabled={repricing}>{repricing ? 'Re-preciando…' : 'Re-preciar'}</button>
          <button type="button" onClick={reclassify} disabled={reclassifying}>{reclassifying ? 'Reclasificando…' : 'Reclasificar'}</button>
          <button type="button" onClick={syncOriginal} disabled={syncingOriginal}>{syncingOriginal ? 'Sync original…' : 'Sync original'}</button>
          <button type="button" className="admin-logout" onClick={onLogout}>Salir</button>
        </div>
      </div>

      {error && <p className="admin-error" role="alert">{error}</p>}

      <nav className="admin-tabs" aria-label="Secciones del panel">
        <button type="button" className={`admin-tab-btn${adminTab === 'resumen' ? ' active' : ''}`} onClick={() => setAdminTab('resumen')}>Resumen</button>
        <button type="button" className={`admin-tab-btn${adminTab === 'productos' ? ' active' : ''}`} onClick={() => setAdminTab('productos')}>Productos</button>
      </nav>

      {adminTab === 'resumen' && (<>
      <div className="admin-stats">
        <article><span>Visitas</span><strong>{data.summary.pageViews}</strong></article>
        <article><span>Sesiones</span><strong>{data.summary.uniqueSessions}</strong></article>
        <article><span>Clicks</span><strong>{data.summary.productViews}</strong></article>
        <article><span>Carrito</span><strong>{data.summary.addToCart}</strong></article>
        <article className="stat-accent"><span>Ventas</span><strong>{data.summary.salesCount}</strong></article>
        <article className="stat-danger"><span>Sin stock</span><strong>{data.summary.productsUnavailable}</strong></article>
        <article><span>Ingresos totales</span><strong>{money(data.revenue ?? 0)}</strong></article>
        <article><span>Ticket promedio</span><strong>{money(data.averageTicket ?? 0)}</strong></article>
        <article><span>Catálogo</span><strong>{data.summary.productsTotal}</strong><small>{data.summary.productsAvailable ?? '—'} disp.</small></article>
        <article><span>Relojes estilo</span><strong>{data.summary.styleWatches ?? 0}</strong><small>{data.summary.styleWatchesAvailable ?? 0} disp.</small></article>
        <article><span>Relojería original</span><strong>{data.summary.originalWatches ?? 0}</strong><small>{data.summary.originalWatchesAvailable ?? 0} disp.</small></article>
      </div>

      {(data.catalogByCategory?.length || data.syncStatus) && (
        <div className="admin-catalog-panels">
          {!!data.catalogByCategory?.length && (
            <section className="admin-card">
              <div className="admin-card-head">
                <h2>Inventario por categoría</h2>
                <p>Totales al día, incluyendo imitación y originales.</p>
              </div>
              <ul className="admin-category-list">
                {data.catalogByCategory.map((row) => (
                  <li key={row.slug}>
                    <span>{row.name}</span>
                    <strong>{row.available}/{row.total}</strong>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {data.syncStatus && (
            <section className="admin-card">
              <div className="admin-card-head">
                <h2>Sync automático</h2>
                <p>VOLKOVA {data.syncStatus.schedule?.volkova} · Original {data.syncStatus.schedule?.original}</p>
              </div>
              <div className="admin-sync-status-grid">
                <article>
                  <p className="eyebrow">VOLKOVA / estilo</p>
                  <strong className={`sync-status sync-${data.syncStatus.volkova?.status || 'idle'}`}>{data.syncStatus.volkova?.status || 'sin datos'}</strong>
                  <p>{data.syncStatus.volkova ? new Date(data.syncStatus.volkova.startedAt).toLocaleString('es-VE') : 'Aún no hay sync'}</p>
                  {data.syncStatus.volkova && <p>Encontrados {data.syncStatus.volkova.productsFound} · Nuevos {data.syncStatus.volkova.productsAdded}</p>}
                </article>
                <article>
                  <p className="eyebrow">Lua + Ecko / original</p>
                  <strong className={`sync-status sync-${data.syncStatus.original?.status || 'idle'}`}>{data.syncStatus.original?.status || 'sin datos'}</strong>
                  <p>{data.syncStatus.original ? new Date(data.syncStatus.original.startedAt).toLocaleString('es-VE') : 'Aún no hay sync'}</p>
                  {data.syncStatus.original && <p>Encontrados {data.syncStatus.original.productsFound} · Nuevos {data.syncStatus.original.productsAdded}</p>}
                </article>
              </div>
            </section>
          )}
        </div>
      )}

      <div className="admin-charts">
        <section className="admin-card admin-chart-wide">
          <div className="admin-card-head">
            <h2>Actividad · 30 días</h2>
            <p>Visitas, clicks a productos y agregados al carrito por día.</p>
          </div>
          <ActivityChart series={data.dailySeries || []} />
        </section>
        <section className="admin-card">
          <div className="admin-card-head">
            <h2>Embudo</h2>
            <p>De visita a venta registrada.</p>
          </div>
          <FunnelChart summary={data.summary} />
        </section>
        <section className="admin-card">
          <div className="admin-card-head">
            <h2>Stock</h2>
            <p>Disponibles vs sin stock del catálogo completo.</p>
          </div>
          <StockDonut total={data.summary.productsTotal} unavailable={data.summary.productsUnavailable} />
        </section>
        <section className="admin-card">
          <div className="admin-card-head">
            <h2>Más vistos</h2>
            <p>Top productos por clicks.</p>
          </div>
          <BarChart items={data.topViewedProducts} />
        </section>
        <section className="admin-card">
          <div className="admin-card-head">
            <h2>Más al carrito</h2>
            <p>Top productos agregados.</p>
          </div>
          <BarChart items={data.topCartProducts} />
        </section>
        <section className="admin-card">
          <div className="admin-card-head">
            <h2>Ingresos por categoría</h2>
            <p>Top 8 por ingresos registrados.</p>
          </div>
          <BarChart
            items={data.revenueByCategory || []}
            labelKey="category"
            valueKey="revenue"
            empty="Sin ventas registradas en el período."
            formatValue={(item) => `${money(item.revenue)} · ${item.sales} uds`}
            barClass="revenue"
          />
        </section>
      </div>

      <section className="admin-card admin-stockout">
        <div className="admin-card-head">
          <h2>Sin stock · {data.summary.productsUnavailable}</h2>
          <p>Productos marcados no disponibles según la última sync de VOLKOVAMEN.</p>
        </div>
        <div className="admin-stockout-tools">
          <input
            type="search"
            value={stockoutSearch}
            onChange={(event) => setStockoutSearch(event.target.value)}
            placeholder="Filtrar sin stock por nombre, ref o marca…"
            aria-label="Filtrar productos sin stock"
          />
          <span>{filteredUnavailable.length} visibles</span>
        </div>
        <ul className="admin-stockout-list">
          {filteredUnavailable.map((product) => (
            <li key={product.id}>
              {product.imageUrl ? <img src={product.imageUrl} alt="" /> : <div className="admin-stockout-ph">K</div>}
              <div>
                <strong>{product.name}</strong>
                <small>
                  {[product.brand, product.category, product.productType].filter(Boolean).join(' · ')}
                  {product.sku ? ` · Ref ${product.sku}` : ''}
                  {` · ${money(product.price)}`}
                </small>
              </div>
            </li>
          ))}
          {!filteredUnavailable.length && <li className="admin-empty">No hay productos sin stock con ese filtro.</li>}
        </ul>
      </section>

      <div className="admin-layout">
        <section className="admin-card admin-sales">
          <div className="admin-card-head">
            <h2>Registrar venta</h2>
            <p>Solo control interno. No cambia el stock del catálogo.</p>
          </div>
          <div className="admin-sale-form">
            <label>
              <span>Producto</span>
              <input
                type="search"
                value={saleSearch}
                onChange={(event) => setSaleSearch(event.target.value)}
                placeholder="Buscar por nombre o ref…"
              />
            </label>
            <label>
              <span>Nota</span>
              <input
                type="text"
                value={saleNote}
                onChange={(event) => setSaleNote(event.target.value)}
                placeholder="Cliente, color, etc."
              />
            </label>
          </div>
          {!!saleResults.length && (
            <ul className="admin-sale-results">
              {saleResults.map((product) => (
                <li key={product.id}>
                  <div>
                    <strong>{product.name}</strong>
                    <small>{product.sku ? `Ref ${product.sku}` : 'Sin ref'} · {money(product.price)}{product.available ? '' : ' · sin stock VOLKOVA'}</small>
                  </div>
                  <button type="button" onClick={() => markSold(product)} disabled={savingSale}>Vendido</button>
                </li>
              ))}
            </ul>
          )}
          <h3>Historial de ventas</h3>
          <ul className="admin-sale-list">
            {(data.sales || []).map((sale) => (
              <li key={sale.id}>
                <div>
                  <strong>{sale.productName}</strong>
                  <small>
                    {new Date(sale.soldAt).toLocaleString('es-VE')}
                    {sale.sku ? ` · Ref ${sale.sku}` : ''}
                    {sale.priceUsd != null ? ` · ${money(sale.priceUsd)}` : ''}
                    {sale.note ? ` · ${sale.note}` : ''}
                  </small>
                </div>
                <button type="button" className="remove-item" onClick={() => removeSale(sale.id)}>Quitar</button>
              </li>
            ))}
            {!data.sales?.length && <li className="admin-empty">Aún no registraste ventas.</li>}
          </ul>
        </section>

        <div className="admin-side">
          <section className="admin-card">
            <div className="admin-card-head">
              <h2>Más al carrito</h2>
            </div>
            <ul>{data.topCartProducts.map((item) => <li key={`cart-${item.productId}`}><span>{item.productName}</span><strong>{item.count}</strong></li>)}
              {!data.topCartProducts.length && <li className="admin-empty">Sin datos todavía.</li>}
            </ul>
          </section>
          <section className="admin-card">
            <div className="admin-card-head">
              <h2>Más vistos</h2>
            </div>
            <ul>{data.topViewedProducts.map((item) => <li key={`view-${item.productId}`}><span>{item.productName}</span><strong>{item.count}</strong></li>)}
              {!data.topViewedProducts.length && <li className="admin-empty">Sin datos todavía.</li>}
            </ul>
          </section>
        </div>
      </div>

      <section className="admin-card admin-syncs">
        <div className="admin-card-head">
          <h2>Historial de importaciones</h2>
          <p>VOLKOVA (estilo) y Lua/Ecko (original). El stock se actualiza por fuente, sin cruzarse.</p>
        </div>
        {data.syncRuns.map((run) => (
          <article key={run.id} className="admin-sync">
            <div className="admin-sync-top">
              <strong className={`sync-status sync-${run.status}`}>{run.status}</strong>
              <span className="sync-source">{run.source === 'original' ? 'Original · Lua/Ecko' : 'Estilo · VOLKOVA'}</span>
              <span>{new Date(run.startedAt).toLocaleString('es-VE')}</span>
            </div>
            <p>Encontrados: {run.productsFound} · Nuevos: {run.productsAdded} · Sin stock: {run.productsUnavailable ?? 0}</p>
            {run.error && <p className="admin-error">{run.error}</p>}
            {!!run.additions?.length && (
              <ul>
                {run.additions.map((item) => <li key={item.id}>{item.productName}{item.sku ? ` · ${item.sku}` : ''}</li>)}
              </ul>
            )}
          </article>
        ))}
        {!data.syncRuns.length && <p className="admin-empty">Aún no hay sincronizaciones registradas.</p>}
      </section>
      </>)}

      {adminTab === 'productos' && (
        <section className="admin-card admin-products">
          <div className="admin-card-head">
            <h2>Productos</h2>
            <p>{productData.meta.total} productos en total.</p>
          </div>
          <div className="admin-products-tools">
            <input
              type="search"
              value={productSearch}
              onChange={(event) => { setProductSearch(event.target.value); setProductPage(1) }}
              placeholder="Buscar por nombre o SKU…"
              aria-label="Buscar productos"
            />
          </div>
          {productLoading ? (
            <p className="admin-loading">Cargando productos…</p>
          ) : (
            <>
              <table className="admin-products-table">
                <thead>
                  <tr>
                    <th>Nombre / SKU</th>
                    <th>Categoría</th>
                    <th>Precio</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {productData.data.map((product) => (
                    <tr key={product.id}>
                      <td>
                        <strong>{product.name}</strong>
                        {product.sku && <small>{product.sku}</small>}
                      </td>
                      <td>{product.category?.name ?? '—'}</td>
                      <td>{money(product.price)}</td>
                      <td>
                        <span className={`badge${product.available ? '' : ' badge-danger'}`}>
                          {product.available ? 'Disponible' : 'Sin stock'}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {!productData.data.length && (
                    <tr><td colSpan={4} className="admin-empty">No se encontraron productos.</td></tr>
                  )}
                </tbody>
              </table>
              {productData.meta.totalPages > 1 && (
                <div className="admin-products-pagination">
                  <button type="button" onClick={() => setProductPage((p) => Math.max(1, p - 1))} disabled={productPage <= 1}>← Anterior</button>
                  <span>Página {productData.meta.page} de {productData.meta.totalPages}</span>
                  <button type="button" onClick={() => setProductPage((p) => Math.min(productData.meta.totalPages, p + 1))} disabled={productPage >= productData.meta.totalPages}>Siguiente →</button>
                </div>
              )}
            </>
          )}
        </section>
      )}
    </section>
  )
}

function App() {
  const [view, setView] = useState(() => (window.location.hash === '#admin' ? 'admin' : 'store'))
  const [adminAuth, setAdminAuth] = useState('idle') // 'idle' | 'checking' | 'logged-in' | 'logged-out'
  const [adminInput, setAdminInput] = useState('')
  const [products, setProducts] = useState([])
  const [categories, setCategories] = useState([])
  const [watchBrands, setWatchBrands] = useState([])
  const [watchTypes, setWatchTypes] = useState([])
  const [cart, setCart] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('kronos-cart') ?? '[]')
    } catch {
      return []
    }
  })
  const [filters, setFilters] = useState({ search: '', category: '', brand: '', type: '', sort: 'recent' })
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(1)
  const [totalProducts, setTotalProducts] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState('')
  const [categoryError, setCategoryError] = useState(false)
  const [selected, setSelected] = useState(null)
  const [selectedImage, setSelectedImage] = useState(null)
  const [cartOpen, setCartOpen] = useState(false)
  const [selectedAdvisor, setSelectedAdvisor] = useState(0)
  const [showAdvisors, setShowAdvisors] = useState(false)
  const [deepLinkError, setDeepLinkError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)
  const productDialogRef = useRef(null)
  const cartDialogRef = useRef(null)
  const isWatches = filters.category === 'relojes' || filters.category === 'relojeria-original'

  const parseProductSlugFromHash = useCallback(() => {
    const hash = window.location.hash
    const match = hash.match(/^#\/producto\/(.+)$/)
    return match ? decodeURIComponent(match[1]) : null
  }, [])

  const closeProduct = useCallback(() => {
    setSelected(null)
    setDeepLinkError('')
    if (window.location.hash.startsWith('#/producto/')) {
      window.history.replaceState(null, '', window.location.pathname + window.location.search + '#')
    }
  }, [])
  const openProduct = useCallback((product) => {
    setSelected(product)
    setSelectedImage(product.imageUrl || product.images?.[0]?.url || null)
    setDeepLinkError('')
    trackEvent('product_view', { productId: product.id, productName: product.name })
    if (product.slug && !window.location.hash.startsWith('#/producto/')) {
      window.history.pushState(null, '', `#/producto/${product.slug}`)
    }
  }, [])
  const closeCart = useCallback(() => setCartOpen(false), [])
  useAccessibleDialog(Boolean(selected), closeProduct, productDialogRef)
  useAccessibleDialog(cartOpen, closeCart, cartDialogRef)

  useEffect(() => {
    const onHash = () => setView(window.location.hash === '#admin' ? 'admin' : 'store')
    window.addEventListener('hashchange', onHash)
    trackEvent('page_view')
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  /* Deep linking: open product from hash on mount */
  useEffect(() => {
    if (view !== 'store') return undefined
    const slug = parseProductSlugFromHash()
    if (!slug || selected) return undefined

    const found = products.find((p) => p.slug === slug)
    if (found) {
      openProduct(found)
      return undefined
    }

    if (products.length === 0 && loading) return undefined

    let cancelled = false
    fetchProductBySlug(slug)
      .then((product) => {
        if (!cancelled && product) {
          setSelected(product)
          setSelectedImage(product.imageUrl || product.images?.[0]?.url || null)
          window.history.replaceState(null, '', `#/producto/${product.slug}`)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setDeepLinkError('Producto no encontrado. Redirigiendo al catálogo…')
          window.setTimeout(() => {
            window.history.replaceState(null, '', window.location.pathname + window.location.search + '#')
            setDeepLinkError('')
          }, 2200)
        }
      })
    return () => { cancelled = true }
  }, [view, products, loading, openProduct, parseProductSlugFromHash, selected])

  /* Deep linking: respond to hashchange (browser back/forward) */
  useEffect(() => {
    if (view !== 'store') return undefined
    let cancelled = false
    const onHashDeepLink = () => {
      const slug = parseProductSlugFromHash()
      if (slug && !selected) {
        const found = products.find((p) => p.slug === slug)
        if (found) {
          openProduct(found)
        } else if (products.length > 0) {
          fetchProductBySlug(slug)
            .then((product) => {
              if (!cancelled && product) {
                setSelected(product)
                setSelectedImage(product.imageUrl || product.images?.[0]?.url || null)
              }
            })
            .catch(() => {
              if (!cancelled) {
                setDeepLinkError('Producto no encontrado.')
                window.setTimeout(() => setDeepLinkError(''), 2000)
              }
            })
        }
      } else if (!slug && selected) {
        closeProduct()
      }
    }
    window.addEventListener('hashchange', onHashDeepLink)
    return () => {
      cancelled = true
      window.removeEventListener('hashchange', onHashDeepLink)
    }
  }, [view, products, selected, openProduct, parseProductSlugFromHash, closeProduct])

  useEffect(() => {
    if (view !== 'admin') return undefined
    setAdminAuth('checking')
    const controller = new AbortController()
    adminFetch(`${apiUrl}/admin/overview`, { signal: controller.signal })
      .then((response) => {
        if (response.ok) setAdminAuth('logged-in')
        else setAdminAuth('logged-out')
      })
      .catch(() => {
        if (!controller.signal.aborted) setAdminAuth('logged-out')
      })
    return () => controller.abort()
  }, [view])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setPage(1)
      setDebouncedSearch(filters.search.trim())
    }, 350)
    return () => window.clearTimeout(timer)
  }, [filters.search])

  useEffect(() => {
    if (view !== 'store') return undefined
    const controller = new AbortController()
    fetch(`${apiUrl}/categories`, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error('No se pudieron cargar las categorías')
        return response.json()
      })
      .then((data) => {
        setCategories(data)
        setCategoryError(false)
      })
      .catch((requestError) => {
        if (requestError.name !== 'AbortError') setCategoryError(true)
      })
    return () => controller.abort()
  }, [reloadKey, view])

  useEffect(() => {
    if (view !== 'store' || !isWatches) {
      setWatchBrands([])
      setWatchTypes([])
      return undefined
    }
    const controller = new AbortController()
    const brandsUrl = `${apiUrl}/brands?category=${encodeURIComponent(filters.category)}`
    const typesParams = new URLSearchParams({ category: filters.category })
    if (filters.brand) typesParams.set('brand', filters.brand)

    Promise.all([
      fetch(brandsUrl, { signal: controller.signal }).then((response) => response.ok ? response.json() : []),
      fetch(`${apiUrl}/product-types?${typesParams}`, { signal: controller.signal }).then((response) => response.ok ? response.json() : []),
    ])
      .then(([brands, types]) => {
        setWatchBrands(brands)
        setWatchTypes(types)
      })
      .catch((requestError) => {
        if (requestError.name !== 'AbortError') {
          setWatchBrands([])
          setWatchTypes([])
        }
      })
    return () => controller.abort()
  }, [filters.brand, filters.category, isWatches, reloadKey, view])

  useEffect(() => {
    if (view !== 'store') return undefined
    const controller = new AbortController()
    const params = new URLSearchParams({
      page: String(page),
      limit: String(PAGE_SIZE),
      sort: filters.sort,
    })
    if (debouncedSearch) params.set('search', debouncedSearch)
    if (filters.category) params.set('category', filters.category)
    if (filters.brand) params.set('brand', filters.brand)
    if (filters.type) params.set('type', filters.type)

    if (page === 1) setLoading(true)
    else setLoadingMore(true)
    setError('')

    fetch(`${apiUrl}/products?${params}`, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error('No se pudo cargar el catálogo')
        return response.json()
      })
      .then((data) => {
        setProducts((current) => page === 1 ? (data.items ?? []) : [...current, ...(data.items ?? [])])
        setPages(data.pages || 1)
        setTotalProducts(data.total || 0)
      })
      .catch((requestError) => {
        if (requestError.name !== 'AbortError') setError('No pudimos cargar los productos. Revisa tu conexión e inténtalo otra vez.')
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false)
          setLoadingMore(false)
        }
      })
    return () => controller.abort()
  }, [debouncedSearch, filters.brand, filters.category, filters.sort, filters.type, page, reloadKey, view])

  useEffect(() => {
    localStorage.setItem('kronos-cart', JSON.stringify(cart))
  }, [cart])

  const changeCategory = (category) => {
    setFilters((current) => ({ ...current, category, brand: '', type: '' }))
    setPage(1)
  }
  const changeBrand = (brand) => {
    setFilters((current) => ({ ...current, brand, type: '' }))
    setPage(1)
  }
  const changeType = (type) => {
    setFilters((current) => ({ ...current, type }))
    setPage(1)
  }
  const changeSort = (sort) => {
    setFilters((current) => ({ ...current, sort }))
    setPage(1)
  }
  const addToCart = (product) => {
    setCart((current) => {
      const found = current.find((item) => item.id === product.id)
      return found
        ? current.map((item) => item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item)
        : [...current, { ...product, quantity: 1 }]
    })
    trackEvent('add_to_cart', { productId: product.id, productName: product.name })
  }
  const updateQuantity = (id, quantity) => {
    if (quantity < 1) {
      setCart((current) => current.filter((item) => item.id !== id))
      return
    }
    setCart((current) => current.map((item) => item.id === id ? { ...item, quantity } : item))
  }
  const itemCount = cart.reduce((sum, item) => sum + item.quantity, 0)
  const total = cart.reduce((sum, item) => sum + Number(item.price) * item.quantity, 0)
  const totalBs = cart.reduce((sum, item) => sum + Number(item.priceBs || 0) * item.quantity, 0)
  const cartMessage = buildCartWhatsApp(cart, advisors[selectedAdvisor], total, totalBs)
  const generalMessage = (advisor) => buildGeneralWhatsApp(advisor)

  const loginAdmin = async (event) => {
    event.preventDefault()
    const token = adminInput.trim()
    if (!token) return
    try {
      const response = await adminFetch(`${apiUrl}/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      })
      if (response.ok) {
        setAdminInput('')
        setAdminAuth('logged-in')
      } else {
        window.alert('Token inválido')
      }
    } catch {
      window.alert('Error de conexión')
    }
  }

  const logoutAdmin = async () => {
    try {
      await adminFetch(`${apiUrl}/admin/logout`, { method: 'POST' })
    } catch {
      // ignore — clear local state either way
    }
    setAdminAuth('logged-out')
    window.location.hash = ''
    setView('store')
  }

  if (view === 'admin') {
    return (
      <main className="admin-shell">
        <header>
          <a className="brand" href="/#" onClick={() => setView('store')} aria-label="KRONOS, volver al catálogo">
            <img src="/kronos-logo.jpg" alt="KRONOS" width="160" height="87" />
          </a>
          <div className="header-actions">
            <a className="admin-tab" href="/#">Catálogo</a>
            <span className="admin-tab active" aria-current="page">Admin</span>
          </div>
        </header>
        {adminAuth === 'checking' ? (
          <section className="admin-login">
            <div className="admin-login-visual" aria-hidden="true" />
            <div className="admin-login-card">
              <p className="eyebrow">ACCESO PRIVADO</p>
              <h1>Admin KRONOS</h1>
              <p className="admin-loading">Verificando sesión…</p>
            </div>
          </section>
        ) : adminAuth !== 'logged-in' ? (
          <section className="admin-login">
            <div className="admin-login-visual" aria-hidden="true" />
            <div className="admin-login-card">
              <p className="eyebrow">ACCESO PRIVADO</p>
              <h1>Admin KRONOS</h1>
              <p>Solo para el dueño. Los clientes no necesitan login.</p>
              <form onSubmit={loginAdmin}>
                <label>
                  <span>Token de administración</span>
                  <input type="password" value={adminInput} onChange={(event) => setAdminInput(event.target.value)} placeholder="Pega tu token" autoComplete="current-password" />
                </label>
                <button type="submit">Entrar al panel</button>
              </form>
            </div>
          </section>
        ) : (
          <AdminPanel onLogout={logoutAdmin} />
        )}
      </main>
    )
  }

  return <main>
    <header>
      <a className="brand" href="/" aria-label="KRONOS, inicio">
        <img src="/kronos-logo.jpg" alt="KRONOS" width="148" height="81" />
      </a>
      <div className="header-actions">
        <a className="admin-tab" href="#admin">Admin</a>
        <button className="contact-trigger" onClick={() => setShowAdvisors(true)}>Asesores</button>
        <button className="cart-button" onClick={() => setCartOpen(true)} aria-label={`Abrir carrito, ${itemCount} productos`}>Carrito ({itemCount})</button>
      </div>
    </header>

    <section className="hero" aria-label="KRONOS">
      <div className="hero-stage">
        <picture className="hero-bg-picture" aria-hidden="true">
          <source srcSet="/hero-lifestyle.avif" type="image/avif" />
          <source srcSet="/hero-lifestyle.webp" type="image/webp" />
          <img className="hero-bg" src="/hero-lifestyle.jpg" alt="" fetchPriority="high" />
        </picture>
        <div className="hero-veil" aria-hidden="true" />
        <div className="hero-copy">
          <p className="hero-brand-name">KRONOS</p>
          <p className="hero-tag">Precisión y estilo · Relojería exclusiva</p>
          <h1>El tiempo, a tu manera.</h1>
          <p className="hero-lead">Relojes, bolsos, bandoleros y regalos seleccionados para ti.</p>
          <a className="hero-cta" href="#catalogo">Explorar colección <span aria-hidden="true">↓</span></a>
        </div>
      </div>
    </section>

    <section className="collection-rails" aria-label="Colecciones de relojería">
      <article className="collection-card collection-card-style">
        <p className="collection-kicker">Colección estilo</p>
        <h2>Relojes imitación</h2>
        <p>Diseños de moda inspirados en las grandes marcas. Ideal para uso diario con gran variedad y mejor precio.</p>
        <button type="button" className="collection-cta" onClick={() => { changeCategory('relojes'); document.getElementById('catalogo')?.scrollIntoView({ behavior: 'smooth' }) }}>
          Ver relojes estilo
        </button>
      </article>
      <article className="collection-card collection-card-original">
        <p className="collection-kicker">Colección certificada</p>
        <h2>Relojería original</h2>
        <p>Piezas 100% originales: Citizen, Seiko, Tissot, Cartier, TAG Heuer y más.</p>
        <button type="button" className="collection-cta" onClick={() => { changeCategory('relojeria-original'); document.getElementById('catalogo')?.scrollIntoView({ behavior: 'smooth' }) }}>
          Ver relojería original
        </button>
      </article>
    </section>

    <section className="toolbar" aria-label="Filtros del catálogo">
      <label className="search-field">
        <span className="sr-only">Buscar productos</span>
        <span className="search-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M10.5 3a7.5 7.5 0 0 1 5.95 12.1l3.72 3.73-1.34 1.34-3.73-3.72A7.5 7.5 0 1 1 10.5 3Zm0 2a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11Z" /></svg>
        </span>
        <input type="search" placeholder="Buscar productos, marca o referencia…" value={filters.search} onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))} />
      </label>
      <label className="sort-field"><span className="sr-only">Ordenar productos</span><select value={filters.sort} onChange={(event) => changeSort(event.target.value)}><option value="recent">Recientes</option><option value="name">Alfabético</option><option value="price-asc">Menor precio</option><option value="price-desc">Mayor precio</option></select></label>
    </section>

    <nav className="mobile-categories" aria-label="Categorías">
      <button className={!filters.category ? 'active' : ''} onClick={() => changeCategory('')}>Todos</button>
      {categories.map((category) => <button key={category.id} className={filters.category === category.slug ? 'active' : ''} onClick={() => changeCategory(category.slug)}>{categoryLabel(category)}</button>)}
    </nav>

    {isWatches && (
      <section className="watch-filters" aria-label="Filtros de relojes">
        <div>
          <p>Marca</p>
          <div className="filter-chips">
            <button className={!filters.brand ? 'active' : ''} onClick={() => changeBrand('')}>Todas</button>
            {watchBrands.map((brand) => (
              <button key={brand.id} className={filters.brand === brand.slug ? 'active' : ''} onClick={() => changeBrand(brand.slug)}>
                {brand.name}{brand._count?.products ? ` (${brand._count.products})` : ''}
              </button>
            ))}
          </div>
        </div>
        <div>
          <p>Tipo</p>
          <div className="filter-chips">
            <button className={!filters.type ? 'active' : ''} onClick={() => changeType('')}>Todos</button>
            {watchTypes.map((type) => (
              <button key={type.name} className={filters.type === type.name ? 'active' : ''} onClick={() => changeType(type.name)}>
                {type.name} ({type.count})
              </button>
            ))}
          </div>
        </div>
      </section>
    )}

    <section className="catalog" id="catalogo">
      <aside aria-label="Categorías">
        <h2>Categorías</h2>
        <button className={!filters.category ? 'active' : ''} onClick={() => changeCategory('')}>Todos los productos</button>
        {categories.map((category) => <button key={category.id} className={filters.category === category.slug ? 'active' : ''} onClick={() => changeCategory(category.slug)}>{categoryLabel(category)} <span>{category._count?.products ?? ''}</span></button>)}
        {isWatches && !!watchBrands.length && <>
          <h2 className="aside-subtitle">Marcas</h2>
          <button className={!filters.brand ? 'active' : ''} onClick={() => changeBrand('')}>Todas las marcas</button>
          {watchBrands.map((brand) => <button key={brand.id} className={filters.brand === brand.slug ? 'active' : ''} onClick={() => changeBrand(brand.slug)}>{brand.name} <span>{brand._count?.products ?? ''}</span></button>)}
        </>}
        {isWatches && !!watchTypes.length && <>
          <h2 className="aside-subtitle">Tipos</h2>
          <button className={!filters.type ? 'active' : ''} onClick={() => changeType('')}>Todos los tipos</button>
          {watchTypes.map((type) => <button key={type.name} className={filters.type === type.name ? 'active' : ''} onClick={() => changeType(type.name)}>{type.name} <span>{type.count}</span></button>)}
        </>}
        {categoryError && <small className="aside-error">No se cargaron las categorías.</small>}
      </aside>

      <div className="catalog-results">
        {!loading && !error && <p className="result-count" aria-live="polite">Mostrando {products.length} de {totalProducts} productos</p>}
        {loading && <div className="grid skeleton-grid" aria-label="Cargando productos" aria-busy="true">{Array.from({ length: 8 }, (_, index) => <div className="skeleton-card" key={index}><span /><span /><span /></div>)}</div>}
        {!loading && error && <div className="status-message" role="alert"><p>{error}</p><button onClick={() => setReloadKey((current) => current + 1)}>Reintentar</button></div>}
        {!loading && !error && <div className="grid">
          {products.map((product) => {
            const badge = collectionBadge(product.category)
            return (
          <article className={`product${product.available ? '' : ' unavailable'}`} key={product.id}>
            <button className="image-button" onClick={() => openProduct(product)} aria-label={`Ver detalles de ${product.name}`}>
              {product.imageUrl ? <img src={productImageSrc(product.imageUrl, product.updatedAt)} alt={product.name} loading="lazy" decoding="async" /> : <div className="image-placeholder">KRONOS</div>}
              {badge && <span className={`collection-badge collection-badge-${badge.tone}`}>{badge.label}</span>}
              {!product.available && <span className="stock-badge">Sin stock</span>}
            </button>
            <p className="product-category">{productMetaLine(product)}{productRefLine(product)}</p>
            <h3>{product.name}</h3>
            <PriceBlock price={product.price} priceBs={product.priceBs} />
            <button className="add-button" onClick={() => addToCart(product)} disabled={!product.available}>{product.available ? 'AGREGAR' : 'SIN STOCK'}</button>
            <a className="product-whatsapp-btn" href={whatsappUrl(advisors[0], buildMarketplaceWhatsApp(product))} target="_blank" rel="noreferrer" aria-label={`Consultar ${product.name} por WhatsApp`}>
              <svg viewBox="0 0 32 32" fill="currentColor" aria-hidden="true"><path d="M16.04 3A12.74 12.74 0 0 0 5.06 22.2L3 29l7-1.91A12.8 12.8 0 1 0 16.04 3Zm0 23.35c-2.1 0-4.17-.56-5.97-1.62l-.43-.25-4.15 1.13 1.18-4.04-.28-.44a10.25 10.25 0 1 1 9.65 5.22Zm5.62-7.68c-.31-.15-1.82-.9-2.1-1-.28-.1-.49-.15-.69.16-.2.3-.8 1-1 1.2-.18.2-.36.23-.67.08-1.82-.91-3.02-1.63-4.23-3.7-.32-.55.32-.51.91-1.7.1-.2.05-.38-.03-.53-.08-.16-.69-1.66-.95-2.27-.25-.6-.5-.52-.69-.53h-.59c-.2 0-.54.08-.82.38-.28.31-1.08 1.06-1.08 2.58 0 1.51 1.1 2.98 1.26 3.18.15.2 2.17 3.31 5.25 4.64 1.95.84 2.72.91 3.7.77 1.18-.18 1.82-1.21 2.08-2.38.25-1.18.25-2.18.18-2.39-.08-.2-.28-.3-.59-.46Z" /></svg>
              Consultar
            </a>
          </article>
            )
          })}
          {!products.length && (
            <p className="empty">
              {filters.category === 'relojeria-original'
                ? 'Aún no hay relojería original disponible.'
                : 'No encontramos productos con esos filtros.'}
            </p>
          )}
        </div>}
        {!loading && !error && page < pages && <div className="load-more"><button onClick={() => setPage((current) => current + 1)} disabled={loadingMore}>{loadingMore ? 'Cargando…' : `Cargar más (${totalProducts - products.length} restantes)`}</button></div>}
      </div>
    </section>

    {selected && <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && closeProduct()}>
      <section className="modal product-modal" ref={productDialogRef} role="dialog" aria-modal="true" aria-labelledby="product-dialog-title">
        <button className="close" onClick={closeProduct} aria-label="Cerrar detalles">×</button>
        <ProductGallery product={selected} selectedImage={selectedImage} onSelectImage={setSelectedImage} />
        {(() => {
          const badge = collectionBadge(selected.category)
          if (!badge) return null
          return (
            <p className={`collection-badge-inline collection-badge-${badge.tone}`}>
              {badge.label === 'Original' ? 'Relojería original · 100% auténtico' : 'Relojes estilo · imitación'}
            </p>
          )
        })()}
        <p className="product-category">{productMetaLine(selected)}{productRefLine(selected)}</p>
        <h2 id="product-dialog-title">{selected.name}</h2>
        {!selected.available && <p className="stock-note">Sin stock por ahora. Puedes consultar por WhatsApp por si vuelve.</p>}
        <p>{publicDescription(selected.description) || 'Producto disponible por encargo.'}</p>
        <PriceBlock price={selected.price} priceBs={selected.priceBs} />
        <ProductWarranty />
        <div className="modal-cta-group">
          <a className="marketplace-whatsapp-btn" href={whatsappUrl(advisors[selectedAdvisor], buildMarketplaceWhatsApp(selected))} target="_blank" rel="noreferrer">
            <svg viewBox="0 0 32 32" fill="currentColor" aria-hidden="true"><path d="M16.04 3A12.74 12.74 0 0 0 5.06 22.2L3 29l7-1.91A12.8 12.8 0 1 0 16.04 3Zm0 23.35c-2.1 0-4.17-.56-5.97-1.62l-.43-.25-4.15 1.13 1.18-4.04-.28-.44a10.25 10.25 0 1 1 9.65 5.22Zm5.62-7.68c-.31-.15-1.82-.9-2.1-1-.28-.1-.49-.15-.69.16-.2.3-.8 1-1 1.2-.18.2-.36.23-.67.08-1.82-.91-3.02-1.63-4.23-3.7-.32-.55.32-.51.91-1.7.1-.2.05-.38-.03-.53-.08-.16-.69-1.66-.95-2.27-.25-.6-.5-.52-.69-.53h-.59c-.2 0-.54.08-.82.38-.28.31-1.08 1.06-1.08 2.58 0 1.51 1.1 2.98 1.26 3.18.15.2 2.17 3.31 5.25 4.64 1.95.84 2.72.91 3.7.77 1.18-.18 1.82-1.21 2.08-2.38.25-1.18.25-2.18.18-2.39-.08-.2-.28-.3-.59-.46Z" /></svg>
            Consultar por WhatsApp
          </a>
          <div className="marketplace-advisor-select" role="radiogroup" aria-label="Seleccionar asesor">
            {advisors.map((advisor, index) => (
              <label key={advisor.number}>
                <input type="radio" name="modal-advisor" className="sr-only" checked={selectedAdvisor === index} onChange={() => setSelectedAdvisor(index)} />
                <span>{advisor.label}</span>
              </label>
            ))}
          </div>
          <button className="add-button modal-add-secondary" onClick={() => addToCart(selected)} disabled={!selected.available}>{selected.available ? 'Agregar al carrito' : 'Sin stock'}</button>
        </div>
      </section>
    </div>}

    {deepLinkError && <div className="deep-link-toast" role="alert">{deepLinkError}</div>}

    {cartOpen && <div className="modal-backdrop cart-backdrop" onMouseDown={(event) => event.target === event.currentTarget && closeCart()}>
      <section className="cart-drawer" ref={cartDialogRef} role="dialog" aria-modal="true" aria-labelledby="cart-title">
        <div className="cart-header"><div><p className="eyebrow">TU SELECCIÓN</p><h2 id="cart-title">Carrito</h2></div><button className="close" onClick={closeCart} aria-label="Cerrar carrito">×</button></div>
        {!cart.length ? <div className="cart-empty"><p>Tu carrito está vacío.</p><button onClick={closeCart}>Seguir explorando</button></div> : <>
          <div className="cart-items">{cart.map((item) => <article className="cart-item" key={item.id}>
            {item.imageUrl ? <img src={productImageSrc(item.imageUrl, item.updatedAt)} alt="" /> : <div className="cart-placeholder">K</div>}
            <div className="cart-item-info">
              <h3>{item.name}</h3>
              <PriceBlock price={item.price} priceBs={item.priceBs} />
              <div className="quantity" aria-label={`Cantidad de ${item.name}`}><button onClick={() => updateQuantity(item.id, item.quantity - 1)} aria-label="Disminuir cantidad">−</button><span aria-live="polite">{item.quantity}</span><button onClick={() => updateQuantity(item.id, item.quantity + 1)} aria-label="Aumentar cantidad">+</button></div>
              <button className="remove-item" onClick={() => updateQuantity(item.id, 0)}>Eliminar</button>
            </div>
          </article>)}</div>
          <div className="cart-checkout">
            <div className="cart-total"><span>Total</span><div><strong>{money(total)}</strong>{totalBs > 0 && <span className="price-bs">{moneyBs(totalBs)}</span>}</div></div>
            <fieldset><legend>Elige tu asesor</legend>{advisors.map((advisor, index) => <label key={advisor.number}><input type="radio" name="advisor" checked={selectedAdvisor === index} onChange={() => setSelectedAdvisor(index)} /><span>{advisor.label}<small>{advisor.number}</small></span></label>)}</fieldset>
            <a className="checkout-button" href={whatsappUrl(advisors[selectedAdvisor], cartMessage)} target="_blank" rel="noreferrer">Enviar pedido por WhatsApp</a>
          </div>
        </>}
      </section>
    </div>}

    <div className="whatsapp-widget">
      {showAdvisors && <section className="advisor-panel" aria-label="Asesores de venta"><button className="advisor-close" onClick={() => setShowAdvisors(false)} aria-label="Cerrar">×</button><strong>Asesores de venta</strong><p>Elige un asesor para conversar</p>{advisors.map((advisor) => <a key={advisor.number} href={whatsappUrl(advisor, generalMessage(advisor))} target="_blank" rel="noreferrer" onClick={() => setShowAdvisors(false)}><span>{advisor.label}</span><small>{advisor.number}</small></a>)}</section>}
      <button className="whatsapp-float" onClick={() => setShowAdvisors((current) => !current)} aria-expanded={showAdvisors} aria-label="Elegir asesor de ventas por WhatsApp"><svg viewBox="0 0 32 32" aria-hidden="true"><path d="M16.04 3A12.74 12.74 0 0 0 5.06 22.2L3 29l7-1.91A12.8 12.8 0 1 0 16.04 3Zm0 23.35c-2.1 0-4.17-.56-5.97-1.62l-.43-.25-4.15 1.13 1.18-4.04-.28-.44a10.25 10.25 0 1 1 9.65 5.22Zm5.62-7.68c-.31-.15-1.82-.9-2.1-1-.28-.1-.49-.15-.69.16-.2.3-.8 1-1 1.2-.18.2-.36.23-.67.08-1.82-.91-3.02-1.63-4.23-3.7-.32-.55.32-.51.91-1.7.1-.2.05-.38-.03-.53-.08-.16-.69-1.66-.95-2.27-.25-.6-.5-.52-.69-.53h-.59c-.2 0-.54.08-.82.38-.28.31-1.08 1.06-1.08 2.58 0 1.51 1.1 2.98 1.26 3.18.15.2 2.17 3.31 5.25 4.64 1.95.84 2.72.91 3.7.77 1.18-.18 1.82-1.21 2.08-2.38.25-1.18.25-2.18.18-2.39-.08-.2-.28-.3-.59-.46Z" /></svg><span>¿Te ayudamos?</span></button>
    </div>
    <footer>© {new Date().getFullYear()} KRONOS · Asesor 1: {advisors[0].number} · Asesor 2: {advisors[1].number}</footer>
  </main>
}

export default App
