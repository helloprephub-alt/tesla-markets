import { publicText, type PublicLanguage } from './public-i18n';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { supabase, isCurrentUserAdmin } from './lib/supabase';
import { ArrowLeft, BadgeCheck, CheckCheck, FileImage, LoaderCircle, LockKeyhole, MessageCircle, Moon, Plus, RefreshCw, Send, ShieldCheck, Sun, X } from 'lucide-react';

type Message = { id: string; sender: 'visitor'|'admin'; text: string; attachmentUrl?: string|null; messageType?: string; structuredData?: any; createdAt: number };
type Thread = { id: string; visitorName: string; visitorEmail: string; enquiryType?:string; enquirySource?:string; vehicleModel?:string; phone?:string; updatedAt: number; lastMessage: string; status?: string; responderPaused?: boolean };
const errorText = (e: unknown) => e instanceof Error ? e.message : 'Something went wrong. Please try again.';
const timeLabel = (stamp:number) => new Date(stamp).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'});
const ADMIN_EMAIL = 'oyejideoluwatobi7@gmail.com';
export function ThemeToggle({className=''}:{className?:string}) {
 const [theme,setTheme]=useState<'light'|'dark'>(()=>{try{return localStorage.getItem('tesla-markets-theme')==='dark'?'dark':'light';}catch{return 'light';}});
 useEffect(()=>{const sync=()=>{let next:'light'|'dark'='light';try{next=localStorage.getItem('tesla-markets-theme')==='dark'?'dark':'light';}catch{}document.documentElement.dataset.theme=next;setTheme(next);};sync();window.addEventListener('tesla-theme-change',sync);return()=>window.removeEventListener('tesla-theme-change',sync);},[]);
 const toggle=()=>{const next=theme==='dark'?'light':'dark';try{localStorage.setItem('tesla-markets-theme',next);localStorage.setItem('tesla-admin-theme',next);}catch{}document.documentElement.dataset.theme=next;setTheme(next);window.dispatchEvent(new Event('tesla-theme-change'));};
 return <button type="button" className={'theme-toggle-button '+className} onClick={toggle} aria-label={theme==='dark'?'Switch to light mode':'Switch to dark mode'} title={theme==='dark'?'Light mode':'Dark mode'}>{theme==='dark'?<Sun size={17}/>:<Moon size={17}/>}<span>{theme==='dark'?'Light':'Dark'}</span></button>;
}


function ManagementAvatar({className='chat-avatar'}:{className?:string}) {
  const [profileUrl,setProfileUrl] = useState('');
  const [fallbackFailed,setFallbackFailed] = useState(false);
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
  return <span className={'management-avatar '+className}>{profileUrl || !fallbackFailed ? <img src={profileUrl || '/resources/tesla-management-profile'} alt="Tesla Markets Management profile" loading="eager" decoding="async" onError={()=>{if(profileUrl)setProfileUrl('');else setFallbackFailed(true);}}/> : <span className="management-avatar-fallback">TM</span>}</span>;
}

async function ensureCustomerSession(details?:{name:string;email:string;phone:string}) {
  let { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    const { data, error } = await supabase.auth.signInAnonymously();
    if (error) throw new Error('Secure customer chat could not start. Anonymous sign-in may need to be enabled in Supabase Authentication settings. ' + error.message);
    user = data.user;
  }
  if (!user) throw new Error('Could not establish a secure customer session.');
  // Never let an authenticated management account become the owner of a public customer conversation.
  // This prevents management replies sent from the public chat route being stored as customer messages.
  const { data: currentProfile, error: roleError } = await supabase.from('customer_profiles').select('is_admin').eq('id',user.id).maybeSingle();
  if (roleError) throw roleError;
  if (currentProfile?.is_admin) throw new Error('You are signed in with the management account. Sign out of management or open the public website in a private browser window to test customer chat.');
  const { error: profileError } = await supabase.from('customer_profiles').upsert({ id:user.id, display_name:details?.name||'Website visitor', email:details?.email||null, phone:details?.phone||null, is_admin:false }, { onConflict:'id' });
  if (profileError) throw profileError;
  return user;
}

