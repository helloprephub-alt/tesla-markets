import { useMemo, useState } from 'react';
import {
  ArrowLeft, ArrowRight, ArrowUpRight, BatteryCharging, Check, ChevronRight,
  CreditCard, Heart, Menu, PackageCheck, PlugZap, Search, ShieldCheck,
  ShoppingBag, SlidersHorizontal, Sun, Truck, X
} from 'lucide-react';
import { getDiscountedPrice, getProductImageIndex, storeProducts, type StoreDepartment, type StoreProduct } from './marketplace-catalog';

type Props = { onSelectModel: (id: string) => void; onEnquire: (context: string) => void };
type Department = StoreDepartment | 'All products';
type CartLine = { id: string; quantity: number; selectedSize?: string };

const money = (amount: number) => new Intl.NumberFormat('en-US', {
  style: 'currency', currency: 'USD', maximumFractionDigits: 0
}).format(amount);

const departments: { name: Department; sub: string; icon: typeof ShoppingBag }[] = [
  { name: 'All products', sub: 'Browse the complete shop', icon: Menu },
  { name: 'Apparel', sub: 'Clothing, hats and kids', icon: Heart },
  { name: 'Lifestyle', sub: 'Drinkware, bags and collectibles', icon: ShoppingBag },
  { name: 'Vehicle Accessories', sub: 'Interior, exterior and care', icon: SlidersHorizontal },
  { name: 'EV Charging', sub: 'Home and mobile charging', icon: PlugZap },
  { name: 'Solar & Energy', sub: 'Solar systems and accessories', icon: Sun },
  { name: 'Batteries & Inverters', sub: 'Home and commercial storage', icon: BatteryCharging },
];

const vehicles = [
  { id: 'model-3', name: 'Model 3', image: '/resources/model-3-1.jpg', desc: 'Electric sedan' },
  { id: 'model-y', name: 'Model Y', image: '/resources/model-y-1.jpg', desc: 'Electric SUV' },
  { id: 'cybertruck', name: 'Cybertruck', image: '/resources/cybertruck-1.jpg', desc: 'Electric pickup' },
  { id: 'roadster', name: 'Roadster', image: '/resources/roadster-1.jpg', desc: 'Performance vehicle' },
  { id: 'semi', name: 'Tesla Semi', image: '/resources/semi-1.jpg', desc: 'Electric truck' },
];

function productPrice(product: StoreProduct) {
  return getDiscountedPrice(product);
}

function productArtStyle(product: StoreProduct) {
  const index = getProductImageIndex(product);
  const column = index % 4;
  const row = Math.floor(index / 4);
  return {
    backgroundImage: "url('/shop-assets/product-atlas.webp')",
    backgroundSize: '400% 500%',
    backgroundPosition: ((column / 3) * 100) + '% ' + ((row / 4) * 100) + '%',
    backgroundRepeat: 'no-repeat'
  };
}

function productMatchesModel(product: StoreProduct, model: string) {
  if (model === 'All models') return true;
  const text = (product.name + ' ' + product.category).toLowerCase();
  const terms: Record<string, string[]> = {
    'Model 3': ['model 3', 'model 3/y', 'model s/3/y', 'sx3y'],
    'Model Y': ['model y', 'model 3/y', 'model x/y', 'model s/3/y', 'sx3y'],
    'Model S': ['model s', 'model s/x', 'model s/3/y', 'sx3y'],
    'Model X': ['model x', 'model s/x', 'model x/y', 'model s/3/y', 'sx3y'],
    'Cybertruck': ['cybertruck', 'cyber beast', 'cyberbeast']
  };
  return (terms[model] || [model.toLowerCase()]).some(term => text.includes(term));
}

function discountValue(product: StoreProduct) {
  const price = productPrice(product);
  return price === null ? 0 : Math.max(0, product.originalPrice - price);
}

