import { useEffect, useState } from 'react';
import { isCurrentUserAdmin, supabase, supabaseConfigured } from './lib/supabase';
import { Activity, CarFront, ClipboardList, LogOut, MessageCircle, RefreshCw, ShieldCheck, Users, Eye, Settings, CircleUserRound } from 'lucide-react';
import { AdminInbox } from './ChatWorkspace';

const ADMIN_EMAIL = 'oyejideoluwatobi7@gmail.com';
type Thread = { id: string; visitorName?: string; visitorEmail?: string; createdAt: number; updatedAt: number; lastMessage?: string; status?: string };
type Visit = { id: string; page: string; createdAt: number };
type Overview = { conversations: number; messages: number; generatedImages: number; visits: number; clicks: number; onlineNow: number; updatedAt: number };
type Section = 'overview' | 'visitors' | 'customers' | 'catalogue' | 'messages' | 'operations' | 'settings';

const catalogue = [
  { name: 'Model 3', count: 5, first: '/resources/model-3-1.jpg' },
  { name: 'Model Y', count: 5, first: '/resources/model-y-1.jpg' },
  { name: 'Cybertruck', count: 9, first: '/resources/cybertruck-1.jpg' },
  { name: 'Roadster', count: 6, first: '/resources/roadster-1.jpg' },
  { name: 'Tesla Semi', count: 10, first: '/resources/semi-1.jpg' },
];
const statusOptions = ['new', 'reviewing', 'awaiting_customer', 'broker_referred', 'closed'];
export function AdminConsole() {
  const [user, setUser] = useState<{ email?: string } | null>(null);
  const [checking, setChecking] = useState(true);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [threads, setThreads] = useState<Thread[]>([]);
  const [visits, setVisits] = useState<Visit[]>([]);
  const [section, setSection] = useState<Section>('overview');
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [profileUrl, setProfileUrl] = useState('');
  const [profileFile, setProfileFile] = useState<File | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);

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

  useEffect(() => {
    let active = true;
    if (!supabaseConfigured) {
      setError('Supabase is not configured. Add the VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY environment variables.');
      setChecking(false);
      return () => { active = false; };
    }
    isCurrentUserAdmin()
      .then(({ user: current, isAdmin }) => {
        if (!active) return;
        setUser(current && isAdmin ? { email: current.email || '' } : null);
        if (current && !isAdmin) setError('This account is not authorised for management access.');
      })
      .catch(e => { if (active) setError(e instanceof Error ? e.message : 'Sign-in check failed.'); })
      .finally(() => { if (active) setChecking(false); });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      if (!session?.user) { setUser(null); return; }
      void isCurrentUserAdmin().then(({ user: current, isAdmin }) => {
        if (active) setUser(current && isAdmin ? { email: current.email || '' } : null);
      }).catch(e => setError(e instanceof Error ? e.message : 'Could not verify administrator access.'));
    });
    return () => { active = false; listener.subscription.unsubscribe(); };
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
    void load();
    const timer = window.setInterval(() => { void load(); }, 20000);
    return () => window.clearInterval(timer);
  }, [user?.email]);

  const signIn = async () => {
    try {
      const { error: signInError } = await supabase.auth.signInWithOtp({
        email: ADMIN_EMAIL,
        options: { emailRedirectTo: window.location.origin + '/#admin' },
      });
      if (signInError) throw signInError;
      setError('A secure sign-in link has been sent to the authorised administrator email. Open it on this device to continue.');
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not start administrator sign-in.'); }
  };
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

  if (checking) return <div className="admin-auth-state"><ShieldCheck size={26} /> Checking administrator access…</div>;
  if (!user) return <div className="admin-auth-state admin-auth-full"><ShieldCheck size={30} /><h2>Private management access</h2><p>Sign in with the authorised Tesla Markets management account.</p>{error && <p className="chat-error">{error}</p>}<button className="btn btn-dark" onClick={signIn} disabled={!supabaseConfigured}>Administrator sign in</button><a href="#home">Return to public website</a></div>;
  

  const nav = [
    { id: 'overview' as const, label: 'Overview', icon: Activity },
    { id: 'visitors' as const, label: 'Visitors', icon: Eye },
    { id: 'customers' as const, label: 'Customers', icon: Users },
    { id: 'catalogue' as const, label: 'Vehicles', icon: CarFront },
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
        {section === 'messages' && <section className="admin-console-panel"><div className="admin-console-panel-head"><div><div className="eyebrow dark">CUSTOMER COMMUNICATIONS</div><h2>Chats & support replies</h2><p>Read conversations and reply with text or image attachments.</p></div></div><AdminInbox /></section>}
        {section === 'operations' && <section className="admin-console-panel"><div className="admin-console-panel-head"><div><div className="eyebrow dark">ENQUIRY PIPELINE</div><h2>{threads.length} enquiries</h2><p>Track the current status of each customer enquiry.</p></div></div>{threads.length ? <div className="admin-pipeline">{threads.map(thread=><article key={thread.id}><div><b>{thread.visitorName || 'Website visitor'}</b><small>{thread.lastMessage || 'No message yet'} · {new Date(thread.updatedAt).toLocaleString()}</small></div><label>Status<select value={thread.status || 'new'} onChange={event=>void updateStatus(thread.id,event.target.value)}>{statusOptions.map(status=><option key={status} value={status}>{status.replaceAll('_',' ')}</option>)}</select></label></article>)}</div> : <p className="admin-empty-note">New enquiries will appear here.</p>}</section>}
        {section === 'settings' && <section className="admin-console-panel admin-profile-settings"><div className="eyebrow dark">MANAGEMENT PROFILE</div><h2>Chat profile picture</h2><p>Upload or replace the picture displayed beside Tesla Markets Management in customer chat. The image is stored with the app and can be changed here later.</p><div className="admin-profile-preview">{profileUrl ? <img src={profileUrl} alt="Current management profile" /> : <CircleUserRound size={54} />}<span>{profileUrl ? 'Current profile picture' : 'No custom profile picture saved yet'}</span></div><label className="admin-upload-label">Choose a new profile picture<input type="file" accept="image/png,image/jpeg,image/webp" onChange={event=>setProfileFile(event.target.files?.[0] || null)} /></label><small>JPG, PNG or WEBP · maximum 4 MB</small><button className="btn btn-dark" disabled={!profileFile || savingProfile} onClick={()=>void saveProfile()}>{savingProfile ? 'Saving…' : 'Save profile picture'}</button></section>}
        <footer className="admin-console-footer">Signed in as {user.email} · Private management session · <a href="#home">Open public website</a></footer>
      </main>
    </div>
  );
}
