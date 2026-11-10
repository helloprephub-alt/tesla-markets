import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from './lib/supabase';
import { ChatWorkspace, GeneratedGallery } from './ChatWorkspace';
import { AdminConsole } from './AdminConsole';
import { VehicleExperience } from './VehicleExperience';
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
  LayoutDashboard,
  LockKeyhole,
  Menu,
  MessageCircle,
  Search,
  ShieldCheck,
  ShoppingBag,
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
  | 'about'
  | 'contact'
  | 'faq'
  | 'login'
  | 'signup'
  | 'dashboard'
  | 'portfolio'
  | 'history'
  | 'profile'
  | 'admin'
  | 'chat'
  | 'model-y'
  | 'model-3'
  | 'cybertruck'
  | 'roadster'
  | 'semi';
const navItems: { label: string; page: Page }[] = [
  { label: 'Home', page: 'home' },
  { label: 'Vehicles / Shop', page: 'shop' },
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
const supportedLanguages=[['en','English'],['ar','العربية'],['bn','বাংলা'],['zh-CN','简体中文'],['nl','Nederlands'],['fr','Français'],['de','Deutsch'],['ha','Hausa'],['hi','हिन्दी'],['id','Bahasa Indonesia'],['it','Italiano'],['ja','日本語'],['ko','한국어'],['pl','Polski'],['pt','Português'],['ru','Русский'],['es','Español'],['sw','Kiswahili'],['sv','Svenska'],['th','ไทย'],['tr','Türkçe'],['uk','Українська'],['ur','اردو'],['vi','Tiếng Việt'],['yo','Yorùbá']];


function App() {
  const [page, setPage] = useState<Page>(
    () => (location.hash.replace('#', '') as Page) || 'home'
  );
  const [pageHistory, setPageHistory] = useState<Page[]>([]);
  const [menuOpen, setMenuOpen] = useState(false);
  const [languageOpen,setLanguageOpen]=useState(false);
  const [languageSearch,setLanguageSearch]=useState('');
  const [detectedLanguage,setDetectedLanguage] = useState(()=>{const candidates=[...(typeof navigator!=='undefined'?navigator.languages:[]),...(typeof navigator!=='undefined'?[navigator.language]:[])];return candidates.map(value=>value.toLowerCase().split('-')[0]).find(value=>supportedLanguages.some(([code])=>code===value))||'en';});
  const currentLanguageName=String(supportedLanguages.find(([code])=>code===detectedLanguage)?.[1]||'English');
  const translateSite = (lang:string) => {setDetectedLanguage(lang);setLanguageOpen(false);setLanguageSearch('');if(lang==='en'){window.location.href=window.location.href.split('#')[0];return;}window.location.href='https://translate.google.com/translate?sl=en&tl='+lang+'&u='+encodeURIComponent(window.location.href);};
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
    country: 'Nigeria',
    currency: 'USD',
    password: '',
  });

  const go = (next: Page) => {
    if (next !== page) setPageHistory(history => [...history, page]);
    setPage(next);
    location.hash = next;
    setMenuOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
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
      goParent('shop');
      return;
    }
    if (page === 'shop') {
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
    const fallback: Record<Page, Page> = {home:'home',how:'home',markets:'home',ai:'home',shop:'home',about:'home',contact:'home',faq:'home',login:'home',signup:'home',dashboard:'home',portfolio:'dashboard',history:'dashboard',profile:'dashboard',admin:'home',chat:'home','model-y':'shop','model-3':'shop',cybertruck:'shop',roadster:'shop',semi:'shop'};
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
      <img className="brand-logo" src="data:image/webp;base64,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" alt="Tesla wordmark" />
      <span className="brand-word">MARKETS</span>
    </button>
  );
  const Header = () => (
    <header className="topbar">
      <div className="nav-wrap">
        <Brand />
        <nav className={menuOpen ? 'nav-links open' : 'nav-links'}>
          {navItems.map(item => (
            <button
              key={item.page}
              className={page === item.page ? 'active' : ''}
              onClick={() => go(item.page)}
            >
              {item.label}
            </button>
          ))}
        </nav>
        <div className="nav-actions">
          <button className="language-trigger" type="button" onClick={()=>{setLanguageOpen(true);setMenuOpen(false);}} aria-label="Change language"><Globe2 size={19}/><span>Language</span><b>{currentLanguageName}</b><ChevronDown size={14}/></button>
          <button className="btn btn-outline btn-small" onClick={() => go('shop')}>Browse vehicles <ArrowUpRight size={15} /></button>
        </div>
        <button className="language-trigger mobile-language-trigger" type="button" onClick={()=>setLanguageOpen(true)} aria-label="Change language"><Globe2 size={19}/><span>Language</span></button>
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
  const LanguageDialog=()=>languageOpen?<div className="language-backdrop" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget)setLanguageOpen(false);}}><section className="language-dialog" role="dialog" aria-modal="true" aria-labelledby="language-title"><div className="language-dialog-head"><div><span className="language-dialog-kicker">TESLA MARKETS</span><h2 id="language-title">Choose your language</h2><p>Select the language you’re most comfortable using.</p></div><button type="button" className="language-close" onClick={()=>setLanguageOpen(false)} aria-label="Close language selector"><X size={21}/></button></div><label className="language-search"><Search size={18}/><input autoFocus value={languageSearch} onChange={e=>setLanguageSearch(e.target.value)} placeholder="Search languages…" /></label><div className="language-grid">{supportedLanguages.filter(([code,name])=>(name+' '+code).toLowerCase().includes(languageSearch.toLowerCase())).map(([code,name])=><button type="button" key={code} className={detectedLanguage===code?'selected':''} onClick={()=>translateSite(code)}><span>{name}</span><small>{code.toUpperCase()}</small>{detectedLanguage===code&&<Check size={16}/>}</button>)}</div><p className="language-note">25 language options · Your choice can be changed anytime</p></section></div>:null;
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
          <button onClick={() => { sessionStorage.setItem('tesla-markets-enquiry-intent',JSON.stringify({source:'Footer investment enquiry',type:'investment',context:'Tesla investment enquiry'})); go('chat'); }}>Investment enquiries</button>
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
          <span /> ELECTRIC MOBILITY & INVESTMENT ENQUIRIES
        </div>
        <h1>
          Invest in the<br />
          <em>future in motion.</em>
        </h1>
        <p>
          Explore publicly traded shares in Tesla and SpaceX, review market information and send an enquiry about buying through an authorised brokerage.
        </p>
        <div className="hero-buttons">
          <button className="btn btn-red" onClick={() => go('markets')}>
            Explore Tesla & SpaceX <ArrowUpRight size={17} />
          </button>
          <button className="btn btn-ghost" onClick={() => go('chat')}>
            Chat with us <ArrowRight size={16} />
          </button>
        </div>
        <div className="hero-proof">
          <div className="proof-icon">
            <ShieldCheck size={18} />
          </div>
          <span>
            <b>Independent information</b>
            <small>Trade execution is handled by authorised brokers.</small>
          </span>
        </div>
      </div>
      <div className="hero-video-stage" aria-label="Tesla Markets cinematic vehicle showcase">
        <video ref={heroVideoRef} autoPlay muted={videoMuted} loop playsInline preload="auto" poster="/resources/tesla-hero.jpg">
          <source src="/resources/tesla-showreel.mp4" type="video/mp4"/>
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
  const Home = () => (
    <>
      <Hero />
      <section className="home-intro">
        <div className="eyebrow dark">TESLA MARKETS / INTRODUCTION</div>
        <h2>{publicContent.homeHeadline}</h2>
        <p>{publicContent.homeDescription}</p>
        <div className="home-intro-actions"><button className="btn btn-dark" onClick={()=>go('markets')}>Invest now <ArrowUpRight size={16}/></button><button className="btn btn-outline" onClick={()=>go('shop')}>Shop vehicles <ArrowUpRight size={16}/></button></div>
      </section>
      <section className="home-model-preview">
        <div className="section-head"><div><div className="eyebrow dark">VEHICLE COLLECTION</div><h2>Choose your<br/><em>next Tesla.</em></h2></div><button className="text-link" onClick={()=>go('shop')}>View all models <ArrowUpRight size={15}/></button></div>
        <div className="home-model-grid">
          <button onClick={()=>go('model-3')}><img src="/resources/model-3-1.jpg" alt="Model 3 vehicle preview" loading="lazy"/><span>Model 3 <ArrowUpRight size={14}/></span></button>
          <button onClick={()=>go('model-y')}><img src="/resources/model-y-1.jpg" alt="Model Y vehicle preview" loading="lazy"/><span>Model Y <ArrowUpRight size={14}/></span></button>
          <button onClick={()=>go('cybertruck')}><img src="/resources/cybertruck-1.jpg" alt="Cybertruck vehicle preview" loading="lazy"/><span>Cybertruck <ArrowUpRight size={14}/></span></button>
          <button onClick={()=>go('roadster')}><img src="/resources/roadster-1.jpg" alt="Roadster vehicle preview" loading="lazy"/><span>Roadster <ArrowUpRight size={14}/></span></button>
          <button onClick={()=>go('semi')}><img src="/resources/semi-1.jpg" alt="Tesla Semi vehicle preview" loading="lazy"/><span>Tesla Semi <ArrowUpRight size={14}/></span></button>
        </div>
      </section>
              <section className="home-investment-strip"><div><div className="eyebrow">INVESTMENT ENQUIRIES</div><h2>Explore Tesla<br/><em>investment information.</em></h2><p>Contact Tesla Markets Management directly with your investment questions.</p></div><button className="btn btn-light" onClick={() => { sessionStorage.setItem('tesla-markets-enquiry-intent',JSON.stringify({source:'Invest Now',type:'investment',context:'Tesla investment enquiry — I would like to speak directly with Tesla Markets Management.'})); go('chat'); }}>Invest now <ArrowUpRight size={16}/></button></section>
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
          <div className="investment-slide-caption"><span>TESLA MARKETS</span><b>Tesla investment enquiries</b></div>
        </div>
        <div className="investment-panel">
          <div className="investment-panel-heading"><div className="eyebrow dark">TESLA INVESTMENT INFORMATION</div><span className="portfolio-status-pill broker-connected"><i/> Broker connected</span></div>
          <h1>{publicContent.investmentHeading}</h1>
          <p className="investment-description">{publicContent.investmentDescription}</p>
          <div className="investment-info-grid"><article><b>Tesla, Inc.</b><span>NASDAQ: TSLA</span><small>Publicly traded company information</small></article><article><b>Direct management contact</b><span>Enquiry support</span><small>Discuss your questions with management</small></article></div>
          <button className="btn btn-dark investment-cta" onClick={()=>{sessionStorage.setItem('tesla-markets-enquiry-intent',JSON.stringify({source:'Invest Now',type:'investment',context:'Tesla investment enquiry — I would like to speak directly with Tesla Markets Management.'}));go('chat')}}>INVEST NOW <ArrowUpRight size={17}/></button>
        </div>
      </section>
      <section className="investment-trust-note"><span>Broker connected. Contact management to discuss your Tesla investment enquiry and the available next steps.</span></section>
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
  const Shop = () => <VehicleExperience onBack={()=>goParent('home')} onSelectModel={(id)=>go(id as Page)} onEnquire={(context)=>{sessionStorage.setItem('tesla-markets-enquiry-intent',JSON.stringify({source:'Vehicle page',type:'vehicle',vehicleModel:context.match(/Model 3|Model Y|Cybertruck|Roadster|Semi/i)?.[0]||'Tesla vehicle',context}));go('chat')}} />;
  const VehicleDetail = () => <VehicleExperience modelId={page==='model-y'?'model-y':page==='model-3'?'model-3':page==='cybertruck'?'cybertruck':page==='semi'?'semi':'roadster'} onBack={()=>goParent('shop')} onSelectModel={(id)=>go(id as Page)} onEnquire={(context)=>{sessionStorage.setItem('tesla-markets-enquiry-intent',JSON.stringify({source:'Vehicle page',type:'vehicle',vehicleModel:context.match(/Model 3|Model Y|Cybertruck|Roadster|Semi/i)?.[0]||'Tesla vehicle',context}));go('chat')}} />;
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
          <div className="eyebrow">WELCOME TO A NEW PERSPECTIVE</div>
          <h2>
            Explore ideas
            <br />
            that move <em>forward.</em>
          </h2>
          <p>Your personal space for research, discovery and market context.</p>
        </div>
      </div>
      <div className="auth-panel">
        <div className="auth-form-wrap">
          <button className="back-home" onClick={() => go('home')}>
            ← Back to home
          </button>
          <div className="eyebrow dark">
            {signup ? 'CREATE ACCOUNT' : 'WELCOME BACK'}
          </div>
          <h1>{signup ? 'Create your account' : 'Sign in to your account'}</h1>
          <p className="muted">
            {signup
              ? 'Start building your personal research workspace.'
              : 'Continue to your personal workspace.'}
          </p>
          <form
            onSubmit={e => {
              e.preventDefault();
              announce(
                'Account access is not connected in this visual preview.'
              );
            }}
          >
            {signup && (
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
            <label>
              Email address
              <input
                required
                type="email"
                value={form.email}
                onChange={e => setForm({ ...form, email: e.target.value })}
                placeholder="name@example.com"
              />
            </label>
            {signup && (
              <div className="form-row">
                <label>
                  Country
                  <select
                    value={form.country}
                    onChange={e =>
                      setForm({ ...form, country: e.target.value })
                    }
                  >
                    <option>Nigeria</option>
                    <option>United States</option>
                    <option>United Kingdom</option>
                    <option>Canada</option>
                    <option>Germany</option>
                  </select>
                </label>
                <label>
                  Preferred currency
                  <select
                    value={form.currency}
                    onChange={e =>
                      setForm({ ...form, currency: e.target.value })
                    }
                  >
                    <option>USD</option>
                    <option>NGN</option>
                    <option>GBP</option>
                    <option>EUR</option>
                  </select>
                </label>
              </div>
            )}
            <label>
              Password
              <input
                required
                type="password"
                value={form.password}
                onChange={e => setForm({ ...form, password: e.target.value })}
                placeholder="Enter password"
              />
            </label>
            {signup && (
              <label className="checkline">
                <input type="checkbox" required /> I agree to the terms and
                privacy policy.
              </label>
            )}
            {!signup && (
              <button
                type="button"
                className="forgot"
                onClick={() =>
                  announce('Password recovery will be added in a later phase.')
                }
              >
                Forgot password?
              </button>
            )}
            <button className="btn btn-red full">
              {signup ? 'Continue' : 'Sign in'} <ArrowUpRight size={16} />
            </button>
          </form>
          <div className="auth-switch">
            {signup ? 'Already have an account?' : 'New to the platform?'}{' '}
            <button onClick={() => go(signup ? 'login' : 'signup')}>
              {signup ? 'Log in' : 'Create account'}
            </button>
          </div>
          <div className="auth-disclaimer">
            <LockKeyhole size={14} /> Preview only. No account is created and
            credentials are not transmitted or stored.
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
      </div>
    </aside>
  );
  const Chat = () => <ChatWorkspace onBack={goBack} />;
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
  else if (page === 'about' || page === 'contact' || page === 'faq')
    content = <Info kind={page} />;
  else if (page === 'signup' || page === 'login')
    content = <Auth signup={page === 'signup'} />;  else content = <Dashboard />;

  const dashboardPage = [
    'dashboard',
    'portfolio',
    'history',
    'profile',
  ].includes(page);
  const hideSiteChrome = dashboardPage || page === 'admin' || page === 'signup' || page === 'login' || page === 'chat';
  const hasOwnBack = page === 'chat' || ['model-y','model-3','cybertruck','roadster','semi'].includes(page);
  return (
    <div className="app-shell">
      <LanguageDialog/>
      {!hideSiteChrome && <Header />}
      {page !== 'home' && !hasOwnBack && <button type="button" className={'global-page-back '+(hideSiteChrome?'standalone':'')} onClick={goBack} aria-label="Go back to previous page"><ChevronLeft size={16}/><span>Back</span></button>}
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
