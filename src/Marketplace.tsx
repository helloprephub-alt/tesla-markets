import { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft, ArrowRight, ArrowUpRight, BatteryCharging, Check, ChevronRight,
  CreditCard, Heart, Menu, PackageCheck, PlugZap, Search, ShieldCheck,
  ShoppingBag, SlidersHorizontal, Sun, Truck, X
} from 'lucide-react';
import { getDiscountedPrice, storeProducts, type StoreDepartment, type StoreProduct } from './marketplace-catalog';
import { supabase } from './lib/supabase';

type Props = { onSelectModel: (id: string) => void; onRequireAuth: () => void; onEnquire: (context: string) => void };
type Department = StoreDepartment | 'All products';
type CartLine = { id: string; quantity: number; selectedSize?: string };
type CheckoutIntent = {
  cart: CartLine[];
  checkoutDetails?: { fullName: string; email: string; phone: string; address: string; city: string; postalCode: string; country: string };
};
const CHECKOUT_INTENT_KEY = 'tesla-markets-checkout-intent';
function readCheckoutIntent(): CheckoutIntent | null {
  try {
    const raw = sessionStorage.getItem(CHECKOUT_INTENT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CheckoutIntent;
    return Array.isArray(parsed.cart) ? parsed : null;
  } catch { return null; }
}

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

function ProductVisual({ product, variant = 'card' }: { product: StoreProduct; variant?: 'card' | 'large' | 'thumb' }) {
  const [imageFailed, setImageFailed] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  useEffect(() => {
    setImageFailed(false);
    setImageLoaded(false);
  }, [product.image]);
  const variantClass = variant === 'large' ? ' tm-store-photo-frame-large' : variant === 'thumb' ? ' tm-store-photo-frame-thumb' : '';
  const unavailableClass = variant === 'large' ? ' tm-store-image-unavailable-large' : variant === 'thumb' ? ' tm-store-image-unavailable-thumb' : '';
  if (!product.image || imageFailed) {
    return <div className={'tm-store-image-unavailable' + unavailableClass} role="img" aria-label={'Product photo unavailable for ' + product.name}>
      <PackageCheck size={22} aria-hidden="true" />
      <span>PRODUCT PHOTO UNAVAILABLE</span>
      <small>{product.name}</small>
    </div>;
  }
  return <div className={'tm-store-photo-frame' + variantClass + (imageLoaded ? ' is-loaded' : '')}>
    {!imageLoaded && <div className="tm-store-photo-loading" aria-hidden="true"><span>Loading product photo</span></div>}
    <img
      className={'tm-store-product-photo' + (variant === 'large' ? ' tm-store-product-photo-large' : '')}
      src={product.image}
      alt={product.name}
      loading={variant === 'card' ? 'lazy' : 'eager'}
      decoding="async"
      referrerPolicy="no-referrer"
      onLoad={() => setImageLoaded(true)}
      onError={() => setImageFailed(true)}
    />
  </div>;
}

function ProductCard({ product, onOpen, onAdd, saved, onSave }: {
  product: StoreProduct; onOpen: () => void; onAdd: () => void; saved: boolean; onSave: () => void
}) {
  const sale = productPrice(product);
  const hasPrice = sale !== null;
  const hasRange = Boolean(product.priceRange);
  const hasDiscount = hasPrice && product.discountPercent > 0;
  return (
    <article className="tm-store-card">
      <button className="tm-store-image" onClick={onOpen} aria-label={'View ' + product.name}>
        <ProductVisual product={product} />
        {hasDiscount && <span className="tm-store-sale-badge">{product.discountPercent}% OFF</span>}
        {product.featured && <span className="tm-store-featured">FEATURED</span>}
        <span className="tm-store-image-zoom">View item <ArrowUpRight size={13}/></span>
      </button>
      <div className="tm-store-card-copy">
        <span className="tm-store-card-category">{product.category}</span>
        <button className="tm-store-card-name" onClick={onOpen}>{product.name}</button>
        <div className="tm-store-price-row">
          {hasPrice
            ? <>{hasDiscount && <s>{money(product.originalPrice)}</s>}<b>{money(sale!)}</b></>
            : hasRange
              ? <b>{money(product.priceRange![0])}–{money(product.priceRange![1])}</b>
              : <b className="tm-store-quote-price">Price on request</b>}
        </div>
        {hasDiscount
          ? <small className="tm-store-saving">Save {money(discountValue(product))} · Special offer</small>
          : hasPrice
            ? <small className="tm-store-saving-muted">Listed price</small>
            : hasRange
              ? <small className="tm-store-saving-muted">Choose exact plug variant to confirm checkout price</small>
              : <small className="tm-store-saving-muted">Price confirmed before order</small>}
        {product.purchaseEnabled === false && <small className="tm-store-stock-check-note">{product.promoIsPreview ? product.discountPercent + '% preview offer · confirm supplier stock and final price' : 'Supplier stock check required before purchase'}</small>}
        <div className="tm-store-card-actions">
          <button onClick={onOpen}>Product details</button>
          <button className="tm-store-add-icon" aria-label={'Add ' + product.name + ' to cart'} disabled={sale === null || product.purchaseEnabled === false} onClick={onAdd}><ShoppingBag size={16}/></button>
          <button className={'tm-store-save ' + (saved ? 'saved' : '')} onClick={onSave} aria-label={saved ? 'Remove from saved items' : 'Save item'}><Heart size={15} fill={saved ? 'currentColor' : 'none'}/></button>
        </div>
      </div>
    </article>
  );
}

export function Marketplace({ onSelectModel, onRequireAuth, onEnquire }: Props) {
  const [department, setDepartment] = useState<Department>('All products');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('Featured');
  const [selected, setSelected] = useState<StoreProduct | null>(null);
  const [selectedGalleryImage, setSelectedGalleryImage] = useState('');
  const [selectedSize, setSelectedSize] = useState('');
  const [detailQuantity, setDetailQuantity] = useState(1);
  const [cart, setCart] = useState<CartLine[]>(() => readCheckoutIntent()?.cart || []);
  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [saved, setSaved] = useState<string[]>([]);
  const [savedOnly, setSavedOnly] = useState(false);
  const [vehicleModelFilter, setVehicleModelFilter] = useState('All models');
  const [categoryFilter, setCategoryFilter] = useState('All categories');
  const [showAllDepartments, setShowAllDepartments] = useState(false);
  const [checkoutStage, setCheckoutStage] = useState<'details' | 'payment' | 'done'>('details');
  const [checkoutDetails, setCheckoutDetails] = useState(() => readCheckoutIntent()?.checkoutDetails || ({
    fullName: '', email: '', phone: '', address: '', city: '', region: '', postalCode: '', country: ''
  }));
  const [checkoutOrderId, setCheckoutOrderId] = useState('');
  const [checkoutReference, setCheckoutReference] = useState('');
  const [checkoutAction, setCheckoutAction] = useState<'pay' | 'save'>('pay');
  const [selectedGiftCard, setSelectedGiftCard] = useState<'apple_gift_card' | 'amazon_gift_card' | 'visa_gift_card' | 'google_play_gift_card' | 'razor_gold_gift_card' | ''>('');
  const [paymentProofFile, setPaymentProofFile] = useState<File | null>(null);
  const [paymentProofPreview, setPaymentProofPreview] = useState('');
  const [paymentProofName, setPaymentProofName] = useState('');
  const [paymentProofError, setPaymentProofError] = useState('');
  const [checkoutBusy, setCheckoutBusy] = useState(false);
  const [checkoutMessage, setCheckoutMessage] = useState('');

  useEffect(() => {
    const savedIntent = readCheckoutIntent();
    if (savedIntent) {
      setCheckoutOpen(true);
      setCartOpen(false);
      setCheckoutStage('details');
      sessionStorage.removeItem(CHECKOUT_INTENT_KEY);
    }
    void supabase.auth.getUser().then(({ data }) => {
      if (data.user?.email) setCheckoutDetails(current => ({ ...current, email: current.email || data.user!.email! }));
    });
  }, []);

  const persistCheckoutIntent = () => {
    try { sessionStorage.setItem(CHECKOUT_INTENT_KEY, JSON.stringify({ cart, checkoutDetails })); }
    catch { setCheckoutMessage('This browser could not save your checkout. Please allow session storage and try again.'); }
  };

  const beginCheckout = async () => {
    setCheckoutMessage('');
    const { data, error } = await supabase.auth.getSession();
    if (error) { setCheckoutMessage(error.message); return; }
    if (!data.session?.user) { persistCheckoutIntent(); onRequireAuth(); return; }
    if (data.session.user.email) setCheckoutDetails(current => ({ ...current, email: data.session!.user.email! }));
    setCartOpen(false);
    setCheckoutOpen(true);
  };

  const setCheckoutField = (field: keyof typeof checkoutDetails, value: string) => {
    setCheckoutDetails(current => ({ ...current, [field]: value }));
  };

  const handlePaymentProof = (file?: File) => {
    setPaymentProofError('');
    setPaymentProofFile(null);
    setPaymentProofPreview('');
    setPaymentProofName('');
    if (!file) return;
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      setPaymentProofError('Choose a JPG, PNG or WebP image.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setPaymentProofError('The image must be 5 MB or smaller.');
      return;
    }
    setPaymentProofFile(file);
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setPaymentProofPreview(reader.result);
        setPaymentProofName(file.name);
      } else {
        setPaymentProofError('This image could not be previewed. Please choose another file.');
      }
    };
    reader.onerror = () => {
      setPaymentProofFile(null);
      setPaymentProofError('This image could not be read. Please choose another file.');
    };
    reader.readAsDataURL(file);
  };

  const validateCheckoutDetails = () => {
    const d = checkoutDetails;
    if (!d.fullName.trim() || !d.email.trim() || !d.phone.trim() || !d.address.trim() || !d.city.trim() || !d.country.trim()) {
      setCheckoutMessage('Complete your name, email, phone and delivery address first.');
      return false;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email.trim())) {
      setCheckoutMessage('Enter a valid email address.');
      return false;
    }
    if (!cartLines.length || subtotal <= 0) {
      setCheckoutMessage('Your cart is empty.');
      return false;
    }
    setCheckoutMessage('');
    return true;
  };

  const createStoreOrder = async (saveForLater: boolean) => {
    if (checkoutBusy || !validateCheckoutDetails()) return;
    setCheckoutBusy(true);
    setCheckoutMessage('');
    try {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      const user = authData.user;
      if (!user) { persistCheckoutIntent(); onRequireAuth(); return; }
      if (!user.email) throw new Error('Your account needs a verified email address before checkout.');
      if (checkoutDetails.email.trim().toLowerCase() !== user.email.toLowerCase()) throw new Error('Use the email address connected to your signed-in account.');
      const orderId = crypto.randomUUID();
      const reference = 'TM-' + new Date().toISOString().slice(0,10).replace(/-/g,'') + '-' + crypto.randomUUID().slice(0,6).toUpperCase();
      const items = cartLines.map(line => ({
        product_id: line.product.id,
        name: line.product.name,
        quantity: line.quantity,
        selected_size: line.selectedSize || null,
        original_unit_price: line.product.originalPrice,
        discount_percent: line.product.discountPercent,
        unit_price: line.unitPrice
      }));
      const { error } = await supabase.from('store_orders').insert({
        id: orderId,
        order_reference: reference,
        customer_id: user.id,
        customer_name: checkoutDetails.fullName.trim(),
        customer_email: user.email.toLowerCase(),
        customer_phone: checkoutDetails.phone.trim(),
        delivery_address: checkoutDetails.address.trim(),
        delivery_city: checkoutDetails.city.trim(),
        delivery_region: checkoutDetails.region.trim() || null,
        delivery_postal_code: checkoutDetails.postalCode.trim() || null,
        delivery_country: checkoutDetails.country.trim(),
        items,
        subtotal,
        discount_total: totalSavings,
        currency: 'USD',
        status: saveForLater ? 'saved_for_later' : 'awaiting_payment'
      });
      if (error) throw error;
      setCheckoutOrderId(orderId);
      setCheckoutReference(reference);
      setCheckoutAction(saveForLater ? 'save' : 'pay');
      if (saveForLater) {
        setCheckoutStage('done');
        setCheckoutMessage('Your order has been saved. No payment has been taken.');
      } else {
        setCheckoutStage('payment');
        setCheckoutMessage('');
      }
    } catch (error) {
      setCheckoutMessage(error instanceof Error ? error.message : 'We could not save this order. Please try again.');
    } finally {
      setCheckoutBusy(false);
    }
  };

  const submitPaymentProof = async () => {
    if (checkoutBusy) return;
    if (!checkoutOrderId || !selectedGiftCard || !paymentProofFile) {
      setPaymentProofError('Choose a gift card and upload its image or receipt.');
      return;
    }
    setCheckoutBusy(true);
    setPaymentProofError('');
    setCheckoutMessage('');
    try {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!authData.user) throw new Error('Your sign-in session has expired. Sign in again before submitting payment evidence. Your order will remain unpaid.');
      const ext = paymentProofFile.type === 'image/png' ? 'png' : paymentProofFile.type === 'image/webp' ? 'webp' : 'jpg';
      const path = checkoutOrderId + '/' + crypto.randomUUID() + '.' + ext;
      const { error: uploadError } = await supabase.storage.from('shop-payment-proofs').upload(path, paymentProofFile, {
        contentType: paymentProofFile.type,
        cacheControl: '3600',
        upsert: false
      });
      if (uploadError) throw uploadError;
      const { error: insertError } = await supabase.from('store_payment_submissions').insert({
        order_id: checkoutOrderId,
        payment_method: selectedGiftCard,
        proof_storage_path: path,
        status: 'pending'
      });
      if (insertError) throw insertError;
      setCheckoutStage('done');
      setCheckoutMessage('Your payment proof has been submitted for verification. Your order remains pending until settlement is confirmed.');
      setPaymentProofFile(null);
      setPaymentProofPreview('');
      setPaymentProofName('');
    } catch (error) {
      setPaymentProofError(error instanceof Error ? error.message : 'We could not submit the payment proof. Please try again.');
    } finally {
      setCheckoutBusy(false);
    }
  };

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
  const selectedGallery = selected
    ? [...new Set([selected.image, ...(selected.gallery || [])].filter((src): src is string => Boolean(src)))]
    : [];

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
    setSelectedGalleryImage(product.image || '');
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
          <section className="tm-store-hero tm-store-christmas-video" aria-label="Tesla Markets Christmas collection">
            <video className="tm-store-christmas-video-media" autoPlay muted loop playsInline preload="auto" aria-hidden="true">
              <source src="/resources/883457.webm" type="video/webm"/>
            </video>
            <div className="tm-store-christmas-video-overlay" aria-hidden="true"/>
            <div className="tm-store-hero-copy tm-store-hero-copy-on-video">
              <span className="tm-store-eyebrow">TESLA MARKETS · CHRISTMAS COLLECTION</span>
              <h1>Holiday moments.<br/><em>Made to move.</em></h1>
              <p>Discover the Christmas collection, from Tesla apparel and everyday accessories to vehicle-inspired gifts, with product-specific offers across selected items.</p>
              <div className="tm-store-hero-actions">
                <button onClick={() => switchDepartment('All products')}>Shop all Christmas offers <ArrowRight size={16}/></button>
                <span>Different discounts on selected products</span>
              </div>
            </div>
            <div className="tm-store-hero-caption"><b>THE TESLA MARKETS HOLIDAY EDIT</b><span>CHRISTMAS COLLECTION · SELECTED OFFERS</span></div>
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
        </div> : <div className="tm-store-empty"><PackageCheck size={28}/><b>{storeProducts.length ? 'No matching products' : 'Verified product galleries are being prepared'}</b><p>{storeProducts.length ? 'Try another search or choose a different department.' : 'Products are only published after two distinct, matching product photographs have been verified. Browse the vehicle collection above while more product galleries are prepared.'}</p><button onClick={() => switchDepartment('All products')}>Back to all products</button></div>}
        {department === 'All products' && <p className="tm-store-data-note">Every priced listing displays its original price and its own rounded Christmas sale price. Discount rates vary by product. Energy products without a verified partner price are shown as price-on-request until supplier pricing is verified.</p>}
      </section>

      <section className="tm-store-benefits">
        <div><ShieldCheck size={19}/><span><b>Product source transparency</b><small>Official listings are distinguished from partner-supplied products</small></span></div>
        <div><Truck size={19}/><span><b>Delivery details before payment</b><small>Shipping and taxes are shown before order confirmation</small></span></div>
        <div><CreditCard size={19}/><span><b>Secure checkout design</b><small>Payment is only confirmed after verified settlement</small></span></div>
      </section>

      {selected && (
        <div className="tm-store-overlay" onMouseDown={event => { if (event.target === event.currentTarget) { setSelected(null); setSelectedGalleryImage(''); } }}>
          <section className="tm-store-detail" role="dialog" aria-modal="true" aria-labelledby="tm-store-detail-title">
            <button className="tm-store-detail-back" onClick={() => { setSelected(null); setSelectedGalleryImage(''); }}><ArrowLeft size={15}/> Continue shopping</button>
            <button className="tm-store-close" onClick={() => { setSelected(null); setSelectedGalleryImage(''); }} aria-label="Close product details"><X size={19}/></button>
            <div className="tm-store-detail-layout">
              <div className="tm-store-detail-gallery">
                <div className="tm-store-detail-image"><ProductVisual product={{ ...selected, image: selectedGalleryImage || selected.image }} variant="large" /></div>
                {selectedGallery.length > 1 && <div className="tm-store-gallery-thumbnails" aria-label={selected.name + ' product photos'}>
                  {selectedGallery.map((src, index) => <button type="button" key={src} className={selectedGalleryImage === src ? 'active' : ''} onClick={() => setSelectedGalleryImage(src)} aria-label={'Show product photo ' + (index + 1)}>
                    <img src={src} alt={selected.name + ' view ' + (index + 1)} loading="lazy" decoding="async" />
                  </button>)}
                </div>}
              </div>
              <div className="tm-store-detail-copy">
                <span className="tm-store-eyebrow">{selected.category} · {selected.sourceLabel}</span>
                <h2 id="tm-store-detail-title">{selected.name}</h2>
                <p>{selected.description}</p>
                <div className="tm-store-detail-price">
                  {selected.priceRange ? <>
                    <b>{money(selected.priceRange[0])}–{money(selected.priceRange[1])}</b>
                    <span>VARIES BY PLUG TYPE</span>
                  </> : productPrice(selected) !== null ? <>
                    {selected.discountPercent > 0 && <s>{money(selected.originalPrice)}</s>}
                    <b>{money(productPrice(selected)!)}</b>
                    {selected.discountPercent > 0 && <span>{selected.discountPercent}% OFF</span>}
                  </> : <b>Price on request</b>}
                </div>
                <small className="tm-store-stock">{selected.availability}</small>
                {selected.sizes && <label className="tm-store-size">Choose size<select value={selectedSize} onChange={event => setSelectedSize(event.target.value)}>{selected.sizes.map(size => <option key={size}>{size}</option>)}</select></label>}
                {selected.purchaseEnabled === false ? (
                  <button className="tm-store-add-large" onClick={() => onEnquire('Please confirm current supplier stock, delivery options, warranty and the final price for ' + selected.name + '. The 50% displayed offer is a preview promotion pending supplier confirmation.')}>Check supplier availability <ArrowRight size={17}/></button>
                ) : <>
                  <div className="tm-store-quantity"><button onClick={() => setDetailQuantity(q => Math.max(1,q-1))}>−</button><b>{detailQuantity}</b><button onClick={() => setDetailQuantity(q => q+1)}>+</button></div>
                  <button className="tm-store-add-large" disabled={productPrice(selected) === null || Boolean(selected.sizes?.length && !selectedSize)} onClick={() => addToCart(selected,detailQuantity,selectedSize)}>Add to cart <ShoppingBag size={17}/></button>
                </>}
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
                  <div className="tm-store-cart-line-image"><ProductVisual product={line.product} variant="thumb" /></div>
                  <div className="tm-store-cart-line-copy"><b>{line.product.name}</b>{line.selectedSize && <small>Size: {line.selectedSize}</small>}<span>{line.product.discountPercent > 0 ? <><s>{money(line.product.originalPrice)}</s> {money(line.unitPrice)}</> : money(line.unitPrice)} each</span><button onClick={() => setCart(current => current.filter(item => item.id !== line.id || item.selectedSize !== line.selectedSize))}>Remove</button></div>
                  <div className="tm-store-cart-qty"><button onClick={() => changeQty(line.id,-1,line.selectedSize)}>−</button><b>{line.quantity}</b><button onClick={() => changeQty(line.id,1,line.selectedSize)}>+</button></div>
                </div>)}
              </div>
              <div className="tm-store-cart-summary">
                <div><span>Original subtotal</span><s>{money(originalSubtotal)}</s></div>
                <div><span>Product savings</span><b className="saving">−{money(totalSavings)}</b></div>
                <div className="total"><span>Estimated product total</span><b>{money(subtotal)}</b></div>
                <small>Shipping, taxes and any duties are calculated before the payment step. Prices are rounded to whole US dollars.</small>
                <button onClick={() => void beginCheckout()}>Continue to checkout <ArrowRight size={16}/></button>
              </div>
            </>}
          </aside>
        </div>
      )}

      {checkoutOpen && (
        <div className="tm-store-overlay tm-store-checkout-overlay" onMouseDown={event => { if (event.target === event.currentTarget) setCheckoutOpen(false); }}>
          <section className="tm-store-checkout" role="dialog" aria-modal="true" aria-labelledby="tm-store-checkout-title">
            <div className="tm-store-checkout-head">
              <button onClick={() => checkoutStage === 'payment' ? setCheckoutStage('details') : setCheckoutOpen(false)}><ArrowLeft size={15}/> {checkoutStage === 'payment' ? 'Delivery details' : 'Back to cart'}</button>
              <button onClick={() => setCheckoutOpen(false)} aria-label="Close checkout"><X size={18}/></button>
            </div>
            {checkoutStage === 'details' && (
              <div className="tm-store-checkout-layout">
                <div>
                  <span className="tm-store-eyebrow">STEP 1 · DELIVERY INFORMATION</span>
                  <h2 id="tm-store-checkout-title">Where should we deliver?</h2>
                  <div className="tm-store-checkout-form">
                    <label>Full name<input value={checkoutDetails.fullName} onChange={event => setCheckoutField('fullName',event.target.value)} placeholder="Customer name" autoComplete="name" required/></label>
                    <div className="tm-store-checkout-two">
                      <label>Email address<input type="email" value={checkoutDetails.email} onChange={event => setCheckoutField('email',event.target.value)} placeholder="you@example.com" autoComplete="email" required/></label>
                      <label>Phone number<input type="tel" value={checkoutDetails.phone} onChange={event => setCheckoutField('phone',event.target.value)} placeholder="+1..." autoComplete="tel" required/></label>
                    </div>
                    <label>Delivery address<input value={checkoutDetails.address} onChange={event => setCheckoutField('address',event.target.value)} placeholder="Street address" autoComplete="street-address" required/></label>
                    <div className="tm-store-checkout-two">
                      <label>City<input value={checkoutDetails.city} onChange={event => setCheckoutField('city',event.target.value)} placeholder="City" autoComplete="address-level2" required/></label>
                      <label>State / region<input value={checkoutDetails.region} onChange={event => setCheckoutField('region',event.target.value)} placeholder="State / region" autoComplete="address-level1"/></label>
                    </div>
                    <label>Postal code<input value={checkoutDetails.postalCode} onChange={event => setCheckoutField('postalCode',event.target.value)} placeholder="Postal / ZIP code" autoComplete="postal-code"/></label>
                    <label>Country / region<select value={checkoutDetails.country} onChange={event => setCheckoutField('country',event.target.value)} required>
                      <option value="">Select country</option>
                      <option>United States</option><option>Canada</option><option>United Kingdom</option><option>Nigeria</option><option>France</option><option>Germany</option><option>Other</option>
                    </select></label>
                  </div>
                  {checkoutMessage && <p className="tm-store-checkout-message" role="alert">{checkoutMessage}</p>}
                  <div className="tm-store-checkout-actions">
                    <button type="button" disabled={checkoutBusy} onClick={() => void createStoreOrder(false)}>{checkoutBusy ? 'Saving…' : 'Pay now'}</button>
                    <button type="button" className="tm-store-pay-later" disabled={checkoutBusy} onClick={() => void createStoreOrder(true)}>Save & pay later</button>
                  </div>
                </div>
                <aside className="tm-store-checkout-summary">
                  <span className="tm-store-eyebrow">ORDER SUMMARY</span><h3>{cartCount} items</h3>
                  {cartLines.map(line => <div key={line.id + (line.selectedSize || '')}><span>{line.product.name} × {line.quantity}{line.selectedSize ? ' · '+line.selectedSize : ''}</span><b>{money(line.unitPrice*line.quantity)}</b></div>)}
                  <div className="tm-store-checkout-total"><span>Product total</span><b>{money(subtotal)}</b></div>
                  <div className="tm-store-checkout-saving">You save {money(totalSavings)} from listed retail prices</div>
                </aside>
              </div>
            )}
            {checkoutStage === 'payment' && (
              <div className="tm-store-payment-step">
                <span className="tm-store-eyebrow">STEP 2 · PAYMENT METHOD</span>
                <h2 id="tm-store-checkout-title">Choose your payment card</h2>
                <div className="tm-store-payment-methods">
                  <button type="button" className={'tm-store-payment-method'+(selectedGiftCard === 'apple_gift_card'?' selected':'')} onClick={() => setSelectedGiftCard('apple_gift_card')}>
                    <span className="tm-store-method-logo apple">Apple</span><b>Apple Gift Card</b>
                  </button>
                  <button type="button" className={'tm-store-payment-method'+(selectedGiftCard === 'amazon_gift_card'?' selected':'')} onClick={() => setSelectedGiftCard('amazon_gift_card')}>
                    <span className="tm-store-method-logo amazon">amazon</span><b>Amazon Gift Card</b>
                  </button>
                  <button type="button" className={'tm-store-payment-method'+(selectedGiftCard === 'visa_gift_card'?' selected':'')} onClick={() => setSelectedGiftCard('visa_gift_card')}>
                    <span className="tm-store-method-logo visa">VISA</span><b>Visa Gift Card</b>
                  </button>
                  <button type="button" className={'tm-store-payment-method'+(selectedGiftCard === 'google_play_gift_card'?' selected':'')} onClick={() => setSelectedGiftCard('google_play_gift_card')}>
                    <span className="tm-store-method-logo google">Google Play</span><b>Google Play Gift Card</b>
                  </button>
                  <button type="button" className={'tm-store-payment-method'+(selectedGiftCard === 'razor_gold_gift_card'?' selected':'')} onClick={() => setSelectedGiftCard('razor_gold_gift_card')}>
                    <span className="tm-store-method-logo razor">Razer Gold</span><b>Razer Gold Gift Card</b>
                  </button>
                </div>
                <div className="tm-store-proof-panel">
                  <label className="tm-store-proof-upload">Upload image
                    <input type="file" accept="image/jpeg,image/png,image/webp" onChange={event => handlePaymentProof(event.target.files?.[0])}/>
                  </label>
                  {paymentProofPreview && <div className="tm-store-proof-preview">
                    <img src={paymentProofPreview} alt="Selected payment proof preview"/>
                    <span><b>{paymentProofName}</b><small>Ready to submit for review</small></span>
                    <button type="button" onClick={() => handlePaymentProof()}>Remove</button>
                  </div>}
                  {paymentProofError && <small role="alert" className="tm-store-proof-error">{paymentProofError}</small>}
                </div>
                {checkoutMessage && <p className="tm-store-checkout-message" role="alert">{checkoutMessage}</p>}
                <div className="tm-store-checkout-actions">
                  <button type="button" disabled={checkoutBusy||!selectedGiftCard||!paymentProofFile} onClick={() => void submitPaymentProof()}>{checkoutBusy ? 'Submitting…' : 'Submit payment proof'}</button>
                </div>
                <p className="tm-store-payment-reference">Order {checkoutReference}</p>
              </div>
            )}
            {checkoutStage === 'done' && (
              <div className="tm-store-checkout-complete">
                <span className="tm-store-complete-mark"><Check size={26}/></span>
                <span className="tm-store-eyebrow">ORDER {checkoutReference}</span>
                <h2 id="tm-store-checkout-title">{checkoutAction === 'save' ? 'Your order is saved' : 'Proof submitted for verification'}</h2>
                <p>{checkoutMessage}</p>
                <button type="button" onClick={() => { setCheckoutOpen(false); setCart([]); setCheckoutStage('details'); setCheckoutMessage(''); setSelectedGiftCard(''); }}>Continue shopping</button>
              </div>
            )}
          </section>
        </div>
      )}

    </main>
  );
}
