import { useCallback, useEffect, useRef, useState } from 'react'

const apiUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api/v1'
const PAGE_SIZE = 24
const ADMIN_STORAGE_KEY = 'kronos-admin-token'
const SESSION_STORAGE_KEY = 'kronos-session-id'
const advisors = [
  { label: 'Asesor 1', number: '04241362318' },
  { label: 'Asesor 2', number: '04264125187' },
]

const money = (value) => `$${Math.round(Number(value))}`
const moneyBs = (value) => `Bs. ${Math.round(Number(value)).toLocaleString('es-VE')}`
const whatsappUrl = (advisor, message) => `https://wa.me/58${advisor.number.slice(1)}?text=${encodeURIComponent(message)}`
const catalogOrigin = () => window.location.origin

function buildProductWhatsApp(product, advisor) {
  const lines = [
    `Hola ${advisor.label},`,
    '',
    'Vengo del *catálogo KRONOS* y quiero consultar este producto:',
    '',
    `*${product.name}*`,
    product.sku ? `Ref: ${product.sku}` : null,
    product.brand?.name ? `Marca: ${product.brand.name}` : null,
    product.category?.name ? `Categoría: ${product.category.name}` : null,
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
      return `${index + 1}. *${item.name}*${item.sku ? ` (Ref ${item.sku})` : ''}\n   Cant: ${item.quantity} · ${money(lineTotal)}${lineBs != null ? ` · ${moneyBs(lineBs)}` : ''}`
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

function ProductGallery({ product, selectedImage, onSelectImage }) {
  const images = product.images?.length
    ? product.images
    : product.imageUrl
      ? [{ id: 'main', url: product.imageUrl }]
      : []
  const currentIndex = Math.max(0, images.findIndex((image) => image.url === selectedImage))
  const safeIndex = currentIndex >= 0 ? currentIndex : 0
  const imageKey = images.map((image) => image.url).join('|')

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
        <img className="modal-main-image" src={selectedImage || images[0].url} alt={product.name} />
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
              <img src={image.url} alt="" />
            </button>
          ))}
        </div>
      )}
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

