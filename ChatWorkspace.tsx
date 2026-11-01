import { useEffect, useRef, useState } from 'react';
import { api, auth } from '@appdeploy/client';
import { ArrowLeft, ArrowUpRight, ImagePlus, LoaderCircle, LockKeyhole, MessageCircle, RefreshCw, Send, ShieldCheck, UserRound, X } from 'lucide-react';

type Message = { id: string; sender: 'visitor'|'admin'; text: string; attachmentUrl?: string|null; createdAt: number };
type Thread = { id: string; visitorName: string; visitorEmail: string; updatedAt: number; lastMessage: string };
const readFile = (file: File) => new Promise<{data:string;mimeType:string}>((resolve,reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve({ data: String(reader.result).split(',')[1], mimeType: file.type });
  reader.onerror = () => reject(new Error('Could not read image.'));
  reader.readAsDataURL(file);
});
const errorText = (e: unknown) => e instanceof Error ? e.message : 'Something went wrong. Please try again.';

export function ChatWorkspace({ onBack }: { onBack: () => void }) {
  const [threadId,setThreadId] = useState('');
  const [messages,setMessages] = useState<Message[]>([]);
  const [draft,setDraft] = useState('');
  const [busy,setBusy] = useState(false);
  const [problem,setProblem] = useState('');
  const [image,setImage] = useState<File|null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let active = true;
    const boot = async () => {
      try {
        let id = localStorage.getItem('tesla-markets-enquiry-id') || '';
        if (!id) {
          const r = await api.post('/api/enquiries', {});
          id = r.data.threadId;
          localStorage.setItem('tesla-markets-enquiry-id', id);
        }
        if (active) setThreadId(id);
      } catch (e) { if (active) setProblem(errorText(e)); }
    };
    void boot();
    return () => { active = false; };
  }, []);
  const refresh = async () => {
    if (!threadId) return;
    try {
      const r = await api.get('/api/enquiries/' + threadId + '/messages');
      setMessages(r.data.messages || []);
      setProblem('');
    } catch (e) { setProblem(errorText(e)); }
  };
  useEffect(() => {
    if (!threadId) return;
    void refresh();
    const timer = window.setInterval(() => { void refresh(); }, 4000);
    return () => window.clearInterval(timer);
  }, [threadId]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);
  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!draft.trim() && !image) || busy) return;
    setBusy(true); setProblem('');
    try {
      const attachment = image ? await readFile(image) : undefined;
      if (image && image.size > 3*1024*1024) throw new Error('Choose an image smaller than 3 MB.');
      await api.post('/api/enquiries/' + threadId + '/messages', { text: draft, attachment });
      setDraft(''); setImage(null); await refresh();
    } catch (e) { setProblem(errorText(e)); }
    finally { setBusy(false); }
  };
  return <section className="chat-page chat-page-live">
    <div className="chat-heading"><button className="back-home" onClick={onBack}><ArrowLeft size={14}/> Back to website</button><div className="eyebrow dark">TESLA MARKETS / LIVE ENQUIRIES</div><h1>Let's talk about<br/><em>what interests you.</em></h1><p className="muted">Send a message or image. Our team can reply in this conversation.</p><div className="chat-trust"><ShieldCheck size={16}/> Private enquiry conversation</div></div>
    <div className="chat-panel live-chat-panel">
      <div className="chat-top"><span className="chat-avatar chat-avatar-fallback">T</span><div><b>Tesla Markets support</b><small><i/> Enquiry team · replies appear here</small></div><span className="chat-secure"><LockKeyhole size={14}/> Private</span></div>
      <div className="chat-messages live-chat-messages">
        {messages.length === 0 && <div className="chat-empty-agent"><span className="chat-avatar">T</span><b>Welcome to Tesla Markets</b><p>How can we help with Tesla or SpaceX market information today?</p></div>}
        {messages.map(m=><div key={m.id} className={'chat-message-row '+(m.sender==='visitor'?'mine':'theirs')}><div className={'chat-bubble '+(m.sender==='visitor'?'you':'team')}>{m.text && <p>{m.text}</p>}{m.attachmentUrl && <a href={m.attachmentUrl} target="_blank" rel="noreferrer"><img className="chat-attachment" src={m.attachmentUrl} alt="Shared attachment"/></a>}<small>{new Date(m.createdAt).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}</small></div></div>)}
        <div ref={endRef}/>
      </div>
      {image && <div className="chat-image-preview"><ImagePlus size={16}/>{image.name}<button onClick={()=>setImage(null)} aria-label="Remove image"><X size={15}/></button></div>}
      {problem && <p className="chat-error">{problem}</p>}
      <form className="chat-compose live-chat-compose" onSubmit={send}>
        <label className="chat-attach" title="Attach an image"><ImagePlus size={20}/><input type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={e=>setImage(e.target.files?.[0] || null)}/></label>
        <input value={draft} onChange={e=>setDraft(e.target.value)} placeholder="Write your message..." aria-label="Write your message"/>
        <button className="btn btn-red" disabled={busy || (!draft.trim() && !image)}>{busy?<LoaderCircle className="spin" size={17}/>:<Send size={17}/>} Send</button>
      </form>
      <p className="chat-footnote">Your enquiry is saved securely so the support team can reply. Do not send passwords, card details or sensitive personal information.</p>
    </div>
  </section>;
}

