import { useEffect, useState, type FormEvent } from 'react';
import { supabase, isCurrentUserAdmin } from './lib/supabase';
import { ArrowLeft, BadgeCheck, CheckCheck, FileImage, LoaderCircle, LockKeyhole, MessageCircle, Plus, RefreshCw, Send, ShieldCheck, X } from 'lucide-react';

type Message = { id: string; sender: 'visitor'|'admin'; text: string; attachmentUrl?: string|null; createdAt: number };
type Thread = { id: string; visitorName: string; visitorEmail: string; updatedAt: number; lastMessage: string; status?: string };
const errorText = (e: unknown) => e instanceof Error ? e.message : 'Something went wrong. Please try again.';
const timeLabel = (stamp:number) => new Date(stamp).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'});
const ADMIN_EMAIL = 'oyejideoluwatobi7@gmail.com';

function ManagementAvatar({className='chat-avatar'}:{className?:string}) {
  const [profileUrl,setProfileUrl] = useState('');
  useEffect(()=>{
    let active=true;
    const load=async()=>{
      const {data,error}=await supabase.from('site_settings').select('value').eq('key','management_profile').maybeSingle();
      if(!active)return;
      if(!error && typeof data?.value?.url==='string')setProfileUrl(data.value.url);
    };
    void load();
    const channel=supabase.channel('management-profile-live')
      .on('postgres_changes',{event:'*',schema:'public',table:'site_settings',filter:'key=eq.management_profile'},payload=>{
        const next=(payload.new as {value?:{url?:string}}|undefined)?.value?.url;
        if(typeof next==='string')setProfileUrl(next);
      }).subscribe();
    return ()=>{active=false;void supabase.removeChannel(channel);};
  },[]);
  return <span className={'management-avatar '+className}>{profileUrl ? <img src={profileUrl} alt="Tesla Markets Management profile" loading="eager" decoding="async" onError={()=>setProfileUrl('')}/> : <span className="management-avatar-fallback">TM</span>}</span>;
}

async function ensureCustomerSession() {
  let { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    const { data, error } = await supabase.auth.signInAnonymously();
    if (error) throw new Error('Secure customer chat could not start. Anonymous sign-in may need to be enabled in Supabase Authentication settings. ' + error.message);
    user = data.user;
  }
  if (!user) throw new Error('Could not establish a secure customer session.');
  const { error: profileError } = await supabase.from('customer_profiles').upsert({ id:user.id, display_name:'Website visitor', is_admin:false }, { onConflict:'id', ignoreDuplicates:true });
  if (profileError) throw profileError;
  return user;
}

async function fetchMessages(conversationId:string, viewerId:string):Promise<Message[]> {
  const { data, error } = await supabase.from('support_messages').select('id,sender_id,body,attachment_path,created_at').eq('conversation_id',conversationId).order('created_at',{ascending:true});
  if (error) throw error;
  return Promise.all((data||[]).map(async row=>{
    let attachmentUrl:string|null=null;
    if(row.attachment_path){ const {data:asset}=await supabase.storage.from('support-attachments').createSignedUrl(row.attachment_path,3600); attachmentUrl=asset?.signedUrl||null; }
    return { id:row.id, sender:row.sender_id===viewerId?'visitor':'admin', text:row.body||'', attachmentUrl, createdAt:new Date(row.created_at).getTime() };
  }));
}

async function uploadAttachment(file:File,userId:string,conversationId:string) {
  if(file.size>3*1024*1024) throw new Error('Choose an image smaller than 3 MB.');
  if(!['image/jpeg','image/png','image/webp','image/gif'].includes(file.type)) throw new Error('Choose a JPG, PNG, WEBP or GIF image.');
  const ext=file.name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g,'')||'jpg';
  const path=`${userId}/${conversationId}/${Date.now()}-${crypto.randomUUID()}.${ext}`;
  const {error}=await supabase.storage.from('support-attachments').upload(path,file,{contentType:file.type,upsert:false});
  if(error) throw error;
  return path;
}

