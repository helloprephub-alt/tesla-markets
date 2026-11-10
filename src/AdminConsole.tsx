import { useEffect, useState } from 'react';
import { isCurrentUserAdmin, supabase, supabaseConfigured } from './lib/supabase';
import { Activity, CarFront, ClipboardList, LogOut, MessageCircle, RefreshCw, ShieldCheck, Users, Eye, Settings, CircleUserRound, Menu, X, ChevronDown, LayoutDashboard, Image, Globe, Inbox, SlidersHorizontal, Sun, Moon, Search, Bell, TrendingUp, Wallet, Plus, Upload, Pencil, ArrowUpRight, BarChart3, ChevronRight } from 'lucide-react';
import { AdminInbox } from './ChatWorkspace';

const ADMIN_EMAIL = 'oyejideoluwatobi7@gmail.com';
const ADMIN_AUTH_REDIRECT = 'https://tesla-markets.vercel.app/#admin';
type Thread = { id: string; visitorName?: string; visitorEmail?: string; createdAt: number; updatedAt: number; lastMessage?: string; status?: string };
type Visit = { id: string; page: string; createdAt: number };
type FinanceOrder = {id:string;reference:string;item:string;amount:number;currency:string;status:string;createdAt:number};
type FinancePayment = {id:string;reference:string;orderId:string|null;amount:number;currency:string;status:string;method:string;createdAt:number};
type Overview = { conversations: number; messages: number; generatedImages: number; visits: number; clicks: number; onlineNow: number; updatedAt: number };
type Section = 'overview' | 'visitors' | 'customers' | 'catalogue' | 'investment' | 'content' | 'media' | 'messages' | 'operations' | 'finance' | 'settings';

