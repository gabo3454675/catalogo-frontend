import { useEffect, useMemo, useState } from 'react'

const apiUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api/v1'
const whatsapp = '04241362318'

function App() {
  const [products, setProducts] = useState([])
  const [categories, setCategories] = useState([])
  const [cart, setCart] = useState([])
  const [filters, setFilters] = useState({ search: '', category: '', sort: 'recent' })
  const [selected, setSelected] = useState(null)
  const [watchRotation, setWatchRotation] = useState({ x: -10, y: 25 })

  useEffect(() => {
    Promise.all([
      fetch(`${apiUrl}/products?limit=48`).then((response) => response.json()),
      fetch(`${apiUrl}/categories`).then((response) => response.json()),
    ]).then(([productData, categoryData]) => {
      setProducts(productData.items ?? [])
      setCategories(categoryData)
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
    <header><a className="brand" href="/">KRONOS</a><div className="header-actions"><a href={`https://wa.me/58${whatsapp.slice(1)}`} target="_blank" rel="noreferrer">WhatsApp</a><button className="cart-button" onClick={checkout} disabled={!cart.length}>Carrito ({cart.length})</button></div></header>
    <section className="hero"><p className="eyebrow">TIEMPO · ESTILO · PRECISIÓN</p><h1>El tiempo, a tu manera.</h1><p>Relojes, bolsos, bandoleros y regalos seleccionados para ti.</p><a className="hero-cta" href="#catalogo">Explorar colección <span>↓</span></a></section>
    <section className="toolbar"><input aria-label="Buscar productos" placeholder="Buscar productos" value={filters.search} onChange={(event) => setFilters({ ...filters, search: event.target.value })} /><select aria-label="Ordenar productos" value={filters.sort} onChange={(event) => setFilters({ ...filters, sort: event.target.value })}><option value="recent">Recientes</option><option value="name">Alfabético</option><option value="price-asc">Menor precio</option><option value="price-desc">Mayor precio</option></select></section>
    <section className="catalog" id="catalogo"><aside><h2>Categorías</h2><button className={!filters.category ? 'active' : ''} onClick={() => setFilters({ ...filters, category: '' })}>Todos los productos</button>{categories.map((category) => <button key={category.id} className={filters.category === category.slug ? 'active' : ''} onClick={() => setFilters({ ...filters, category: category.slug })}>{category.name} <span>{category._count?.products ?? ''}</span></button>)}</aside>
      <div className="grid">{visibleProducts.map((product) => <article className="product" key={product.id}><button className="image-button" onClick={() => { setSelected(product); setWatchRotation({ x: -10, y: 25 }) }}>{product.imageUrl ? <img src={product.imageUrl} alt={product.name} /> : <div className="image-placeholder">KRONOS</div>}</button><p className="product-category">{product.category?.name}</p><h3>{product.name}</h3><strong>${Number(product.price).toFixed(2)}</strong><button className="add-button" onClick={() => addToCart(product)} disabled={!product.available}>{product.available ? 'AGREGAR' : 'AGOTADO'}</button></article>)}{!visibleProducts.length && <p className="empty">La colección se mostrará aquí después de importar los productos.</p>}</div>
    </section>
    {selected && <div className="modal-backdrop" onClick={() => setSelected(null)}><section className="modal" onClick={(event) => event.stopPropagation()}><button className="close" onClick={() => setSelected(null)}>×</button>{selected.category?.name?.toLowerCase() === 'relojes' && <div className="watch-viewer" onPointerMove={rotateWatch} onPointerLeave={() => setWatchRotation({ x: -10, y: 25 })}><div className="watch-3d" style={{ transform: `rotateX(${watchRotation.x}deg) rotateY(${watchRotation.y}deg)` }}><div className="watch-strap top"></div><div className="watch-case">{selected.imageUrl ? <img src={selected.imageUrl} alt={`Vista 3D de ${selected.name}`} /> : <span>12:00</span>}</div><div className="watch-strap bottom"></div></div><p>Mueve el cursor para girar la vista 3D</p></div>}{selected.imageUrl && selected.category?.name?.toLowerCase() !== 'relojes' && <img src={selected.imageUrl} alt={selected.name} />}<p className="product-category">{selected.category?.name}</p><h2>{selected.name}</h2><p>{selected.description || 'Producto disponible por encargo.'}</p><strong>${Number(selected.price).toFixed(2)}</strong><button className="add-button" onClick={() => { addToCart(selected); setSelected(null) }}>AGREGAR AL CARRITO</button></section></div>}
    <footer>© {new Date().getFullYear()} KRONOS · Pedidos por WhatsApp {whatsapp}</footer>
  </main>
}

export default App