function ProductCard({ product, onOpen, onAdd, saved, onSave }: {
  product: StoreProduct; onOpen: () => void; onAdd: () => void; saved: boolean; onSave: () => void
}) {
  const sale = productPrice(product);
  const hasDiscount = sale !== null;
  return (
    <article className="tm-store-card">
      <button className="tm-store-image" onClick={onOpen} aria-label={'View ' + product.name}>
        {product.image ? <img className="tm-store-product-photo" src={product.image} alt={product.name} loading="lazy" /> : <span className="tm-store-product-art" style={productArtStyle(product)} role="img" aria-label={product.name}/>}
        <span className="tm-store-sale-badge">{product.discountPercent}% OFF</span>
        {product.featured && <span className="tm-store-featured">FEATURED</span>}
        <span className="tm-store-image-zoom">View item <ArrowUpRight size={13}/></span>
      </button>
      <div className="tm-store-card-copy">
        <span className="tm-store-card-category">{product.category}</span>
        <button className="tm-store-card-name" onClick={onOpen}>{product.name}</button>
        <div className="tm-store-price-row">
          {hasDiscount ? <><s>{money(product.originalPrice)}</s><b>{money(sale!)}</b></> : <b className="tm-store-quote-price">Price on request</b>}
        </div>
        {hasDiscount ? <small className="tm-store-saving">Save {money(discountValue(product))} · December sale price</small> : <small className="tm-store-saving-muted">10% off confirmed final quote</small>}
        <div className="tm-store-card-actions">
          <button onClick={onOpen}>Product details</button>
          <button className="tm-store-add-icon" aria-label={'Add ' + product.name + ' to cart'} disabled={sale === null} onClick={onAdd}><ShoppingBag size={16}/></button>
          <button className={'tm-store-save ' + (saved ? 'saved' : '')} onClick={onSave} aria-label={saved ? 'Remove from saved items' : 'Save item'}><Heart size={15} fill={saved ? 'currentColor' : 'none'}/></button>
        </div>
      </div>
    </article>
  );
}