export function ChatWorkspace({ onBack }: { onBack: () => void }) {
  const [threadId,setThreadId] = useState('');
    const [messages,setMessages] = useState<Message[]>([]);
  const [draft,setDraft] = useState('');
  const [busy,setBusy] = useState(false);
  const [problem,setProblem] = useState('');
  const [image,setImage] = useState<File|null>(null);
  const [attachOpen,setAttachOpen] = useState(false);
  const [context] = useState(()=>sessionStorage.getItem('tesla-markets-chat-context') || '');
  const [booting,setBooting] = useState(true);
  const [viewerId,setViewerId] = useState('');
  useEffect(() => {
    let active=true;
    (async()=>{
      try {
        const user=await ensureCustomerSession();
        if(!active)return;
        setViewerId(user.id);
        let id=localStorage.getItem('tesla-markets-enquiry-id')||'';
        if(id){ const {data,error}=await supabase.from('support_conversations').select('id').eq('id',id).eq('customer_id',user.id).maybeSingle(); if(error)throw error; if(!data)id=''; }
        if(!id){ const {data,error}=await supabase.from('support_conversations').insert({customer_id:user.id,subject:context.slice(0,160)||'Website enquiry',status:'new'}).select('id').single(); if(error)throw error; id=data.id; localStorage.setItem('tesla-markets-enquiry-id',id); }
        if(active)setThreadId(id);
      } catch(e){if(active)setProblem(errorText(e));}
      finally{if(active)setBooting(false);}
    })();
    return()=>{active=false;};
  },[]);
  const refresh=async()=>{if(!threadId||!viewerId)return;try{setMessages(await fetchMessages(threadId,viewerId));setProblem('');}catch(e){setProblem(errorText(e));}};
  useEffect(()=>{if(!threadId)return;void refresh();const timer=window.setInterval(()=>void refresh(),4000);return()=>window.clearInterval(timer);},[threadId,viewerId]);
  const send=async(e:FormEvent)=>{
    e.preventDefault(); if((!draft.trim()&&!image)||busy||!threadId||!viewerId)return;
    setBusy(true);setProblem('');
    try{
      const attachmentPath=image?await uploadAttachment(image,viewerId,threadId):null;
      const {error}=await supabase.from('support_messages').insert({conversation_id:threadId,sender_id:viewerId,body:draft.trim(),attachment_path:attachmentPath,attachment_name:image?.name||null,attachment_mime:image?.type||null});
      if(error)throw error;
      setDraft('');setImage(null);setAttachOpen(false);await refresh();
    }catch(e){setProblem(errorText(e));}finally{setBusy(false);}
  };
  return <section className="chat-fullscreen customer-chat-screen">
    <header className="chat-appbar"><button onClick={onBack} aria-label="Back to website"><ArrowLeft size={18}/><span>Back</span></button><div className="chat-appbar-brand"><ManagementAvatar className="chat-brand-avatar"/><div><b>Tesla Markets Management <BadgeCheck className="chat-verified-badge" size={16} fill="#1685e8" color="#1685e8" aria-label="Verified management profile"/></b></div></div></header>
    <div className="chat-full-body"><div className="chat-conversation-shell"><div className="chat-conversation-heading"><div><span className="eyebrow dark">PRIVATE CUSTOMER CONVERSATION</span><h1>Message our team</h1><p>Ask a question and continue the conversation here.</p></div><span className="chat-encryption"><LockKeyhole size={14}/> Private chat</span></div>
      <div className="chat-panel live-chat-panel"><div className="chat-top chat-top-hidden" aria-hidden="true"/><div className="chat-messages live-chat-messages"><div className="chat-day-divider"><span>Conversation started</span></div><div className="chat-message-row theirs"><div className="chat-bubble team"><p>Welcome. How can our management team help you today?</p><small>Management team · Welcome</small></div></div>{context&&<div className="chat-context-card"><b>About your enquiry</b><span>{context}</span></div>}{messages.map(m=><div key={m.id} className={'chat-message-row '+(m.sender==='visitor'?'mine':'theirs')}><div className={'chat-bubble '+(m.sender==='visitor'?'you':'team')}>{m.text&&<p>{m.text}</p>}{m.attachmentUrl&&<a href={m.attachmentUrl} target="_blank" rel="noreferrer"><img className="chat-attachment" src={m.attachmentUrl} alt="Shared attachment"/></a>}<small>{m.sender==='admin'?'Management':'You'} · {timeLabel(m.createdAt)} {m.sender==='visitor'&&<CheckCheck size={12}/>}</small></div></div>)}</div>
      {image&&<div className="chat-image-preview"><FileImage size={16}/><span>{image.name}</span><button type="button" onClick={()=>setImage(null)} aria-label="Remove attachment"><X size={15}/></button></div>}{(problem||booting)&&<p className="chat-error">{problem||'Opening secure chat…'}</p>}
      <form className="chat-compose live-chat-compose" onSubmit={send}><div className="chat-attach-wrap"><button type="button" className={'chat-plus-button '+(attachOpen?'active':'')} onClick={()=>setAttachOpen(!attachOpen)} aria-label="Add attachment"><Plus size={21}/></button>{attachOpen&&<div className="chat-attach-menu"><button type="button" onClick={()=>document.getElementById('customer-chat-file')?.click()}><FileImage size={17}/> Photo or image</button><small>JPG, PNG, WEBP or GIF · up to 3 MB</small></div>}<input id="customer-chat-file" className="chat-file-input" type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={e=>{setImage(e.target.files?.[0]||null);setAttachOpen(false);}}/></div><input value={draft} onChange={e=>setDraft(e.target.value)} placeholder="Type your message…" aria-label="Write your message"/><button className="chat-send-button" disabled={busy||booting||(!draft.trim()&&!image)} aria-label="Send message">{busy?<LoaderCircle className="spin" size={18}/>:<Send size={18}/>}</button></form>
      </div></div></div>
  </section>;
}

