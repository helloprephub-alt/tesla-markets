import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from './lib/supabase';
import { getInitialPublicLanguage, getSavedPublicLanguage, normalizePublicLanguage, publicText, savePublicLanguage, supportedPublicLanguages, type PublicLanguage } from './public-i18n';
import { startPublicDomTranslation } from './dom-translation';
import { ChatWorkspace, GeneratedGallery, ThemeToggle } from './ChatWorkspace';
import { AdminConsole } from './AdminConsole';
import { VehicleExperience } from './VehicleExperience';
import { Marketplace } from './Marketplace';
import { getDiscountedPrice, storeProducts } from './marketplace-catalog';
import { productAssetUrl } from './product-assets.generated';
import {
  ArrowDownRight,
  ArrowRight,
  ChevronLeft,
  ArrowUpRight,
  BarChart3,
  Bell,
  Check,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Clock3,
  CreditCard,
  Globe2,
  Heart,
  LayoutDashboard,
  LockKeyhole,
  LogOut,
  Menu,
  MessageCircle,
  RefreshCw,
  Search,
  ShieldCheck,
  ShoppingBag,
  PackageCheck,
  Truck,
  Sparkles,
  TrendingUp,
  UserRound,
  Volume2,
  VolumeX,
  Wallet,
  X,
  Zap,
} from 'lucide-react';

type Page =
  | 'home'
  | 'how'
  | 'markets'
  | 'ai'
  | 'shop'
  | 'vehicles'
  | 'about'
  | 'contact'
  | 'faq'
  | 'login'
  | 'signup'
  | 'dashboard'
  | 'portfolio'
  | 'history'
  | 'profile'
  | 'orders'
  | 'admin'
  | 'chat'
  | 'model-y'
  | 'model-3'
  | 'cybertruck'
  | 'roadster'
  | 'semi';
const navItems: { label: string; page: Page }[] = [
  { label: 'Home', page: 'home' },
  { label: 'Vehicles', page: 'vehicles' },
  { label: 'Shop', page: 'shop' },
  { label: 'My Orders', page: 'orders' },
  { label: 'My Account', page: 'profile' },
  { label: 'Investments', page: 'markets' },
  { label: 'About', page: 'about' },
  { label: 'FAQs', page: 'faq' },
  { label: 'Contact', page: 'contact' },
  { label: 'Support / Chat', page: 'chat' },
];
const projects = [
  {
    name: 'Space City Fund',
    type: 'Private markets',
    tag: 'FEATURED',
    desc: 'A curated look at the next generation of aerospace and infrastructure innovation.',
    amount: '$250',
    horizon: 'Long-term',
    color: 'orbital',
    progress: 68,
  },
  {
    name: 'Tunnel Network',
    type: 'Infrastructure',
    tag: 'NEW',
    desc: 'Explore emerging mobility infrastructure and next-generation transport systems.',
    amount: '$500',
    horizon: 'Long-term',
    color: 'tunnel',
    progress: 42,
  },
  {
    name: 'AI Strategy Alpha',
    type: 'AI strategies',
    tag: 'AI POWERED',
    desc: 'An overview of systematic, data-led market strategies and their risk framework.',
    amount: '$100',
    horizon: 'Strategy plan',
    color: 'neural',
    progress: 81,
  },
];
const plans = [
  {
    name: 'Essential',
    price: '$19',
    detail: 'For curious, independent learners',
    features: [
      'Market insights dashboard',
      'Weekly research brief',
      'Basic AI market signals',
    ],
    tone: 'plain',
  },
  {
    name: 'Advanced',
    price: '$49',
    detail: 'For a deeper research workflow',
    features: [
      'Everything in Essential',
      'Expanded AI analytics',
      'Priority research updates',
      'Portfolio tools preview',
    ],
    tone: 'featured',
  },
  {
    name: 'Institutional',
    price: 'Custom',
    detail: 'For teams and professional users',
    features: [
      'Everything in Advanced',
      'Team workspace',
      'Dedicated onboarding',
      'Custom reporting',
    ],
    tone: 'plain',
  },
];
const money = (n: string) => n;
const supportedLanguages=supportedPublicLanguages;
const translations:Record<string,Record<string,string>>={
en:{home:'Home',vehicles:'Vehicles / Shop',investments:'Investments',about:'About',faqs:'FAQs',contact:'Contact',support:'Support / Chat',language:'Choose your language',languageHint:'Select your preferred website language.',heroEyebrow:'ELECTRIC MOBILITY & INVESTMENT ENQUIRIES',heroTitle:'Invest in the',heroItalic:'future in motion.',heroDescription:'Explore public market information about Tesla (NASDAQ: TSLA) and send an enquiry to Tesla Markets Management.',explore:'Explore Tesla market information',chat:'Chat with us',independent:'Independent information',broker:'We do not execute trades; use a regulated brokerage of your choice.',intro:'TESLA MARKETS / INTRODUCTION',investNow:'Invest now',shop:'Explore the shop',collection:'VEHICLE COLLECTION',choose:'Choose your',next:'next Tesla.',viewAll:'View all models',search:'Search languages…'},
fr:{home:'Accueil',vehicles:'Véhicules / Boutique',investments:'Investissements',about:'À propos',faqs:'FAQ',contact:'Contact',support:'Assistance / Chat',language:'Choisir votre langue',languageHint:'Choisissez la langue du site que vous préférez.',heroEyebrow:'MOBILITÉ ÉLECTRIQUE ET DEMANDES D’INVESTISSEMENT',heroTitle:'Investissez dans le',heroItalic:'mouvement de demain.',heroDescription:'Consultez les informations publiques sur le marché de Tesla (NASDAQ : TSLA) et adressez une demande à l’équipe de Tesla Markets.',explore:'Consulter le marché Tesla',chat:'Discuter avec nous',independent:'Informations indépendantes',broker:'Nous n’exécutons pas de transactions ; utilisez le courtier réglementé de votre choix.',intro:'TESLA MARKETS / PRÉSENTATION',investNow:'Investir',shop:'Explorer la boutique',collection:'COLLECTION DE VÉHICULES',choose:'Choisissez votre',next:'prochaine Tesla.',viewAll:'Voir tous les modèles',search:'Rechercher une langue…'},
de:{home:'Startseite',vehicles:'Fahrzeuge / Shop',investments:'Investitionen',about:'Über uns',faqs:'Häufige Fragen',contact:'Kontakt',support:'Support / Chat',language:'Sprache auswählen',languageHint:'Wählen Sie Ihre bevorzugte Website-Sprache.',heroEyebrow:'ELEKTROMOBILITÄT & INVESTITIONSANFRAGEN',heroTitle:'Investieren Sie in die',heroItalic:'Zukunft in Bewegung.',heroDescription:'Informieren Sie sich über den öffentlichen Markt für Tesla (NASDAQ: TSLA) und senden Sie eine Anfrage an das Tesla-Markets-Team.',explore:'Tesla-Marktinforma­tionen ansehen',chat:'Mit uns chatten',independent:'Unabhängige Informationen',broker:'Wir führen keine Trades aus; nutzen Sie einen regulierten Broker Ihrer Wahl.',intro:'TESLA MARKETS / EINFÜHRUNG',investNow:'Jetzt investieren',shop:'Shop entdecken',collection:'FAHRZEUGSAMMLUNG',choose:'Wählen Sie Ihren',next:'nächsten Tesla.',viewAll:'Alle Modelle ansehen',search:'Sprachen suchen…'},
es:{home:'Inicio',vehicles:'Vehículos / Tienda',investments:'Inversiones',about:'Acerca de',faqs:'Preguntas frecuentes',contact:'Contacto',support:'Soporte / Chat',language:'Elige tu idioma',languageHint:'Selecciona el idioma que prefieres para el sitio.',heroEyebrow:'MOVILIDAD ELÉCTRICA Y CONSULTAS DE INVERSIÓN',heroTitle:'Invierte en el',heroItalic:'futuro en movimiento.',heroDescription:'Consulta información pública del mercado sobre Tesla (NASDAQ: TSLA) y envía una consulta al equipo de Tesla Markets.',explore:'Consultar información del mercado de Tesla',chat:'Chatea con nosotros',independent:'Información independiente',broker:'No ejecutamos operaciones; utiliza una entidad de corretaje regulada de tu elección.',intro:'TESLA MARKETS / INTRODUCCIÓN',investNow:'Invertir ahora',shop:'Explorar la tienda',collection:'COLECCIÓN DE VEHÍCULOS',choose:'Elige tu',next:'próximo Tesla.',viewAll:'Ver todos los modelos',search:'Buscar idiomas…'}
};