export function Marketplace({ onSelectModel }: Props) {
  const [department, setDepartment] = useState<Department>('All products');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('Featured');
  const [selected, setSelected] = useState<StoreProduct | null>(null);
  const [selectedSize, setSelectedSize] = useState('');
  const [detailQuantity, setDetailQuantity] = useState(1);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [saved, setSaved] = useState<string[]>([]);
  const [savedOnly, setSavedOnly] = useState(false);
  const [vehicleModelFilter, setVehicleModelFilter] = useState('All models');
  const [categoryFilter, setCategoryFilter] = useState('All categories');
  const [showAllDepartments, setShowAllDepartments] = useState(false);

  const cartCount = cart.reduce((sum, line) => sum + line.quantity, 0);
  const categoryOptions = useMemo(() => {
    return [...new Set(storeProducts
      .filter(product => department === 'All products' || product.department === department)
      .filter(product => department !== 'Vehicle Accessories' || productMatchesModel(product, vehicleModelFilter))
      .map(product => product.category))].sort((a,b) => a.localeCompare(b));
  }, [department, vehicleModelFilter]);

  const visibleProducts = useMemo(() => {
    let items = storeProducts.filter(product =>
      (department === 'All products' || product.department === department) &&
      (department !== 'Vehicle Accessories' || productMatchesModel(product, vehicleModelFilter)) &&
      (categoryFilter === 'All categories' || product.category === categoryFilter) &&
      (!savedOnly || saved.includes(product.id)) &&
      (product.name + ' ' + product.category + ' ' + product.description).toLowerCase().includes(query.toLowerCase())
    );
    if (sort === 'Name A–Z') items = [...items].sort((a,b) => a.name.localeCompare(b.name));
    if (sort === 'Price: low to high') items = [...items].sort((a,b) => (productPrice(a) ?? Infinity) - (productPrice(b) ?? Infinity));
    if (sort === 'Price: high to low') items = [...items].sort((a,b) => (productPrice(b) ?? -1) - (productPrice(a) ?? -1));
    if (sort === 'Biggest discount') items = [...items].sort((a,b) => b.discountPercent - a.discountPercent);
    return items;
  }, [department, query, sort, savedOnly, saved, vehicleModelFilter, categoryFilter]);

  const cartLines = cart.map(line => {
    const product = storeProducts.find(item => item.id === line.id);
    return product ? { ...line, product, unitPrice: productPrice(product) ?? 0 } : null;
  }).filter((line): line is NonNullable<typeof line> => Boolean(line));
  const subtotal = cartLines.reduce((sum,line) => sum + line.unitPrice * line.quantity, 0);
  const originalSubtotal = cartLines.reduce((sum,line) => sum + line.product.originalPrice * line.quantity, 0);
  const totalSavings = originalSubtotal - subtotal;

  const addToCart = (product: StoreProduct, quantity = 1, size?: string) => {
    if (productPrice(product) === null) return;
    const keySize = size || '';
    setCart(current => {
      const found = current.find(line => line.id === product.id && (line.selectedSize || '') === keySize);
      return found
        ? current.map(line => line.id === product.id && (line.selectedSize || '') === keySize ? { ...line, quantity: line.quantity + quantity } : line)
        : [...current, { id: product.id, quantity, selectedSize: keySize || undefined }];
    });
    setSelected(null);
    setCartOpen(true);
  };

  const changeQty = (id: string, delta: number, size?: string) => {
    setCart(current => current.map(line =>
      line.id === id && (line.selectedSize || '') === (size || '')
        ? { ...line, quantity: Math.max(1, line.quantity + delta) } : line
    ));
  };

  const openDetail = (product: StoreProduct) => {
    setSelected(product);
    setSelectedSize(product.sizes?.[0] || '');
    setDetailQuantity(1);
  };

  const switchDepartment = (next: Department) => {
    setDepartment(next);
    setSavedOnly(false);
    setVehicleModelFilter('All models');
    setCategoryFilter('All categories');
    setQuery('');
    setSort('Featured');
    setShowAllDepartments(false);
  };

  return (
    <main className="tm-marketplace-v2">
      <header className="tm-store-header">
        <button className="tm-store-brand" onClick={() => switchDepartment('All products')} aria-label="Tesla Markets shop home">
          <span className="tm-store-brand-mark">T</span>
          <span><b>TESLA MARKETS</b><small>CHRISTMAS SPECIAL OFFERS</small></span>
        </button>
        <label className="tm-store-search">
          <Search size={17}/>
          <input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search products, collections, accessories..." />
          {query && <button onClick={() => setQuery('')} aria-label="Clear search"><X size={14}/></button>}
        </label>
        <div className="tm-store-header-actions">
          <button className={savedOnly ? 'active' : ''} onClick={() => {setSavedOnly(v => !v);setDepartment('All products');setQuery('');}}><Heart size={17}/><span>Saved {saved.length ? '('+saved.length+')' : ''}</span></button>
          <button onClick={() => setCartOpen(true)} className="tm-store-cart-button"><ShoppingBag size={18}/><span>Cart</span><b>{cartCount}</b></button>
        </div>
      </header>

      <nav className="tm-store-departments" aria-label="Marketplace departments">
        {departments.map(({name,icon:Icon}) => (
          <button key={name} className={department === name ? 'active' : ''} onClick={() => switchDepartment(name)}>
            <Icon size={15}/>{name}
          </button>
        ))}
      </nav>
      <section className="tm-store-christmas-banner">
        <div className="tm-store-holiday-emblem" aria-hidden="true">✦</div>
        <div className="tm-store-christmas-copy">
          <span>TESLA MARKETS · CHRISTMAS PROMOTION</span>
          <b>Holiday season. Special prices.</b>
          <small>DIFFERENT DISCOUNTS · UP TO 70% OFF SELECTED ITEMS</small>
        </div>
        <button onClick={() => switchDepartment('All products')}>Shop Christmas offers <ArrowUpRight size={15}/></button>
        <span className="tm-store-snowflake one">✦</span><span className="tm-store-snowflake two">✧</span><span className="tm-store-snowflake three">❄</span>
      </section>

      {department === 'All products' && !query && (
        <>
          <section className="tm-store-hero">
            <div className="tm-store-hero-copy">
              <span className="tm-store-eyebrow">TESLA MARKETS · CHRISTMAS COLLECTION</span>
              <h1>Christmas<br/><em>special offers.</em></h1>
              <p>Discover Tesla apparel, drinkware, miniatures, vehicle accessories, charging and energy products — with different Christmas discounts across the collection.</p>
              <div className="tm-store-hero-actions">
                <button onClick={() => switchDepartment('All products')}>Shop all Christmas offers <ArrowRight size={16}/></button>
                <span>Product-specific Christmas discounts</span>
              </div>
            </div>
            <div className="tm-store-hero-media">
              <img src="https://digitalassets-shop.tesla.com/image/upload/f_auto%2Cq_auto/v1/content/dam/tesla/teslaweb/homepage/Lifestyle_home.jpg" alt="Tesla lifestyle collection featuring bags and drinkware"/>
              <div className="tm-store-hero-caption"><b>DESIGNED FOR THE EVERYDAY</b><span>APPAREL · LIFESTYLE · ACCESSORIES</span></div>
            </div>
          </section>

          <section className="tm-store-section tm-store-vehicle-section">
            <div className="tm-store-section-head"><div><span className="tm-store-eyebrow">THE VEHICLE COLLECTION</span><h2>Explore Tesla vehicles</h2></div><small>Vehicle purchases continue through the dedicated vehicle pages</small></div>
            <div className="tm-store-vehicle-grid">
              {vehicles.map(vehicle => <button key={vehicle.id} onClick={() => onSelectModel(vehicle.id)} className="tm-store-vehicle-card">
                <img src={vehicle.image} alt={vehicle.name} loading="lazy"/>
                <span><b>{vehicle.name}</b><small>{vehicle.desc}</small></span><ArrowUpRight size={15}/>
              </button>)}
            </div>
          </section>

          <section className="tm-store-section">
            <div className="tm-store-section-head"><div><span className="tm-store-eyebrow">SHOP BY DEPARTMENT</span><h2>Explore the marketplace</h2></div><button className="tm-store-link-button" onClick={() => setShowAllDepartments(v => !v)}>{showAllDepartments ? 'Show less' : 'All departments'} <ArrowRight size={15}/></button></div>
            <div className="tm-store-department-grid">
              {(showAllDepartments ? departments.slice(1) : departments.slice(1,5)).map(({name,sub,icon:Icon}) => <button key={name} onClick={() => switchDepartment(name)} className="tm-store-department-card"><span><Icon size={21}/></span><b>{name}</b><small>{sub}</small><em>Browse department <ArrowUpRight size={13}/></em></button>)}
            </div>
          </section>
        </>
      )}

      <section className="tm-store-section tm-store-catalogue">
        <div className="tm-store-section-head tm-store-catalogue-head">
          <div><span className="tm-store-eyebrow">{department === 'All products' ? 'THE FULL COLLECTION' : department.toUpperCase()}</span><h2>{query ? 'Search results' : department === 'All products' ? 'Shop all products' : department}</h2><small>{visibleProducts.length} listings in this catalogue view</small></div>
          <div className="tm-store-catalogue-controls">
            {department === 'Vehicle Accessories' && <label className="tm-store-filter-select"><span>VEHICLE MODEL</span><select value={vehicleModelFilter} onChange={event => {setVehicleModelFilter(event.target.value);setCategoryFilter('All categories');}}><option>All models</option><option>Model 3</option><option>Model Y</option><option>Model S</option><option>Model X</option><option>Cybertruck</option></select></label>}
            {department !== 'All products' && <label className="tm-store-filter-select"><span>PRODUCT TYPE</span><select value={categoryFilter} onChange={event => setCategoryFilter(event.target.value)}><option>All categories</option>{categoryOptions.map(category => <option key={category}>{category}</option>)}</select></label>}
            <label className="tm-store-sort"><SlidersHorizontal size={15}/><select value={sort} onChange={event => setSort(event.target.value)}><option>Featured</option><option>Name A–Z</option><option>Price: low to high</option><option>Price: high to low</option><option>Biggest discount</option></select></label>
          </div>
        </div>
        {visibleProducts.length ? <div className="tm-store-product-grid">
          {visibleProducts.map(product => <ProductCard key={product.id} product={product} onOpen={() => openDetail(product)} onAdd={() => addToCart(product)} saved={saved.includes(product.id)} onSave={() => setSaved(current => current.includes(product.id) ? current.filter(id => id !== product.id) : [...current, product.id])}/>)}
        </div> : <div className="tm-store-empty"><PackageCheck size={28}/><b>No matching products</b><p>Try another search or choose a different department.</p><button onClick={() => switchDepartment('All products')}>Back to all products</button></div>}
        {department === 'All products' && <p className="tm-store-data-note">Every priced listing displays its original price and its own rounded Christmas sale price. Discount rates vary by product. Energy products without a verified partner price are shown as price-on-request until supplier pricing is verified.</p>}
      </section>

      <section className="tm-store-benefits">
        <div><ShieldCheck size={19}/><span><b>Product source transparency</b><small>Official listings are distinguished from partner-supplied products</small></span></div>
        <div><Truck size={19}/><span><b>Delivery details before payment</b><small>Shipping and taxes are shown before order confirmation</small></span></div>
        <div><CreditCard size={19}/><span><b>Secure checkout design</b><small>Payment is only confirmed after verified settlement</small></span></div>
      </section>

      {selected && (
        <div className="tm-store-overlay" onMouseDown={event => { if (event.target === event.currentTarget) setSelected(null); }}>
          <section className="tm-store-detail" role="dialog" aria-modal="true" aria-labelledby="tm-store-detail-title">
            <button className="tm-store-detail-back" onClick={() => setSelected(null)}><ArrowLeft size={15}/> Continue shopping</button>
            <button className="tm-store-close" onClick={() => setSelected(null)} aria-label="Close product details"><X size={19}/></button>
            <div className="tm-store-detail-layout">
              <div className="tm-store-detail-image">{selected.image ? <img className="tm-store-product-photo tm-store-product-photo-large" src={selected.image} alt={selected.name} /> : <div className="tm-store-product-art tm-store-product-art-large" style={productArtStyle(selected)} role="img" aria-label={selected.name}/>}</div>
              <div className="tm-store-detail-copy">
                <span className="tm-store-eyebrow">{selected.category} · {selected.sourceLabel}</span>
                <h2 id="tm-store-detail-title">{selected.name}</h2>
                <p>{selected.description}</p>
                <div className="tm-store-detail-price">
                  {productPrice(selected) !== null ? <>
                    <s>{money(selected.originalPrice)}</s>
                    <b>{money(productPrice(selected)!)}</b>
                    <span>{selected.discountPercent}% OFF</span>
                  </> : <b>Price on request</b>}
                </div>
                <small className="tm-store-stock">{selected.availability}</small>
                {selected.sizes && <label className="tm-store-size">Choose size<select value={selectedSize} onChange={event => setSelectedSize(event.target.value)}>{selected.sizes.map(size => <option key={size}>{size}</option>)}</select></label>}
                <div className="tm-store-quantity"><button onClick={() => setDetailQuantity(q => Math.max(1,q-1))}>−</button><b>{detailQuantity}</b><button onClick={() => setDetailQuantity(q => q+1)}>+</button></div>
                <button className="tm-store-add-large" disabled={productPrice(selected) === null || Boolean(selected.sizes?.length && !selectedSize)} onClick={() => addToCart(selected,detailQuantity,selectedSize)}>Add to cart <ShoppingBag size={17}/></button>
                {selected.sourceUrl && <a className="tm-store-source-link" href={selected.sourceUrl} target="_blank" rel="noreferrer">View source listing <ArrowUpRight size={13}/></a>}
                <p className="tm-store-product-disclaimer">{selected.brandType}. Tesla Markets is an independent marketplace and is not presented as Tesla’s official store or dealer. Product eligibility and source terms may limit resale.</p>
              </div>
            </div>
          </section>
        </div>
      )}

      {cartOpen && (
        <div className="tm-store-overlay tm-store-cart-overlay" onMouseDown={event => { if (event.target === event.currentTarget) setCartOpen(false); }}>
          <aside className="tm-store-cart-drawer" aria-label="Shopping cart">
            <div className="tm-store-cart-head"><div><span className="tm-store-eyebrow">YOUR SELECTION</span><h2>Shopping cart ({cartCount})</h2></div><button onClick={() => setCartOpen(false)} aria-label="Close cart"><X/></button></div>
            {!cartLines.length ? <div className="tm-store-cart-empty"><ShoppingBag size={32}/><b>Your cart is empty</b><p>Choose a product from the collection to start an order.</p><button onClick={() => setCartOpen(false)}>Continue shopping</button></div> : <>
              <div className="tm-store-cart-lines">
                {cartLines.map(line => <div className="tm-store-cart-line" key={line.id + (line.selectedSize || '')}>
                  <div className="tm-store-cart-line-image">{line.product.image ? <img className="tm-store-product-photo" src={line.product.image} alt={line.product.name}/> : <div className="tm-store-product-art tm-store-product-art-thumb" style={productArtStyle(line.product)} role="img" aria-label={line.product.name}/>}</div>
                  <div className="tm-store-cart-line-copy"><b>{line.product.name}</b>{line.selectedSize && <small>Size: {line.selectedSize}</small>}<span>{line.product.discountPercent > 0 ? <><s>{money(line.product.originalPrice)}</s> {money(line.unitPrice)}</> : money(line.unitPrice)} each</span><button onClick={() => setCart(current => current.filter(item => item.id !== line.id || item.selectedSize !== line.selectedSize))}>Remove</button></div>
                  <div className="tm-store-cart-qty"><button onClick={() => changeQty(line.id,-1,line.selectedSize)}>−</button><b>{line.quantity}</b><button onClick={() => changeQty(line.id,1,line.selectedSize)}>+</button></div>
                </div>)}
              </div>
              <div className="tm-store-cart-summary">
                <div><span>Original subtotal</span><s>{money(originalSubtotal)}</s></div>
                <div><span>Product savings</span><b className="saving">−{money(totalSavings)}</b></div>
                <div className="total"><span>Estimated product total</span><b>{money(subtotal)}</b></div>
                <small>Shipping, taxes and any duties are calculated before the payment step. Prices are rounded to whole US dollars.</small>
                <button onClick={() => {setCartOpen(false);setCheckoutOpen(true)}}>Continue to checkout <ArrowRight size={16}/></button>
              </div>
            </>}
          </aside>
        </div>
      )}

      {checkoutOpen && (
        <div className="tm-store-overlay tm-store-checkout-overlay" onMouseDown={event => { if (event.target === event.currentTarget) setCheckoutOpen(false); }}>
          <section className="tm-store-checkout" role="dialog" aria-modal="true" aria-labelledby="tm-store-checkout-title">
            <div className="tm-store-checkout-head"><button onClick={() => setCheckoutOpen(false)}><ArrowLeft size={15}/> Back to cart</button><button onClick={() => setCheckoutOpen(false)} aria-label="Close checkout"><X size={18}/></button></div>
            <div className="tm-store-checkout-layout">
              <div>
                <span className="tm-store-eyebrow">DIRECT STORE CHECKOUT</span>
                <h2 id="tm-store-checkout-title">Delivery details</h2>
                <p>Customer and delivery information belongs to this store order. Vehicle purchases and investment enquiries remain separate.</p>
                <div className="tm-store-checkout-form">
                  <label>Full name<input placeholder="Customer name" autoComplete="name"/></label>
                  <div className="tm-store-checkout-two"><label>Email address<input type="email" placeholder="you@example.com" autoComplete="email"/></label><label>Phone number<input type="tel" placeholder="+1..." autoComplete="tel"/></label></div>
                  <label>Delivery address<input placeholder="Street address" autoComplete="street-address"/></label>
                  <div className="tm-store-checkout-two"><label>City<input placeholder="City" autoComplete="address-level2"/></label><label>Postal code<input placeholder="Postal / ZIP code" autoComplete="postal-code"/></label></div>
                  <label>Country / region<select defaultValue=""><option value="" disabled>Select country</option><option>United States</option><option>Canada</option><option>United Kingdom</option><option>Nigeria</option><option>France</option><option>Germany</option><option>Other</option></select></label>
                </div>
                <div className="tm-store-giftcard-panel"><div><CreditCard size={18}/><b>Gift-card payment</b><span className="tm-store-pending-chip">Integration required</span></div><p>The checkout is designed for direct gift-card payment, but a verified gift-card redemption service is not connected yet. Third-party gift-card PINs or scratch-card photos must not be collected here.</p><small>Once an authorised processor or Tesla Markets store-credit service is connected, customers can redeem a valid balance and pay directly without contacting the investment team.</small></div>
              </div>
              <aside className="tm-store-checkout-summary"><span className="tm-store-eyebrow">ORDER SUMMARY</span><h3>{cartCount} items</h3>{cartLines.map(line => <div key={line.id + (line.selectedSize || '')}><span>{line.product.name} × {line.quantity}{line.selectedSize ? ' · '+line.selectedSize : ''}</span><b>{money(line.unitPrice*line.quantity)}</b></div>)}<div className="tm-store-checkout-total"><span>Product total</span><b>{money(subtotal)}</b></div><div className="tm-store-checkout-saving">You save {money(totalSavings)} from listed retail prices</div><button disabled>Gift card payment is not connected</button><small>No payment is taken and no order is marked paid in this preview.</small></aside>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