export function AdminInbox() {
  const [user,setUser] = useState<{email?:string;name?:string}|null>(null);
  const [checking,setChecking] = useState(true);
  const [threads,setThreads] = useState<Thread[]>([]);
  const [selected,setSelected] = useState('');
  const [messages,setMessages] = useState<Message[]>([]);
  const [draft,setDraft] = useState('');
  const [image,setImage] = useState<File|null>(null);
  const [busy,setBusy] = useState(false);
  const [problem,setProblem] = useState('');
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(()=>{ let active=true; auth.getUser().then(u=>{if(active)setUser(u?{email:u.email,name:u.name}:null);}).catch(e=>setProblem(errorText(e))).finally(()=>{if(active)setChecking(false);}); return ()=>{active=false;}; },[]);
  const loadThreads = async () => {
    try { const r=await api.get('/api/admin/enquiries'); setThreads(r.data.threads||[]); setProblem(''); }
    catch(e){setProblem(errorText(e));}
  };
  useEffect(()=>{if(!user)return; void loadThreads(); const t=window.setInterval(()=>{void loadThreads();},6000); return ()=>window.clearInterval(t);},[user]);
  const loadMessages = async () => { if(!selected)return; try {const r=await api.get('/api/admin/enquiries/'+selected+'/messages');setMessages(r.data.messages||[]);}catch(e){setProblem(errorText(e));} };
  useEffect(()=>{if(!selected)return;void loadMessages();const t=window.setInterval(()=>{void loadMessages();},3500);return()=>window.clearInterval(t);},[selected]);
  useEffect(()=>{endRef.current?.scrollIntoView({behavior:'smooth'});},[messages]);
  const reply = async (e:React.FormEvent) => {e.preventDefault();if((!draft.trim()&&!image)||busy||!selected)return;setBusy(true);setProblem('');try{const attachment=image?await readFile(image):undefined;if(image&&image.size>3*1024*1024)throw new Error('Choose an image smaller than 3 MB.');await api.post('/api/admin/enquiries/'+selected+'/messages',{text:draft,attachment});setDraft('');setImage(null);await loadMessages();await loadThreads();}catch(e){setProblem(errorText(e));}finally{setBusy(false);}};
  const login = async () => {try{await auth.signInWithRedirect();}catch(e){setProblem(errorText(e));}};
  if(checking)return <div className="dash-box admin-auth-state"><LoaderCircle className="spin"/> Checking administrator access…</div>;
  if(!user)return <div className="dash-box admin-auth-state"><LockKeyhole size={30}/><h2>Administrator sign-in</h2><p className="muted">Sign in with helloprephub@gmail.com to access private customer enquiries.</p>{problem&&<p className="chat-error">{problem}</p>}<button className="btn btn-red" onClick={login}>Sign in securely <ArrowUpRight size={15}/></button></div>;
  if(user.email?.toLowerCase()!=='helloprephub@gmail.com')return <div className="dash-box admin-auth-state"><LockKeyhole size={30}/><h2>Access not authorised</h2><p className="muted">This account is not on the Tesla Markets administrator allowlist.</p><button className="btn btn-outline" onClick={()=>auth.signOut().then(()=>setUser(null))}>Sign out</button></div>;
  return <div className="admin-inbox-layout">
    <div className="admin-thread-list"><div className="admin-inbox-heading"><div><b>Customer enquiries</b><small>{threads.length} conversations</small></div><button className="icon-btn" onClick={()=>void loadThreads()}><RefreshCw size={16}/></button></div>
      {threads.length===0?<div className="empty-state"><MessageCircle/><b>No enquiries yet</b><span>New visitor messages will appear here.</span></div>:threads.map(t=><button key={t.id} className={'admin-thread '+(selected===t.id?'selected':'')} onClick={()=>setSelected(t.id)}><b>{t.visitorName||'Website visitor'}</b><small>{t.visitorEmail||'Visitor'}</small><span>{t.lastMessage||'New enquiry'}</span></button>)}
    </div>
    <div className="admin-conversation"><div className="admin-conversation-head"><b>{selected?(threads.find(t=>t.id===selected)?.visitorName||'Visitor conversation'):'Select an enquiry'}</b><small>Signed in as {user.email}</small></div>
      {selected?<><div className="chat-messages admin-chat-messages">{messages.map(m=><div key={m.id} className={'chat-message-row '+(m.sender==='admin'?'mine':'theirs')}><div className={'chat-bubble '+(m.sender==='admin'?'you':'team')}>{m.text&&<p>{m.text}</p>}{m.attachmentUrl&&<a href={m.attachmentUrl} target="_blank" rel="noreferrer"><img className="chat-attachment" src={m.attachmentUrl} alt="Shared attachment"/></a>}<small>{m.sender==='admin'?'You':'Visitor'} · {new Date(m.createdAt).toLocaleString()}</small></div></div>)}<div ref={endRef}/></div><form className="chat-compose live-chat-compose" onSubmit={reply}><label className="chat-attach"><ImagePlus size={20}/><input type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={e=>setImage(e.target.files?.[0]||null)}/></label><input value={draft} onChange={e=>setDraft(e.target.value)} placeholder="Reply to this enquiry..."/><button className="btn btn-red" disabled={busy||(!draft.trim()&&!image)}>{busy?'Sending…':'Reply'} <ArrowUpRight size={15}/></button></form></>:<div className="empty-state"><MessageCircle/><span>Choose a conversation to read and reply.</span></div>}
      {image&&<p className="chat-image-preview">Image ready: {image.name} <button onClick={()=>setImage(null)}><X size={14}/></button></p>}{problem&&<p className="chat-error">{problem}</p>}
    </div>
  </div>;
}

export function GeneratedGallery() {
  const [images,setImages] = useState<{id:string;label:string;note:string;url:string}[]>([]);
  useEffect(()=>{
    let active=true;
    api.get('/api/vehicle-gallery/generated').then(r=>{if(active)setImages(r.data.images||[]);}).catch(()=>{});
    return ()=>{active=false;};
  },[]);
  if(!images.length)return null;
  return <div className="generated-gallery"><div className="eyebrow dark">AI-GENERATED CONCEPTS</div><div className="generated-gallery-grid">{images.map(img=><figure key={img.id}><img src={img.url} alt={img.label}/><figcaption>{img.label}<small>{img.note}</small></figcaption></figure>)}</div></div>;
}
