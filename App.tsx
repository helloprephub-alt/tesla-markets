import { useMemo, useState } from 'react';
import { ChatWorkspace, AdminInbox, GeneratedGallery } from './ChatWorkspace';
import { supabase } from './supabaseClient';
import {
  ArrowDownRight,
  ArrowRight,
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
  Search,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  TrendingUp,
  UserRound,
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
  | 'chat';
const navItems: { label: string; page: Page }[] = [
  { label: 'Investments', page: 'markets' },
  { label: 'Enquiries', page: 'chat' },
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

function App() {
  const [page, setPage] = useState<Page>(
    () => (location.hash.replace('#', '') as Page) || 'home'
  );
  const [menuOpen, setMenuOpen] = useState(false);
  const [notice, setNotice] = useState('');
  const [query, setQuery] = useState('');
  const [faq, setFaq] = useState<number | null>(0);
  const [tab, setTab] = useState('Overview');
  const [form, setForm] = useState({
    email: '',
    first: '',
    last: '',
    country: 'Nigeria',
    currency: 'USD',
    password: '',
  });

  const go = (next: Page) => {
    setPage(next);
    location.hash = next;
    setMenuOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
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
      aria-label="Tesla Invest home"
    >
      <img className="brand-logo" src="data:image/webp;base64,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" alt="Tesla wordmark" />
      <span>
        TESLA<span className="brand-light"> MARKETS</span>
        <small>INDEPENDENT MARKET INFORMATION</small>
      </span>
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
          <label className="language-select" aria-label="Translate website"><Globe2 size={15}/><select defaultValue="en" onChange={e=>{const lang=e.target.value;if(lang!=='en')window.location.href='https://translate.google.com/translate?sl=en&tl='+lang+'&u='+encodeURIComponent(window.location.href);}}><option value="en">EN</option><option value="fr">FR</option><option value="es">ES</option><option value="de">DE</option><option value="pt">PT</option><option value="ar">AR</option><option value="ha">HA</option></select></label>
          <button className="login-link" onClick={() => go('login')}>
            Log in
          </button>
          <button
            className="btn btn-red btn-small"
            onClick={() => go('signup')}
          >
            Get started <ArrowUpRight size={15} />
          </button>
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
  const Footer = () => (
    <footer className="footer">
      <div className="footer-top">
        <div>
          <Brand />
          <p className="muted footer-blurb">
            Independent information and enquiry access for Tesla and SpaceX market watchers.
          </p>
        </div>
        <div>
          <b>Investments</b>
          <button onClick={() => go('markets')}>Tesla (TSLA)</button>
          <button onClick={() => go('markets')}>SpaceX (SPCX)</button>
          <button onClick={() => go('chat')}>Investment enquiries</button>
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
      <p className="legal-note">
        This is an independent information and enquiry website, not affiliated with, endorsed by, or sponsored by Tesla, Inc. or Space Exploration Technologies Corp. Market data may be delayed. This site does not execute trades, accept investment funds or provide personalised investment advice. All share purchases must be completed through an authorised broker.
      </p>
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
          <span /> TESLA & SPACEX MARKET ACCESS INFORMATION
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
      <div className="hero-showcase real-media-showcase" aria-label="Tesla Roadster concept and Tesla and SpaceX showcase">
        <div className="media-panel roadster-media"><div className="media-overlay"><small>TESLA ROADSTER · CONCEPT VISUAL</small><strong>Designed to defy the ordinary.</strong><span>Rocket-thruster flight concept illustration</span></div></div>
        <div className="media-panel tesla-media"><div className="media-overlay"><small>TESLA · NASDAQ: TSLA</small><strong>Electric mobility & energy</strong></div></div>
        <div className="media-panel spacex-media"><div className="media-overlay"><small>SPACEX · NASDAQ: SPCX</small><strong>Space technology & exploration</strong></div></div>
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
      <section className="ticker"><span>TESLA · TSLA</span><i /><span>SPACEX · SPCX</span><i /><span>NASDAQ-LISTED SHARES</span><i /><span>INDEPENDENT ENQUIRY SERVICE</span></section>
      <section className="section section-light">
        <div className="section-head"><div><div className="eyebrow dark">AVAILABLE MARKETS</div><h2>Two companies.<br/><em>One destination.</em></h2></div><p>Explore Tesla and SpaceX share information and contact us about accessing the market through a regulated brokerage.</p></div>
        <div className="company-cards">
          <article className="company-card"><div className="company-card-top"><span>NASDAQ · TSLA</span><b>TESLA</b></div><h3>Tesla, Inc.</h3><p>Electric vehicles, energy generation and storage, and related technology.</p><button className="btn btn-red" onClick={()=>go('chat')}>Enquire about Tesla shares <ArrowUpRight size={16}/></button></article>
          <article className="company-card"><div className="company-card-top spacex-label"><span>NASDAQ · SPCX</span><b>SPACEX</b></div><h3>Space Exploration Technologies</h3><p>Launch services, satellite connectivity and space transportation systems.</p><button className="btn btn-red" onClick={()=>go('chat')}>Enquire about SpaceX shares <ArrowUpRight size={16}/></button></article>
        </div>
      </section>
      <section className="section vehicle-showcase-section">
        <div className="section-head"><div><div className="eyebrow dark">THE TESLA LINEUP</div><h2>Electric design.<br/><em>In full view.</em></h2></div><p>Browse the vehicle images supplied for this website. Exact trim and model identification should be confirmed before treating a pictured vehicle as a specific listing.</p></div>
        <div className="vehicle-photo-grid">
          <figure><img src="/resources/tesla-hero.jpg" alt="Tesla vehicle hero image"/><figcaption>Tesla vehicle collection</figcaption></figure>
          <figure><img src="/resources/tesla-city.jpg" alt="Tesla vehicle in city setting"/><figcaption>Urban electric mobility</figcaption></figure>
          <figure><img src="/resources/tesla-rear.jpg" alt="Tesla vehicle rear view"/><figcaption>Exterior detail</figcaption></figure>
          <figure><img src="/resources/tesla-road.jpg" alt="Tesla vehicle on the road"/><figcaption>On the road</figcaption></figure>
          <figure><img src="/resources/tesla-silver.jpg" alt="Silver Tesla vehicle"/><figcaption>Silver performance finish</figcaption></figure>
          <figure><img src="/resources/tesla-suv.jpg" alt="Tesla SUV"/><figcaption>Electric SUV</figcaption></figure>
        </div>
        <div className="video-showcase"><div><div className="eyebrow dark">CINEMATIC SHOWREEL</div><h3>See the movement.</h3><p className="muted">Video supplied for Tesla Markets.</p></div><video controls playsInline preload="metadata" poster="/resources/tesla-hero.jpg"><source src="/resources/tesla-showreel.mp4" type="video/mp4"/>Your browser does not support video playback.</video></div>
        <GeneratedGallery />
      </section>
      <section className="cta-band"><div><div className="eyebrow">QUESTIONS ABOUT BUYING SHARES?</div><h2>Start with a<br/><em>conversation.</em></h2></div><button className="btn btn-red" onClick={()=>go('chat')}>Open investment chat <ArrowUpRight size={16}/></button></section>
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
    <>
      <section className="page-hero compact">
        <div className="eyebrow">TESLA & SPACEX SHARES</div>
        <h1>Explore listed<br/><em>company shares.</em></h1>
        <p>Review company information and market reference prices. All purchase enquiries continue through the on-site chat.</p>
      </section>
      <section className="section section-light">
        <div className="share-list">
          <article className="share-card"><div className="share-card-image tesla-share-image"/><div className="share-card-body"><div className="stock-symbol">TSLA <span>NASDAQ</span></div><h2>Tesla, Inc.</h2><p>Common stock · USD</p><div className="stock-price">$399.81</div><small>Closing price · Oct 30, 2026 · delayed reference</small><div className="share-actions"><button className="btn btn-red" onClick={()=>go('chat')}>Buy Tesla shares · Enquire <ArrowUpRight size={16}/></button><a href="https://www.google.com/finance/quote/TSLA:NASDAQ" target="_blank" rel="noreferrer">Check current market price ↗</a><a href="https://ir.tesla.com/" target="_blank" rel="noreferrer">Official investor relations ↗</a></div></div></article>
          <article className="share-card"><div className="share-card-image spacex-share-image"/><div className="share-card-body"><div className="stock-symbol">SPCX <span>NASDAQ</span></div><h2>SpaceX</h2><p>Class A common stock · USD</p><div className="stock-price">$134.72 <span className="stock-down">Oct 30 close</span></div><small>Closing price · Oct 30, 2026 · delayed reference</small><div className="share-actions"><button className="btn btn-red" onClick={()=>go('chat')}>Buy SpaceX shares · Enquire <ArrowUpRight size={16}/></button><a href="https://ir.spacex.com/faqs-and-contact/" target="_blank" rel="noreferrer">SpaceX investor information ↗</a><a href="https://www.google.com/finance/quote/SPCX:NASDAQ" target="_blank" rel="noreferrer">Check current market price ↗</a></div></div></article>
        </div>
        <section className="vehicle-price-guide">
          <div className="eyebrow dark">VEHICLE PRICE GUIDE · UNITED STATES</div>
          <h2>Starting prices in USD</h2>
          <p>Indicative U.S. starting prices, not Nigerian landed prices. Taxes, delivery, options, availability and trim affect the final price. Confirm exact model and trim with Tesla before purchase.</p>
          <div className="vehicle-price-grid">
            <div><b>Model 3</b><strong>$36,990</strong><small>Starting price · Tesla model page</small></div>
            <div><b>Model Y</b><strong>$39,990</strong><small>Starting price · 2026 lineup reference</small></div>
            <div><b>Cybertruck</b><strong>$74,990</strong><small>Starting price · 2026 lineup reference</small></div>
            <div><b>Model S</b><strong>$109,990</strong><small>Starting price · 2026 lineup reference</small></div>
            <div><b>Model X</b><strong>$114,990</strong><small>Starting price · 2026 lineup reference</small></div>
            <div><b>Roadster</b><strong>Not confirmed</strong><small>Future product; no verified retail price shown</small></div>
          </div>
          <div className="vehicle-price-sources"><a href="https://www.tesla.com/model3/design" target="_blank" rel="noreferrer">Tesla Model 3 configurator ↗</a><a href="https://www.tesla.com/current-offers" target="_blank" rel="noreferrer">Tesla current offers ↗</a><a href="https://www.cars.com/research/tesla/" target="_blank" rel="noreferrer">2026 model price references ↗</a></div>
          <small className="stock-disclaimer">These are model-level U.S. starting references, not verified prices for each uploaded photograph or individual trim. They are not Nigerian retail or import quotations.</small>
        </section>
        <p className="stock-disclaimer">Prices are historical reference values, not live quotes. Tesla's displayed value is the Oct 30, 2026 close; SpaceX's displayed value is the Oct 30, 2026 close. Market prices move continuously. This website does not hold shares or execute trades. Purchases must be made through an authorised broker. No returns are promised.</p>
      </section>
    </>
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
  const Shop = () => (
    <>
      <section className="page-hero compact">
        <div className="eyebrow">CURATED SHOP</div>
        <h1>
          Objects of
          <br />
          <em>what comes next.</em>
        </h1>
        <p>
          A considered collection inspired by design, mobility and technology.
        </p>
      </section>
      <section className="section section-dark">
        <div className="shop-grid">
          <article className="shop-card">
            <div className="shop-image car">
              <div className="car-shape">
                <span />
              </div>
              <small>01 / ELECTRIC MOBILITY</small>
            </div>
            <div className="shop-info">
              <div>
                <h3>Electric mobility</h3>
                <p>Explore future-facing vehicle design.</p>
              </div>
              <button
                onClick={() =>
                  go('chat')
                }
              >
                <ArrowUpRight />
              </button>
            </div>
          </article>
          <article className="shop-card">
            <div className="shop-image tech">
              <div className="tech-shape">
                <span />
                <i />
              </div>
              <small>02 / TECHNOLOGY</small>
            </div>
            <div className="shop-info">
              <div>
                <h3>Technology essentials</h3>
                <p>Tools for a connected world.</p>
              </div>
              <button
                onClick={() =>
                  go('chat')
                }
              >
                <ArrowUpRight />
              </button>
            </div>
          </article>
          <article className="shop-card">
            <div className="shop-image design">
              <div className="design-shape">T</div>
              <small>03 / DESIGN OBJECTS</small>
            </div>
            <div className="shop-info">
              <div>
                <h3>Design objects</h3>
                <p>Form, function and forward thinking.</p>
              </div>
              <button
                onClick={() =>
                  go('chat')
                }
              >
                <ArrowUpRight />
              </button>
            </div>
          </article>
        </div>
      </section>
    </>
  );
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
                        'SpaceX is listed under SPCX. You can enquire here; purchases must be completed through an authorised brokerage.',
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
            onSubmit={async e => {
              e.preventDefault();
              if (!supabase) {
                announce('Account service is not configured. Please contact support.');
                return;
              }
              try {
                if (signup) {
                  const { data, error } = await supabase.auth.signUp({
                    email: form.email.trim().toLowerCase(),
                    password: form.password,
                    options: { data: { display_name: (form.first + ' ' + form.last).trim(), country: form.country, currency: form.currency } }
                  });
                  if (error) throw error;
                  if (data.user) {
                    const { error: profileError } = await supabase.from('customer_profiles').upsert({
                      id: data.user.id,
                      display_name: (form.first + ' ' + form.last).trim()
                    }, { onConflict: 'id' });
                    if (profileError) throw profileError;
                  }
                  announce(data.session ? 'Account created. Welcome to Tesla Markets.' : 'Account created. Check your email to confirm your address, then sign in.');
                  if (data.session) go('dashboard');
                } else {
                  const { error } = await supabase.auth.signInWithPassword({
                    email: form.email.trim().toLowerCase(),
                    password: form.password
                  });
                  if (error) throw error;
                  announce('Signed in successfully.');
                  go('dashboard');
                }
              } catch (error) {
                announce(error instanceof Error ? error.message : 'Unable to authenticate. Please try again.');
              }
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
          Admin preview
        </button>
      </div>
    </aside>
  );
  const Chat = () => <ChatWorkspace onBack={() => go('home')} />;
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
        {page === 'admin' ? <AdminInbox /> : (
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
  if (page === 'chat') content = <Chat />;
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
    'admin',
  ].includes(page);
  return (
    <div className="app-shell">
      {!dashboardPage && page !== 'signup' && page !== 'login' && <Header />}
      {content}
      {!dashboardPage && page !== 'signup' && page !== 'login' && <Footer />}
      {notice && (
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