export function AdminInbox() {
  const [user,setUser]=useState<{id:string;email?:string}|null>(null);
  const [checking,setChecking]=useState(true);
  const [threads,setThreads]=useState<Thread[]>([]);
  const [selected,setSelected]=useState('');
  const [messages,setMessages]=useState<Message[]>([]);
  const [draft,setDraft]=useState('');
  const [image,setImage]=useState<File|null>(null);
  const [busy,setBusy]=useState(false);
  const [problem,setProblem]=useState('');
  const [mobileConversation,setMobileConversation]=useState(false);
  useEffect(()=>{let active=true;isCurrentUserAdmin().then(({user:current,isAdmin})=>{if(active)setUser(current&&isAdmin?{id:current.id,email:current.email||''}:null);}).catch(e=>setProblem(errorText(e))).finally(()=>{if(active)setChecking(false);});return()=>{active=false;};},[]);
  const loadThreads=async()=>{try{const {data,error}=await supabase.from('support_conversations').select('id,customer_id,subject,status,updated_at,last_message_at').order('last_message_at',{ascending:false,nullsFirst:false});if(error)throw error;const rows=data||[];const ids=rows.map(r=>r.customer_id);const {data:profiles}=ids.length?await supabase.from('customer_profiles').select('id,display_name').in('id',ids):{data:[]};const names=new Map((profiles||[]).map(p=>[p.id,p.display_name]));const mapped=await Promise.all(rows.map(async r=>{const {data:last}=await supabase.from('support_messages').select('body,created_at').eq('conversation_id',r.id).order('created_at',{ascending:false}).limit(1).maybeSingle();return{id:r.id,visitorName:names.get(r.customer_id)||'Website visitor',visitorEmail:'',updatedAt:new Date(r.updated_at).getTime(),lastMessage:last?.body||r.subject||'Conversation opened',status:r.status};}));setThreads(mapped);setProblem('');}catch(e){setProblem(errorText(e));}};
  useEffect(()=>{if(!user)return;void loadThreads();const t=window.setInterval(()=>void loadThreads(),6000);return()=>window.clearInterval(t);},[user?.id]);
  const loadMessages=async()=>{if(!selected||!user)return;try{setMessages(await fetchMessages(selected,user.id));}catch(e){setProblem(errorText(e));}};
  useEffect(()=>{if(!selected)return;void loadMessages();const t=window.setInterval(()=>void loadMessages(),3500);return()=>window.clearInterval(t);},[selected,user?.id]);
  const reply=async(e:FormEvent)=>{e.preventDefault();if((!draft.trim()&&!image)||busy||!selected||!user)return;setBusy(true);setProblem('');try{const attachmentPath=image?await uploadAttachment(image,user.id,selected):null;const {error}=await supabase.from('support_messages').insert({conversation_id:selected,sender_id:user.id,body:draft.trim(),attachment_path:attachmentPath,attachment_name:image?.name||null,attachment_mime:image?.type||null});if(error)throw error;setDraft('');setImage(null);await loadMessages();await loadThreads();}catch(e){setProblem(errorText(e));}finally{setBusy(false);}};
  const login=async()=>{const {error}=await supabase.auth.signInWithOtp({email:ADMIN_EMAIL,options:{emailRedirectTo:window.location.origin+'/#admin'}});if(error)setProblem(error.message);else setProblem('A secure sign-in link has been sent to the authorised administrator email. Open it on this device to continue.');};
  if(checking)return <div className="admin-auth-state"><LoaderCircle className="spin"/> Checking administrator access…</div>;
  if(!user)return <div className="admin-auth-state"><ShieldCheck size={30}/><h2>Administrator sign-in</h2><p>Sign in with the authorised Tesla Markets administrator account.</p>{problem&&<p className="chat-error">{problem}</p>}<button className="btn btn-dark" onClick={login}>Sign in securely</button></div>;
  return <div className={'admin-inbox-layout '+(mobileConversation?'show-conversation':'')}><aside className="admin-thread-list"><div className="admin-inbox-heading"><div><b>Messages</b><small>{threads.length} conversations</small></div><button className="icon-btn" onClick={()=>void loadThreads()} aria-label="Refresh messages"><RefreshCw size={16}/></button></div>{threads.length===0?<div className="empty-state"><MessageCircle/><b>No conversations yet</b><span>New customer messages will appear here.</span></div>:threads.map(t=><button key={t.id} className={'admin-thread '+(selected===t.id?'selected':'')} onClick={()=>{setSelected(t.id);setMobileConversation(true);}}><span className="admin-thread-avatar">{t.visitorName.slice(0,1).toUpperCase()}</span><span className="admin-thread-copy"><b>{t.visitorName}</b><small>Website enquiry</small><span>{t.lastMessage}</span></span><time>{new Date(t.updatedAt).toLocaleDateString([], {month:'short',day:'numeric'})}</time></button>)}</aside>
  <section className="admin-conversation"><div className="admin-conversation-head"><button className="admin-mobile-back" onClick={()=>setMobileConversation(false)}><ArrowLeft size={17}/> All messages</button><span className="admin-thread-avatar">{selected?(threads.find(t=>t.id===selected)?.visitorName||'V').slice(0,1).toUpperCase():'TM'}</span><div><b>{selected?(threads.find(t=>t.id===selected)?.visitorName||'Customer'):'Select a conversation'}</b><small>{selected?'Website customer':'Customer support inbox'} · {user.email}</small></div></div>
  {selected?<><div className="chat-messages admin-chat-messages">{messages.map(m=><div key={m.id} className={'chat-message-row '+(m.sender==='admin'?'mine':'theirs')}><div className={'chat-bubble '+(m.sender==='admin'?'you':'team')}>{m.text&&<p>{m.text}</p>}{m.attachmentUrl&&<a href={m.attachmentUrl} target="_blank" rel="noreferrer"><img className="chat-attachment" src={m.attachmentUrl} alt="Shared attachment"/></a>}<small>{m.sender==='admin'?'You':'Customer'} · {timeLabel(m.createdAt)}</small></div></div>)}</div>{image&&<div className="chat-image-preview"><FileImage size={15}/><span>{image.name}</span><button type="button" onClick={()=>setImage(null)}><X size={14}/></button></div>}<form className="chat-compose admin-compose" onSubmit={reply}><button type="button" className="chat-plus-button" onClick={()=>document.getElementById('admin-chat-file')?.click()} aria-label="Attach image"><Plus size={20}/></button><input id="admin-chat-file" className="chat-file-input" type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={e=>setImage(e.target.files?.[0]||null)}/><input value={draft} onChange={e=>setDraft(e.target.value)} placeholder="Type a reply…" aria-label="Type a reply"/><button className="chat-send-button" disabled={busy||(!draft.trim()&&!image)} aria-label="Send reply">{busy?<LoaderCircle className="spin" size={18}/>:<Send size={18}/>}</button></form></>:<div className="admin-empty-conversation"><MessageCircle size={34}/><b>Your conversations</b><span>Select a customer on the left to read and reply.</span></div>}{problem&&<p className="chat-error admin-chat-error">{problem}</p>}</section></div>;
}

export function GeneratedGallery() { return null; }
