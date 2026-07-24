import { useEffect, useMemo, useState } from 'react'

const apiUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api/v1'
const whatsapp = '04241362318'
const whatsappUrl = `https://wa.me/58${whatsapp.slice(1)}?text=${encodeURIComponent('Hola, vi el catálogo de KRONOS y quiero información sobre sus productos.')}`

function App() {
  const [products, setProducts] = useState([])
  const [categories, setCategories] = useState([])
  const [cart, setCart] = useState([])
  const [filters, setFilters] = useState({ search: '', category: '', sort: 'recent' })
  const [selected, setSelected] = useState(null)
  const [selectedImage, setSelectedImage] = useState(null)
  const [watchRotation, setWatchRotation] = useState({ x: -10, y: 25 })

  useEffect(() => {
    Promise.all([
      fetch(`${apiUrl}/products?limit=48`).then((response) => response.json()),
      fetch(`${apiUrl}/categories`).then((response) => response.json()),
    ]).then(async ([productData, categoryData]) => {
      setCategories(categoryData)
      const remainingPages = Array.from({ length: Math.max(0, productData.pages - 1) }, (_, index) => index + 2)
      const remainingProducts = await Promise.all(remainingPages.map((page) => fetch(`${apiUrl}/products?limit=48&page=${page}`).then((response) => response.json())))
      setProducts([...(productData.items ?? []), ...remainingProducts.flatMap((page) => page.items ?? [])])
    }).catch(() => setProducts([]))
  }, [])

  const visibleProducts = useMemo(() => products.filter((product) => {
    return product.name.toLowerCase().includes(filters.search.toLowerCase())
      && (!filters.category || product.category?.slug === filters.category)
  }).sort((a, b) => {
    if (filters.sort === 'name') return a.name.localeCompare(b.name)
    if (filters.sort === 'price-asc') return Number(a.price) - Number(b.price)
    if (filters.sort === 'price-desc') return Number(b.price) - Number(a.price)
    return 0
  }), [products, filters])

  const addToCart = (product) => setCart((current) => {
    const found = current.find((item) => item.id === product.id)
    return found ? current.map((item) => item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item) : [...current, { ...product, quantity: 1 }]
  })
  const total = cart.reduce((sum, item) => sum + Number(item.price) * item.quantity, 0)
  const checkout = () => {
    const lines = cart.map((item) => `• ${item.name} x${item.quantity} — $${(Number(item.price) * item.quantity).toFixed(2)}`)
    const message = encodeURIComponent(`Hola, quiero realizar este pedido:\n${lines.join('\n')}\n\nTotal: $${total.toFixed(2)}`)
    window.open(`https://wa.me/58${whatsapp.slice(1)}?text=${message}`, '_blank', 'noopener,noreferrer')
  }
  const rotateWatch = (event) => {
    const bounds = event.currentTarget.getBoundingClientRect()
    setWatchRotation({
      x: ((event.clientY - bounds.top) / bounds.height - 0.5) * -40,
      y: ((event.clientX - bounds.left) / bounds.width - 0.5) * 70,
    })
  }

  return <main>
    <header><a className="brand" href="/" aria-label="KRONOS">KRONOS</a><div className="header-actions"><a href={whatsappUrl} target="_blank" rel="noreferrer">WhatsApp</a><button className="cart-button" onClick={checkout} disabled={!cart.length}>Carrito ({cart.length})</button></div></header>
    <section className="hero"><div className="hero-copy"><p className="eyebrow">TIEMPO · ESTILO · PRECISIÓN</p><h1>El tiempo, a tu manera.</h1><p>Relojes, bolsos, bandoleros y regalos seleccionados para ti.</p><a className="hero-cta" href="#catalogo">Explorar colección <span>↓</span></a></div></section>
    <section className="toolbar"><input aria-label="Buscar productos" placeholder="Buscar productos" value={filters.search} onChange={(event) => setFilters({ ...filters, search: event.target.value })} /><select aria-label="Ordenar productos" value={filters.sort} onChange={(event) => setFilters({ ...filters, sort: event.target.value })}><option value="recent">Recientes</option><option value="name">Alfabético</option><option value="price-asc">Menor precio</option><option value="price-desc">Mayor precio</option></select></section>
    <nav className="mobile-categories" aria-label="Categorías"><button className={!filters.category ? 'active' : ''} onClick={() => setFilters({ ...filters, category: '' })}>Todos</button>{categories.map((category) => <button key={category.id} className={filters.category === category.slug ? 'active' : ''} onClick={() => setFilters({ ...filters, category: category.slug })}>{category.name}</button>)}</nav>
    <section className="catalog" id="catalogo"><aside><h2>Categorías</h2><button className={!filters.category ? 'active' : ''} onClick={() => setFilters({ ...filters, category: '' })}>Todos los productos</button>{categories.map((category) => <button key={category.id} className={filters.category === category.slug ? 'active' : ''} onClick={() => setFilters({ ...filters, category: category.slug })}>{category.name} <span>{category._count?.products ?? ''}</span></button>)}</aside>
      <div className="grid">{visibleProducts.map((product) => <article className="product" key={product.id}><button className="image-button" onClick={() => { setSelected(product); setSelectedImage(product.imageUrl); setWatchRotation({ x: -10, y: 25 }) }}>{product.imageUrl ? <img src={product.imageUrl} alt={product.name} loading="lazy" decoding="async" /> : <div className="image-placeholder">KRONOS</div>}</button><p className="product-category">{product.category?.name}</p><h3>{product.name}</h3><strong>${Number(product.price).toFixed(2)}</strong><button className="add-button" onClick={() => addToCart(product)} disabled={!product.available}>{product.available ? 'AGREGAR' : 'AGOTADO'}</button></article>)}{!visibleProducts.length && <p className="empty">La colección se mostrará aquí después de importar los productos.</p>}</div>
    </section>
    {selected && <div className="modal-backdrop" onClick={() => setSelected(null)}><section className="modal" onClick={(event) => event.stopPropagation()}><button className="close" onClick={() => setSelected(null)}>×</button>{selected.category?.name?.toLowerCase() === 'relojes' && <div className="watch-viewer" onPointerMove={rotateWatch} onPointerLeave={() => setWatchRotation({ x: -10, y: 25 })}><div className="watch-3d" style={{ transform: `rotateX(${watchRotation.x}deg) rotateY(${watchRotation.y}deg)` }}><div className="watch-strap top"></div><div className="watch-case">{selectedImage ? <img src={selectedImage} alt={`Vista 3D de ${selected.name}`} /> : <span>12:00</span>}</div><div className="watch-strap bottom"></div></div><p>Mueve el cursor para girar la vista 3D</p></div>}{selectedImage && selected.category?.name?.toLowerCase() !== 'relojes' && <img src={selectedImage} alt={selected.name} />}{selected.images?.length > 1 && <div className="image-gallery">{selected.images.map((image) => <button key={image.id} className={selectedImage === image.url ? 'active' : ''} onClick={() => setSelectedImage(image.url)}><img src={image.url} alt={`Imagen ${image.sortOrder + 1} de ${selected.name}`} /></button>)}</div>}<p className="product-category">{selected.category?.name}</p><h2>{selected.name}</h2><p>{selected.description || 'Producto disponible por encargo.'}</p><strong>${Number(selected.price).toFixed(2)}</strong><button className="add-button" onClick={() => { addToCart(selected); setSelected(null) }}>AGREGAR AL CARRITO</button></section></div>}
    <a className="whatsapp-float" href={whatsappUrl} target="_blank" rel="noreferrer" aria-label="Escribir a KRONOS por WhatsApp"><svg viewBox="0 0 32 32" aria-hidden="true"><path d="M16.04 3A12.74 12.74 0 0 0 5.06 22.2L3 29l7-1.91A12.8 12.8 0 1 0 16.04 3Zm0 23.35c-2.1 0-4.17-.56-5.97-1.62l-.43-.25-4.15 1.13 1.18-4.04-.28-.44a10.25 10.25 0 1 1 9.65 5.22Zm5.62-7.68c-.31-.15-1.82-.9-2.1-1-.28-.1-.49-.15-.69.16-.2.3-.8 1-1 1.2-.18.2-.36.23-.67.08-1.82-.91-3.02-1.63-4.23-3.7-.32-.55.32-.51.91-1.7.1-.2.05-.38-.03-.53-.08-.16-.69-1.66-.95-2.27-.25-.6-.5-.52-.69-.53h-.59c-.2 0-.54.08-.82.38-.28.31-1.08 1.06-1.08 2.58 0 1.51 1.1 2.98 1.26 3.18.15.2 2.17 3.31 5.25 4.64 1.95.84 2.72.91 3.7.77 1.18-.18 1.82-1.21 2.08-2.38.25-1.18.25-2.18.18-2.39-.08-.2-.28-.3-.59-.46Z"/></svg><span>¿Te ayudamos?</span></a>
    <footer>© {new Date().getFullYear()} KRONOS · Pedidos por WhatsApp {whatsapp}</footer>
  </main>
}

export default App
