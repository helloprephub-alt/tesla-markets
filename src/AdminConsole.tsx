import { useEffect, useState } from 'react';
import { isCurrentUserAdmin, supabase, supabaseConfigured } from './lib/supabase';
import { Activity, CarFront, ClipboardList, LogOut, MessageCircle, RefreshCw, ShieldCheck, Users, Eye, Settings, CircleUserRound } from 'lucide-react';
import { AdminInbox } from './ChatWorkspace';

const ADMIN_EMAIL = 'oyejideoluwatobi7@gmail.com';
const ADMIN_AUTH_REDIRECT = 'https://tesla-markets.vercel.app/#admin';
type Thread = { id: string; visitorName?: string; visitorEmail?: string; createdAt: number; updatedAt: number; lastMessage?: string; status?: string };
type Visit = { id: string; page: string; createdAt: number };
type Overview = { conversations: number; messages: number; generatedImages: number; visits: number; clicks: number; onlineNow: number; updatedAt: number };
type Section = 'overview' | 'visitors' | 'customers' | 'catalogue' | 'investment' | 'content' | 'media' | 'messages' | 'operations' | 'settings';

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
  const [authStep,setAuthStep]=useState<'login'|'enroll'|'verify'|'ready'>('login');
  const [loginEmail,setLoginEmail]=useState(ADMIN_EMAIL);
  const [loginPassword,setLoginPassword]=useState('');
  const [passwordRecovery,setPasswordRecovery]=useState(false);
  const [newPassword,setNewPassword]=useState('');
  const [authCode,setAuthCode]=useState('');
  const [factorId,setFactorId]=useState('');
  const [challengeId,setChallengeId]=useState('');
  const [totpQr,setTotpQr]=useState('');
  const [totpSecret,setTotpSecret]=useState('');
  const [authBusy,setAuthBusy]=useState(false);
  const [passkeys,setPasskeys]=useState<Array<{id:string;friendly_name?:string;created_at?:string;last_used_at?:string}>>([]);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [threads, setThreads] = useState<Thread[]>([]);
  const [visits, setVisits] = useState<Visit[]>([]);
  const [section, setSection] = useState<Section>('overview');
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
      const [visitCount, clickCount, conversationCount, messageCount, presenceCount, visitorLog, conversationRows] = await Promise.all([
        supabase.from('site_visits').select('id', { count:'exact', head:true }),
        supabase.from('site_clicks').select('id', { count:'exact', head:true }),
        supabase.from('support_conversations').select('id', { count:'exact', head:true }),
        supabase.from('support_messages').select('id', { count:'exact', head:true }),
        supabase.from('site_presence').select('visitor_id', { count:'exact', head:true }).gte('last_seen_at', new Date(Date.now()-90000).toISOString()),
        supabase.from('site_visits').select('id,page,created_at').order('created_at',{ascending:false}).limit(100),
        supabase.from('support_conversations').select('id,customer_id,subject,status,updated_at').order('updated_at',{ascending:false}).limit(100),
      ]);
      for (const result of [visitCount,clickCount,conversationCount,messageCount,presenceCount,visitorLog,conversationRows]) if (result.error) throw result.error;
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
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load management records.');
    } finally {
      setRefreshing(false);
    }
  };

  const evaluateAdminSession = async () => {
    const {data:{user:current},error:authError}=await supabase.auth.getUser();
    if(authError)throw authError;
    if(!current){setUser(null);setAuthStep('login');return;}
    const {isAdmin}=await isCurrentUserAdmin();
    if(!isAdmin){setUser(null);setAuthStep('login');setError('This account is not authorised for Tesla Markets management.');await supabase.auth.signOut();return;}
    const {data:factors,error:factorError}=await supabase.auth.mfa.listFactors();
    if(factorError)throw factorError;
    const verified=factors.totp.find(factor=>factor.status==='verified');
    if(!verified){setUser(null);setAuthStep('enroll');return;}
    const {data:assurance,error:assuranceError}=await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if(assuranceError)throw assuranceError;
    if(assurance.currentLevel!=='aal2'){
      const challenge=await supabase.auth.mfa.challenge({factorId:verified.id});
      if(challenge.error)throw challenge.error;
      setFactorId(verified.id);setChallengeId(challenge.data.id);setUser(null);setAuthStep('verify');return;
    }
    setUser({email:current.email||''});setAuthStep('ready');setError('');
    const keys=await supabase.auth.passkey.list();if(!keys.error)setPasskeys(keys.data||[]);
  };
  useEffect(() => {
    let active=true;
    if(!supabaseConfigured){setError('Supabase is not configured.');setChecking(false);return()=>{active=false;};}
    void evaluateAdminSession().catch(e=>{if(active){setUser(null);setAuthStep('login');setError(e instanceof Error?e.message:'Sign-in check failed.');}}).finally(()=>{if(active)setChecking(false);});
    const {data:listener}=supabase.auth.onAuthStateChange((_event,session)=>{
      if(!active)return;
      if(!session?.user){setUser(null);setAuthStep('login');return;}
      if(_event==='PASSWORD_RECOVERY'){setPasswordRecovery(true);setUser(null);setAuthStep('login');return;}
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

  const signIn = async () => {
    setAuthBusy(true);setError('');
    try { if(!loginEmail.trim())throw new Error('Enter your administrator email.');const {error:signInError}=await supabase.auth.signInWithPassword({email:loginEmail.trim(),password:loginPassword});if(signInError)throw signInError; }
    catch(e){setError(e instanceof Error?e.message:'Could not sign in.');}finally{setAuthBusy(false);}
  };
  const resetAdminPassword=async()=>{setAuthBusy(true);setError('');try{const {error:resetError}=await supabase.auth.resetPasswordForEmail(loginEmail.trim()||ADMIN_EMAIL,{redirectTo:ADMIN_AUTH_REDIRECT});if(resetError)throw resetError;setError('Password reset email sent. The live Vercel URL must be allowed in Supabase Auth URL settings.');}catch(e){setError(e instanceof Error?e.message:'Could not send password reset email.');}finally{setAuthBusy(false);}};
  const saveRecoveredPassword=async()=>{if(newPassword.length<14){setError('Use at least 14 characters for the new administrator password.');return;}setAuthBusy(true);setError('');try{const {error:updateError}=await supabase.auth.updateUser({password:newPassword});if(updateError)throw updateError;setNewPassword('');setPasswordRecovery(false);setError('Password updated. Now complete authenticator setup or verification.');await evaluateAdminSession();}catch(e){setError(e instanceof Error?e.message:'Could not update the administrator password.');}finally{setAuthBusy(false);}};
  const signInWithPasskey=async()=>{setAuthBusy(true);setError('');try{const {error:passkeyError}=await supabase.auth.signInWithPasskey();if(passkeyError)throw passkeyError;}catch(e){setError(e instanceof Error?e.message:'Passkey sign-in failed.');}finally{setAuthBusy(false);}};
  const beginTotpEnrollment=async()=>{setAuthBusy(true);setError('');try{const existing=await supabase.auth.mfa.listFactors();if(existing.error)throw existing.error;for(const pending of existing.data.totp.filter(factor=>factor.status!=='verified')){const cleanup=await supabase.auth.mfa.unenroll({factorId:pending.id});if(cleanup.error)throw cleanup.error;}const {data,error:enrollError}=await supabase.auth.mfa.enroll({factorType:'totp',friendlyName:'Tesla Markets Management'});if(enrollError)throw enrollError;setFactorId(data.id);setTotpQr(data.totp.qr_code);setTotpSecret(data.totp.secret);}catch(e){setError(e instanceof Error?e.message:'Could not start authenticator setup.');}finally{setAuthBusy(false);}};
  const verifyTotp=async()=>{if(!factorId||authCode.trim().length!==6)return;setAuthBusy(true);setError('');try{let activeChallenge=challengeId;if(!activeChallenge){const challenge=await supabase.auth.mfa.challenge({factorId});if(challenge.error)throw challenge.error;activeChallenge=challenge.data.id;}const {error:verifyError}=await supabase.auth.mfa.verify({factorId,challengeId:activeChallenge,code:authCode.trim()});if(verifyError)throw verifyError;setAuthCode('');setChallengeId('');setTotpQr('');setTotpSecret('');await evaluateAdminSession();}catch(e){setError(e instanceof Error?e.message:'Authenticator verification failed. Check the current six-digit code.');}finally{setAuthBusy(false);}};
  const addPasskey=async()=>{setAuthBusy(true);setError('');try{const {error:registerError}=await supabase.auth.registerPasskey();if(registerError)throw registerError;const keys=await supabase.auth.passkey.list();if(keys.error)throw keys.error;setPasskeys(keys.data||[]);setError('Passkey registered successfully on this device.');}catch(e){setError(e instanceof Error?e.message:'Could not register a passkey.');}finally{setAuthBusy(false);}};
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

  if(checking)return <div className="admin-auth-state"><ShieldCheck size={26}/> Checking administrator security…</div>;
  if(!user)return <div className="admin-auth-state admin-auth-full"><ShieldCheck size={30}/><h2>Private management access</h2>
    {authStep==='login'&&<>{passwordRecovery?<><p>Set a new, unique administrator password. Use at least 14 characters.</p><input className="admin-auth-input" type="password" autoComplete="new-password" value={newPassword} onChange={e=>setNewPassword(e.target.value)} placeholder="New administrator password"/><button className="btn btn-dark" onClick={saveRecoveredPassword} disabled={authBusy||newPassword.length<14}>{authBusy?'Updating…':'Save new password'}</button></>:<><p>Use the authorised administrator account. Authenticator verification is required.</p><input className="admin-auth-input" type="email" autoComplete="username" value={loginEmail} onChange={e=>setLoginEmail(e.target.value)} placeholder="Administrator email"/><input className="admin-auth-input" type="password" autoComplete="current-password" value={loginPassword} onChange={e=>setLoginPassword(e.target.value)} placeholder="Password"/><button className="btn btn-dark" onClick={signIn} disabled={!supabaseConfigured||authBusy||!loginPassword}>{authBusy?'Signing in…':'Continue securely'}</button><button className="admin-auth-link" onClick={resetAdminPassword} disabled={authBusy}>Forgot password?</button><div className="admin-auth-divider">OR</div><button className="btn btn-outline" onClick={signInWithPasskey} disabled={!supabaseConfigured||authBusy}>Sign in with passkey</button></>}</>}
    {authStep==='enroll'&&<><p>Set up an authenticator app before entering management. Scan this QR code with Google Authenticator, Microsoft Authenticator or another TOTP app.</p>{totpQr?<><img className="admin-auth-qr" src={totpQr.startsWith('data:')?totpQr:'data:image/svg+xml;utf8,'+encodeURIComponent(totpQr)} alt="Authenticator setup QR code"/><p className="admin-auth-secret">Manual setup key: <b>{totpSecret}</b></p><input className="admin-auth-input" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={authCode} onChange={e=>setAuthCode(e.target.value.replace(/\D/g,'').slice(0,6))} placeholder="6-digit authenticator code"/><button className="btn btn-dark" onClick={verifyTotp} disabled={authBusy||authCode.length!==6}>{authBusy?'Verifying…':'Verify and secure account'}</button></>:<button className="btn btn-dark" onClick={beginTotpEnrollment} disabled={authBusy}>{authBusy?'Preparing…':'Set up authenticator app'}</button>}</>}
    {authStep==='verify'&&<><p>Enter the current six-digit code from your registered authenticator app.</p><input className="admin-auth-input" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={authCode} onChange={e=>setAuthCode(e.target.value.replace(/\D/g,'').slice(0,6))} placeholder="6-digit authenticator code"/><button className="btn btn-dark" onClick={verifyTotp} disabled={authBusy||authCode.length!==6}>{authBusy?'Verifying…':'Verify and continue'}</button></>}
    {error&&<p className="chat-error">{error}</p>}<a href="#home">Return to public website</a></div>;
  

  const nav = [
    { id: 'overview' as const, label: 'Overview', icon: Activity },
    { id: 'visitors' as const, label: 'Visitors', icon: Eye },
    { id: 'customers' as const, label: 'Customers', icon: Users },
    { id: 'catalogue' as const, label: 'Vehicles', icon: CarFront },
    { id: 'investment' as const, label: 'Investment content', icon: Activity },
    { id: 'content' as const, label: 'Website content', icon: ClipboardList },
    { id: 'media' as const, label: 'Media library', icon: Eye },
    { id: 'messages' as const, label: 'Chats & replies', icon: MessageCircle },
    { id: 'operations' as const, label: 'Enquiries & orders', icon: ClipboardList },
    { id: 'settings' as const, label: 'Settings', icon: Settings },
  ];

  return (
    <div className="admin-console admin-console-standalone">
      <aside className="admin-console-side">
        <div className="admin-console-brand"><span className="admin-brand-mark">T</span><div><b>TESLA MARKETS</b><small>MANAGEMENT</small></div></div>
        <div className="admin-console-label">WORKSPACE</div>
        {nav.map(item => {
          const Icon = item.icon;
          return <button key={item.id} className={section === item.id ? 'active' : ''} onClick={() => setSection(item.id)}><Icon size={17} />{item.label}</button>;
        })}
        <div className="admin-console-side-foot"><ShieldCheck size={16} /> Private administrator workspace</div>
      </aside>
      <main className="admin-console-main">
        <header className="admin-console-header">
          <div><div className="eyebrow dark">TESLA MARKETS / MANAGEMENT</div><h1>{nav.find(item => item.id === section)?.label}</h1><p>Website activity, customer conversations and operations at a glance.</p></div>
          <div className="admin-console-user"><span className="admin-live-dot" />{user.email}<button className="icon-btn" onClick={() => void load()} aria-label="Refresh management data" disabled={refreshing}><RefreshCw size={16} /></button><button className="icon-btn" onClick={() => supabase.auth.signOut().then(() => setUser(null))} aria-label="Sign out"><LogOut size={16} /></button></div>
        </header>
        {error && <div className="admin-console-error">{error}</div>}
        {section === 'overview' && <>
          <section className="admin-console-stats">
            <article><span><Eye size={18} /></span><small>Total page views</small><strong>{overview?.visits ?? '—'}</strong><em>Recorded website visits</em></article>
            <article><span><Activity size={18} /></span><small>Total clicks</small><strong>{overview?.clicks ?? '—'}</strong><em>Clicks on buttons and links</em></article>
            <article><span><Users size={18} /></span><small>Online now</small><strong>{overview?.onlineNow ?? '—'}</strong><em>Active browser sessions in the last 90 seconds</em></article>
            <article><span><MessageCircle size={18} /></span><small>Customer chats</small><strong>{overview?.conversations ?? '—'}</strong><em>Saved enquiry conversations</em></article>
            <article><span><Activity size={18} /></span><small>Messages</small><strong>{overview?.messages ?? '—'}</strong><em>Messages received and sent</em></article>
          </section>
          <section className="admin-console-panel">
            <div className="admin-console-panel-head"><div><div className="eyebrow dark">RECENT CUSTOMER ACTIVITY</div><h2>Recently active chats</h2><p>Latest customer messages and management replies.</p></div><button className="btn btn-outline" onClick={() => setSection('messages')}>Open chats <MessageCircle size={15} /></button></div>
            {threads.length ? <div className="admin-record-list">{threads.slice(0, 8).map(thread => <div key={thread.id}><span className="admin-record-avatar">{(thread.visitorName || 'V').slice(0, 1).toUpperCase()}</span><div><b>{thread.visitorName || 'Website visitor'}</b><small>{thread.visitorEmail || 'Email not provided'} · {thread.lastMessage || 'Conversation opened'}</small></div><time>{new Date(thread.updatedAt).toLocaleString()}</time></div>)}</div> : <p className="admin-empty-note">No customer conversations have been recorded yet.</p>}
          </section>
          <section className="admin-console-panel"><div className="admin-console-panel-head"><div><div className="eyebrow dark">QUICK ACCESS</div><h2>Management workspace</h2><p>Open the area you need without navigating through the public website.</p></div></div><div className="admin-quick-actions">{nav.filter(item => item.id !== 'overview').map(item => <button key={item.id} onClick={() => setSection(item.id)}>{item.label}</button>)}</div></section>
        </>}
        {section === 'visitors' && <section className="admin-console-panel"><div className="admin-console-panel-head"><div><div className="eyebrow dark">VISITOR ACTIVITY</div><h2>{visits.length} recent page views</h2><p>Page-level activity; this is not a count of unique people.</p></div></div>{visits.length ? <div className="admin-table-wrap"><table className="admin-record-table"><thead><tr><th>Page</th><th>Visited at</th><th>Record ID</th></tr></thead><tbody>{visits.map(visit => <tr key={visit.id}><td>{visit.page}</td><td>{new Date(visit.createdAt).toLocaleString()}</td><td>{visit.id.slice(0, 12)}</td></tr>)}</tbody></table></div> : <p className="admin-empty-note">No page views recorded yet.</p>}</section>}
        {section === 'customers' && <section className="admin-console-panel"><div className="admin-console-panel-head"><div><div className="eyebrow dark">CUSTOMER REGISTER</div><h2>{threads.length} enquiry contacts</h2><p>Records are based on saved website conversations.</p></div></div>{threads.length ? <div className="admin-table-wrap"><table className="admin-record-table"><thead><tr><th>Customer</th><th>Email</th><th>Last activity</th><th>Last message</th></tr></thead><tbody>{threads.map(thread => <tr key={thread.id}><td>{thread.visitorName || 'Website visitor'}</td><td>{thread.visitorEmail || 'Not provided'}</td><td>{new Date(thread.updatedAt).toLocaleString()}</td><td>{thread.lastMessage || '—'}</td></tr>)}</tbody></table></div> : <p className="admin-empty-note">New customer conversations will appear here.</p>}</section>}
        {section === 'catalogue' && <section className="admin-console-panel"><div className="admin-console-panel-head"><div><div className="eyebrow dark">VEHICLE COLLECTION</div><h2>Attached image galleries</h2><p>Existing uploaded resources are retained.</p></div></div><div className="admin-catalogue-grid">{catalogue.map(item => <article key={item.name}><img src={item.first} alt={item.name} /><div><b>{item.name}</b><small>{item.count} attached images</small></div></article>)}</div></section>}
        {section === 'investment' && <section className="admin-console-panel admin-content-editor"><div className="admin-console-panel-head"><div><div className="eyebrow dark">INVESTMENT PAGE</div><h2>Investment slideshow images</h2><p>Manage the images shown on the public investment page. Existing images remain until you remove them here.</p></div></div><div className="admin-investment-gallery">{investmentImages.map((src,index)=><article key={src}><img src={src} alt={'Investment slide '+(index+1)}/><div><span>Image {index+1}</span><button type="button" onClick={()=>setInvestmentImages(current=>current.filter((_,i)=>i!==index))}>Remove</button></div></article>)}</div><label className="admin-upload-label">Add multiple investment images<input type="file" multiple accept="image/jpeg,image/png,image/webp" onChange={event=>{const picked=Array.from(event.target.files||[]);setInvestmentFiles(current=>[...current,...picked]);event.currentTarget.value='';}}/></label>{investmentFiles.length>0&&<p>{investmentFiles.length} new image(s) selected</p>}<small>JPG, PNG or WEBP · maximum 3 MB per image · uses existing site-media storage</small><button className="btn btn-dark" disabled={savingInvestment} onClick={()=>void saveInvestmentImages()}>{savingInvestment?'Saving images…':'Save investment gallery'}</button></section>}
        {section === 'content' && <section className="admin-console-panel admin-content-editor"><div className="admin-console-panel-head"><div><div className="eyebrow dark">PUBLIC WEBSITE CONTENT</div><h2>Text content editor</h2><p>Edit the supported homepage, investment page and footer text. Preview your wording before saving.</p></div></div><label>Homepage headline<input value={contentDraft.homeHeadline} onChange={e=>setContentDraft(current=>({...current,homeHeadline:e.target.value}))}/></label><label>Homepage description<textarea rows={3} value={contentDraft.homeDescription} onChange={e=>setContentDraft(current=>({...current,homeDescription:e.target.value}))}/></label><label>Investment heading<input value={contentDraft.investmentHeading} onChange={e=>setContentDraft(current=>({...current,investmentHeading:e.target.value}))}/></label><label>Investment description<textarea rows={3} value={contentDraft.investmentDescription} onChange={e=>setContentDraft(current=>({...current,investmentDescription:e.target.value}))}/></label><label>Footer description<textarea rows={2} value={contentDraft.footerBlurb} onChange={e=>setContentDraft(current=>({...current,footerBlurb:e.target.value}))}/></label><div className="admin-content-preview"><b>Preview</b><h3>{contentDraft.homeHeadline}</h3><p>{contentDraft.homeDescription}</p><h3>{contentDraft.investmentHeading}</h3><p>{contentDraft.investmentDescription}</p><small>{contentDraft.footerBlurb}</small></div><div className="admin-content-actions"><button className="btn btn-outline" onClick={()=>setContentDraft(siteContent)}>Cancel changes</button><button className="btn btn-dark" disabled={savingContent} onClick={()=>void saveContent()}>{savingContent?'Saving…':'Save website content'}</button></div></section>}
        {section === 'media' && <section className="admin-console-panel"><div className="admin-console-panel-head"><div><div className="eyebrow dark">MEDIA LIBRARY</div><h2>Managed website images</h2><p>Investment images are managed in Investment content. The management profile is managed in Settings. Existing vehicle images remain in the project's resources folder.</p></div></div><div className="admin-media-links"><button onClick={()=>setSection('investment')}>Manage investment images</button><button onClick={()=>setSection('catalogue')}>View vehicle galleries</button><button onClick={()=>setSection('settings')}>Manage profile image</button></div></section>}
        {section === 'messages' && <section className="admin-console-panel"><div className="admin-console-panel-head"><div><div className="eyebrow dark">CUSTOMER COMMUNICATIONS</div><h2>Chats & support replies</h2><p>Read conversations and reply with text or image attachments.</p></div></div><AdminInbox /></section>}
        {section === 'operations' && <section className="admin-console-panel"><div className="admin-console-panel-head"><div><div className="eyebrow dark">ENQUIRY PIPELINE</div><h2>{threads.length} enquiries</h2><p>Track the current status of each customer enquiry.</p></div></div>{threads.length ? <div className="admin-pipeline">{threads.map(thread=><article key={thread.id}><div><b>{thread.visitorName || 'Website visitor'}</b><small>{thread.lastMessage || 'No message yet'} · {new Date(thread.updatedAt).toLocaleString()}</small></div><label>Status<select value={thread.status || 'new'} onChange={event=>void updateStatus(thread.id,event.target.value)}>{statusOptions.map(status=><option key={status} value={status}>{status.replaceAll('_',' ')}</option>)}</select></label></article>)}</div> : <p className="admin-empty-note">New enquiries will appear here.</p>}</section>}
        {section === 'settings' && <section className="admin-console-panel"><div className="eyebrow dark">ACCOUNT SECURITY</div><h2>Administrator sign-in protection</h2><p>Authenticator verification is required for every management login. Register a passkey on this trusted device for phishing-resistant sign-in.</p><div className="admin-security-row"><div><b>Authenticator app</b><small>Time-based six-digit code · required</small></div><span className="admin-security-status">Verified</span></div><div className="admin-security-row"><div><b>Passkeys</b><small>{passkeys.length} registered</small></div><button className="btn btn-dark" onClick={addPasskey} disabled={authBusy}>{authBusy?'Working…':'Add this device passkey'}</button></div>{passkeys.map(key=><div className="admin-security-row" key={key.id}><div><b>{key.friendly_name||'Passkey'}</b><small>Added {key.created_at?new Date(key.created_at).toLocaleDateString():'date unavailable'}</small></div></div>)}</section>}
        {section === 'settings' && <section className="admin-console-panel admin-profile-settings"><div className="eyebrow dark">MANAGEMENT PROFILE</div><h2>Chat profile picture</h2><p>Upload or replace the picture displayed beside Tesla Markets Management in customer chat. The image is stored with the app and can be changed here later.</p><div className="admin-profile-preview">{profileUrl ? <img src={profileUrl} alt="Current management profile" /> : <CircleUserRound size={54} />}<span>{profileUrl ? 'Current profile picture' : 'No custom profile picture saved yet'}</span></div><label className="admin-upload-label">Choose a new profile picture<input type="file" accept="image/png,image/jpeg,image/webp" onChange={event=>setProfileFile(event.target.files?.[0] || null)} /></label><small>JPG, PNG or WEBP · maximum 4 MB</small><button className="btn btn-dark" disabled={!profileFile || savingProfile} onClick={()=>void saveProfile()}>{savingProfile ? 'Saving…' : 'Save profile picture'}</button></section>}
        <footer className="admin-console-footer">Signed in as {user.email} · Private management session · <a href="#home">Open public website</a></footer>
      </main>
    </div>
  );
}