const catalogue = [
  { name: 'Model 3', count: 5, first: '/resources/model-3-1.jpg' },
  { name: 'Model Y', count: 5, first: '/resources/model-y-1.jpg' },
  { name: 'Cybertruck', count: 9, first: '/resources/cybertruck-1.jpg' },
  { name: 'Roadster', count: 6, first: '/resources/roadster-1.jpg' },
  { name: 'Tesla Semi', count: 10, first: '/resources/semi-1.jpg' },
];
const statusOptions = ['open', 'pending', 'closed'];
export function AdminConsole() {
  const [user, setUser] = useState<{ email?: string } | null>(null);
  const [checking, setChecking] = useState(true);
  const [authStep,setAuthStep]=useState<'setup'|'login'|'enroll'|'verify'|'ready'>('setup');
  const [setupToken,setSetupToken]=useState(()=>new URLSearchParams(window.location.search).get('admin_setup')||'');
  const [loginPassword,setLoginPassword]=useState('');
  const [confirmPassword,setConfirmPassword]=useState('');
  const [authCode,setAuthCode]=useState('');
  const [factorId,setFactorId]=useState('');
  const [challengeId,setChallengeId]=useState('');
  const [totpQr,setTotpQr]=useState('');
  const [totpSecret,setTotpSecret]=useState('');
  const [authBusy,setAuthBusy]=useState(false);
  const [passkeys,setPasskeys]=useState<Array<{id:string;friendly_name?:string;created_at?:string;last_used_at?:string}>>([]);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [registeredCustomerCount,setRegisteredCustomerCount]=useState<number|null>(null);
  const [dashboardSearch,setDashboardSearch]=useState('');
  const [threads, setThreads] = useState<Thread[]>([]);
  const [visits, setVisits] = useState<Visit[]>([]);
  const [financeOrders,setFinanceOrders]=useState<FinanceOrder[]>([]);
  const [financePayments,setFinancePayments]=useState<FinancePayment[]>([]);
  const [section, setSection] = useState<Section>('overview');
  const [mobileNavOpen,setMobileNavOpen]=useState(false);
  const [adminTheme,setAdminTheme]=useState<'light'|'dark'>(()=>(localStorage.getItem('tesla-admin-theme')==='dark'?'dark':'light'));
  const toggleAdminTheme=()=>setAdminTheme(current=>{const next=current==='light'?'dark':'light';localStorage.setItem('tesla-admin-theme',next);return next;});
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [profileUrl, setProfileUrl] = useState('');
  const [profileFile, setProfileFile] = useState<File | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [siteContent,setSiteContent] = useState({homeHeadline:'Invest in the future in motion.',homeDescription:'Explore publicly traded shares in Tesla and SpaceX, review market information and send an enquiry about buying through an authorised brokerage.',investmentHeading:'Explore Tesla investment opportunities.',investmentDescription:'Speak directly with Tesla Markets Management for information about Tesla-related investment enquiries, available routes, eligibility and the next steps.',footerBlurb:'Independent information and enquiry access for Tesla and SpaceX market watchers.'});
  const [contentDraft,setContentDraft] = useState(siteContent);
  const [investmentImages,setInvestmentImages] = useState<string[]>(['/resources/investment-slide-1','/resources/investment-slide-2']);
  const [investmentFiles,setInvestmentFiles] = useState<File[]>([]);
  const [savingContent,setSavingContent] = useState(false);
  const [savingInvestment,setSavingInvestment] = useState(false);

  const load = async () => {
    setRefreshing(true);
    try {
      const [visitCount, clickCount, conversationCount, messageCount, presenceCount, visitorLog, conversationRows, orderRows, paymentRows, customerCount] = await Promise.all([
        supabase.from('site_visits').select('id', { count:'exact', head:true }),
        supabase.from('site_clicks').select('id', { count:'exact', head:true }),
        supabase.from('support_conversations').select('id', { count:'exact', head:true }),
        supabase.from('support_messages').select('id', { count:'exact', head:true }),
        supabase.from('site_presence').select('visitor_id', { count:'exact', head:true }).gte('last_seen_at', new Date(Date.now()-90000).toISOString()),
        supabase.from('site_visits').select('id,page,created_at').order('created_at',{ascending:false}).limit(100),
        supabase.from('support_conversations').select('id,customer_id,subject,status,updated_at').order('updated_at',{ascending:false}).limit(100),
        supabase.from('business_orders').select('id,order_reference,item_description,agreed_amount,currency,status,created_at').order('created_at',{ascending:false}).limit(100),
        supabase.from('business_payments').select('id,payment_reference,order_id,amount,currency,status,method,created_at').order('created_at',{ascending:false}).limit(100),
        supabase.from('customer_profiles').select('id',{count:'exact',head:true}),
      ]);
      for (const result of [visitCount,clickCount,conversationCount,messageCount,presenceCount,visitorLog,conversationRows,orderRows,paymentRows,customerCount]) if (result.error) throw result.error;
      const rows=conversationRows.data||[];
      const ids=rows.map(row=>row.customer_id);
      const {data:profiles,error:profilesError}=ids.length?await supabase.from('customer_profiles').select('id,display_name').in('id',ids):{data:[],error:null};
      if(profilesError) throw profilesError;
      const names=new Map((profiles||[]).map(profile=>[profile.id,profile.display_name]));
      const mapped=await Promise.all(rows.map(async row=>{
        const {data:last,error:lastError}=await supabase.from('support_messages').select('body,created_at').eq('conversation_id',row.id).order('created_at',{ascending:false}).limit(1).maybeSingle();
        if(lastError) throw lastError;
        return {id:row.id,visitorName:names.get(row.customer_id)||'Website visitor',visitorEmail:'',createdAt:new Date(row.updated_at).getTime(),updatedAt:new Date(row.updated_at).getTime(),lastMessage:last?.body||row.subject||'Conversation opened',status:row.status};
      }));
      setOverview({visits:visitCount.count||0,clicks:clickCount.count||0,conversations:conversationCount.count||0,messages:messageCount.count||0,generatedImages:0,onlineNow:presenceCount.count||0,updatedAt:Date.now()});
      setThreads(mapped);
      setVisits((visitorLog.data||[]).map(row=>({id:row.id,page:row.page,createdAt:new Date(row.created_at).getTime()})));
      setFinanceOrders((orderRows.data||[]).map(row=>({id:row.id,reference:row.order_reference||row.id.slice(0,8),item:row.item_description||'Business order',amount:Number(row.agreed_amount||0),currency:row.currency||'USD',status:row.status||'pending',createdAt:new Date(row.created_at).getTime()})));
      setFinancePayments((paymentRows.data||[]).map(row=>({id:row.id,reference:row.payment_reference||row.id.slice(0,8),orderId:row.order_id,amount:Number(row.amount||0),currency:row.currency||'USD',status:row.status||'pending',method:row.method||'—',createdAt:new Date(row.created_at).getTime()})));
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load management records.');
    } finally {
      setRefreshing(false);
    }
  };

  const evaluateAdminSession = async () => {
    const {data:{session},error:authError}=await supabase.auth.getSession();
    if(authError)throw authError;
    const current=session?.user ?? null;
    if(!current){setUser(null);const {data:status,error:statusError}=await supabase.functions.invoke('admin-key-login',{body:{action:'status'}});if(statusError)throw statusError;if(status?.error)throw new Error(status.error);setAuthStep(setupToken || !status?.setupComplete ? 'setup' : 'login');return;}
    const {isAdmin}=await isCurrentUserAdmin();
    if(!isAdmin){setUser(null);setAuthStep('login');setError('This account is not authorised for Tesla Markets management.');await supabase.auth.signOut();return;}
    setUser({email:current.email||''});setAuthStep('ready');setError('');
  };
  useEffect(() => {
    let active=true;
    if(!supabaseConfigured){setError('Supabase is not configured.');setChecking(false);return()=>{active=false;};}
    void evaluateAdminSession().catch(e=>{if(active){setUser(null);setAuthStep('login');setError(e instanceof Error?e.message:'Sign-in check failed.');}}).finally(()=>{if(active)setChecking(false);});
    const {data:listener}=supabase.auth.onAuthStateChange((_event,session)=>{
      if(!active)return;
      if(!session?.user){window.setTimeout(()=>{if(active)void evaluateAdminSession().catch(e=>setError(e instanceof Error?e.message:'Could not check administrator setup.'));},0);return;}
      if(_event==='SIGNED_IN')window.setTimeout(()=>{if(active)void evaluateAdminSession().catch(e=>setError(e instanceof Error?e.message:'Could not verify administrator security.'));},0);
    });
    return()=>{active=false;listener.subscription.unsubscribe();};
  }, []);

  useEffect(() => {
    if (!user) return;
    const loadProfile = async () => {
      const { data, error: profileError } = await supabase.from('site_settings').select('value').eq('key', 'management_profile').maybeSingle();
      if (profileError) { setError(profileError.message); return; }
      setProfileUrl(typeof data?.value?.url === 'string' ? data.value.url : '');
    };
    void loadProfile();
  }, [user?.email]);

  useEffect(() => {
    if (!user) return;
    const loadSettings = async () => {
      const { data, error: settingsError } = await supabase.from('site_settings').select('key,value').in('key',['public_site_content','investment_gallery']);
      if(settingsError){setError(settingsError.message);return;}
      const contentRow=data?.find(row=>row.key==='public_site_content');
      const galleryRow=data?.find(row=>row.key==='investment_gallery');
      if(contentRow?.value && typeof contentRow.value==='object'){
        const next={...siteContent,...contentRow.value};
        setSiteContent(next);setContentDraft(next);
      }
      if(Array.isArray(galleryRow?.value?.images))setInvestmentImages(galleryRow.value.images.filter((url:unknown)=>typeof url==='string'));
    };
    void loadSettings();
  },[user?.email]);

  useEffect(() => {
    if (!user) return;
    void load();
    const timer = window.setInterval(() => { void load(); }, 20000);
    return () => window.clearInterval(timer);
  }, [user?.email]);

  const completeKeyAuth = async (action: 'setup'|'login') => {
    setAuthBusy(true);setError('');
    try {
      if(action==='setup' && (loginPassword.length<14 || loginPassword!==confirmPassword)) throw new Error('Enter matching passwords with at least 14 characters.');
      const {data,error:invokeError}=await supabase.functions.invoke('admin-key-login',{body:action==='setup'?{action,setupToken,password:loginPassword}:{action,password:loginPassword}});
      if(invokeError){let detail='';try{detail=(await invokeError.context?.json())?.error||'';}catch{}throw new Error(detail||invokeError.message||'Administrator access request failed.');}
      if(data?.error) throw new Error(data.error);
      const {error:verifyError}=await supabase.auth.verifyOtp({token_hash:data.token_hash,type:'magiclink'});
      if(verifyError) throw verifyError;
      setSetupToken('');setLoginPassword('');setConfirmPassword('');
      if(action==='setup'){const cleanUrl=new URL(window.location.href);cleanUrl.searchParams.delete('admin_setup');window.history.replaceState({},'',cleanUrl.toString());}
      await evaluateAdminSession();
    } catch(e){setError(e instanceof Error?e.message:'Could not complete administrator access.');}
    finally{setAuthBusy(false);}
  };
  const signIn = async () => completeKeyAuth('login');
  const saveInitialPassword = async () => completeKeyAuth('setup');
  const updateStatus = async (threadId: string, status: string) => {
    try {
      const {error}=await supabase.from('support_conversations').update({status,updated_at:new Date().toISOString()}).eq('id',threadId);
      if(error) throw error;
      setThreads(current => current.map(thread => thread.id === threadId ? { ...thread, status } : thread));
      setError('');
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not update enquiry status.'); }
  };
  const saveProfile = async () => {
    if (!profileFile) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(profileFile.type)) {
      setError('Choose a JPG, PNG or WEBP image.');
      return;
    }
    if (profileFile.size > 4 * 1024 * 1024) {
      setError('Choose an image smaller than 4 MB.');
      return;
    }
    setSavingProfile(true);
    try {
      const { user: current, isAdmin } = await isCurrentUserAdmin();
      if (!current || !isAdmin) throw new Error('Your administrator session has expired. Sign in again.');
      const extension = profileFile.type === 'image/jpeg' ? 'jpg' : profileFile.type === 'image/png' ? 'png' : 'webp';
      const path = `management/${current.id}/profile-${Date.now()}.${extension}`;
      const { error: uploadError } = await supabase.storage.from('site-media').upload(path, profileFile, {
        contentType: profileFile.type,
        cacheControl: '3600',
        upsert: true,
      });
      if (uploadError) throw uploadError;
      const { data: publicAsset } = supabase.storage.from('site-media').getPublicUrl(path);
      const { error: settingError } = await supabase.from('site_settings').upsert({
        key: 'management_profile',
        value: { path, url: publicAsset.publicUrl },
        updated_at: new Date().toISOString(),
        updated_by: current.id,
      }, { onConflict: 'key' });
      if (settingError) throw settingError;
      setProfileUrl(publicAsset.publicUrl);
      setProfileFile(null);
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save the management profile picture.');
    } finally {
      setSavingProfile(false);
    }
  };

  const saveContent = async () => {
    setSavingContent(true);
    try {
      const {user:current,isAdmin}=await isCurrentUserAdmin();
      if(!current||!isAdmin)throw new Error('Your administrator session has expired. Sign in again.');
      const {error:saveError}=await supabase.from('site_settings').upsert({key:'public_site_content',value:contentDraft,updated_at:new Date().toISOString(),updated_by:current.id},{onConflict:'key'});
      if(saveError)throw saveError;
      setSiteContent(contentDraft);setError('');
    } catch(e){setError(e instanceof Error?e.message:'Could not save website content.');}
    finally{setSavingContent(false);}
  };
  const saveInvestmentImages = async () => {
    setSavingInvestment(true);
    try {
      const {user:current,isAdmin}=await isCurrentUserAdmin();
      if(!current||!isAdmin)throw new Error('Your administrator session has expired. Sign in again.');
      const uploaded=await Promise.all(investmentFiles.map(async(file,index)=>{
        if(!['image/jpeg','image/png','image/webp'].includes(file.type))throw new Error('Use JPG, PNG or WEBP images.');
        if(file.size>3*1024*1024)throw new Error('Each investment image must be 3 MB or smaller.');
        const ext=file.type==='image/jpeg'?'jpg':file.type==='image/png'?'png':'webp';
        const path='investment/'+current.id+'/'+Date.now()+'-'+index+'-'+file.name.replace(/[^a-zA-Z0-9._-]/g,'-');
        const {error:uploadError}=await supabase.storage.from('site-media').upload(path,file,{contentType:file.type,cacheControl:'3600',upsert:false});
        if(uploadError)throw uploadError;
        return supabase.storage.from('site-media').getPublicUrl(path).data.publicUrl;
      }));
      const next=[...investmentImages,...uploaded];
      const {error:saveError}=await supabase.from('site_settings').upsert({key:'investment_gallery',value:{images:next},updated_at:new Date().toISOString(),updated_by:current.id},{onConflict:'key'});
      if(saveError)throw saveError;
      setInvestmentImages(next);setInvestmentFiles([]);setError('');
    }catch(e){setError(e instanceof Error?e.message:'Could not save investment gallery.');}
    finally{setSavingInvestment(false);}
  };

  if(checking)return <div className="admin-auth-state"><ShieldCheck size={26}/> Checking administrator access…</div>;
  if(!user)return <div className="admin-auth-state admin-auth-full"><ShieldCheck size={30}/><h2>Management access</h2>
    {authStep==='setup'&&<><p>Create your administrator password to activate the private management console. This is a one-time setup.</p><input className="admin-auth-input" type="password" autoComplete="new-password" value={loginPassword} onChange={e=>setLoginPassword(e.target.value)} placeholder="Create administrator password (14+ characters)"/><input className="admin-auth-input" type="password" autoComplete="new-password" value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)} placeholder="Confirm administrator password"/><button className="btn btn-dark" onClick={saveInitialPassword} disabled={!supabaseConfigured||authBusy||loginPassword.length<14||loginPassword!==confirmPassword}>{authBusy?'Setting up…':'Create administrator password'}</button></>}
    {authStep==='login'&&<><p>Enter your administrator password to continue.</p><input className="admin-auth-input" type="password" autoComplete="current-password" value={loginPassword} onChange={e=>setLoginPassword(e.target.value)} placeholder="Administrator password"/><button className="btn btn-dark" onClick={signIn} disabled={!supabaseConfigured||authBusy||!loginPassword}>{authBusy?'Signing in…':'Sign in'}</button></>}
    {error&&<p className="chat-error">{error}</p>}<a href="#home">Return to public website</a></div>;

  const nav = [
    { id: 'overview' as const, label: 'Overview', icon: LayoutDashboard, group:'WORKSPACE' },
    { id: 'visitors' as const, label: 'Visitor analytics', icon: Eye, group:'CUSTOMERS' },
    { id: 'customers' as const, label: 'Customer directory', icon: Users, group:'CUSTOMERS' },
    { id: 'messages' as const, label: 'Messages & live chat', icon: MessageCircle, group:'CUSTOMERS' },
    { id: 'operations' as const, label: 'Enquiries & orders', icon: ClipboardList, group:'CUSTOMERS' },
    { id: 'finance' as const, label: 'Sales & finance', icon: Activity, group:'BUSINESS' },
    { id: 'catalogue' as const, label: 'Vehicle catalogue', icon: CarFront, group:'WEBSITE CONTROL' },
    { id: 'investment' as const, label: 'Investment page', icon: Activity, group:'WEBSITE CONTROL' },
    { id: 'content' as const, label: 'Website content', icon: Globe, group:'WEBSITE CONTROL' },
    { id: 'media' as const, label: 'Media library', icon: Image, group:'WEBSITE CONTROL' },
    { id: 'settings' as const, label: 'Admin settings', icon: Settings, group:'SYSTEM' },
  ];

  return (
    <div className={`admin-console admin-console-standalone admin-console-premium admin-theme-${adminTheme}`}>
      <header className="admin-topbar">
        <button className="admin-mobile-menu" onClick={()=>setMobileNavOpen(v=>!v)} aria-label={mobileNavOpen?'Close navigation':'Open navigation'}>{mobileNavOpen?<X size={20}/>:<Menu size={20}/>}</button>
        <div className="admin-console-brand"><span className="admin-brand-mark admin-tesla-mark">T</span><div><b>TESLA MARKETS</b><small>MANAGEMENT CONSOLE</small></div></div>
        <div className="admin-topbar-right"><button className="icon-btn admin-theme-toggle" onClick={toggleAdminTheme} aria-label={adminTheme==='light'?'Switch to dark mode':'Switch to light mode'} title={adminTheme==='light'?'Dark mode':'Light mode'}>{adminTheme==='light'?<Moon size={16}/>:<Sun size={16}/>}</button><span className="admin-secure-label"><ShieldCheck size={14}/> Secure workspace</span><span className="admin-live-dot"/><span className="admin-topbar-email">{user.email}</span><button className="icon-btn" onClick={()=>void load()} aria-label="Refresh management data" disabled={refreshing}><RefreshCw size={16}/></button><button className="icon-btn" onClick={()=>supabase.auth.signOut().then(()=>setUser(null))} aria-label="Sign out"><LogOut size={16}/></button></div>
      </header>
      <div className="admin-shell">
        <aside className={'admin-console-side '+(mobileNavOpen?'is-open':'')}>
          <div className="admin-sidebar-heading">CONTROL CENTRE</div>
          {['WORKSPACE','CUSTOMERS','BUSINESS','WEBSITE CONTROL','SYSTEM'].map(group=><div className="admin-nav-group" key={group}><div className="admin-console-label">{group}</div>{nav.filter(item=>item.group===group).map(item=>{const Icon=item.icon;return <button key={item.id} className={section===item.id?'active':''} onClick={()=>{setSection(item.id);setMobileNavOpen(false);}}><Icon size={17}/><span>{item.label}</span>{section===item.id&&<i/>}</button>})}</div>)}
          <div className="admin-console-side-foot"><ShieldCheck size={16}/> Private administrator workspace</div>
        </aside>
        <main className="admin-console-main">
          <div className="admin-breadcrumb"><span>TESLA MARKETS</span><ChevronDown size={13}/><b>{nav.find(item=>item.id===section)?.label}</b></div>
          <header className="admin-console-header">
            <div><div className="eyebrow dark">MANAGEMENT / {section.toUpperCase()}</div><h1>{nav.find(item=>item.id===section)?.label}</h1><p>{section==='overview'?'Your website performance and customer activity, in one place.':section==='messages'?'Manage every customer conversation from one focused workspace.':'Manage '+(nav.find(item=>item.id===section)?.label.toLowerCase()||'your website')+' from your private control centre.'}</p></div>
            <div className="admin-page-actions"><span className="admin-updated-label"><span className="admin-live-dot"/> Live data</span><button className="btn btn-outline" onClick={()=>void load()} disabled={refreshing}><RefreshCw size={15}/> Refresh</button></div>
          </header>
          {error && <div className="admin-console-error">{error}</div>}
          {section === 'overview' && <>
            <div className="tm-dashboard-toolbar">
              <label className="tm-global-search"><Search size={17}/><input value={dashboardSearch} onChange={e=>setDashboardSearch(e.target.value)} placeholder="Search customers, orders, vehicles…"/><kbd>Ctrl K</kbd></label>
              <button className="tm-notification-button" aria-label="Notifications"><Bell size={18}/><i/></button>
            </div>
            <section className="tm-kpi-grid">
              <article className="tm-kpi-card"><span className="tm-kpi-icon"><Users size={20}/></span><div><small>Total Customers</small><strong>{registeredCustomerCount??'—'}</strong><em>Registered customer profiles</em></div><Users className="tm-kpi-watermark"/></article>
              <article className="tm-kpi-card"><span className="tm-kpi-icon"><Eye size={20}/></span><div><small>Website Visitors</small><strong>{overview?.visits??'—'}</strong><em>Recorded page visits</em></div><Eye className="tm-kpi-watermark"/></article>
              <article className="tm-kpi-card"><span className="tm-kpi-icon"><MessageCircle size={20}/></span><div><small>Active Chats</small><strong>{overview?.onlineNow??'—'}</strong><em>Visitors active in last 90 seconds</em></div><MessageCircle className="tm-kpi-watermark"/></article>
              <article className="tm-kpi-card"><span className="tm-kpi-icon"><CarFront size={20}/></span><div><small>Customer Enquiries</small><strong>{overview?.conversations??'—'}</strong><em>Saved customer conversations</em></div><CarFront className="tm-kpi-watermark"/></article>
              <article className="tm-kpi-card"><span className="tm-kpi-icon"><Wallet size={20}/></span><div><small>Recorded Orders</small><strong>{financeOrders.length}</strong><em>Order records · no estimated value</em></div><Wallet className="tm-kpi-watermark"/></article>
            </section>
            <div className="tm-dashboard-grid tm-dashboard-grid-primary">
              <section className="tm-dashboard-card tm-activity-chart"><div className="tm-card-heading"><div><h2>Website Activity</h2><p>Recent visitor activity from recorded page views.</p></div><span className="tm-card-chip">Latest {visits.length} records</span></div>
                <div className="tm-chart-area"><div className="tm-chart-y"><span>Recent</span><span>Earlier</span></div><div className="tm-chart-bars">{[...visits].slice(0,28).reverse().map((v,i)=><div key={v.id} title={v.page+' · '+new Date(v.createdAt).toLocaleString()} style={{height:(22+((v.createdAt%997)/997)*72)+'%'}}/>)}{visits.length===0&&<p>No visit records yet.</p>}</div></div><div className="tm-chart-foot"><span>Latest tracked visits</span><b>{overview?.visits??0} total page views</b></div>
              </section>
              <section className="tm-dashboard-card tm-quick-actions-card"><div className="tm-card-heading"><div><h2>Quick Actions</h2><p>Common management tasks.</p></div></div><div className="tm-action-grid"><button onClick={()=>setSection('catalogue')}><CarFront/><span>Add / manage vehicle</span></button><button onClick={()=>setSection('media')}><Upload/><span>Upload media</span></button><button onClick={()=>setSection('investment')}><TrendingUp/><span>Update investment</span></button><button onClick={()=>setSection('content')}><Pencil/><span>Edit website content</span></button></div></section>
              <section className="tm-dashboard-card tm-recent-enquiries"><div className="tm-card-heading"><div><h2>Recent Enquiries</h2><p>Latest customer conversations.</p></div><button onClick={()=>setSection('operations')}>View all <ArrowUpRight size={13}/></button></div>{threads.filter(t=>!dashboardSearch||[t.visitorName,t.visitorEmail,t.lastMessage].join(' ').toLowerCase().includes(dashboardSearch.toLowerCase())).slice(0,5).map(t=><button className="tm-enquiry-row" key={t.id} onClick={()=>setSection('messages')}><span className="tm-enquiry-avatar">{(t.visitorName||'V').slice(0,1).toUpperCase()}</span><span><b>{t.visitorName||'Website visitor'}</b><small>{t.lastMessage||'Customer enquiry'}</small></span><ChevronRight size={15}/></button>)}{threads.length===0&&<p className="tm-empty">No enquiries recorded yet.</p>}</section>
            </div>
            <div className="tm-dashboard-grid tm-dashboard-grid-secondary">
              <section className="tm-dashboard-card tm-sales-summary"><div className="tm-card-heading"><div><h2>Sales & Finance Summary</h2><p>Verified receipts and orders only.</p></div><button onClick={()=>setSection('finance')}>Finance <ArrowUpRight size={13}/></button></div><div className="tm-finance-summary-content"><div className="tm-finance-ring"><strong>{financePayments.filter(p=>['verified','completed','paid'].includes(p.status.toLowerCase())).length}</strong><small>Verified payments</small></div><div className="tm-finance-legend"><span><i/>Orders <b>{financeOrders.length}</b></span><span><i/>Payments <b>{financePayments.length}</b></span><span><i/>Pending <b>{financePayments.filter(p=>['pending','submitted','processing'].includes(p.status.toLowerCase())).length}</b></span></div></div><p className="tm-finance-caveat">Portfolio valuation and sales revenue are not displayed until supported by verified financial records.</p></section>
              <section className="tm-dashboard-card tm-vehicle-interest"><div className="tm-card-heading"><div><h2>Vehicle Interest</h2><p>Available vehicle collections.</p></div><button onClick={()=>setSection('catalogue')}>Vehicles <ArrowUpRight size={13}/></button></div>{catalogue.map(item=><div className="tm-vehicle-row" key={item.name}><img src={item.first} alt=""/><b>{item.name}</b><span>{item.count} images</span></div>)}</section>
              <section className="tm-dashboard-card tm-recent-activity"><div className="tm-card-heading"><div><h2>Recent Activity</h2><p>Latest recorded website events.</p></div><button onClick={()=>setSection('visitors')}>View all <ArrowUpRight size={13}/></button></div>{visits.slice(0,5).map(v=><div className="tm-activity-row" key={v.id}><span><Activity size={15}/></span><div><b>Page visit recorded</b><small>{v.page}</small></div><time>{new Date(v.createdAt).toLocaleTimeString()}</time></div>)}{visits.length===0&&<p className="tm-empty">No recent activity.</p>}</section>
            </div>
            <section className="tm-dashboard-card tm-chat-dashboard"><div className="tm-card-heading"><div><h2>Customer Conversations</h2><p>Inbox, live replies and customer details.</p></div><button onClick={()=>setSection('messages')}>Open full inbox <ArrowUpRight size={13}/></button></div><AdminInbox/></section>
            <section className="tm-dashboard-card tm-quick-links"><div className="tm-card-heading"><div><h2>Management Sections</h2><p>All website controls in one organized place.</p></div></div><div className="admin-quick-actions">{nav.filter(item=>item.id!=='overview').map(item=><button key={item.id} onClick={()=>setSection(item.id)}>{item.label}</button>)}</div></section>
          </>}
          {section === 'visitors' && <section className="admin-console-panel"><div className="admin-console-panel-head"><div><div className="eyebrow dark">VISITOR ACTIVITY</div><h2>{visits.length} recent page views</h2><p>Page-level activity; this is not a count of unique people.</p></div></div>{visits.length?<div className="admin-table-wrap"><table className="admin-record-table"><thead><tr><th>Page</th><th>Visited at</th><th>Record ID</th></tr></thead><tbody>{visits.map(visit=><tr key={visit.id}><td>{visit.page}</td><td>{new Date(visit.createdAt).toLocaleString()}</td><td>{visit.id.slice(0,12)}</td></tr>)}</tbody></table></div>:<p className="admin-empty-note">No page views recorded yet.</p>}</section>}
          {section === 'customers' && <section className="admin-console-panel"><div className="admin-console-panel-head"><div><div className="eyebrow dark">CUSTOMER DIRECTORY</div><h2>{threads.length} enquiry contacts</h2><p>Customer records based on saved website conversations.</p></div></div>{threads.length?<div className="admin-table-wrap"><table className="admin-record-table"><thead><tr><th>Customer</th><th>Email</th><th>Last activity</th><th>Last message</th></tr></thead><tbody>{threads.map(thread=><tr key={thread.id}><td>{thread.visitorName||'Website visitor'}</td><td>{thread.visitorEmail||'Not provided'}</td><td>{new Date(thread.updatedAt).toLocaleString()}</td><td>{thread.lastMessage||'—'}</td></tr>)}</tbody></table></div>:<p className="admin-empty-note">New customer conversations will appear here.</p>}</section>}
          {section === 'catalogue' && <section className="admin-console-panel"><div className="admin-console-panel-head"><div><div className="eyebrow dark">VEHICLE CATALOGUE</div><h2>Vehicle image collections</h2><p>Review the current vehicle galleries. Vehicle detail and pricing controls are being expanded.</p></div></div><div className="admin-catalogue-grid">{catalogue.map(item=><article key={item.name}><img src={item.first} alt={item.name}/><div><b>{item.name}</b><small>{item.count} attached images</small></div></article>)}</div></section>}
          {section === 'investment' && <section className="admin-console-panel admin-content-editor"><div className="admin-console-panel-head"><div><div className="eyebrow dark">INVESTMENT PAGE</div><h2>Investment slideshow</h2><p>Manage the images displayed on the public investment page.</p></div></div><div className="admin-investment-gallery">{investmentImages.map((src,index)=><article key={src}><img src={src} alt={'Investment slide '+(index+1)}/><div><span>Image {index+1}</span><button type="button" onClick={()=>setInvestmentImages(current=>current.filter((_,i)=>i!==index))}>Remove</button></div></article>)}</div><label className="admin-upload-label">Add investment images<input type="file" multiple accept="image/jpeg,image/png,image/webp" onChange={event=>{const picked=Array.from(event.target.files||[]);setInvestmentFiles(current=>[...current,...picked]);event.currentTarget.value='';}}/></label>{investmentFiles.length>0&&<p>{investmentFiles.length} new image(s) selected</p>}<small>JPG, PNG or WEBP · maximum 3 MB per image · existing site-media storage</small><button className="btn btn-dark" disabled={savingInvestment} onClick={()=>void saveInvestmentImages()}>{savingInvestment?'Saving images…':'Save investment gallery'}</button></section>}
          {section === 'content' && <section className="admin-console-panel admin-content-editor"><div className="admin-console-panel-head"><div><div className="eyebrow dark">PUBLIC WEBSITE CONTENT</div><h2>Website copy editor</h2><p>Edit the supported homepage, investment page and footer text.</p></div></div><label>Homepage headline<input value={contentDraft.homeHeadline} onChange={e=>setContentDraft(current=>({...current,homeHeadline:e.target.value}))}/></label><label>Homepage description<textarea rows={3} value={contentDraft.homeDescription} onChange={e=>setContentDraft(current=>({...current,homeDescription:e.target.value}))}/></label><label>Investment heading<input value={contentDraft.investmentHeading} onChange={e=>setContentDraft(current=>({...current,investmentHeading:e.target.value}))}/></label><label>Investment description<textarea rows={3} value={contentDraft.investmentDescription} onChange={e=>setContentDraft(current=>({...current,investmentDescription:e.target.value}))}/></label><label>Footer description<textarea rows={2} value={contentDraft.footerBlurb} onChange={e=>setContentDraft(current=>({...current,footerBlurb:e.target.value}))}/></label><div className="admin-content-preview"><b>Live preview</b><h3>{contentDraft.homeHeadline}</h3><p>{contentDraft.homeDescription}</p><h3>{contentDraft.investmentHeading}</h3><p>{contentDraft.investmentDescription}</p><small>{contentDraft.footerBlurb}</small></div><div className="admin-content-actions"><button className="btn btn-outline" onClick={()=>setContentDraft(siteContent)}>Discard changes</button><button className="btn btn-dark" disabled={savingContent} onClick={()=>void saveContent()}>{savingContent?'Saving…':'Publish website content'}</button></div></section>}
          {section === 'media' && <section className="admin-console-panel"><div className="admin-console-panel-head"><div><div className="eyebrow dark">MEDIA LIBRARY</div><h2>Website media</h2><p>Manage investment slides and the management profile image. Vehicle gallery assets remain attached to the current site resources.</p></div></div><div className="admin-media-links"><button onClick={()=>setSection('investment')}>Manage investment images</button><button onClick={()=>setSection('catalogue')}>View vehicle galleries</button><button onClick={()=>setSection('settings')}>Management profile image</button></div></section>}
          {section === 'messages' && <section className="admin-console-panel admin-messages-panel"><div className="admin-console-panel-head"><div><div className="eyebrow dark">CUSTOMER COMMUNICATIONS</div><h2>Customer inbox</h2><p>Customer conversation list and replies. The conversation header and reply bar remain in place while messages scroll.</p></div></div><AdminInbox/></section>}
          {section === 'operations' && <section className="admin-console-panel"><div className="admin-console-panel-head"><div><div className="eyebrow dark">ENQUIRY PIPELINE</div><h2>{threads.length} enquiries</h2><p>Track the current status of each customer enquiry.</p></div></div>{threads.length?<div className="admin-pipeline">{threads.map(thread=><article key={thread.id}><div><b>{thread.visitorName||'Website visitor'}</b><small>{thread.lastMessage||'No message yet'} · {new Date(thread.updatedAt).toLocaleString()}</small></div><label>Status<select value={thread.status||'new'} onChange={event=>void updateStatus(thread.id,event.target.value)}>{statusOptions.map(status=><option key={status} value={status}>{status.replaceAll('_',' ')}</option>)}</select></label></article>)}</div>:<p className="admin-empty-note">New enquiries will appear here.</p>}</section>}
          {section === 'finance' && <><section className="admin-finance-kpis admin-finance-page-kpis"><article><small>Orders recorded</small><b>{financeOrders.length}</b><span>All order records</span></article><article><small>Payments recorded</small><b>{financePayments.length}</b><span>All payment records</span></article><article><small>Verified payments</small><b>{financePayments.filter(p=>['verified','completed','paid'].includes(p.status.toLowerCase())).length}</b><span>Marked verified or completed</span></article><article><small>Awaiting verification</small><b>{financePayments.filter(p=>['pending','submitted','processing'].includes(p.status.toLowerCase())).length}</b><span>Pending or processing</span></article></section><section className="admin-console-panel"><div className="admin-console-panel-head"><div><div className="eyebrow dark">SALES REGISTER</div><h2>Orders & agreed values</h2><p>Order values are not treated as received revenue until a payment is verified.</p></div></div>{financeOrders.length?<div className="admin-table-wrap"><table className="admin-record-table"><thead><tr><th>Order</th><th>Item</th><th>Agreed value</th><th>Status</th><th>Date</th></tr></thead><tbody>{financeOrders.map(order=><tr key={order.id}><td>{order.reference}</td><td>{order.item}</td><td>{new Intl.NumberFormat(undefined,{style:'currency',currency:order.currency||'USD',maximumFractionDigits:2}).format(order.amount)}</td><td><span className="admin-finance-status">{order.status}</span></td><td>{new Date(order.createdAt).toLocaleDateString()}</td></tr>)}</tbody></table></div>:<div className="admin-finance-empty"><Activity size={24}/><b>No sales orders recorded yet</b><span>When an order is created, it will appear here with its agreed value and status.</span></div>}</section><section className="admin-console-panel"><div className="admin-console-panel-head"><div><div className="eyebrow dark">PAYMENT LEDGER</div><h2>Recorded payments</h2><p>Only verified payments should be counted as received funds.</p></div></div>{financePayments.length?<div className="admin-table-wrap"><table className="admin-record-table"><thead><tr><th>Reference</th><th>Amount</th><th>Method</th><th>Status</th><th>Recorded</th></tr></thead><tbody>{financePayments.map(payment=><tr key={payment.id}><td>{payment.reference}</td><td>{new Intl.NumberFormat(undefined,{style:'currency',currency:payment.currency||'USD',maximumFractionDigits:2}).format(payment.amount)}</td><td>{payment.method}</td><td><span className="admin-finance-status">{payment.status}</span></td><td>{new Date(payment.createdAt).toLocaleDateString()}</td></tr>)}</tbody></table></div>:<div className="admin-finance-empty"><Inbox size={24}/><b>No payment records yet</b><span>Payments will appear here after they are recorded in the business payment ledger.</span></div>}</section></>}
          {section === 'settings' && <><section className="admin-console-panel"><div className="eyebrow dark">ACCOUNT SECURITY</div><h2>Administrator sign-in protection</h2><p>Management access uses your private administrator password. No authenticator code is required.</p><div className="admin-security-row"><div><b>Administrator password</b><small>Only your password is required to sign in.</small></div><span className="admin-security-status">Password protected</span></div></section><section className="admin-console-panel admin-profile-settings"><div className="eyebrow dark">MANAGEMENT PROFILE</div><h2>Chat profile picture</h2><p>Upload or replace the picture displayed beside Tesla Markets Management in customer chat.</p><div className="admin-profile-preview">{profileUrl?<img src={profileUrl} alt="Current management profile"/>:<CircleUserRound size={54}/>}<span>{profileUrl?'Current profile picture':'No custom profile picture saved yet'}</span></div><label className="admin-upload-label">Choose a new profile picture<input type="file" accept="image/png,image/jpeg,image/webp" onChange={event=>setProfileFile(event.target.files?.[0]||null)}/></label><small>JPG, PNG or WEBP · maximum 4 MB</small><button className="btn btn-dark" disabled={!profileFile||savingProfile} onClick={()=>void saveProfile()}>{savingProfile?'Saving…':'Save profile picture'}</button></section></>}
          <footer className="admin-console-footer">Signed in as {user.email} · Private management session · <a href="#home">Open public website</a></footer>
        </main>
      </div>
    </div>
  );
}
