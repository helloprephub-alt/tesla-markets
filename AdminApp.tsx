import { useCallback, useEffect, useState } from 'react';
import {
  Activity, Bell, CarFront, ChevronRight, CircleHelp, Command, LayoutDashboard,
  LogOut, Menu, MessageSquare, Moon, Search, ShieldCheck, Sun, Users, X
} from 'lucide-react';
import { AdminInbox } from './ChatWorkspace';
import { supabase } from './supabaseClient';
import './markets-redesign.css';
import './index.css';
import './admin-workspace.css';

type Theme = 'dark' | 'light';
type Section = 'overview' | 'messages';

type Metric = { label: string; value: number | null; note: string; icon: typeof Users };

const navItems = [
  { id: 'overview' as const, label: 'Overview', icon: LayoutDashboard },
  { id: 'messages' as const, label: 'Messages & Inbox', icon: MessageSquare },
];

export default function AdminApp() {
  const [privateKey, setPrivateKey] = useState('');
  const [message, setMessage] = useState('');
  const [signedIn, setSignedIn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [section, setSection] = useState<Section>('overview');
  const [theme, setTheme] = useState<Theme>(() => {
    try { return localStorage.getItem('tm-admin-theme') === 'light' ? 'light' : 'dark'; }
    catch { return 'dark'; }
  });
  const [mobileNav, setMobileNav] = useState(false);
  const [loadingMetrics, setLoadingMetrics] = useState(false);
  const [metricsError, setMetricsError] = useState('');
  const [metrics, setMetrics] = useState<Metric[]>([
    { label: 'Registered customers', value: null, note: 'Live database count', icon: Users },
    { label: 'Conversations', value: null, note: 'All support conversations', icon: MessageSquare },
    { label: 'New enquiries', value: null, note: 'Vehicle and investment enquiries', icon: Activity },
    { label: 'Website visits', value: null, note: 'Recorded visit events', icon: Activity },
  ]);

  useEffect(() => {
    document.documentElement.dataset.adminTheme = theme;
    try { localStorage.setItem('tm-admin-theme', theme); } catch { /* Storage may be unavailable. */ }
  }, [theme]);

  const confirmAdmin = useCallback(async () => {
    if (!supabase) throw new Error('Admin sign-in is unavailable.');
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData.user) throw new Error('Administrator session could not be verified.');
    const { data: profile, error: profileError } = await supabase
      .from('customer_profiles').select('is_admin').eq('id', userData.user.id).maybeSingle();
    if (profileError) throw profileError;
    if (profile?.is_admin !== true) {
      await supabase.auth.signOut();
      throw new Error('This account is not authorized as an administrator.');
    }
    setSignedIn(true);
  }, []);

  useEffect(() => {
    let active = true;
    const checkExistingSession = async () => {
      if (!supabase) return;
      try {
        const { data } = await supabase.auth.getSession();
        if (data.session) await confirmAdmin();
      } catch {
        if (active) await supabase.auth.signOut();
      }
    };
    void checkExistingSession();
    return () => { active = false; };
  }, [confirmAdmin]);

  const loadMetrics = useCallback(async () => {
    if (!supabase) { setMetricsError('The database connection is not configured.'); return; }
    setLoadingMetrics(true);
    setMetricsError('');
    const [customers, conversations, vehicleEnquiries, investmentEnquiries, visits] = await Promise.all([
      supabase.from('customer_profiles').select('id', { count: 'exact', head: true }),
      supabase.from('support_conversations').select('id', { count: 'exact', head: true }),
      supabase.from('vehicle_enquiries').select('id', { count: 'exact', head: true }),
      supabase.from('investment_enquiries').select('id', { count: 'exact', head: true }),
      supabase.from('site_visits').select('id', { count: 'exact', head: true }),
    ]);
    const errors = [customers.error, conversations.error, vehicleEnquiries.error, investmentEnquiries.error, visits.error].filter(Boolean);
    if (errors.length) {
      setMetricsError('Some live totals could not be loaded. Check administrator read permissions and try again.');
    }
    setMetrics([
      { label: 'Registered customers', value: customers.error ? null : customers.count ?? 0, note: 'Live database count', icon: Users },
      { label: 'Conversations', value: conversations.error ? null : conversations.count ?? 0, note: 'All support conversations', icon: MessageSquare },
      { label: 'New enquiries', value: vehicleEnquiries.error || investmentEnquiries.error ? null : (vehicleEnquiries.count ?? 0) + (investmentEnquiries.count ?? 0), note: 'Vehicle and investment enquiries', icon: Activity },
      { label: 'Website visits', value: visits.error ? null : visits.count ?? 0, note: 'Recorded visit events', icon: Activity },
    ]);
    setLoadingMetrics(false);
  }, []);

  useEffect(() => {
    if (signedIn) void loadMetrics();
  }, [signedIn, loadMetrics]);

  const signIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase || busy) { setMessage('Admin sign-in is unavailable.'); return; }
    setBusy(true); setMessage('');
    try {
      const { data, error } = await supabase.functions.invoke('admin-key-login', { body: { key: privateKey } });
      if (error) throw new Error('Could not verify the private key. Please try again.');
      if (!data?.token_hash) throw new Error(data?.error || 'Invalid access key.');
      const { error: verifyError } = await supabase.auth.verifyOtp({ token_hash: data.token_hash, type: 'email' });
      if (verifyError) throw verifyError;
      setPrivateKey('');
      await confirmAdmin();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Unable to sign in.');
    } finally { setBusy(false); }
  };

  const signOut = async () => {
    await supabase?.auth.signOut();
    setSignedIn(false); setPrivateKey(''); setMessage('');
  };

  if (!signedIn) return (
    <div className="tm-admin tm-admin-login">
      <div className="tm-login-top"><a href="/" className="tm-back-link">← <span>Public website</span></a><div className="tm-wordmark"><span className="tm-logo">T</span><span>TESLA MARKETS<small>MANAGEMENT CONSOLE</small></span></div><span className="tm-private-label">PRIVATE ACCESS</span></div>
      <main className="tm-login-main">
        <section className="tm-login-card">
          <div className="tm-login-emblem"><ShieldCheck size={24}/></div>
          <span className="tm-overline">SECURE ADMINISTRATION</span>
          <h1>Welcome<br/><em>back.</em></h1>
          <p>Sign in to your private Tesla Markets management workspace.</p>
          <form onSubmit={signIn}>
            <label>Private administrator key<input type="password" required autoComplete="current-password" value={privateKey} onChange={e=>setPrivateKey(e.target.value)} placeholder="Enter your private key"/></label>
            <button className="tm-primary-button" disabled={busy}>{busy ? 'Verifying access…' : 'Unlock management console'} <ChevronRight size={17}/></button>
          </form>
          {message && <p className="tm-error" role="alert">{message}</p>}
          <small className="tm-login-footnote">Private access only. Your key is verified by the server and is not stored in this browser.</small>
        </section>
      </main>
      <footer className="tm-login-footer">TESLA MARKETS <span>·</span> MANAGEMENT CONSOLE <span>·</span> SECURE ACCESS</footer>
    </div>
  );

  return (
    <div className="tm-admin" data-theme={theme}>
      {mobileNav && <button className="tm-nav-scrim" aria-label="Close navigation" onClick={()=>setMobileNav(false)}/>}
      <aside className={mobileNav ? 'tm-sidebar tm-sidebar-open' : 'tm-sidebar'}>
        <div className="tm-sidebar-brand"><span className="tm-logo">T</span><span>TESLA MARKETS<small>MANAGEMENT CONSOLE</small></span><button className="tm-close-nav" onClick={()=>setMobileNav(false)} aria-label="Close menu"><X size={19}/></button></div>
        <div className="tm-sidebar-caption">WORKSPACE</div>
        <nav className="tm-side-nav" aria-label="Admin navigation">
          {navItems.map(item => { const Icon=item.icon; return <button key={item.id} className={section===item.id?'active':''} onClick={()=>{setSection(item.id);setMobileNav(false);}}><Icon size={18}/><span>{item.label}</span>{section===item.id&&<i/>}</button>; })}
        </nav>
        <div className="tm-sidebar-bottom"><div className="tm-secure-status"><span/><div><b>Secure workspace</b><small>Administrator session active</small></div></div><button className="tm-signout" onClick={signOut}><LogOut size={17}/> Sign out</button></div>
      </aside>
      <div className="tm-main-column">
        <header className="tm-topbar">
          <button className="tm-mobile-menu" onClick={()=>setMobileNav(true)} aria-label="Open navigation"><Menu size={21}/></button>
          <div className="tm-breadcrumb">TESLA MARKETS <span>/</span> {section==='overview'?'OVERVIEW':'MESSAGES & INBOX'}</div>
          <div className="tm-top-actions"><button className="tm-icon-button" aria-label="Search (coming in a later phase)" title="Global search is planned for a later phase"><Search size={18}/></button><button className="tm-icon-button" aria-label="Notifications (coming in a later phase)" title="Notification centre is planned for a later phase"><Bell size={18}/></button><button className="tm-theme-toggle" onClick={()=>setTheme(theme==='dark'?'light':'dark')} aria-label={theme==='dark'?'Switch to light mode':'Switch to dark mode'} title={theme==='dark'?'Switch to light mode':'Switch to dark mode'}>{theme==='dark'?<Sun size={17}/>:<Moon size={17}/>}<span>{theme==='dark'?'Light':'Dark'}</span></button><div className="tm-avatar">TM</div></div>
        </header>
        {section==='overview' ? <main className="tm-content">
          <div className="tm-page-heading"><div><span className="tm-overline">MANAGEMENT / OVERVIEW</span><h1>Good to see you.</h1><p>Your operations, customer activity and conversations at a glance.</p></div><button className="tm-refresh-button" onClick={()=>void loadMetrics()} disabled={loadingMetrics}>{loadingMetrics?'Refreshing…':'Refresh data'} <Activity size={16}/></button></div>
          <div className="tm-live-line"><span/> LIVE DATABASE METRICS <small>Counts are loaded from the connected Supabase project.</small></div>
          {metricsError&&<div className="tm-inline-error" role="status">{metricsError}</div>}
          <section className="tm-metric-grid">{metrics.map(metric=>{const Icon=metric.icon;return <article className="tm-metric-card" key={metric.label}><div className="tm-metric-top"><span>{metric.label}</span><Icon size={18}/></div><strong>{metric.value===null?'—':metric.value.toLocaleString()}</strong><small>{metric.note}</small></article>;})}</section>
          <section className="tm-overview-lower"><article className="tm-panel tm-focus-panel"><div className="tm-panel-heading"><div><span className="tm-overline">YOUR WORKSPACE</span><h2>Stay on top of every conversation.</h2></div><MessageSquare size={21}/></div><p>Open the existing secure support inbox to review customer messages, respond to enquiries and manage active conversations.</p><button className="tm-primary-button tm-panel-button" onClick={()=>setSection('messages')}>Open messages & inbox <ChevronRight size={17}/></button></article><article className="tm-panel tm-roadster-panel"><span className="tm-overline">TESLA MARKETS</span><h2>Clarity in every<br/><em>customer interaction.</em></h2><span className="tm-panel-mark">T</span></article></section>
          <div className="tm-phase-note"><Command size={15}/> Phase 1 foundation · Overview and the existing secure inbox are the first active workspace modules. Additional modules will be introduced only when their data connections and actions are ready.</div>
        </main> : <main className="tm-content tm-messages-content"><div className="tm-page-heading"><div><span className="tm-overline">WORKSPACE / COMMUNICATIONS</span><h1>Messages & inbox</h1><p>Manage customer conversations in the existing secure support workspace.</p></div><button className="tm-refresh-button" onClick={()=>setSection('overview')}>Back to overview <ChevronRight size={16}/></button></div><AdminInbox/></main>}
        <footer className="tm-workspace-footer"><span>TESLA MARKETS MANAGEMENT</span><span>PRIVATE ADMINISTRATION · {theme.toUpperCase()} MODE</span></footer>
      </div>
      <nav className="tm-mobile-tabs" aria-label="Quick navigation">{navItems.map(item=>{const Icon=item.icon;return <button key={item.id} className={section===item.id?'active':''} onClick={()=>setSection(item.id)}><Icon size={19}/><span>{item.label==='Overview'?'Home':'Inbox'}</span></button>;})}</nav>
    </div>
  );
}