function CustomerOrders({onShop,onLogin}:{onShop:()=>void;onLogin:()=>void}) {
  const [orders,setOrders]=useState<any[]>([]);
  const [proofs,setProofs]=useState<any[]>([]);
  const [loading,setLoading]=useState(true);
  const [refreshing,setRefreshing]=useState(false);
  const [error,setError]=useState('');
  const [tab,setTab]=useState<'all'|'saved'|'submitted'>('all');
  const [refreshKey,setRefreshKey]=useState(0);

  useEffect(()=>{
    let active=true;
    const load=async()=>{
      if(active)setRefreshing(true);
      const {data:{user},error:userError}=await supabase.auth.getUser();
      if(userError||!user){
        if(active){setOrders([]);setProofs([]);setError('Sign in to see your saved orders and order updates.');setLoading(false);setRefreshing(false);}
        return;
      }
      const [orderResult,proofResult]=await Promise.all([
        supabase.from('store_orders').select('id,order_reference,items,subtotal,currency,status,payment_method,payment_verified_at,delivery_carrier,tracking_number,tracking_url,created_at,updated_at').eq('customer_id',user.id).order('created_at',{ascending:false}).limit(100),
        supabase.from('store_payment_submissions').select('id,order_id,payment_method,provider_reference,status,review_note,verified_at,reviewed_at,created_at').order('created_at',{ascending:false}).limit(300)
      ]);
      if(!active)return;
      if(orderResult.error){setError(orderResult.error.message);setLoading(false);setRefreshing(false);return;}
      const orderRows=orderResult.data||[];
      const ownIds=new Set(orderRows.map(row=>row.id));
      setOrders(orderRows);
      setProofs((proofResult.data||[]).filter(row=>ownIds.has(row.order_id)));
      setError('');
      setLoading(false);
      setRefreshing(false);
    };
    void load();
    const channel=supabase.channel('customer-store-order-tracking')
      .on('postgres_changes',{event:'*',schema:'public',table:'store_orders'},()=>{void load();})
      .on('postgres_changes',{event:'*',schema:'public',table:'store_payment_submissions'},()=>{void load();})
      .subscribe();
    const timer=window.setInterval(()=>{void load();},30000);
    return()=>{active=false;window.clearInterval(timer);void supabase.removeChannel(channel);};
  },[refreshKey]);

  const visibleOrders=orders.filter(order=>tab==='all'||(tab==='saved'?order.status==='saved_for_later':order.status!=='saved_for_later'));
  const getLatestProof=(orderId:string)=>proofs.find(proof=>proof.order_id===orderId);
  const stateFor=(order:any)=>{
    const proof=getLatestProof(order.id);
    if(order.status==='saved_for_later')return {label:'Saved for later',tone:'saved',detail:'This order is saved and has not been submitted.'};
    if(order.status==='completed'||order.status==='delivered')return {label:'Delivered',tone:'accepted',detail:'This order is marked as completed.'};
    if(order.status==='shipped')return {label:'Shipped',tone:'accepted',detail:'Your order has been marked as shipped.'};
    if(order.status==='processing')return {label:'Processing',tone:'accepted',detail:'Your order is being prepared.'};
    if(order.status==='payment_verified'||order.payment_verified_at)return {label:'Payment verified',tone:'accepted',detail:'Tesla Markets Management has independently confirmed receipt. Your order may now proceed to fulfilment.'};
    if(order.status==='cancelled')return {label:'Cancelled',tone:'rejected',detail:'This order has been cancelled.'};
    if(order.status==='proof_approved_pending_settlement'||proof?.status==='approved_pending_settlement')return {label:'Evidence accepted · awaiting settlement',tone:'accepted',detail:'Management accepted the evidence, but payment is not yet confirmed. Fulfilment will wait for settlement verification.'};
    if(order.status==='proof_submitted'||proof?.status==='pending')return {label:'Review pending',tone:'pending',detail:'Your payment evidence has been received. Management must review it before confirming payment.'};
    if(order.status==='payment_proof_rejected'||proof?.status==='rejected')return {label:'Needs attention',tone:'rejected',detail:'Management has reviewed this submission. See the review note below.'};
    return {label:'Not submitted yet',tone:'not-submitted',detail:'This order has been created, but no payment evidence has been received yet.'};
  };

  return <main className="customer-orders-page">
    <div className="customer-orders-hero">
      <div><span className="eyebrow dark">TESLA MARKETS · CUSTOMER AREA</span><h1>My orders</h1><p>See what you have saved, check your submissions and follow every order update in one place.</p></div>
      <button className="customer-orders-shop-btn" onClick={onShop}><ShoppingBag size={16}/> Continue shopping</button>
    </div>
    <div className="customer-orders-toolbar">
      <div className="customer-orders-tabs" role="tablist" aria-label="Order filters">
        <button type="button" className={tab==='all'?'active':''} onClick={()=>setTab('all')}>All orders <b>{orders.length}</b></button>
        <button type="button" className={tab==='saved'?'active':''} onClick={()=>setTab('saved')}>Saved <b>{orders.filter(o=>o.status==='saved_for_later').length}</b></button>
        <button type="button" className={tab==='submitted'?'active':''} onClick={()=>setTab('submitted')}>Submitted <b>{orders.filter(o=>o.status!=='saved_for_later').length}</b></button>
      </div>
      <button type="button" className="customer-orders-refresh" onClick={()=>setRefreshKey(value=>value+1)} disabled={refreshing}><RefreshCw size={14}/> {refreshing?'Refreshing…':'Refresh status'}</button>
    </div>
    {loading?<div className="customer-orders-state"><span className="customer-orders-spinner"/>Loading your orders…</div>
    :error?<div className="customer-orders-empty"><h2>Sign in to track your orders</h2><p>{error}</p><button className="btn btn-red" onClick={onLogin}>Sign in</button></div>
    :visibleOrders.length===0?<div className="customer-orders-empty"><span className="customer-orders-empty-icon"><ShoppingBag size={23}/></span><h2>{tab==='saved'?'No saved orders yet':tab==='submitted'?'No submitted orders yet':'Your order list is empty'}</h2><p>Orders you save or submit from the shop will appear here with their latest status.</p><button className="btn btn-red" onClick={onShop}>Visit the shop</button></div>
    :<div className="customer-orders-list">{visibleOrders.map(order=>{
      const proof=getLatestProof(order.id);
      const state=stateFor(order);
      const paymentVerified=Boolean(order.payment_verified_at||['payment_verified','processing','shipped','delivered','completed'].includes(order.status));
      const stages=[
        {label:'Order created',done:true},
        {label:'Evidence submitted',done:Boolean(proof)||['proof_submitted','proof_approved_pending_settlement','payment_verified','processing','shipped','delivered','completed'].includes(order.status)},
        {label:'Management review',done:Boolean(proof&&proof.status!=='pending')||paymentVerified},
        {label:'Payment verified',done:paymentVerified},
        {label:'Fulfilment',done:['processing','shipped','delivered','completed'].includes(order.status)}
      ];
      return <article className="customer-order-card" key={order.id}>
        <div className="customer-order-top"><div><span className="customer-order-reference">ORDER REFERENCE</span><b>{order.order_reference}</b><small>{new Date(order.created_at).toLocaleString()}</small></div><span className={'customer-order-badge '+state.tone}><i/>{state.label}</span></div>
        <div className="customer-order-items">{(order.items||[]).map((item:any,index:number)=><div key={item.product_id||index}><span>{item.name} <small>× {item.quantity}</small></span><b>{new Intl.NumberFormat('en-US',{style:'currency',currency:order.currency||'USD',maximumFractionDigits:0}).format(Number(item.unit_price||0)*Number(item.quantity||1))}</b></div>)}</div>
        <div className="customer-order-total"><span>Order total</span><b>{new Intl.NumberFormat('en-US',{style:'currency',currency:order.currency||'USD',maximumFractionDigits:0}).format(Number(order.subtotal||0))}</b></div>
        {order.payment_method&&<div className="customer-order-review-note"><b>Selected payment method</b><p>{String(order.payment_method).replaceAll('_',' ')}</p></div>}
        {order.payment_verified_at&&<div className="customer-order-review-note"><b>Payment verified</b><p>{new Date(order.payment_verified_at).toLocaleString()}</p></div>}
        <div className="customer-order-status-line"><span className={'customer-order-badge '+state.tone}><i/>{state.label}</span><p>{state.detail}</p></div>
        <div className="customer-order-progress">{stages.map((stage,index)=><div className={'customer-order-progress-step '+(stage.done?'done':'')} key={stage.label}><span className="customer-order-progress-dot">{stage.done?'✓':index+1}</span><small>{stage.label}</small></div>)}</div>
        {(order.delivery_carrier||order.tracking_number||order.tracking_url)&&<div className="customer-order-review-note"><b>Shipment tracking</b><p>{[order.delivery_carrier,order.tracking_number].filter(Boolean).join(' · ')||'Tracking details are being prepared.'}</p>{order.tracking_url&&<a href={order.tracking_url} target="_blank" rel="noopener noreferrer">Track package securely</a>}</div>}
        {proof?.review_note&&<div className={'customer-order-review-note '+(proof.status==='rejected'?'rejected':'')}><b>{proof.status==='rejected'?'Management review note':'Management update'}</b><p>{proof.review_note}</p></div>}
        {order.status==='saved_for_later'&&<div className="customer-order-saved-hint">Saved order · Return to the shop to continue browsing or rebuild your cart.</div>}
        <div className="customer-order-footer"><small>Last updated {new Date(order.updated_at||order.created_at).toLocaleString()}</small><button type="button" onClick={onShop}>Open shop <ArrowUpRight size={14}/></button></div>
      </article>;
    })}</div>}
  </main>;
}