function AdminPanel({ token, onLogout }) {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [reclassifying, setReclassifying] = useState(false)
  const [saleSearch, setSaleSearch] = useState('')
  const [saleResults, setSaleResults] = useState([])
  const [saleNote, setSaleNote] = useState('')
  const [savingSale, setSavingSale] = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    setError('')
    fetch(`${apiUrl}/admin/overview`, { headers: { 'X-Kronos-Admin-Token': token } })
      .then((response) => {
        if (!response.ok) throw new Error(response.status === 401 ? 'Token inválido' : 'No se pudo cargar el panel')
        return response.json()
      })
      .then(setData)
      .catch((requestError) => setError(requestError.message))
      .finally(() => setLoading(false))
  }, [token])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (saleSearch.trim().length < 2) {
      setSaleResults([])
      return undefined
    }
    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      fetch(`${apiUrl}/admin/products?search=${encodeURIComponent(saleSearch.trim())}`, {
        headers: { 'X-Kronos-Admin-Token': token },
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
  }, [saleSearch, token])

  const reclassify = async () => {
    setReclassifying(true)
    try {
      const response = await fetch(`${apiUrl}/admin/reclassify`, {
        method: 'POST',
        headers: { 'X-Kronos-Admin-Token': token },
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

  const markSold = async (product) => {
    setSavingSale(true)
    try {
      const response = await fetch(`${apiUrl}/admin/sales`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Kronos-Admin-Token': token,
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
    const response = await fetch(`${apiUrl}/admin/sales/${saleId}`, {
      method: 'DELETE',
      headers: { 'X-Kronos-Admin-Token': token },
    })
    if (response.ok) load()
  }

  if (loading) return <section className="admin-panel"><p className="admin-loading">Cargando panel…</p></section>
  if (error && !data) return <section className="admin-panel"><p className="status-message" role="alert">{error}</p><button onClick={onLogout}>Salir</button></section>
  if (!data) return null

  return (
    <section className="admin-panel">
      <div className="admin-hero-bar">
        <div>
          <p className="eyebrow">CONTROL PRIVADO</p>
          <h1>Panel KRONOS</h1>
          <p className="admin-meta">{data.adminEmail} · últimos {data.periodDays} días · {data.summary.productsTotal} productos</p>
        </div>
        <div className="admin-actions">
          <button type="button" onClick={load}>Actualizar</button>
          <button type="button" onClick={reclassify} disabled={reclassifying}>{reclassifying ? 'Reclasificando…' : 'Reclasificar'}</button>
          <button type="button" className="admin-logout" onClick={onLogout}>Salir</button>
        </div>
      </div>

      {error && <p className="admin-error" role="alert">{error}</p>}

      <div className="admin-stats">
        <article><span>Visitas</span><strong>{data.summary.pageViews}</strong></article>
        <article><span>Sesiones</span><strong>{data.summary.uniqueSessions}</strong></article>
        <article><span>Clicks</span><strong>{data.summary.productViews}</strong></article>
        <article><span>Carrito</span><strong>{data.summary.addToCart}</strong></article>
        <article className="stat-accent"><span>Ventas</span><strong>{data.summary.salesCount}</strong></article>
        <article className="stat-danger"><span>Sin stock</span><strong>{data.summary.productsUnavailable}</strong></article>
      </div>

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
          <h2>Importaciones VOLKOVAMEN</h2>
          <p>El stock en rojo del catálogo se actualiza aquí.</p>
        </div>
        {data.syncRuns.map((run) => (
          <article key={run.id} className="admin-sync">
            <div className="admin-sync-top">
              <strong className={`sync-status sync-${run.status}`}>{run.status}</strong>
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
    </section>
  )
}

function App() {
  const [view, setView] = useState(() => (window.location.hash === '#admin' ? 'admin' : 'store'))
  const [adminToken, setAdminToken] = useState(() => localStorage.getItem(ADMIN_STORAGE_KEY) || '')
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
  const [reloadKey, setReloadKey] = useState(0)
  const productDialogRef = useRef(null)
  const cartDialogRef = useRef(null)
  const isWatches = filters.category === 'relojes'

  const closeProduct = useCallback(() => setSelected(null), [])
  const closeCart = useCallback(() => setCartOpen(false), [])
  useAccessibleDialog(Boolean(selected), closeProduct, productDialogRef)
  useAccessibleDialog(cartOpen, closeCart, cartDialogRef)

  useEffect(() => {
    const onHash = () => setView(window.location.hash === '#admin' ? 'admin' : 'store')
    window.addEventListener('hashchange', onHash)
    trackEvent('page_view')
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

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
    const brandsUrl = `${apiUrl}/brands?category=relojes`
    const typesParams = new URLSearchParams({ category: 'relojes' })
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
  }, [filters.brand, isWatches, reloadKey, view])

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
  const openProduct = (product) => {
    setSelected(product)
    setSelectedImage(product.imageUrl || product.images?.[0]?.url || null)
    trackEvent('product_view', { productId: product.id, productName: product.name })
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
  const productMessage = (product, advisor) => buildProductWhatsApp(product, advisor)
  const generalMessage = (advisor) => buildGeneralWhatsApp(advisor)

  const saveAdminToken = (event) => {
    event.preventDefault()
    const token = adminInput.trim()
    if (!token) return
    localStorage.setItem(ADMIN_STORAGE_KEY, token)
    setAdminToken(token)
    setAdminInput('')
  }

  const logoutAdmin = () => {
    localStorage.removeItem(ADMIN_STORAGE_KEY)
    setAdminToken('')
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
            <a href="/#">Catálogo</a>
            <span className="admin-tab active" aria-current="page">Admin</span>
          </div>
        </header>
        {!adminToken ? (
          <section className="admin-login">
            <div className="admin-login-visual" aria-hidden="true" />
            <div className="admin-login-card">
              <p className="eyebrow">ACCESO PRIVADO</p>
              <h1>Admin KRONOS</h1>
              <p>Solo para el dueño. Los clientes no necesitan login.</p>
              <form onSubmit={saveAdminToken}>
                <label>
                  <span>Token de administración</span>
                  <input type="password" value={adminInput} onChange={(event) => setAdminInput(event.target.value)} placeholder="Pega tu token" autoComplete="current-password" />
                </label>
                <button type="submit">Entrar al panel</button>
              </form>
            </div>
          </section>
        ) : (
          <AdminPanel token={adminToken} onLogout={logoutAdmin} />
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
        <img className="hero-bg" src="/kronos-logo.jpg" alt="" aria-hidden="true" fetchPriority="high" />
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

    <section className="toolbar" aria-label="Filtros del catálogo">
      <label className="search-field"><span className="sr-only">Buscar productos</span><input type="search" placeholder="Buscar productos" value={filters.search} onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))} /></label>
      <label><span className="sr-only">Ordenar productos</span><select value={filters.sort} onChange={(event) => changeSort(event.target.value)}><option value="recent">Recientes</option><option value="name">Alfabético</option><option value="price-asc">Menor precio</option><option value="price-desc">Mayor precio</option></select></label>
    </section>

    <nav className="mobile-categories" aria-label="Categorías">
      <button className={!filters.category ? 'active' : ''} onClick={() => changeCategory('')}>Todos</button>
      {categories.map((category) => <button key={category.id} className={filters.category === category.slug ? 'active' : ''} onClick={() => changeCategory(category.slug)}>{category.name}</button>)}
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
        {categories.map((category) => <button key={category.id} className={filters.category === category.slug ? 'active' : ''} onClick={() => changeCategory(category.slug)}>{category.name} <span>{category._count?.products ?? ''}</span></button>)}
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
          {products.map((product) => <article className={`product${product.available ? '' : ' unavailable'}`} key={product.id}>
            <button className="image-button" onClick={() => openProduct(product)} aria-label={`Ver detalles de ${product.name}`}>
              {product.imageUrl ? <img src={product.imageUrl} alt={product.name} loading="lazy" decoding="async" /> : <div className="image-placeholder">KRONOS</div>}
              {!product.available && <span className="stock-badge">Sin stock</span>}
            </button>
            <p className="product-category">{[product.brand?.name, product.productType || product.category?.name].filter(Boolean).join(' · ')}{product.sku ? ` · Ref ${product.sku}` : ''}</p>
            <h3>{product.name}</h3>
            <PriceBlock price={product.price} priceBs={product.priceBs} />
            <button className="add-button" onClick={() => addToCart(product)} disabled={!product.available}>{product.available ? 'AGREGAR' : 'SIN STOCK'}</button>
            <details className="consult-menu"><summary>Consultar por WhatsApp</summary><div>{advisors.map((advisor) => <a key={advisor.number} href={whatsappUrl(advisor, productMessage(product, advisor))} target="_blank" rel="noreferrer">{advisor.label}</a>)}</div></details>
          </article>)}
          {!products.length && <p className="empty">No encontramos productos con esos filtros.</p>}
        </div>}
        {!loading && !error && page < pages && <div className="load-more"><button onClick={() => setPage((current) => current + 1)} disabled={loadingMore}>{loadingMore ? 'Cargando…' : `Cargar más (${totalProducts - products.length} restantes)`}</button></div>}
      </div>
    </section>

    {selected && <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && closeProduct()}>
      <section className="modal product-modal" ref={productDialogRef} role="dialog" aria-modal="true" aria-labelledby="product-dialog-title">
        <button className="close" onClick={closeProduct} aria-label="Cerrar detalles">×</button>
        <ProductGallery product={selected} selectedImage={selectedImage} onSelectImage={setSelectedImage} />
        <p className="product-category">{[selected.brand?.name, selected.productType || selected.category?.name].filter(Boolean).join(' · ')}{selected.sku ? ` · Ref ${selected.sku}` : ''}</p>
        <h2 id="product-dialog-title">{selected.name}</h2>
        {!selected.available && <p className="stock-note">Sin stock en VOLKOVAMEN. Puedes consultar por WhatsApp por si vuelve.</p>}
        <p>{selected.description || 'Producto disponible por encargo.'}</p>
        <PriceBlock price={selected.price} priceBs={selected.priceBs} />
        <button className="add-button" onClick={() => addToCart(selected)} disabled={!selected.available}>{selected.available ? 'AGREGAR AL CARRITO' : 'SIN STOCK'}</button>
        <div className="modal-consult"><p>Consultar por WhatsApp</p>{advisors.map((advisor) => <a key={advisor.number} href={whatsappUrl(advisor, productMessage(selected, advisor))} target="_blank" rel="noreferrer">{advisor.label}</a>)}</div>
      </section>
    </div>}

    {cartOpen && <div className="modal-backdrop cart-backdrop" onMouseDown={(event) => event.target === event.currentTarget && closeCart()}>
      <section className="cart-drawer" ref={cartDialogRef} role="dialog" aria-modal="true" aria-labelledby="cart-title">
        <div className="cart-header"><div><p className="eyebrow">TU SELECCIÓN</p><h2 id="cart-title">Carrito</h2></div><button className="close" onClick={closeCart} aria-label="Cerrar carrito">×</button></div>
        {!cart.length ? <div className="cart-empty"><p>Tu carrito está vacío.</p><button onClick={closeCart}>Seguir explorando</button></div> : <>
          <div className="cart-items">{cart.map((item) => <article className="cart-item" key={item.id}>
            {item.imageUrl ? <img src={item.imageUrl} alt="" /> : <div className="cart-placeholder">K</div>}
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