async function fetchMessages(conversationId:string, viewerId:string):Promise<Message[]> {
  const { data, error } = await supabase.from('support_messages').select('id,sender_id,sender_role,body,attachment_path,created_at,message_type,structured_data').eq('conversation_id',conversationId).order('created_at',{ascending:true});
  if (error) throw error;
  return Promise.all((data||[]).map(async row=>{
    let attachmentUrl:string|null=null;
    if(row.attachment_path){ const {data:asset}=await supabase.storage.from('support-attachments').createSignedUrl(row.attachment_path,3600); attachmentUrl=asset?.signedUrl||null; }
    return { id:row.id, sender:row.sender_role==='management'?'admin':'visitor', text:row.body||'', attachmentUrl, messageType:row.message_type||'text', structuredData:row.structured_data||null, createdAt:new Date(row.created_at).getTime() };
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


function RichMessageCard({type,data,onAddToCart,onBuyNow}:{type?:string;data?:any;onAddToCart?:()=>void;onBuyNow?:()=>void}) {
  if(!type || type==='text' || !data || typeof data!=='object') return null;
  const rows=(value:any)=>Array.isArray(value)?value.filter((x:any)=>x&&typeof x.label==='string'&&x.value!==undefined):[];
  const title=String(data.title|| (type==='vehicle_card'?'Vehicle information':type==='investment_summary'?'Investment enquiry summary':type==='customer_details'?'Customer information':'Tesla Markets information'));
  const metrics=rows(data.metrics), fields=rows(data.fields);
  const sections=Array.isArray(data.sections)?data.sections.filter((x:any)=>x&&typeof x.title==='string'):[];
  return <article className={'tm-rich-card tm-rich-card-'+type}>
    <div className="tm-rich-card-top"><span className="tm-rich-card-brand">TESLA MARKETS</span>{data.status&&<span className={'tm-rich-card-status '+(String(data.status).toLowerCase().includes('pending')?'pending':'')}>{String(data.status).toUpperCase()}</span>}</div>
    {data.image_url&&<img className="tm-rich-card-image" src={String(data.image_url)} alt={title} loading="lazy"/>}
    <div className="tm-rich-card-heading"><h3>{title}</h3>{data.subtitle&&<p>{String(data.subtitle)}</p>}</div>
    {data.amount&&<div className="tm-rich-card-amount"><span>{String(data.amount_label||'AMOUNT')}</span><strong>{String(data.amount)}</strong></div>}
    {metrics.length>0&&<div className="tm-rich-card-metrics">{metrics.map((item:any,i:number)=><div className="tm-rich-card-metric" key={i}><strong>{String(item.value)}</strong><span>{String(item.label)}</span></div>)}</div>}
    {fields.length>0&&<section className="tm-rich-card-section"><h4>{String(data.fields_title||'Customer information')}</h4><dl>{fields.map((item:any,i:number)=><div key={i}><dt>{String(item.label)}</dt><dd>{String(item.value)}</dd></div>)}</dl></section>}
    {sections.map((section:any,i:number)=><section className="tm-rich-card-section" key={i}><h4>{section.title}</h4><dl>{rows(section.rows).map((item:any,j:number)=><div key={j}><dt>{String(item.label)}</dt><dd>{String(item.value)}</dd></div>)}</dl></section>)}
    {(type==='vehicle_card'||type==='vehicle_purchase_prompt')&&onBuyNow&&<button type="button" className="tm-buy-now-button" onClick={onBuyNow}>{type==='vehicle_purchase_prompt'?'Continue purchase':'Start purchase'}</button>}{type==='vehicle_card'&&onAddToCart&&<button type="button" className="tm-add-cart-button" onClick={onAddToCart}>Add to cart</button>}
    {data.note&&<p className="tm-rich-card-note">{String(data.note)}</p>}
    {type==='payment_card'&&typeof data.payment_url==='string'&&/^https:\/\//i.test(data.payment_url)&&<a className="tm-buy-now-button" href={data.payment_url} target="_blank" rel="noopener noreferrer">Pay securely</a>}{data.disclaimer&&<p className="tm-rich-card-disclaimer">{String(data.disclaimer)}</p>}
  </article>;
}

export function ChatWorkspace({ onBack, language = 'en' }: { onBack: () => void; language?: PublicLanguage }) {
  const tr = (value: string) => publicText(value, language);
  const [threadId,setThreadId] = useState('');
    const [messages,setMessages] = useState<Message[]>([]);
  const [draft,setDraft] = useState('');
  const [busy,setBusy] = useState(false);
  const [isTyping,setIsTyping] = useState(false);
  const [problem,setProblem] = useState('');
  const [images,setImages] = useState<File[]>([]);
  const [attachOpen,setAttachOpen] = useState(false);
  const [context] = useState(()=>{try{return JSON.parse(sessionStorage.getItem('tesla-markets-enquiry-intent')||'null')?.context||sessionStorage.getItem('tesla-markets-chat-context')||'';}catch{return sessionStorage.getItem('tesla-markets-chat-context')||'';}});
  const [intent] = useState<any>(()=>{try{return JSON.parse(sessionStorage.getItem('tesla-markets-enquiry-intent')||'null');}catch{return null;}});
  const [customerDetails,setCustomerDetails] = useState<{name:string;email:string;phone:string}>(()=>{try{return JSON.parse(localStorage.getItem('tesla-markets-customer-details')||'null')||JSON.parse(sessionStorage.getItem('tesla-markets-customer-details')||'null')||{name:'',email:'',phone:''};}catch{return {name:'',email:'',phone:''};}});
  const [enquiryKind,setEnquiryKind] = useState('Buying');
  const [booting,setBooting] = useState(true);
  const [viewerId,setViewerId] = useState('');
  const messagesRef = useRef<HTMLDivElement|null>(null);
  const nearBottomRef = useRef(true);
  const lastMessageIdRef = useRef('');
  useEffect(() => {
    let active=true;
    (async()=>{
    
  if(intent && (!customerDetails.name || !customerDetails.email)){setBooting(false);return;}
      try {
        const user=await ensureCustomerSession(customerDetails.name?customerDetails:undefined);
        if(!active)return;
        setViewerId(user.id);
        let id=localStorage.getItem('tesla-markets-enquiry-id')||'';
        if(id){ const {data,error}=await supabase.from('support_conversations').select('id').eq('id',id).eq('customer_id',user.id).maybeSingle(); if(error)throw error; if(!data)id=''; }
        if(intent && customerDetails.name){id='';localStorage.removeItem('tesla-markets-enquiry-id');}
        if(!id){ const {data,error}=await supabase.from('support_conversations').insert({customer_id:user.id,subject:context.slice(0,160)||'Website enquiry',status:'open',visitor_email:customerDetails.email||null,contact_phone:customerDetails.phone||null,enquiry_type:intent?.type==='vehicle'?enquiryKind:(intent?.type||'general'),enquiry_source:intent?.source||'Website chat',vehicle_model:intent?.vehicleModel||null}).select('id').single(); if(error)throw error; id=data.id; localStorage.setItem('tesla-markets-enquiry-id',id); }
        if(intent)sessionStorage.removeItem('tesla-markets-enquiry-intent');
        if(active)setThreadId(id);
      } catch(e){if(active)setProblem(errorText(e));}
      finally{if(active)setBooting(false);}
    })();
    return()=>{active=false;};
  },[intent,customerDetails.name,customerDetails.email,customerDetails.phone]);
  const refresh=async()=>{if(!threadId||!viewerId)return;try{setMessages(await fetchMessages(threadId,viewerId));setProblem('');}catch(e){setProblem(errorText(e));}};
  useEffect(()=>{if(!threadId)return;void refresh();const timer=window.setInterval(()=>void refresh(),4000);return()=>window.clearInterval(timer);},[threadId,viewerId]);
  useEffect(()=>{const latest=messages[messages.length-1]?.id||'';if(latest && latest!==lastMessageIdRef.current && nearBottomRef.current){messagesRef.current?.scrollTo({top:messagesRef.current.scrollHeight,behavior:'smooth'});}lastMessageIdRef.current=latest;},[messages]);
  const runIndependentResponder=async(messageId:string,messageText:string)=>{
    setIsTyping(true);
    const started=Date.now();
    try{
      const {error}=await supabase.functions.invoke('tesla-markets-ai-responder',{body:{conversation_id:threadId,message_id:messageId}});
      if(error)console.error('Tesla Markets independent responder invocation failed',error);
    }finally{
      const minimum=Math.min(3400,Math.max(1750,950+messageText.length*16));
      const remaining=Math.max(0,minimum-(Date.now()-started));
      if(remaining)await new Promise(resolve=>window.setTimeout(resolve,remaining));
      await refresh();
      setIsTyping(false);
    }
  };
  const sendQuickMessage=async(messageText:string)=>{
    if(busy||!threadId||!viewerId)return;
    setBusy(true);setProblem('');
    try{
      const {data:insertedMessage,error}=await supabase.from('support_messages').insert({conversation_id:threadId,sender_id:viewerId,sender_role:'customer',body:messageText}).select('id').single();
      if(error)throw error;
      await runIndependentResponder(insertedMessage.id,messageText);
    }catch(e){setProblem(errorText(e));}finally{setBusy(false);}
  };
  const send=async(e:FormEvent)=>{
    e.preventDefault(); if((!draft.trim()&&!images.length)||busy||!threadId||!viewerId)return;
    setBusy(true);setProblem('');
    try{
      if(images.length){
        const uploaded=await Promise.all(images.map(file=>uploadAttachment(file,viewerId,threadId)));
        const rows=uploaded.map((attachmentPath,index)=>({conversation_id:threadId,sender_id:viewerId,sender_role:'customer',body:index===0?draft.trim():'',attachment_path:attachmentPath,attachment_name:images[index].name,attachment_mime:images[index].type}));
        const {data:insertedRows,error}=await supabase.from('support_messages').insert(rows).select('id,body');
        if(error)throw error;
        const textMessage=insertedRows?.find(row=>typeof row.body==='string'&&row.body.trim());
        if(textMessage){await runIndependentResponder(textMessage.id,draft.trim());}
      }else{
        const {data:insertedMessage,error}=await supabase.from('support_messages').insert({conversation_id:threadId,sender_id:viewerId,sender_role:'customer',body:draft.trim()}).select('id').single();
        if(error)throw error;
        await runIndependentResponder(insertedMessage.id,draft.trim());
      }
      setDraft('');setImages([]);setAttachOpen(false);if(!isTyping)await refresh();
    }catch(e){setProblem(errorText(e));}finally{setBusy(false);}
  };
  if(intent && (!customerDetails.name || !customerDetails.email)) return <section className="tm-enquiry-gate"><div className="tm-enquiry-card"><div className="tm-enquiry-mark">TM</div><span className="tm-enquiry-eyebrow">TESLA MARKETS · MANAGEMENT</span><h1>{tr("Let’s get you to the right conversation.")}</h1><p>{tr("Share your contact details so our team can identify your enquiry and respond with the right context.")}</p><form onSubmit={(e)=>{e.preventDefault();const form=e.currentTarget;const data=new FormData(form);const next={name:String(data.get('name')||'').trim(),email:String(data.get('email')||'').trim(),phone:String(data.get('phone')||'').trim()};if(!next.name||!next.email)return;localStorage.setItem('tesla-markets-customer-details',JSON.stringify(next));sessionStorage.setItem('tesla-markets-customer-details',JSON.stringify(next));sessionStorage.setItem('tesla-markets-chat-context',context);setCustomerDetails(next);setBooting(true);}}><label>{tr("Full name")}<input name="name" autoComplete="name" defaultValue={customerDetails.name} required placeholder={tr("Full name")}/></label><label>{tr("Email address")}<input name="email" type="email" autoComplete="email" defaultValue={customerDetails.email} required placeholder="you@example.com"/></label><label>{tr('Phone number')} <span>{tr("(optional)")}</span><input name="phone" type="tel" inputMode="tel" autoComplete="tel" defaultValue={customerDetails.phone} placeholder="e.g. +1 555 123 4567"/></label>{intent.type==='vehicle'&&<label>{tr("What would you like to know?")}<select value={enquiryKind} onChange={e=>setEnquiryKind(e.target.value)}><option>{tr("Buying")}</option><option>{tr("Pricing")}</option><option>{tr("Availability")}</option><option>{tr("Other")}</option></select></label>}<button className="tm-enquiry-submit" type="submit">{tr('Continue to management chat')} <ArrowLeft size={17}/></button></form><button className="tm-enquiry-back" type="button" onClick={onBack}><ArrowLeft size={15}/ > {tr('Back to website')}</button><small className="tm-enquiry-privacy">{tr("Your details are saved on this device so you do not need to enter them again for future enquiries here.")}</small></div></section>;
  return <section className="chat-fullscreen customer-chat-screen">
    <header className="chat-appbar"><button onClick={onBack} aria-label={tr("Back to website")}><ArrowLeft size={18}/><span>{tr("Back")}</span></button><div className="chat-appbar-brand"><ManagementAvatar className="chat-brand-avatar"/><div><b>Tesla Markets Management <BadgeCheck className="chat-verified-badge" size={16} fill="#1685e8" color="#1685e8" aria-label="Verified management profile"/></b></div></div><ThemeToggle className="chat-theme-toggle"/></header>
    <div className="chat-full-body"><div className="chat-conversation-shell">
      <div className="chat-panel live-chat-panel"><div ref={messagesRef} onScroll={e=>{const el=e.currentTarget;nearBottomRef.current=el.scrollHeight-el.scrollTop-el.clientHeight<90;}} className="chat-messages live-chat-messages"><div className="chat-day-divider"><span>{tr("Conversation started")}</span></div>{context&&<div className="chat-context-card"><b>{tr("About your enquiry")}</b><span>{context}</span></div>}{messages.map(m=><div key={m.id} className={'chat-message-row '+(m.sender==='visitor'?'mine':'theirs')}><div className={'chat-bubble '+(m.sender==='visitor'?'you':'team')}>{m.messageType&&m.messageType!=='text'&&<RichMessageCard type={m.messageType} data={m.structuredData} onBuyNow={m.sender==='admin'&&(m.messageType==='vehicle_card'||m.messageType==='vehicle_purchase_prompt')?()=>void sendQuickMessage(m.messageType==='vehicle_purchase_prompt'?"Continue with this purchase":"I want to buy "+String(m.structuredData?.title||"this vehicle")):undefined} onAddToCart={m.sender==='admin'&&m.messageType==='vehicle_card'?()=>void sendQuickMessage("Add "+String(m.structuredData?.title||"vehicle")+" to cart"):undefined}/ >}{m.text&&(!m.messageType||m.messageType==='text'||!m.structuredData)&&<p>{m.text}</p>}{m.attachmentUrl&&<a href={m.attachmentUrl} target="_blank" rel="noreferrer"><img className="chat-attachment" src={m.attachmentUrl} alt="Shared attachment"/></a>}<small>{m.sender==='admin'?tr('Tesla Markets Management'):tr('You')} · {timeLabel(m.createdAt)} {m.sender==='visitor'&&<CheckCheck size={12}/>}</small></div></div>)}</div>{isTyping&&<><style>{`@keyframes tmTypingBounce{0%,60%,100%{transform:translateY(0);opacity:.45}30%{transform:translateY(-4px);opacity:1}}.tm-typing-bubble{display:flex;align-items:center;gap:5px;padding:13px 16px;min-width:64px}.tm-typing-bubble i{display:block;width:7px;height:7px;border-radius:50%;background:#87919b;animation:tmTypingBounce 1.05s infinite}.tm-typing-bubble i:nth-child(2){animation-delay:.15s}.tm-typing-bubble i:nth-child(3){animation-delay:.3s}`}</style><div className="chat-message-row theirs"><div className="chat-bubble team tm-typing-bubble" aria-label="Tesla Markets is typing"><i/><i/><i/></div></div></>}
      {images.length>0&&<div className="chat-image-previews" aria-label={images.length+' images selected'}><div className="chat-image-preview-heading">{images.length} {tr(images.length===1?'image selected':'images selected')}</div><div className="chat-image-preview-list">{images.map((file,index)=><div className="chat-image-preview-item" key={file.name+'-'+file.size+'-'+file.lastModified}><FileImage size={13}/><span>{file.name}</span><button type="button" onClick={()=>setImages(current=>current.filter((_,i)=>i!==index))} aria-label={'Remove '+file.name}><X size={13}/></button></div>)}</div></div>}{(problem||booting)&&<p className="chat-error" role="status">{problem||tr('Opening secure chat…')}</p>}
      <form className="chat-compose live-chat-compose" onSubmit={send}><div className="chat-attach-wrap"><button type="button" className={'chat-plus-button '+(attachOpen?'active':'')} onClick={()=>setAttachOpen(!attachOpen)} aria-label={tr('Add attachments')}><Plus size={19}/></button>{attachOpen&&<div className="chat-attach-menu"><button type="button" onClick={()=>document.getElementById('customer-chat-file')?.click()}><FileImage size={17}/> {tr('Choose images')}</button><small>{tr("Select multiple JPG, PNG, WEBP or GIF images. Each image can be up to 3 MB.")}</small></div>}<input id="customer-chat-file" className="chat-file-input" type="file" multiple accept="image/png,image/jpeg,image/webp,image/gif" onChange={e=>{const selected=Array.from(e.target.files||[]);setImages(current=>[...current,...selected.filter(file=>!current.some(existing=>existing.name===file.name&&existing.size===file.size&&existing.lastModified===file.lastModified))]);setAttachOpen(false);e.currentTarget.value='';}}/></div><textarea value={draft} rows={1} onChange={e=>setDraft(e.target.value)} placeholder={tr("Type a message…")} aria-label={tr('Write your message')} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();e.currentTarget.form?.requestSubmit();}}}/><button className="chat-send-button" disabled={busy||booting||(!draft.trim()&&!images.length)} aria-label="Send message">{busy?<LoaderCircle className="spin" size={18}/>:<Send size={17}/>}</button></form>
      </div></div></div>
  </section>;
}

export function AdminInbox() {
  const [user,setUser]=useState<{id:string;email?:string}|null>(null);
  const [checking,setChecking]=useState(true);
  const [threads,setThreads]=useState<Thread[]>([]);
  const [selected,setSelected]=useState(()=>new URLSearchParams(window.location.hash.split('?')[1]||'').get('conversation')||'');
  const [messages,setMessages]=useState<Message[]>([]);
  const [draft,setDraft]=useState('');
  const [images,setImages]=useState<File[]>([]);
  const [busy,setBusy]=useState(false);
  const [problem,setProblem]=useState('');
  const [mobileConversation,setMobileConversation]=useState(false);
  const [pauseBusy,setPauseBusy]=useState(false);
  const [cardMode,setCardMode]=useState(false);
  const [cardTitle,setCardTitle]=useState('');
  const [cardSubtitle,setCardSubtitle]=useState('');
  const [cardRows,setCardRows]=useState('');
  useEffect(()=>{let active=true;isCurrentUserAdmin().then(({user:current,isAdmin})=>{if(active)setUser(current&&isAdmin?{id:current.id,email:current.email||''}:null);}).catch(e=>setProblem(errorText(e))).finally(()=>{if(active)setChecking(false);});return()=>{active=false;};},[]);
  const loadThreads=async()=>{try{const {data,error}=await supabase.from('support_conversations').select('id,customer_id,subject,status,updated_at,last_message_at,visitor_email,enquiry_type,enquiry_source,vehicle_model,contact_phone,responder_paused').order('last_message_at',{ascending:false,nullsFirst:false});if(error)throw error;const rows=data||[];const ids=rows.map(r=>r.customer_id);const {data:profiles}=ids.length?await supabase.from('customer_profiles').select('id,display_name,email,phone').in('id',ids):{data:[]};const names=new Map((profiles||[]).map(p=>[p.id,p]));const mapped=await Promise.all(rows.map(async r=>{const {data:last}=await supabase.from('support_messages').select('body,sender_role,created_at').eq('conversation_id',r.id).order('created_at',{ascending:false}).limit(1).maybeSingle();const profile=names.get(r.customer_id);return{id:r.id,visitorName:profile?.display_name||'Website visitor',visitorEmail:r.visitor_email||profile?.email||'',phone:r.contact_phone||profile?.phone||'',enquiryType:r.enquiry_type||'general',enquirySource:r.enquiry_source||'Website chat',vehicleModel:r.vehicle_model||'',updatedAt:new Date(r.updated_at).getTime(),lastMessage:(last?.sender_role==='management'?'Tesla Markets Management: ':'Customer: ')+(last?.body||r.subject||'Conversation opened'),status:r.status,responderPaused:r.responder_paused===true};}));setThreads(mapped);const requestedConversation=new URLSearchParams(window.location.hash.split('?')[1]||'').get('conversation');if(requestedConversation&&mapped.some(thread=>thread.id===requestedConversation)){setSelected(requestedConversation);setMobileConversation(true);}setProblem('');}catch(e){setProblem(errorText(e));}};
  useEffect(()=>{if(!user)return;void loadThreads();const t=window.setInterval(()=>void loadThreads(),6000);return()=>window.clearInterval(t);},[user?.id]);
  const loadMessages=async()=>{if(!selected||!user)return;try{setMessages(await fetchMessages(selected,user.id));}catch(e){setProblem(errorText(e));}};
  useEffect(()=>{if(!selected)return;void loadMessages();const t=window.setInterval(()=>void loadMessages(),3500);return()=>window.clearInterval(t);},[selected,user?.id]);
  const reply=async(e:FormEvent)=>{e.preventDefault();if((!draft.trim()&&!images.length)||busy||!selected||!user)return;setBusy(true);setProblem('');try{const uploaded=await Promise.all(images.map(file=>uploadAttachment(file,user.id,selected)));const rows=images.length?images.map((file,index)=>({conversation_id:selected,sender_id:user.id,sender_role:'management',body:index===0?draft.trim():'',attachment_path:uploaded[index],attachment_name:file.name,attachment_mime:file.type})): [{conversation_id:selected,sender_id:user.id,sender_role:'management',body:draft.trim()}];const {error}=await supabase.from('support_messages').insert(rows);if(error){if((error as any).code==='PGRST116'||/duplicate_management_reply_blocked/i.test(error.message||'')){setProblem('This message was blocked because the same message has already been sent to a customer. Please write a new, specific reply.');return;}throw error;}const {error:pauseError}=await supabase.from('support_conversations').update({responder_paused:true,updated_at:new Date().toISOString()}).eq('id',selected);if(pauseError)throw pauseError;setDraft('');setImages([]);await loadMessages();await loadThreads();}catch(e){setProblem(errorText(e));}finally{setBusy(false);}};
  const sendFormattedCard=async()=>{
    if(!selected||!user||busy||!cardTitle.trim())return;
    const rows=cardRows.split('\\n').map(line=>line.split('|')).filter(parts=>parts.length>=2&&parts[0].trim()&&parts.slice(1).join('|').trim()).map(parts=>({label:parts[0].trim().slice(0,80),value:parts.slice(1).join('|').trim().slice(0,400)}));
    if(!rows.length){setProblem('Add at least one row using Label | Value.');return;}
    setBusy(true);setProblem('');
    try{
      const {error}=await supabase.from('support_messages').insert({
        conversation_id:selected,sender_id:user.id,sender_role:'management',
        body:cardTitle.trim(),message_type:'management_card',
        structured_data:{title:cardTitle.trim(),subtitle:cardSubtitle.trim(),fields_title:'Information',fields:rows,disclaimer:'Information supplied by Tesla Markets Management. Please contact management to confirm current details.'},
        attachment_path:null,attachment_name:null,attachment_mime:null
      });
      if(error)throw error;
      const {error:pauseError}=await supabase.from('support_conversations').update({responder_paused:true,updated_at:new Date().toISOString()}).eq('id',selected);
      if(pauseError)throw pauseError;
      setCardTitle('');setCardSubtitle('');setCardRows('');setCardMode(false);await loadMessages();await loadThreads();
    }catch(e){setProblem(errorText(e));}finally{setBusy(false);}
  };
  const toggleResponder=async()=>{if(!selected||!user||pauseBusy)return;const thread=threads.find(item=>item.id===selected);const next=!(thread?.responderPaused??false);setPauseBusy(true);setProblem('');try{const {error}=await supabase.from('support_conversations').update({responder_paused:next,updated_at:new Date().toISOString()}).eq('id',selected);if(error)throw error;await loadThreads();}catch(e){setProblem(errorText(e));}finally{setPauseBusy(false);}};
  const login=async()=>{const {error}=await supabase.auth.signInWithOtp({email:ADMIN_EMAIL,options:{emailRedirectTo:window.location.origin+'/#admin'}});if(error)setProblem(error.message);else setProblem('A secure sign-in link has been sent to the authorised administrator email. Open it on this device to continue.');};
  if(checking)return <div className="admin-auth-state"><LoaderCircle className="spin"/> Checking administrator access…</div>;
  if(!user)return <div className="admin-auth-state"><ShieldCheck size={30}/><h2>Administrator sign-in</h2><p>Sign in with the authorised Tesla Markets administrator account.</p>{problem&&<p className="chat-error">{problem}</p>}<button className="btn btn-dark" onClick={login}>Sign in securely</button></div>;
  return <div className={'admin-inbox-layout '+(mobileConversation?'show-conversation':'')}><aside className="admin-thread-list"><div className="admin-inbox-heading"><div><b>Messages</b><small>{threads.length} conversations</small></div><button className="icon-btn" onClick={()=>void loadThreads()} aria-label="Refresh messages"><RefreshCw size={16}/></button></div>{threads.length===0?<div className="empty-state"><MessageCircle/><b>No conversations yet</b><span>New customer messages will appear here.</span></div>:threads.map(t=><button key={t.id} className={'admin-thread '+(selected===t.id?'selected':'')} onClick={()=>{setSelected(t.id);setMobileConversation(true);}}><span className="admin-thread-avatar">{t.visitorName.slice(0,1).toUpperCase()}</span><span className="admin-thread-copy"><b>{t.visitorName}</b><small>{t.enquiryType==='vehicle'?'Vehicle enquiry':t.enquiryType==='investment'?'Investment enquiry':t.enquiryType||'Website enquiry'}{t.vehicleModel?' · '+t.vehicleModel:''}{t.enquirySource?' · '+t.enquirySource:''}</small><span>{t.lastMessage}</span></span><time>{new Date(t.updatedAt).toLocaleDateString([], {month:'short',day:'numeric'})}</time></button>)}</aside>
  <section className="admin-conversation"><div className="admin-conversation-head"><button className="admin-mobile-back" onClick={()=>setMobileConversation(false)}><ArrowLeft size={17}/> All messages</button><span className="admin-thread-avatar">{selected?(threads.find(t=>t.id===selected)?.visitorName||'V').slice(0,1).toUpperCase():'TM'}</span><div><b>{selected?(threads.find(t=>t.id===selected)?.visitorName||'Customer'):'Select a conversation'}</b><small>{selected?[threads.find(t=>t.id===selected)?.visitorEmail,threads.find(t=>t.id===selected)?.phone,threads.find(t=>t.id===selected)?.enquiryType,threads.find(t=>t.id===selected)?.vehicleModel].filter(Boolean).join(' · '):'Customer support inbox'} · {user.email}</small></div>{selected&&<button type="button" className={'btn '+(threads.find(t=>t.id===selected)?.responderPaused?'btn-outline':'btn-dark')} onClick={toggleResponder} disabled={pauseBusy} aria-pressed={!(threads.find(t=>t.id===selected)?.responderPaused??false)}>{pauseBusy?'Updating…':threads.find(t=>t.id===selected)?.responderPaused?'AI OFF · Resume AI':'AI ON · Pause AI'}</button>}</div>
  {selected?<><div className="chat-messages admin-chat-messages">{messages.map(m=><div key={m.id} className={'chat-message-row '+(m.sender==='admin'?'mine':'theirs')}><div className={'chat-bubble '+(m.sender==='admin'?'you':'team')}>{m.text&&<p>{m.text}</p>}{m.attachmentUrl&&<a href={m.attachmentUrl} target="_blank" rel="noreferrer"><img className="chat-attachment" src={m.attachmentUrl} alt="Shared attachment"/></a>}<small>{m.sender==='admin'?'Tesla Markets Management':'Customer'} · {timeLabel(m.createdAt)}</small></div></div>)}</div>{cardMode&&<div className="tm-card-composer"><b>Send a formatted information card</b><input value={cardTitle} onChange={e=>setCardTitle(e.target.value)} placeholder="Card title, e.g. Vehicle specification"/><input value={cardSubtitle} onChange={e=>setCardSubtitle(e.target.value)} placeholder="Section subtitle (optional)"/><textarea rows={4} value={cardRows} onChange={e=>setCardRows(e.target.value)} placeholder={"One item per line: Label | Value\\nTop speed | 130 mph\\nRange | 320 miles"}/><div><button type="button" onClick={()=>setCardMode(false)}>Cancel</button><button type="button" disabled={busy||!cardTitle.trim()} onClick={()=>void sendFormattedCard()}>{busy?'Sending…':'Send card'}</button></div></div>}{images.length>0&&<div className="chat-image-previews"><div className="chat-image-preview-heading">{images.length} image{images.length===1?'':'s'} selected</div><div className="chat-image-preview-list">{images.map((file,index)=><div className="chat-image-preview-item" key={file.name+'-'+file.size+'-'+file.lastModified}><FileImage size={13}/><span>{file.name}</span><button type="button" onClick={()=>setImages(current=>current.filter((_,i)=>i!==index))} aria-label={'Remove '+file.name}><X size={13}/></button></div>)}</div></div>}<div className="tm-admin-compose-tools"><button type="button" onClick={()=>setCardMode(v=>!v)}> {cardMode?'Close card editor':'Create formatted card'} </button></div><form className="chat-compose admin-compose" onSubmit={reply}><button type="button" className="chat-plus-button" onClick={()=>document.getElementById('admin-chat-file')?.click()} aria-label="Attach images"><Plus size={20}/></button><input id="admin-chat-file" className="chat-file-input" type="file" multiple accept="image/png,image/jpeg,image/webp,image/gif" onChange={e=>{const selected=Array.from(e.target.files||[]);setImages(current=>[...current,...selected.filter(file=>!current.some(existing=>existing.name===file.name&&existing.size===file.size&&existing.lastModified===file.lastModified))]);e.currentTarget.value="";}}/><input value={draft} onChange={e=>setDraft(e.target.value)} placeholder="Type a reply…" aria-label="Type a reply"/><button className="chat-send-button" disabled={busy||(!draft.trim()&&!images.length)} aria-label="Send reply">{busy?<LoaderCircle className="spin" size={18}/>:<Send size={18}/>}</button></form></>:<div className="admin-empty-conversation"><MessageCircle size={34}/><b>Your conversations</b><span>Select a customer on the left to read and reply.</span></div>}{problem&&<p className="chat-error admin-chat-error">{problem}</p>}</section></div>;
}

export function GeneratedGallery() { return null; }