function CustomerProfile({onOrders,onShop,onSignOut}:{onOrders:()=>void;onShop:()=>void;onSignOut:()=>void}) {
  const [user,setUser]=useState<any>(null);
  const [address,setAddress]=useState<any>(null);
  const [orderCount,setOrderCount]=useState(0);
  const [recentOrders,setRecentOrders]=useState<any[]>([]);
  const [savedProductIds]=useState<string[]>(()=>{try{const value=JSON.parse(localStorage.getItem('tesla-markets-saved-products')||'[]');return Array.isArray(value)?value.filter((id):id is string=>typeof id==='string'):[];}catch{return [];}});
  const [recentProductIds]=useState<string[]>(()=>{try{const value=JSON.parse(localStorage.getItem('tesla-markets-recent-products')||'[]');return Array.isArray(value)?value.filter((id):id is string=>typeof id==='string'):[];}catch{return [];}});
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');
  useEffect(()=>{
    let active=true;
    (async()=>{
      const {data:{user:current},error:userError}=await supabase.auth.getUser();
      if(!active)return;
      if(userError||!current){setError('Please sign in to view your customer account.');setLoading(false);return;}
      setUser(current);
      const [addressResult,ordersResult]=await Promise.all([
        supabase.from('customer_delivery_addresses').select('full_name,phone,address,city,region,postal_code,country').eq('user_id',current.id).maybeSingle(),
        supabase.from('store_orders').select('id,order_reference,subtotal,currency,status,created_at').eq('customer_id',current.id).order('created_at',{ascending:false}).limit(5)
      ]);
      if(!active)return;
      if(addressResult.error)console.warn('Could not load account delivery address:',addressResult.error.message);
      if(ordersResult.error)console.warn('Could not load account order history:',ordersResult.error.message);
      setAddress(addressResult.data||null);
      setRecentOrders(ordersResult.data||[]);
      setOrderCount((ordersResult.data||[]).length);
      setLoading(false);
    })();
    return()=>{active=false;};
  },[]);
  const displayName=[user?.user_metadata?.first_name,user?.user_metadata?.last_name].filter(Boolean).join(' ')||user?.user_metadata?.full_name||user?.user_metadata?.name||'Tesla Markets customer';
  const joined=user?.created_at?new Date(user.created_at).toLocaleDateString(undefined,{day:'numeric',month:'long',year:'numeric'}):'';
  return <main className="tm-account-page">
    <div className="tm-account-wrap">
      <div className="tm-account-heading"><span className="eyebrow dark">TESLA MARKETS · YOUR ACCOUNT</span><h1>My account</h1><p>Your profile, orders and saved delivery details in one place.</p></div>
      {loading?<div className="tm-account-panel">Loading your account…</div>
      :error?<div className="tm-account-panel"><h2>Sign in to your account</h2><p>{error}</p></div>
      :<>
        <section className="tm-account-welcome">
          <div className="tm-account-avatar">{String(displayName).trim().charAt(0).toUpperCase()}</div>
          <div><span>WELCOME BACK</span><h2>{displayName}</h2><p>{user.email}</p></div>
          <span className="tm-account-status"><i/> Signed in</span>
        </section>
        <div className="tm-account-grid">
          <section className="tm-account-panel tm-account-identity">
            <div className="tm-account-panel-head"><div><span>ACCOUNT DETAILS</span><h3>Profile information</h3></div><UserRound size={20}/></div>
            <dl><div><dt>Registered email</dt><dd>{user.email||'Not available'}</dd></div><div><dt>Account created</dt><dd>{joined||'—'}</dd></div><div><dt>Email verification</dt><dd><span className={user.email_confirmed_at?'tm-account-verified':'tm-account-unverified'}>{user.email_confirmed_at?'Verified':'Not verified yet'}</span></dd></div></dl>
            <p className="tm-account-note">This is the exact email address connected to the account you are currently signed in with. Use it when continuing a saved cart or checking your orders.</p>
          </section>
          <section className="tm-account-panel">
            <div className="tm-account-panel-head"><div><span>DELIVERY</span><h3>Saved delivery address</h3></div><Truck size={20}/></div>
            {address?<div className="tm-account-address"><b>{address.full_name}</b><span>{address.address}</span><span>{[address.city,address.region,address.postal_code,address.country].filter(Boolean).join(', ')}</span><span>{address.phone}</span></div>:<p className="tm-account-empty">Your delivery address will appear here after you complete it at checkout.</p>}
            <button className="tm-account-link" onClick={onShop}>Manage at checkout <ArrowUpRight size={14}/></button>
          </section>
          <section className="tm-account-panel tm-account-orders">
            <div className="tm-account-panel-head"><div><span>ORDER HISTORY</span><h3>Your recent orders</h3></div><PackageCheck size={20}/></div>
            {recentOrders.length?<div className="tm-account-recent">{recentOrders.slice(0,3).map(order=><div key={order.id}><div><b>{order.order_reference||'Order'}</b><small>{new Date(order.created_at).toLocaleDateString()}</small></div><span>{order.currency||'USD'} {Number(order.subtotal||0).toFixed(2)}</span><em>{String(order.status||'pending').replaceAll('_',' ')}</em></div>)}</div>:<p className="tm-account-empty">Your orders will appear here after you place or save an order.</p>}
            <button className="tm-account-link" onClick={onOrders}>View all orders <ArrowUpRight size={14}/></button>
          </section>
          <section className="tm-account-panel">
            <div className="tm-account-panel-head"><div><span>SAVED ITEMS</span><h3>Your wishlist</h3></div><Heart size={20}/></div>
            {savedProductIds.length ? <div className="tm-account-saved-list">{savedProductIds.slice(0,5).map(id => { const product = storeProducts.find(item => item.id === id); return product ? <div key={id}><span>{product.name}</span><b>{getDiscountedPrice(product) !== null ? "$" + getDiscountedPrice(product) : "Price on request"}</b></div> : null; })}</div> : <p className="tm-account-empty">Products you save in the Shop will appear here for quick access.</p>}
            <button className="tm-account-link" onClick={onShop}>Browse saved products <ArrowUpRight size={14}/></button>
          </section>
          <section className="tm-account-panel">
            <div className="tm-account-panel-head"><div><span>RECENTLY VIEWED</span><h3>Continue exploring</h3></div><Clock3 size={20}/></div>
            {recentProductIds.length ? <div className="tm-account-saved-list">{recentProductIds.slice(0,5).map(id => { const product = storeProducts.find(item => item.id === id); return product ? <div key={id}><span>{product.name}</span><b>Viewed</b></div> : null; })}</div> : <p className="tm-account-empty">Products you recently viewed will appear here.</p>}
            <button className="tm-account-link" onClick={onShop}>Return to the Shop <ArrowUpRight size={14}/></button>
          </section>
          <section className="tm-account-panel">
            <div className="tm-account-panel-head"><div><span>SECURITY</span><h3>Password & security</h3></div><ShieldCheck size={20}/></div>
            <p className="tm-account-empty">Password changes and password recovery will be enabled after the Tesla Markets domain and verified email delivery (Resend) are connected.</p>
            <button className="tm-account-disabled" type="button" disabled>Change password · Coming soon</button>
          </section>
        </div>
        <div className="tm-account-footer"><button className="tm-account-signout" onClick={onSignOut}><LogOut size={15}/> Sign out</button><button className="tm-account-shop" onClick={onShop}>Continue shopping <ArrowRight size={15}/></button></div>
      </>}
    </div>
  </main>;
}

function App() {
  const [page, setPage] = useState<Page>(
    () => {
      const route = new URLSearchParams(location.search).get('page');
      const hash = location.hash.replace(/^#\/?/, '');
      const savedPage = (() => { try { return localStorage.getItem('tesla-markets-last-page') || ''; } catch { return ''; } })();
      const requested = route || hash || (location.pathname.replace(/^\/+|\/+$/g, '') === 'admin' ? 'admin' : savedPage);
      const allowed: Page[] = ['home','how','markets','ai','shop','vehicles','about','contact','faq','login','signup','dashboard','portfolio','history','profile','orders','admin','chat','model-y','model-3','cybertruck','roadster','semi'];
      return allowed.includes(requested as Page) ? requested as Page : 'home';
    }
  );

  // Keep direct admin links working when Opera or another browser reuses an
  // already-open public-site tab and changes only the URL fragment.
  useEffect(() => { try { localStorage.setItem('tesla-markets-last-page', page); } catch {} }, [page]);

  useEffect(() => {
    const key = 'tesla-markets-scroll:' + page;
    let restoring = true;
    const saved = (() => { try { return Number(localStorage.getItem(key) || 0); } catch { return 0; } })();
    const save = () => { try { localStorage.setItem(key, String(window.scrollY)); } catch {} };
    const onScroll = () => { if (!restoring) save(); };
    window.addEventListener('scroll', onScroll, { passive: true });
    const frame = window.requestAnimationFrame(() => { window.scrollTo(0, saved); restoring = false; });
    return () => { save(); window.cancelAnimationFrame(frame); window.removeEventListener('scroll', onScroll); };
  }, [page]);

  useEffect(() => {
    const manifest = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
    if (manifest) manifest.href = page === 'admin' ? '/admin-manifest.webmanifest' : '/manifest.webmanifest';
    document.title = page === 'admin' ? 'Tesla Markets Admin | Private Management' : page === 'shop' ? 'Tesla Markets | Shop' : 'Tesla Markets';
    const theme = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    if (theme) theme.content = page === 'admin' ? '#101820' : '#e82127';
  }, [page]);

  useEffect(() => {
    const syncRoute = () => {
      const route = new URLSearchParams(location.search).get('page');
      const hash = location.hash.replace(/^#\/?/, '');
      const path = location.pathname.replace(/^\/+|\/+$/g, '');
      const requested = route || hash || (path === 'admin' ? 'admin' : 'home');
      const allowed: Page[] = ['home','how','markets','ai','shop','about','contact','faq','login','signup','dashboard','portfolio','history','profile','orders','admin','chat','model-y','model-3','cybertruck','roadster','semi'];
      if (allowed.includes(requested as Page)) setPage(requested as Page);
    };
    window.addEventListener('hashchange', syncRoute);
    window.addEventListener('popstate', syncRoute);
    return () => {
      window.removeEventListener('hashchange', syncRoute);
      window.removeEventListener('popstate', syncRoute);
    };
  }, []);
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(event => {
      if (event === 'PASSWORD_RECOVERY') {
        setPasswordRecovery(true);
        setAuthError('');
        setAuthMessage('Choose a new password for your account.');
        setPage('login');
        location.hash = 'login';
      } else if (event === 'SIGNED_IN' && location.hash === '#oauth-callback') {
        const next: Page = localStorage.getItem('tesla-markets-enquiry-intent') ? 'chat'
          : sessionStorage.getItem('tesla-markets-checkout-intent') ? 'shop' : 'dashboard';
        setPage(next);
        location.hash = next;
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  const [pageHistory, setPageHistory] = useState<Page[]>([]);
  const [menuOpen, setMenuOpen] = useState(false);
  const [languageOpen,setLanguageOpen]=useState(false);
  const [languageSearch,setLanguageSearch]=useState('');
  const [detectedLanguage,setDetectedLanguage] = useState<PublicLanguage>(()=>getInitialPublicLanguage());
  const currentLanguageName=String(supportedLanguages.find(([code])=>code===detectedLanguage)?.[1]||'English');
  const t=(key:string)=>translations.en[key]||key;
  const translateSite = async (lang:string) => {
    const normalized = normalizePublicLanguage(lang);
    if (!normalized) return;
    setDetectedLanguage(normalized);
    savePublicLanguage(normalized);
    setLanguageOpen(false);
    setLanguageSearch('');
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { error } = await supabase.from('customer_profiles').update({ preferred_language: normalized }).eq('id', user.id);
      if (error) console.error('Could not save customer language preference:', error.message);
      const activeConversationId = localStorage.getItem('tesla-markets-enquiry-id');
      if (activeConversationId) {
        const { error: conversationError } = await supabase.from('support_conversations')
          .update({ preferred_language: normalized })
          .eq('id', activeConversationId)
          .eq('customer_id', user.id);
        if (conversationError) console.error('Could not update conversation language:', conversationError.message);
      }
    }
  };
  useEffect(() => {
    let active = true;
    const restoreAccountLanguage = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!active || !user) return;
      const localChoice = getSavedPublicLanguage();
      if (localChoice) {
        const { error } = await supabase.from('customer_profiles').update({ preferred_language: localChoice }).eq('id', user.id);
        if (error) console.error('Could not sync saved customer language:', error.message);
        return;
      }
      const { data, error } = await supabase.from('customer_profiles').select('preferred_language').eq('id', user.id).maybeSingle();
      if (error || !active) return;
      const saved = normalizePublicLanguage(data?.preferred_language);
      if (saved) { savePublicLanguage(saved); setDetectedLanguage(saved); }
    };
    void restoreAccountLanguage();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN') void restoreAccountLanguage();
    });
    return () => { active = false; subscription.unsubscribe(); };
  }, []);
  useEffect(() => {
    document.documentElement.lang = detectedLanguage;
    document.documentElement.dir = ['ar','he','fa','ur'].includes(detectedLanguage) ? 'rtl' : 'ltr';
    return startPublicDomTranslation(detectedLanguage, () => setDetectedLanguage('en'));
  }, [detectedLanguage]);
  const [videoMuted, setVideoMuted] = useState(true);
  const heroVideoRef = useRef<HTMLVideoElement | null>(null);
  const toggleHeroVideoSound = () => {
    const video = heroVideoRef.current;
    if (!video) return;
    const nextMuted = !videoMuted;
    video.muted = nextMuted;
    if (!nextMuted) void video.play().catch(() => setVideoMuted(true));
    setVideoMuted(nextMuted);
  };
  const [notice, setNotice] = useState('');
  const [authBusy, setAuthBusy] = useState(false);
  const [authMessage, setAuthMessage] = useState('');
  const [authError, setAuthError] = useState('');
  const [passwordRecovery, setPasswordRecovery] = useState(false);
  const [verificationPending, setVerificationPending] = useState(false);
  const [pendingVerificationEmail, setPendingVerificationEmail] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [verificationPurpose, setVerificationPurpose] = useState<'signup' | 'recovery'>('signup');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = window.setTimeout(() => setResendCooldown(value => Math.max(0, value - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [resendCooldown]);
  useEffect(() => {
    try {
      const pending = JSON.parse(sessionStorage.getItem('tesla-markets-pending-verification') || 'null');
      if (pending?.email && (pending.purpose === 'signup' || pending.purpose === 'recovery')) {
        setPendingVerificationEmail(String(pending.email));
        setVerificationPurpose(pending.purpose);
        setVerificationPending(true);
      }
    } catch {}
  }, []);
  const [query, setQuery] = useState('');
  const [faq, setFaq] = useState<number | null>(0);
  const [tab, setTab] = useState('Overview');
  const [chatUnread,setChatUnread] = useState(0);
  const [publicContent,setPublicContent] = useState({homeHeadline:'One destination. Two ways to explore.',homeDescription:'Explore the vehicle collection and contact Tesla Markets management through one connected experience.',investmentHeading:'Explore Tesla investment opportunities.',investmentDescription:'Speak directly with Tesla Markets Management for information about Tesla-related investment enquiries, available routes, eligibility and the next steps.',footerBlurb:'Independent information and enquiry access for Tesla and SpaceX market watchers.'});
  const [publicInvestmentImages,setPublicInvestmentImages] = useState(['/resources/investment-slide-1','/resources/investment-slide-2']);
  useEffect(()=>{let active=true;(async()=>{const {data,error}=await supabase.from('site_settings').select('key,value').in('key',['public_site_content','investment_gallery']);if(error||!active)return;const content=data?.find(row=>row.key==='public_site_content')?.value;const gallery=data?.find(row=>row.key==='investment_gallery')?.value;if(content&&typeof content==='object')setPublicContent(current=>({...current,...content}));if(Array.isArray(gallery?.images)&&gallery.images.length)setPublicInvestmentImages(gallery.images.filter((url:unknown)=>typeof url==='string'));})();return()=>{active=false;};},[]);
  useEffect(() => {
    let active=true;
    const checkUnread=async()=>{
      if(page==='chat'){localStorage.setItem('tesla-markets-chat-last-seen',new Date().toISOString());if(active)setChatUnread(0);return;}
      const conversationId=localStorage.getItem('tesla-markets-enquiry-id');
      if(!conversationId)return;
      const {data:{user}}=await supabase.auth.getUser();
      if(!active||!user)return;
      const lastSeen=localStorage.getItem('tesla-markets-chat-last-seen')||'1970-01-01T00:00:00.000Z';
      const {count,error}=await supabase.from('support_messages').select('id',{count:'exact',head:true}).eq('conversation_id',conversationId).eq('sender_role','management').gt('created_at',lastSeen);
      if(active&&!error)setChatUnread(count||0);
    };
    void checkUnread();
    const timer=window.setInterval(()=>void checkUnread(),7000);
    return()=>{active=false;window.clearInterval(timer);};
  },[page]);
  const [form, setForm] = useState({
    email: '',
    first: '',
    last: '',
    country: '',
    password: '',
  });

  const go = (next: Page) => {
    if (next !== page) setPageHistory(history => [...history, page]);
    setPage(next);
    location.hash = next;
    setMenuOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const requireVerifiedAction = async (intent: { source: string; type: string; context: string; vehicleModel?: string }) => {
    try { localStorage.setItem('tesla-markets-enquiry-intent', JSON.stringify(intent)); } catch {}
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user || !data.user.email_confirmed_at) {
      go('signup');
      return;
    }
    go('chat');
  };
  const goParent = (next: Page) => {
    // Parent navigation (vehicle detail -> collection -> home) must not
    // retain stale checkout or gallery entries in the in-app back stack.
    setPageHistory([]);
    setPage(next);
    location.hash = next;
    setMenuOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const goBack = () => {
    // Vehicle navigation is hierarchical, not checkout/history based:
    // a vehicle detail always returns to the collection; the collection returns home.
    if (['model-y','model-3','cybertruck','roadster','semi'].includes(page)) {
      goParent('vehicles');
      return;
    }
    if (page === 'vehicles' || page === 'shop') {
      goParent('home');
      return;
    }
    const previous = pageHistory[pageHistory.length - 1];
    if (previous) {
      setPageHistory(history => history.slice(0, -1));
      setPage(previous);
      location.hash = previous;
      setMenuOpen(false);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    const fallback: Record<Page, Page> = {home:'home',how:'home',markets:'home',ai:'home',shop:'home',vehicles:'home',about:'home',contact:'home',faq:'home',login:'home',signup:'home',dashboard:'home',portfolio:'dashboard',history:'dashboard',profile:'dashboard',orders:'home',admin:'home',chat:'home','model-y':'shop','model-3':'shop',cybertruck:'shop',roadster:'shop',semi:'shop'};
    go(fallback[page] || 'home');
  };
  useEffect(() => {
    const visitorId = localStorage.getItem('tesla-markets-visitor-id') || (() => { const id='visitor_'+crypto.randomUUID(); localStorage.setItem('tesla-markets-visitor-id',id); return id; })();
    void supabase.from('site_visits').insert({ page, visitor_id:visitorId }).then(()=>undefined);
    const ping = () => supabase.rpc('record_site_presence', { p_visitor_id:visitorId, p_page:page }).then(()=>undefined);
    void ping();
    const timer = window.setInterval(ping, 30000);
    return () => window.clearInterval(timer);
  }, [page]);

  useEffect(() => {
    const trackClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      const control = target?.closest('button, a');
      if (!control) return;
      const label = (control.getAttribute('aria-label') || control.textContent || control.getAttribute('href') || 'interactive element').trim().replace(/\\s+/g, ' ').slice(0, 120);
      void supabase.from('site_clicks').insert({ page, target:label }).then(()=>undefined);
    };
    document.addEventListener('click', trackClick);
    return () => document.removeEventListener('click', trackClick);
  }, [page]);

  const announce = (message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(''), 3200);
  };
  const filteredProjects = useMemo(
    () =>
      projects.filter(p =>
        (p.name + p.type + p.desc).toLowerCase().includes(query.toLowerCase())
      ),
    [query]
  );

  const Brand = () => (
    <button
      className="brand"
      onClick={() => go('home')}
      aria-label="Tesla Markets home"
    >
      <img className="brand-logo" src="/tesla-wordmark.svg" alt="Tesla logo" />
      <span className="brand-word">Markets</span>
    </button>
  );
  const Header = () => (
    <header className="topbar">
      <div className="nav-wrap">
        <Brand />
        <nav className={menuOpen ? 'nav-links open' : 'nav-links'}>
          <button className="mobile-nav-language" type="button" onClick={()=>{setLanguageOpen(true);setMenuOpen(false);}}><svg className="language-globe-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9.2"/><path d="M2.8 12h18.4M12 2.8c2.4 2.5 3.5 5.6 3.5 9.2s-1.1 6.7-3.5 9.2c-2.4-2.5-3.5-5.6-3.5-9.2S9.6 5.3 12 2.8Z"/><path d="M5 6.5h14M5 17.5h14"/></svg> Language · {currentLanguageName}</button>
          {navItems.map(item => (
            <button
              key={item.page}
              className={page === item.page ? 'active' : ''}
              onClick={() => go(item.page)}
            >
              {t(({home:'home',markets:'investments',about:'about',faq:'faqs',contact:'contact',chat:'support'} as Record<string,string>)[item.page]||item.label)}
            </button>
          ))}
          <ThemeToggle className="mobile-theme-toggle" />
        </nav>
        <div className="nav-actions">
          <ThemeToggle className="desktop-theme-toggle" />
          <button className="language-trigger" type="button" onClick={()=>{setLanguageOpen(true);setMenuOpen(false);}} aria-label="Change language"><svg className="language-globe-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9.2"/><path d="M2.8 12h18.4M12 2.8c2.4 2.5 3.5 5.6 3.5 9.2s-1.1 6.7-3.5 9.2c-2.4-2.5-3.5-5.6-3.5-9.2S9.6 5.3 12 2.8Z"/><path d="M5 6.5h14M5 17.5h14"/></svg><span className="language-trigger-name">{currentLanguageName}</span><ChevronDown size={13}/></button>
          <button className="btn btn-outline btn-small" onClick={() => goParent('vehicles')}>Browse vehicles <ArrowUpRight size={15} /></button>
        </div>
        <button
          className="mobile-menu"
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="Toggle menu"
        >
          {menuOpen ? <X /> : <Menu />}
        </button>
      </div>
    </header>
  );
  const LanguageDialog=()=>languageOpen?<div className="language-backdrop" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget)setLanguageOpen(false);}}><section className="language-dialog" role="dialog" aria-modal="true" aria-labelledby="language-title"><div className="language-dialog-head"><div><span className="language-dialog-kicker">TESLA MARKETS</span><h2 id="language-title">{t("language")}</h2><p>{t("languageHint")}</p></div><button type="button" className="language-close" onClick={()=>setLanguageOpen(false)} aria-label="Close language selector"><X size={21}/></button></div><label className="language-search"><Search size={18}/><input autoFocus value={languageSearch} onChange={e=>setLanguageSearch(e.target.value)} placeholder={t("search")} /></label><div className="language-grid">{supportedLanguages.filter(([code,name])=>(name+' '+code).toLowerCase().includes(languageSearch.toLowerCase())).map(([code,name])=><button type="button" key={code} className={detectedLanguage===code?'selected':''} onClick={()=>translateSite(code)}><span>{name}</span><small>{code.toUpperCase()}</small>{detectedLanguage===code&&<Check size={16}/>}</button>)}</div><p className="language-note">Your language preference is saved on this device.</p></section></div>:null;
  const Footer = () => (
    <footer className="footer">
      <div className="footer-top">
        <div>
          <Brand />
          <p className="muted footer-blurb">{publicContent.footerBlurb}</p>
        </div>
        <div>
          <b>Investments</b>
          <button onClick={() => go('markets')}>Tesla (TSLA)</button>
          <button onClick={() => go('markets')}>SpaceX information</button>
          <button onClick={() => { void requireVerifiedAction({source:'Footer investment enquiry',type:'investment',context:'Tesla investment enquiry'}); }}>Investment enquiries</button>
        </div>
        <div>
          <b>Company</b>
          <button onClick={() => go('about')}>About us</button>
          <button onClick={() => go('contact')}>Contact</button>
          <button onClick={() => go('faq')}>FAQs</button>
        </div>
        <div>
          <b>Legal</b>
          <button
            onClick={() =>
              announce('Legal information page is being prepared.')
            }
          >
            Terms of use
          </button>
          <button
            onClick={() =>
              announce('Privacy information page is being prepared.')
            }
          >
            Privacy policy
          </button>
          <button
            onClick={() =>
              announce('Compliance information page is being prepared.')
            }          >            Compliance
          </button>
        </div>
      </div>
      <div className="footer-bottom">
        <span>© 2026 Independent Market Enquiries</span>
      </div>
    </footer>
  );
  const Preview = () => (
    <div className="preview-banner">
      <ShieldCheck size={15} /> VISUAL PREVIEW · Financial transactions and
      investment execution are not enabled.
    </div>
  );
  const ProjectCard = ({
    p,
    i,
  }: {
    p: (typeof projects)[number];
    i: number;
  }) => (
    <article className="project-card">
      <div className={'project-art ' + p.color}>
        <span className="art-grid" />
        <span className="art-orb" />
        <span className="art-lines" />
      </div>
      <div className="project-body">
        <div className="card-meta">
          <span>{p.type}</span>
          <span className="tag">{p.tag}</span>
        </div>
        <h3>{p.name}</h3>
        <p>{p.desc}</p>
        <div className="project-stats">
          <div>
            <small>INDICATIVE ENTRY</small>
            <b>{p.amount}</b>
          </div>
          <div>
            <small>TIMEFRAME</small>
            <b>{p.horizon}</b>
          </div>
        </div>
        <div className="progress-row">
          <span>Project overview</span>
          <span>{p.progress}%</span>
        </div>
        <div className="progress">
          <i style={{ width: p.progress + '%' }} />
        </div>
        <button
          className="text-link"
          onClick={() =>
            go('chat')
          }
        >
          Explore project <ArrowUpRight size={15} />
        </button>
      </div>
    </article>
  );
  const Hero = () => (
    <section className="hero">
      <div className="hero-copy">
        <div className="eyebrow">
          <span /> {t("heroEyebrow")}
        </div>
        <h1>
          {t("heroTitle")}<br />
          <em>{t("heroItalic")}</em>
        </h1>
        <p>
          {t("heroDescription")}
        </p>
        <div className="hero-buttons">
          <button className="btn btn-red" onClick={() => go('markets')}>
            {t("explore")} <ArrowUpRight size={17} />
          </button>
          <button className="btn btn-ghost" onClick={() => go('chat')}>
            {t("chat")} <ArrowRight size={16} />
          </button>
        </div>
        <div className="hero-proof">
          <div className="proof-icon">
            <ShieldCheck size={18} />
          </div>
          <span>
            <b>{t("independent")}</b>
            <small>{t("broker")}</small>
          </span>
        </div>
      </div>
      <div className="hero-video-stage" aria-label="Tesla Markets cinematic vehicle showcase">
        <video ref={heroVideoRef} autoPlay muted={videoMuted} loop playsInline preload="auto" poster="/resources/tesla-hero.jpg">
          <source src="/resources/tesla-showreel.webm" type="video/webm"/>
        </video>
        <button type="button" className="hero-video-sound" onClick={toggleHeroVideoSound} aria-label={videoMuted ? "Unmute video sound" : "Mute video sound"} title={videoMuted ? "Turn sound on" : "Mute sound"}>
          {videoMuted ? <VolumeX size={19} /> : <Volume2 size={19} />}
          <span>{videoMuted ? "Sound off" : "Sound on"}</span>
        </button>
      </div>
      <div className="hero-index">
        <span>01</span>
        <span className="index-line" />
        <span>03</span>
      </div>
    </section>
  );
  const homeShopPreview = ['winter-holiday-sweater','winter-holiday-mug','tesla-core-backpack','model-y-mud-flaps']
    .map(id => storeProducts.find(product => product.id === id))
    .filter((product): product is NonNullable<typeof product> => Boolean(product && product.image));
  const Home = () => (
    <>
      <Hero />
      <section className="home-intro">
        <div className="eyebrow dark">{t("intro")}</div>
        <h2>{publicContent.homeHeadline}</h2>
        <p>{publicContent.homeDescription}</p>
        <div className="home-intro-actions"><button className="btn btn-dark" onClick={()=>{void requireVerifiedAction({source:'Invest Now',type:'investment',context:'Tesla investment enquiry — I would like to speak directly with Tesla Markets Management.'});}}>{t("investNow")} <ArrowUpRight size={16}/></button><button className="btn btn-outline" onClick={()=>go('shop')}>{t("shop")} <ArrowUpRight size={16}/></button></div>
      </section>
      <section className="home-shop-preview" aria-label="Tesla Markets Christmas shop promotion">
        <div className="home-shop-preview-heading">
          <div>
            <div className="eyebrow dark">TESLA MARKETS · CHRISTMAS PROMOTION</div>
            <h2>Christmas offers.<br/><em>Different discounts across the shop.</em></h2>
            <p>Apparel, drinkware, mini Teslas, vehicle accessories and more — discover the store before you browse.</p>
          </div>
          <button className="btn btn-red" onClick={() => go('shop')}>Shop Christmas offers <ArrowUpRight size={16}/></button>
        </div>
        <div className="home-shop-preview-grid">
          {homeShopPreview.map(product => {
            const price = getDiscountedPrice(product);
            return <button className="home-shop-preview-card" key={product.id} onClick={() => go('shop')}>
              <div className="home-shop-preview-image" style={{backgroundImage: "url('" + productAssetUrl(product.image) + "')", backgroundSize:'contain', backgroundPosition:'center', backgroundRepeat:'no-repeat'}}>
                {product.discountPercent > 0 && <span>{product.discountPercent}% OFF</span>}
              </div>
              <span className="home-shop-preview-name">{product.name}</span>
              {price !== null && <span className="home-shop-preview-prices">{product.discountPercent > 0 && <s>${product.originalPrice}</s>}<b>${price}</b></span>}
            </button>;
          })}
        </div>
        <div className="home-shop-preview-footer">
          <span>THE TESLA MARKETS CHRISTMAS STORE</span>
          <button onClick={() => go('shop')}>Explore all products <ArrowUpRight size={14}/></button>
        </div>
      </section>
      <section className="home-model-preview">
        <div className="vehicle-promo-ribbon"><span>CHRISTMAS VEHICLE OFFERS</span><b>25–45% OFF SELECTED VERSIONS</b><small>Discounts vary by model and configuration</small></div>
        <div className="section-head"><div><div className="eyebrow dark">{t("collection")}</div><h2>{t("choose")}<br/><em>{t("next")}</em></h2></div><button className="vehicle-view-all-cta" onClick={()=>goParent('vehicles')} aria-label="View the complete vehicle collection"><span>{t("viewAll")}</span><small>EXPLORE THE COLLECTION</small><ArrowUpRight size={17}/></button></div>
        <div className="home-model-grid">
          <button onClick={()=>go('model-3')}><img src="/resources/model-3-1.jpg" alt="Model 3 vehicle preview" loading="lazy"/><span>Model 3 <small>28% OFF SELECTED TRIMS</small><ArrowUpRight size={14}/></span></button>
          <button onClick={()=>go('model-y')}><img src="/resources/model-y-1.jpg" alt="Model Y vehicle preview" loading="lazy"/><span>Model Y <small>25–45% OFF SELECTED TRIMS</small><ArrowUpRight size={14}/></span></button>
          <button onClick={()=>go('cybertruck')}><img src="/resources/cybertruck-1.jpg" alt="Cybertruck vehicle preview" loading="lazy"/><span>Cybertruck <small>30–45% OFF SELECTED TRIMS</small><ArrowUpRight size={14}/></span></button>
          <button onClick={()=>go('roadster')}><img src="/resources/roadster-1.jpg" alt="Roadster vehicle preview" loading="lazy"/><span>Roadster <small>25–40% OFF SELECTED TRIMS</small><ArrowUpRight size={14}/></span></button>
          <button onClick={()=>go('semi')}><img src="/resources/semi-1.jpg" alt="Tesla Semi vehicle preview" loading="lazy"/><span>Tesla Semi <small>35% OFF</small><ArrowUpRight size={14}/></span></button>
        </div>
      </section>
              <section className="home-investment-strip"><div><div className="eyebrow">{t('investmentEnquiries')}</div><h2>{t('Explore Tesla')}<br/><em>{t('investment information.')}</em></h2><p>{t('Contact Tesla Markets Management directly with your investment questions.')}</p></div><button className="btn btn-light" onClick={() => { void requireVerifiedAction({source:'Invest Now',type:'investment',context:'Tesla investment enquiry — I would like to speak directly with Tesla Markets Management.'}); }}>{t("investNow")} <ArrowUpRight size={16}/></button></section>
    </>
  );
  const How = () => (
    <>
      <section className="page-hero">
        <div className="eyebrow">THE PROCESS</div>
        <h1>
          A clearer way to
          <br />
          <em>explore opportunity.</em>
        </h1>
        <p>
          We bring research, project context and digital tools together in one
          considered experience.
        </p>
        <div className="hero-buttons">
          <button className="btn btn-red" onClick={() => go('signup')}>
            Create your account <ArrowUpRight size={16} />
          </button>
          <button className="btn btn-ghost" onClick={() => go('markets')}>
            Browse projects
          </button>
        </div>
      </section>
      <section className="section section-light">
        <div className="section-head">
          <div>
            <div className="eyebrow dark">THREE SIMPLE STEPS</div>
            <h2>
              From discovery
              <br />
              to <em>understanding.</em>
            </h2>
          </div>
        </div>
        <div className="steps">
          {[
            [
              '01',
              'Create your profile',
              'Set up your personal workspace and choose the information you want to follow.',
            ],
            [
              '02',
              'Explore the landscape',
              'Review project summaries, market themes, research notes and risk information.',
            ],
            [
              '03',
              'Stay informed',
              'Use your dashboard to organise saved projects and follow platform updates.',
            ],
          ].map(s => (
            <div className="step" key={s[0]}>
              <span>{s[0]}</span>
              <div>
                <h3>{s[1]}</h3>
                <p>{s[2]}</p>
              </div>
              <ArrowUpRight />
            </div>
          ))}
        </div>
      </section>
      <section className="section section-dark">
        <div className="section-head">
          <div>
            <div className="eyebrow">OUR PRINCIPLES</div>
            <h2>
              Built around
              <br />
              <em>transparency.</em>
            </h2>
          </div>
        </div>
        <div className="principles">
          <div>
            <ShieldCheck />
            <h3>Risk-aware by design</h3>
            <p>
              Clear explanations and risk information should be easy to find.
            </p>
          </div>
          <div>
            <Globe2 />
            <h3>Global perspective</h3>
            <p>Explore themes and ideas across a changing global economy.</p>
          </div>
          <div>
            <Zap />
            <h3>Technology-led</h3>
            <p>Thoughtful digital tools help organise complex information.</p>
          </div>
        </div>
      </section>
    </>
  );
  const Markets = () => (
    <main className="investment-page">
      <section className="investment-hero investment-enquiry-only">
        <div className="investment-slideshow" aria-label="Tesla investment information">
          {publicInvestmentImages.map((src,index)=><img key={src} className="investment-slide" style={{animationDelay:(index*(12/Math.max(publicInvestmentImages.length,1)))+'s'}} src={src} alt={'Tesla investment display '+(index+1)}/>) }
          <div className="investment-slide-shade" />
          <div className="investment-slide-caption"><span>TESLA MARKETS</span><b>{t('Tesla investment enquiries')}</b></div>
        </div>
        <div className="investment-panel">
          <div className="investment-panel-heading"><div className="eyebrow dark">{t('TESLA INVESTMENT INFORMATION')}</div><span className="portfolio-status-pill broker-connected"><i/> {t('Direct management contact')}</span></div>
          <h1>{publicContent.investmentHeading}</h1>
          <p className="investment-description">{publicContent.investmentDescription}</p>
          <div className="investment-info-grid"><article><b>Tesla, Inc.</b><span>NASDAQ: TSLA</span><small>{t('Publicly traded company information')}</small></article><article><b>{t('Direct management contact')}</b><span>{t('Enquiry support')}</span><small>{t('Discuss your questions with management')}</small></article></div>
          <button className="btn btn-dark investment-cta" onClick={()=>{localStorage.setItem('tesla-markets-enquiry-intent',JSON.stringify({source:'Invest Now',type:'investment',context:'Tesla investment enquiry — I would like to speak directly with Tesla Markets Management.'}));go('signup')}}>{t('INVEST NOW')} <ArrowUpRight size={17}/></button>
        </div>
      </section>
      <section className="investment-trust-note"><span>{t('Direct management contact')}. Contact management to discuss your Tesla investment enquiry and the available next steps.</span></section>
    </main>
  );
  const AI = () => (
    <>
      <section className="page-hero compact">
        <div className="eyebrow">AI PLANS / RESEARCH TOOLS</div>
        <h1>
          Intelligence for
          <br />
          <em>better questions.</em>
        </h1>
        <p>
          Choose a research workspace for market context, structured insights
          and analytical tools.
        </p>
      </section>
      <section className="section section-light">        <div className="plan-grid">
          {plans.map((p, i) => (            <article className={'plan-card ' + p.tone} key={p.name}>
              {p.tone === 'featured' && (
                <span className="popular">MOST POPULAR</span>
              )}
              <div className="eyebrow dark">RESEARCH MEMBERSHIP</div>
              <h3>{p.name}</h3>
              <p>{p.detail}</p>
              <div className="plan-price">
                {p.price}
                <small>{p.price !== 'Custom' ? ' / month' : ''}</small>
              </div>
              <div className="plan-rule" />
              {p.features.map(f => (
                <div className="plan-feature" key={f}>
                  <Check size={15} />
                  {f}
                </div>
              ))}
              <button
                className={
                  p.tone === 'featured'
                    ? 'btn btn-red full'
                    : 'btn btn-outline full'
                }
                onClick={() =>
                  go('chat')
                }
              >
                View plan <ArrowUpRight size={15} />
              </button>
            </article>
          ))}
        </div>
        <p className="center-note">
          Plan names, features and prices are illustrative placeholders for
          design review.
        </p>
      </section>
    </>
  );
  const Shop = () => <><div className="shop-order-shortcut"><button type="button" onClick={()=>go('orders')}>My orders <ArrowUpRight size={13}/></button><button type="button" className="shop-vehicles-link" onClick={()=>goParent('vehicles')}>Explore vehicles <ArrowUpRight size={13}/></button></div><Marketplace onOrders={()=>go('orders')} onRequireAuth={()=>go('signup')} onEnquire={(context)=>{void requireVerifiedAction({source:'Marketplace',type:'product',context});}} /></>;
  const VehicleCollection = () => <VehicleExperience language={detectedLanguage as PublicLanguage} onBack={()=>goParent('home')} onSelectModel={(id)=>go(id as Page)} onEnquire={(context)=>{void requireVerifiedAction({source:'Vehicle page',type:'vehicle',vehicleModel:context.match(/Model 3|Model Y|Cybertruck|Roadster|Semi/i)?.[0]||'Tesla vehicle',context});}} />;
  const VehicleDetail = () => <VehicleExperience language={detectedLanguage as PublicLanguage} modelId={page==='model-y'?'model-y':page==='model-3'?'model-3':page==='cybertruck'?'cybertruck':page==='semi'?'semi':'roadster'} onBack={()=>goParent('vehicles')} onSelectModel={(id)=>go(id as Page)} onEnquire={(context)=>{void requireVerifiedAction({source:'Vehicle page',type:'vehicle',vehicleModel:context.match(/Model 3|Model Y|Cybertruck|Roadster|Semi/i)?.[0]||'Tesla vehicle',context});}} />;
  const Info = ({ kind }: { kind: 'about' | 'contact' | 'faq' }) => (
    <>
      <section className="page-hero compact">
        <div className="eyebrow">
          {kind === 'about'
            ? 'OUR STORY'
            : kind === 'contact'
              ? 'GET IN TOUCH'
              : 'HELP CENTRE'}
        </div>
        <h1>
          {kind === 'about' ? (
            <>
              An independent
              <br />
              <em>point of view.</em>
            </>
          ) : kind === 'contact' ? (
            <>
              Let's start a<br />
              <em>conversation.</em>
            </>
          ) : (
            <>
              Questions, met
              <br />
              <em>with clarity.</em>
            </>
          )}
        </h1>
        <p>
          {kind === 'about'
            ? 'A digital concept built around accessible research, emerging ideas and thoughtful technology.'
            : kind === 'contact'
              ? 'Reach out with questions about the platform, research themes or your account.'
              : 'Find answers about this platform preview and how its features are intended to work.'}
        </p>
      </section>
      <section className="section section-light">
        {kind === 'faq' ? (
          <div className="faq-list">
            {[
              'Can I buy Tesla shares here?',
              'Can I buy SpaceX shares here?',
              'Are the prices live?',
              'Is this website affiliated with Tesla or SpaceX?',
              'How do I contact the team?',
            ].map((q, i) => (
              <div className="faq-item" key={q}>
                <button onClick={() => setFaq(faq === i ? null : i)}>
                  <span>{q}</span>
                  {faq === i ? <X size={18} /> : <ChevronDown size={18} />}
                </button>
                {faq === i && (
                  <p>
                    {
                      [
                        'You can enquire here, but share purchases must be completed through an authorised brokerage. This website does not execute trades.',
                        'SpaceX is a privately held company, not a publicly listed stock. Any private-market opportunity requires independent verification and eligibility checks.',
                        'No. The figures shown are dated reference prices. Use the linked market pages for current quotes.',
                        'No. This is an independent information and enquiry website, not affiliated with either company.',
                        'Open the Enquiries tab to start a conversation.',
                      ][i]
                    }
                  </p>
                )}
              </div>
            ))}
          </div>
        ) : kind === 'contact' ? (
          <div className="contact-layout">
            <div>
              <h2>
                We'd love to
                <br />
                <em>hear from you.</em>
              </h2>
              <p className="muted">
                Send a note and our team will get back to you. This preview form
                does not send or store messages.
              </p>
            </div>
            <form
              className="contact-form"
              onSubmit={e => {
                e.preventDefault();
                announce(
                  'Thanks — message preview submitted. No message was sent.'
                );
              }}
            >
              <label>
                Your name
                <input required placeholder="Full name" />
              </label>
              <label>
                Email address
                <input required type="email" placeholder="you@example.com" />
              </label>
              <label>
                How can we help?
                <textarea
                  required
                  placeholder="Write your message..."
                  rows={4}
                />
              </label>
              <button className="btn btn-red">
                Send message <ArrowUpRight size={16} />
              </button>
            </form>
          </div>
        ) : (
          <div className="about-copy">
            <h2>
              Ideas move the world.
              <br />
              <em>Understanding moves us.</em>
            </h2>
            <p>
              We imagine a more considered way to explore the themes shaping
              tomorrow. This interface brings together project discovery,
              research memberships and curated products in one cohesive digital
              experience.
            </p>
            <p>
              Our guiding principle is simple: present information clearly,              explain uncertainty honestly and put understanding before action.
            </p>
          </div>        )}
      </section>
    </>
  );
  const Auth = ({ signup }: { signup: boolean }) => (
    <section className="auth-page">
      <div className="auth-art">
        <div className="auth-orbit" />
        <div className="auth-orbit two" />
        <div className="auth-copy">
          <div className="eyebrow">TESLA MARKETS · PRIVATE CLIENT ACCESS</div>
          <h2>
            A more considered
            <br />
            way to <em>move forward.</em>
          </h2>
          <p>Secure access to your enquiries, orders and conversations with Tesla Markets Management.</p>
          <div className="tm-auth-art-foot"><span>SECURE CLIENT PORTAL</span><span>TESLA MARKETS</span></div>
        </div>
      </div>
      <div className="auth-panel">
        <div className="auth-form-wrap">
          <button className="back-home" onClick={() => go('home')}>
            ← Back to home
          </button>
          <div className="eyebrow dark">
            {passwordRecovery ? 'ACCOUNT RECOVERY' : signup ? 'CREATE ACCOUNT' : 'WELCOME BACK'}
          </div>
          <h1>{passwordRecovery ? 'Choose a new password' : signup ? 'Create your account' : 'Sign in to your account'}</h1>
          <p className="muted">
            {passwordRecovery ? 'Set a new password to secure your account.' : signup ? 'Create your secure Tesla Markets customer account.' : 'Sign in to continue to your account and saved checkout.'}
          </p>


          {verificationPending ? (
            <form onSubmit={async e => {
              e.preventDefault(); if (authBusy) return;
              setAuthBusy(true); setAuthError(''); setAuthMessage('');
              try {
                const result = await supabase.auth.verifyOtp({ email: pendingVerificationEmail, token: verificationCode.trim(), type: verificationPurpose === 'recovery' ? 'recovery' : 'signup' });
                if (result.error) throw result.error;
                try { sessionStorage.removeItem('tesla-markets-pending-verification'); } catch {}
                setVerificationPending(false); setVerificationCode('');
                if (verificationPurpose === 'recovery') {
                  setPasswordRecovery(true);
                  setAuthMessage('Your code has been verified. Choose a new password.');
                } else {
                  setAuthMessage('Your email has been successfully verified. Welcome to Tesla Markets.');
                  if (result.data.session) {
                    if (sessionStorage.getItem('tesla-markets-enquiry-intent')) go('chat');
                    else if (sessionStorage.getItem('tesla-markets-checkout-intent')) go('shop');
                    else go('dashboard');
                  }
                }
              } catch (error) {
                const message = error instanceof Error ? error.message.toLowerCase() : '';
                setAuthError(message.includes('expired') ? 'This verification code has expired. Please request a new code.' : 'That verification code is incorrect. Please check your email and try again.');
              }
              finally { setAuthBusy(false); }
            }}>
              <div className="eyebrow dark">{verificationPurpose === 'recovery' ? 'PASSWORD RECOVERY' : 'EMAIL VERIFICATION'}</div>
              <h1>{verificationPurpose === 'recovery' ? 'Verify your recovery code.' : 'Verify your email address.'}</h1>
              <p className="muted">Enter the six-digit code sent to <strong>{pendingVerificationEmail}</strong>. Check your Inbox, Spam and Promotions folders.</p>
              <label className="tm-otp-label">6-DIGIT SECURITY CODE<input className="tm-otp-input" required inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} value={verificationCode} onChange={e=>setVerificationCode(e.target.value.replace(/\D/g,'').slice(0,6))} placeholder="• • • • • •" /></label>
              {authError && <p className="auth-feedback error" role="alert">{authError}</p>}
              {authMessage && <p className="auth-feedback success" role="status">{authMessage}</p>}
              <button className="btn btn-red full" disabled={authBusy || verificationCode.length!==6}>{authBusy ? 'Verifying…' : 'Verify email'} <ArrowUpRight size={16}/></button>
              <button type="button" className="forgot" disabled={authBusy || resendCooldown > 0} onClick={async()=>{setAuthBusy(true);setAuthError('');setAuthMessage('');try{if(verificationPurpose==='recovery'){const {data,error}=await supabase.functions.invoke('tesla-customer-signup',{body:{action:'recovery',email:pendingVerificationEmail}});if(error)throw error;if(data?.error)throw new Error(String(data.error));}else{const {error}=await supabase.auth.resend({type:'signup',email:pendingVerificationEmail});if(error)throw error;}setResendCooldown(30);setAuthMessage('If the address can receive a code, a new verification email has been requested. Check Inbox, Spam and Promotions.');}catch(error){setAuthError(error instanceof Error?error.message:'Could not resend the code. Please try again shortly.');}finally{setAuthBusy(false);}}}>{resendCooldown > 0 ? 'Resend code in ' + resendCooldown + 's' : 'Resend verification code'}</button>
              <button type="button" className="forgot" onClick={()=>{setVerificationPending(false);setVerificationCode('');try{sessionStorage.removeItem('tesla-markets-pending-verification');}catch{}setAuthError('');setAuthMessage('');}}>Use a different email address</button>
            </form>
          ) : (
          <form
            onSubmit={async e => {
              e.preventDefault();
              if (authBusy) return;
              setAuthBusy(true); setAuthError(''); setAuthMessage('');
              try {
                if (passwordRecovery) {
                  if (form.password.length < 8) throw new Error('Use a password with at least 8 characters.');
                  if (form.password !== confirmPassword) throw new Error('Your password confirmation does not match.');
                  const { error } = await supabase.auth.updateUser({ password: form.password });
                  if (error) throw error;
                  setForm(current => ({ ...current, password: '' }));
                  setPasswordRecovery(false);
                  setConfirmPassword('');
                  setAuthMessage('Your password has been updated. Sign in with your new password.');
                } else if (signup) {
                  const redirectPage = localStorage.getItem('tesla-markets-enquiry-intent')
                    ? 'chat'
                    : sessionStorage.getItem('tesla-markets-checkout-intent')
                      ? 'shop'
                      : 'dashboard';
                  const { data, error } = await supabase.functions.invoke('tesla-customer-signup', {
                    body: {
                      email: form.email.trim().toLowerCase(),
                      password: form.password,
                      firstName: form.first.trim(),
                      lastName: form.last.trim(),
                      country: form.country,
                      redirectPage,
                    },
                  });
                  if (error) throw error;
                  if (data?.error) throw new Error(String(data.error));
                  setForm(current => ({ ...current, password: '' }));
                  setPendingVerificationEmail(form.email.trim().toLowerCase());
                  setVerificationPurpose('signup');
                  setVerificationPending(true);
                  setResendCooldown(30);
                  setVerificationCode('');
                  try { sessionStorage.setItem('tesla-markets-pending-verification', JSON.stringify({email:form.email.trim().toLowerCase(),purpose:'signup'})); } catch {}
                  setAuthMessage(data?.message || 'A six-digit verification code has been sent. Enter it below to activate your account.');
                  return;
                } else {
                  const { error } = await supabase.auth.signInWithPassword({
                    email: form.email.trim().toLowerCase(), password: form.password
                  });
                  if (error) throw error;
                  if (sessionStorage.getItem('tesla-markets-checkout-intent')) go('shop');
                  else go('dashboard');
                }
              } catch (error) {
                const authCode = error && typeof error === 'object' && 'code' in error ? String((error as {code?:unknown}).code) : '';
                if (authCode === 'email_not_confirmed') {
                  setPendingVerificationEmail(form.email.trim().toLowerCase());
                  setVerificationPurpose('signup');
                  setVerificationPending(true);
                  setAuthError('Please verify your email address before continuing. Request a new code below if needed.');
                } else {
                  setAuthError(error instanceof Error ? error.message : 'We could not complete that account request. Please try again.');
                }
              } finally { setAuthBusy(false); }
            }}
          >
            {!passwordRecovery && signup && (
              <div className="form-row">
                <label>
                  First name
                  <input
                    required
                    value={form.first}
                    onChange={e => setForm({ ...form, first: e.target.value })}
                    placeholder="First name"
                  />
                </label>
                <label>
                  Last name
                  <input
                    required
                    value={form.last}
                    onChange={e => setForm({ ...form, last: e.target.value })}
                    placeholder="Last name"
                  />
                </label>
              </div>
            )}
            {!passwordRecovery && <label>
              Email address
              <input required type="email" autoComplete="email" value={form.email}
                onChange={e => setForm({ ...form, email: e.target.value })}
                placeholder="name@example.com" />
            </label>}
            {!passwordRecovery && signup && (
              <label>
                Country
                <input
                  required
                  type="text"
                  autoComplete="country-name"
                  value={form.country}
                  onChange={e => setForm({ ...form, country: e.target.value })}
                  placeholder="Enter your country"
                />
              </label>
            )}
            <label>
              {passwordRecovery ? 'New password' : 'Password'}
              <div className="tm-password-field"><input required type={passwordVisible ? 'text' : 'password'} minLength={8}
                autoComplete={passwordRecovery || signup ? 'new-password' : 'current-password'}
                value={form.password} onChange={e => setForm({ ...form, password: e.target.value })}
                placeholder={passwordRecovery ? 'Enter your new password' : 'Enter password'} />
                <button type="button" className="forgot" onClick={() => setPasswordVisible(value => !value)}>{passwordVisible ? 'Hide' : 'Show'}</button></div>
            </label>
            {(signup || passwordRecovery) && <label>
              Confirm password
              <input required type={passwordVisible ? 'text' : 'password'} minLength={8} autoComplete="new-password"
                value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Confirm your password" />
            </label>}
            {signup && (
              <label className="checkline">
                <input type="checkbox" required /> I agree to the terms and
                privacy policy.
              </label>
            )}
            {!signup && !passwordRecovery && <button type="button" className="forgot"
              disabled={authBusy || !form.email.trim()}
              onClick={async () => {
                setAuthBusy(true); setAuthError(''); setAuthMessage('');
                try {
                  const { data, error } = await supabase.functions.invoke('tesla-customer-signup', {
                    body: { action: 'recovery', email: form.email.trim().toLowerCase() },
                  });
                  if (error) throw error;
                  if (data?.error) throw new Error(String(data.error));
                  setPendingVerificationEmail(form.email.trim().toLowerCase());
                  setVerificationPurpose('recovery');
                  setVerificationPending(true);
                  setResendCooldown(30);
                  setVerificationCode('');
                  try { sessionStorage.setItem('tesla-markets-pending-verification', JSON.stringify({email:form.email.trim().toLowerCase(),purpose:'recovery'})); } catch {}
                  setAuthMessage('If this address is registered, a six-digit password recovery code has been sent.');
                } catch (error) {
                  setAuthError(error instanceof Error ? error.message : 'Password recovery could not be started.');
                } finally { setAuthBusy(false); }
              }}>Forgot password?</button>}
            {authError && <p className="auth-feedback error" role="alert">{authError}</p>}
            {authMessage && <p className="auth-feedback success" role="status">{authMessage}</p>}
            <button className="btn btn-red full" disabled={authBusy}>
              {authBusy ? 'Please wait…' : passwordRecovery ? 'Update password' : signup ? 'Create account' : 'Sign in'} <ArrowUpRight size={16} />
            </button>
          </form>
          )}
          {!verificationPending && !passwordRecovery && <div className="auth-switch">
            {signup ? 'Already have an account?' : 'New to the platform?'}{' '}
            <button onClick={() => { setAuthError(''); setAuthMessage(''); go(signup ? 'login' : 'signup'); }}>
              {signup ? 'Log in' : 'Create account'}
            </button>
          </div>}
          {verificationPending && <div className="auth-disclaimer"><LockKeyhole size={14}/> Your verification progress is saved on this device.</div>}
          <div className="auth-disclaimer">
            <LockKeyhole size={14} /> Your account is protected with secure sign-in.
          </div>
        </div>
      </div>
    </section>
  );
  const Sidebar = () => (
    <aside className="dash-sidebar">
      <Brand />
      <div className="side-label">WORKSPACE</div>
      {[
        ['Overview', 'dashboard', LayoutDashboard],
        ['Portfolio', 'portfolio', BarChart3],
        ['Activity', 'history', Clock3],
        ['Profile', 'profile', UserRound],
      ].map(([label, route, Icon]: any) => (
        <button
          className={page === route ? 'selected' : ''}
          onClick={() => go(route)}
          key={route}
        >
          <Icon size={17} />
          {label}
        </button>
      ))}
      <div className="side-label">DISCOVER</div>
      <button onClick={() => go('markets')}>
        <TrendingUp size={17} />
        Markets
      </button>
      <button onClick={() => go('ai')}>
        <Sparkles size={17} />
        AI plans
      </button>
      <div className="side-bottom">
        <button onClick={() => go('home')}>
          <ArrowRight size={16} />
          Back to website
        </button>
        <button onClick={() => go('admin')}>
          <ShieldCheck size={16} />
          Management console
        </button>
        <button onClick={async () => {
          const { error } = await supabase.auth.signOut();
          if (error) announce(error.message);
          else go('home');
        }}>
          <LogOut size={16} />
          Sign out
        </button>
      </div>
    </aside>
  );
  const Chat = () => <ChatWorkspace language={detectedLanguage as PublicLanguage} onBack={goBack} />;
  const Dashboard = () => (
    <div className="dashboard">
      <Sidebar />
      <main className="dash-main">
        <div className="dash-top">
          <div>
            <span className="eyebrow dark">PERSONAL WORKSPACE</span>
            <h1>
              {page === 'dashboard'
                ? 'Good morning.'
                : page === 'portfolio'
                  ? 'Your portfolio'
                  : page === 'history'
                    ? 'Account activity'
                    : page === 'profile'
                      ? 'Your profile'
                      : 'Admin overview'}
            </h1>
            <p className="muted">A clear view of your research workspace.</p>
          </div>
          <div className="dash-actions">
            <button
              className="icon-btn"
              onClick={() => announce('You are all caught up.')}
            >
              <Bell size={18} />
            </button>
            <button className="avatar" onClick={() => go('profile')}>
              JD
            </button>
          </div>
        </div>
        <div className="dash-preview">
          <ShieldCheck size={16} /> PREVIEW DATA — this workspace is not
          connected to live accounts or financial services.
        </div>
        {page === 'admin' ? (
          <>
<AdminConsole />
          </>
        ) : (
          <div className="dash-box">
            <h3>{page === 'profile' ? 'Profile workspace' : 'Personal workspace'}</h3>
            <p className="muted">This information workspace is a preview. Financial accounts and trade execution are not connected.</p>
            <div className="customer-orders-shortcut"><button className="btn btn-dark" onClick={() => go('orders')}>My saved orders & tracking <ArrowUpRight size={15}/></button></div>
            <button className="btn btn-red" onClick={() => go('markets')}>Explore markets <ArrowUpRight size={15}/></button>
          </div>
        )}
      </main>
    </div>
  );

  let content;
  if (page === 'model-y' || page === 'model-3' || page === 'cybertruck' || page === 'roadster' || page === 'semi') content = <VehicleDetail />;
  else if (page === 'admin') content = <AdminConsole />;
  else if (page === 'chat') content = <Chat />;
  else if (page === 'home') content = <Home />;
  else if (page === 'how') content = <How />;
  else if (page === 'markets') content = <Markets />;
  else if (page === 'ai') content = <AI />;
  else if (page === 'shop') content = <Shop />;
  else if (page === 'vehicles') content = <VehicleCollection />;
  else if (page === 'orders') content = <CustomerOrders onShop={()=>go('shop')} onLogin={()=>go('login')} />;
  else if (page === 'profile') content = <CustomerProfile onOrders={()=>go('orders')} onShop={()=>go('shop')} onSignOut={async()=>{await supabase.auth.signOut();announce('You have been signed out.');goParent('home');}} />;
  else if (page === 'about' || page === 'contact' || page === 'faq')
    content = <Info kind={page} />;
  else if (page === 'signup' || page === 'login')
    content = Auth({ signup: page === 'signup' });  else content = <Dashboard />;

  const dashboardPage = [
    'dashboard',
    'portfolio',
    'history',
  ].includes(page);
  const hideSiteChrome = dashboardPage || page === 'admin' || page === 'signup' || page === 'login' || page === 'chat';
  const hasOwnBack = page === 'chat' || ['vehicles','model-y','model-3','cybertruck','roadster','semi'].includes(page);
  const isAdminOrWorkspace = dashboardPage || page === 'admin';
  return (
    <div className="app-shell" lang={detectedLanguage} dir={!isAdminOrWorkspace && detectedLanguage === 'ar' ? 'rtl' : 'ltr'}>
      <LanguageDialog/>
            {!hideSiteChrome && <Header />}
      {page !== 'home' && page !== 'shop' && !hasOwnBack && <button type="button" className={'global-page-back '+(hideSiteChrome?'standalone':'')} onClick={goBack} aria-label="Go back to previous page"><ChevronLeft size={16}/><span>Back</span></button>}
      {content}
      {!['chat','admin','signup','login'].includes(page) && <button type="button" className="site-chat-launcher" onClick={()=>go('chat')} aria-label="Open your Tesla Markets conversation" title="Chat with Tesla Markets Management"><MessageCircle size={19}/>{chatUnread>0&&<span className="site-chat-unread">{chatUnread>9?'9+':chatUnread}</span>}</button>}
      {!hideSiteChrome && <Footer />
      }{notice && (
        <div className="toast">
          <Check size={16} />
          {notice}
          <button onClick={() => setNotice('')}>
            <X size={14} />
          </button>
        </div>
      )}
    </div>
  );
}

export default App;
