import { publicText, type PublicLanguage } from './public-i18n';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { supabase, isCurrentUserAdmin } from './lib/supabase';
import { ArrowLeft, BadgeCheck, CheckCheck, FileImage, LoaderCircle, LockKeyhole, MessageCircle, Moon, Plus, RefreshCw, Send, ShieldCheck, Sun, X } from 'lucide-react';

type Message = { id: string; sender: 'visitor'|'admin'; text: string; attachmentUrl?: string|null; messageType?: string; structuredData?: any; createdAt: number };
type Thread = { id: string; visitorName: string; visitorEmail: string; enquiryType?:string; enquirySource?:string; vehicleModel?:string; phone?:string; updatedAt: number; lastMessage: string; status?: string; responderPaused?: boolean };
type VehicleCheckoutDraft = { title:string; slug:string; mode:'cart'|'purchase'; variants:{name:string;price:string}[]; colors:string[]; wheels:string[] };
type VehicleCheckoutForm = { fullName:string; email:string; phone:string; country:string; city:string; address:string; variant:string; color:string; wheels:string; instructions:string };
const emptyVehicleCheckoutForm:VehicleCheckoutForm={fullName:'',email:'',phone:'',country:'',city:'',address:'',variant:'',color:'',wheels:'',instructions:''};
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


function RichMessageCard({type,data,onAddToCart,onBuyNow,onSelectVariant,onChoosePaymentMethod}:{type?:string;data?:any;onAddToCart?:(data:any)=>void;onBuyNow?:(data:any)=>void;onSelectVariant?:(variant:string,data:any)=>void;onChoosePaymentMethod?:(method:string)=>void}) {
  const [selectedColor,setSelectedColor]=useState(String(data?.selected_color||""));
  const [selectedWheels,setSelectedWheels]=useState(String(data?.selected_wheels||""));
  const customization=data?.customization&&typeof data.customization==="object"?data.customization:{};
  const colorOptions=Array.isArray(customization.colors)?customization.colors.filter((value:any)=>typeof value==="string"&&value.trim()):[];
  const wheelOptions=Array.isArray(customization.wheels)?customization.wheels.filter((value:any)=>typeof value==="string"&&value.trim()):[];
  const configuredData={...data,selected_color:selectedColor||null,selected_wheels:selectedWheels||null};
  if(!type || type==='text' || !data || typeof data!=='object') return null;
  const rows=(value:any)=>Array.isArray(value)?value.filter((x:any)=>x&&typeof x.label==='string'&&x.value!==undefined):[];
  const title=String(data.title|| (type==='vehicle_card'?'Vehicle information':type==='investment_summary'?'Investment enquiry summary':type==='customer_details'?'Customer information':'Tesla Markets information'));
  const slug=String(data.vehicle_slug||(/cybertruck/i.test(title)?'cybertruck':/roadster/i.test(title)?'roadster':/semi/i.test(title)?'semi':/model\s*3/i.test(title)?'model-3':/model\s*y/i.test(title)?'model-y':''));
  const fallbackImage=slug?'/resources/'+slug+'-1.jpg':'';
  const imageUrl=typeof data.image_url==='string'&&data.image_url.trim()?data.image_url:fallbackImage;
  const galleryCounts:Record<string,number>={'model-3':5,'model-y':5,'cybertruck':10,'roadster':5,'semi':10};
  const gallery=Array.isArray(data.gallery_urls)&&data.gallery_urls.length?data.gallery_urls.filter((url:any)=>typeof url==='string'&&url.trim()):Array.from({length:galleryCounts[slug]||0},(_,index)=>'/resources/'+slug+'-'+(index+1)+'.jpg');
  const metrics=rows(data.metrics), fields=rows(data.fields);
  const sections=Array.isArray(data.sections)?data.sections.filter((x:any)=>x&&typeof x.title==='string'):[];
  return <article className={'tm-rich-card tm-rich-card-'+type}>
    <div className="tm-rich-card-top"><span className="tm-rich-card-brand">TESLA MARKETS</span>{data.status&&<span className={'tm-rich-card-status '+(String(data.status).toLowerCase().includes('pending')?'pending':'')}>{String(data.status).toUpperCase()}</span>}</div>
    {imageUrl&&<img className="tm-rich-card-image" src={imageUrl} alt={title+' vehicle'} loading="lazy" decoding="async" onError={event=>{const image=event.currentTarget;if(fallbackImage&&image.dataset.fallback!=='tried'&&image.src!==new URL(fallbackImage,window.location.origin).href){image.dataset.fallback='tried';image.src=fallbackImage;}else{image.style.display='none';}}}/>}
    {gallery.length>1&&<div className="tm-rich-card-gallery">{gallery.slice(1,4).map((url:string,index:number)=><img key={url} src={url} alt={title+' gallery '+(index+2)} loading="lazy" decoding="async" onError={event=>{event.currentTarget.style.display='none';}}/>)}</div>}
    <div className="tm-rich-card-heading"><h3>{title}</h3>{data.subtitle&&<p>{String(data.subtitle)}</p>}{data.description&&<p className="tm-rich-card-description">{String(data.description)}</p>}</div>
    {data.amount&&<div className="tm-rich-card-amount"><span>{String(data.amount_label||'AMOUNT')}</span><strong>{String(data.amount)}</strong></div>}
    {(type==='vehicle_card'||type==='vehicle_purchase_prompt')&&(colorOptions.length>0||wheelOptions.length>0)&&<section className="tm-rich-card-section tm-vehicle-customisation"><h4>Customise your vehicle</h4>{colorOptions.length>0&&<div className="tm-custom-option"><label htmlFor={'tm-color-'+slug}>Preferred exterior colour</label><select id={'tm-color-'+slug} value={selectedColor} onChange={event=>setSelectedColor(event.target.value)}><option value="">Choose a colour</option>{colorOptions.map((value:string,i:number)=><option key={i} value={value}>{value}</option>)}</select></div>}{wheelOptions.length>0&&<div className="tm-custom-option"><label htmlFor={'tm-wheel-'+slug}>Preferred wheels</label><select id={'tm-wheel-'+slug} value={selectedWheels} onChange={event=>setSelectedWheels(event.target.value)}><option value="">Choose wheels</option>{wheelOptions.map((value:string,i:number)=><option key={i} value={value}>{value}</option>)}</select></div>}<p>Preferences are subject to the selected version, market availability and management confirmation.</p></section>}
    {metrics.length>0&&<div className="tm-rich-card-metrics">{metrics.map((item:any,i:number)=><div className="tm-rich-card-metric" key={i}><strong>{String(item.value)}</strong><span>{String(item.label)}</span></div>)}</div>}
    {fields.length>0&&<section className="tm-rich-card-section"><h4>{String(data.fields_title||'Customer information')}</h4><dl>{fields.map((item:any,i:number)=><div key={i}><dt>{String(item.label)}</dt><dd>{String(item.value)}</dd></div>)}</dl></section>}
    {sections.map((section:any,i:number)=><section className="tm-rich-card-section" key={i}><h4>{section.title}</h4><dl>{rows(section.rows).map((item:any,j:number)=><div key={j}><dt>{String(item.label)}</dt><dd>{String(item.value)}</dd></div>)}</dl></section>)}
    {(type==='vehicle_purchase_prompt'||type==='vehicle_card')&&Array.isArray(data.purchase_variants)&&data.purchase_variants.length>1&&!data.selected_variant&&<section className="tm-rich-card-section"><h4>Choose your preferred version</h4><div className="tm-variant-choice-list">{data.purchase_variants.map((variant:any,i:number)=><button type="button" className="tm-variant-choice" key={variant.name||i} onClick={()=>onSelectVariant?.(String(variant.name),data)}><span><b>{String(variant.name)}</b><small>{String(variant.price||'Price to be confirmed')}</small></span><strong>Select</strong></button>)}</div></section>}{(type==='vehicle_card'||type==='vehicle_purchase_prompt')&&onBuyNow&&<button type="button" className="tm-buy-now-button" onClick={()=>onBuyNow(configuredData)}>{type==='vehicle_purchase_prompt'?'Continue purchase':'Start purchase'}</button>}{(type==='vehicle_card'||type==='vehicle_purchase_prompt')&&onAddToCart&&<button type="button" className="tm-add-cart-button" onClick={()=>onAddToCart(configuredData)}>Add to cart</button>}
    {Array.isArray(data.payment_methods)&&data.payment_methods.length>0&&<section className="tm-payment-method-grid" aria-label="Payment methods">{data.payment_methods.filter((method:any)=>['Apple Pay','Chime','Zelle','PayPal'].includes(String(method))).map((method:string)=><button type="button" key={method} onClick={()=>onChoosePaymentMethod?.(method)}><img className="tm-payment-method-logo" src={'https://cdn.simpleicons.org/'+method.toLowerCase().replace(/\s+/g,'')} alt={method+' logo'} loading="lazy" style={{width:34,height:34,objectFit:'contain'}} onError={event=>{event.currentTarget.style.display='none';const fallback=event.currentTarget.nextElementSibling as HTMLElement|null;if(fallback)fallback.style.display='grid';}}/><span className="tm-payment-method-fallback" style={{display:'none'}}>{method==='Apple Pay'?'':method==='Chime'?'C':method==='Zelle'?'Z':'P'}</span><b>{method}</b><span className="tm-payment-method-arrow">›</span></button>)}</section>}{data.note&&<p className="tm-rich-card-note">{String(data.note)}</p>}
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
  const [vehicleCheckout,setVehicleCheckout]=useState<VehicleCheckoutDraft|null>(null);
  const [vehicleCheckoutForm,setVehicleCheckoutForm]=useState<VehicleCheckoutForm>(emptyVehicleCheckoutForm);
  const [investmentCheckout,setInvestmentCheckout]=useState<{amount:string}|null>(null);
  const [checkoutSubmitting,setCheckoutSubmitting]=useState(false);
  const [paymentReviewOpen,setPaymentReviewOpen]=useState(false);
  const [paymentInvoice,setPaymentInvoice]=useState<{vehicle:string;amount:string;orderReference:string|null;kind?:'vehicle'|'investment'}|null>(null);
  const [chosenPaymentMethod,setChosenPaymentMethod]=useState('');
  const [paymentAccountDetails,setPaymentAccountDetails]=useState<Record<string,any>>({});
  const checkoutSubmitLock=useRef(false);
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
  useEffect(()=>{if(!threadId||!viewerId)return;let active=true;(async()=>{try{const [{data:conversation,error:conversationError},{data:accountRow,error:accountError}]=await Promise.all([supabase.from('support_conversations').select('delivery_details').eq('id',threadId).eq('customer_id',viewerId).maybeSingle(),supabase.from('site_settings').select('value').eq('key','payment_account_details').maybeSingle()]);if(conversationError)throw conversationError;if(accountError)throw accountError;if(!active)return;const details=conversation?.delivery_details&&typeof conversation.delivery_details==='object'?conversation.delivery_details:{};const lock=details.payment_lock;if(lock?.status==='pending'){setPaymentInvoice({vehicle:String(lock.vehicle||'Your Tesla Markets order'),amount:String(lock.amount||'Amount confirmed by management'),orderReference:null,kind:lock.kind==='investment'?'investment':'vehicle'});setChosenPaymentMethod(String(lock.method||''));}setPaymentAccountDetails(accountRow?.value&&typeof accountRow.value==='object'?accountRow.value:{});}catch(e){if(active)setProblem(errorText(e));}})();return()=>{active=false;};},[threadId,viewerId]);
  useEffect(()=>{if(!threadId)return;void refresh();const timer=window.setInterval(()=>void refresh(),4000);return()=>window.clearInterval(timer);},[threadId,viewerId]);
  useEffect(()=>{const latest=messages[messages.length-1]?.id||'';if(latest && latest!==lastMessageIdRef.current && nearBottomRef.current){messagesRef.current?.scrollTo({top:messagesRef.current.scrollHeight,behavior:'smooth'});}lastMessageIdRef.current=latest;},[messages]);
  const runIndependentResponder=async(messageId:string,messageText:string,keepPaymentNotice=false)=>{
    setIsTyping(true);
    const started=Date.now();
    try{
      const {error}=await supabase.functions.invoke('tesla-markets-ai-responder',{body:{conversation_id:threadId,message_id:messageId}});
      if(error)throw error;
    }finally{
      const minimum=Math.min(3400,Math.max(1750,950+messageText.length*16));
      const remaining=Math.max(0,minimum-(Date.now()-started));
      if(remaining)await new Promise(resolve=>window.setTimeout(resolve,remaining));
      await refresh();
      if(!keepPaymentNotice)setPaymentReviewOpen(false);
      setIsTyping(false);
    }
  };
  const sendQuickMessage=async(messageText:string,invokeResponder=true,keepPaymentNotice=false):Promise<boolean>=>{
    if(busy||!threadId||!viewerId)return false;
    setBusy(true);setProblem('');
    try{
      const {data:insertedMessage,error}=await supabase.from('support_messages').insert({conversation_id:threadId,sender_id:viewerId,sender_role:'customer',body:messageText}).select('id').single();
      if(error)throw error;
      // Payment-method selection is a management handoff, not a question for the AI.
      // Save the request in the chat, but do not invoke the responder for this message.
      if(invokeResponder)await runIndependentResponder(insertedMessage.id,messageText,keepPaymentNotice);
      else await refresh();
      return true;
    }catch(e){setProblem(errorText(e));return false;}finally{setBusy(false);}
  };
  const openVehicleCheckout=(data:any,mode:'cart'|'purchase')=>{
    const title=String(data?.title||'Selected Tesla vehicle').replace(/^Continue with\s+/i,'').trim();
    const slug=String(data?.vehicle_slug||(/cybertruck/i.test(title)?'cybertruck':/roadster/i.test(title)?'roadster':/semi/i.test(title)?'semi':/model\s*3/i.test(title)?'model-3':/model\s*y/i.test(title)?'model-y':''));
    const variants=Array.isArray(data?.purchase_variants)?data.purchase_variants.filter((item:any)=>item&&typeof item.name==='string').map((item:any)=>({name:String(item.name),price:String(item.price||'Price to be confirmed')})):[];
    const field=(label:string)=>String(data?.fields?.find((item:any)=>String(item?.label||'').toLowerCase()===label.toLowerCase())?.value||'').replace(/^Still needed$/i,'').trim();
    const savedVariant=field('Vehicle version')||String(data?.selected_variant||'');
    setVehicleCheckoutForm({
      fullName:customerDetails.name||field('Full name'),
      email:customerDetails.email||field('Email address'),
      phone:customerDetails.phone||field('Phone number'),
      country:field('Delivery country'),
      city:field('Delivery city'),
      address:field('Delivery address'),
      variant:variants.length===1?variants[0].name:(variants.some((item:any)=>item.name===savedVariant)?savedVariant:''),
      color:String(data?.selected_color||''),
      wheels:String(data?.selected_wheels||''),
      instructions:''
    });
    setProblem('');
    const customization=data?.customization&&typeof data.customization==='object'?data.customization:{};
    setVehicleCheckout({title,slug,mode,variants,colors:Array.isArray(customization.colors)?customization.colors:[],wheels:Array.isArray(customization.wheels)?customization.wheels:[]});
  };
  const submitVehicleCheckout=async(event:FormEvent)=>{
    event.preventDefault();
    if(!vehicleCheckout||checkoutSubmitLock.current||checkoutSubmitting||busy)return;
    const form=vehicleCheckoutForm;
    if(!form.fullName.trim()||!form.email.trim()||!form.phone.trim()||!form.country.trim()||!form.city.trim()||!form.address.trim()){
      setProblem('Please complete all required contact and delivery details.');
      return;
    }
    if(vehicleCheckout.variants.length>1&&!form.variant){
      setProblem('Please select your preferred vehicle version.');
      return;
    }
    checkoutSubmitLock.current=true;
    setCheckoutSubmitting(true);
    const saved={name:form.fullName.trim(),email:form.email.trim(),phone:form.phone.trim()};
    try{
      localStorage.setItem('tesla-markets-customer-details',JSON.stringify(saved));
      sessionStorage.setItem('tesla-markets-customer-details',JSON.stringify(saved));
      const message=[
        vehicleCheckout.mode==='cart'?'Add '+vehicleCheckout.title+' to my cart.':'',
        'I want to buy '+vehicleCheckout.title+'.',
        form.variant?'Vehicle version: '+form.variant:'',
        form.color?'Preferred exterior colour: '+form.color:'',
        form.wheels?'Preferred wheels: '+form.wheels:'',
        'Full name: '+form.fullName.trim(),
        'Email: '+form.email.trim(),
        'Phone: '+form.phone.trim(),
        'Country: '+form.country.trim(),
        'City: '+form.city.trim(),
        'Delivery address: '+form.address.trim(),
        form.instructions.trim()?'Instructions: '+form.instructions.trim():''
      ].filter(Boolean).join('\n');
      // Avoid a duplicate checkout enquiry if the customer double-taps or retries after a slow connection.
      const cutoff=new Date(Date.now()-5*60*1000).toISOString();
      const {data:recentDuplicates,error:duplicateError}=await supabase.from('support_messages')
        .select('id').eq('conversation_id',threadId).eq('sender_id',viewerId).eq('sender_role','customer').eq('body',message).gte('created_at',cutoff).limit(1);
      if(duplicateError)throw duplicateError;
      const sent=recentDuplicates?.length ? true : await sendQuickMessage(message);
      if(sent){
        const selectedVariant=vehicleCheckout.variants.find(item=>item.name===form.variant)||vehicleCheckout.variants[0];
        const parsed=Number(String(selectedVariant?.price||'').replace(/[^0-9.]/g,''));
        const amount=Number.isFinite(parsed)&&parsed>0?'$'+parsed.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})+' USD':'Amount to be confirmed by management';
        setPaymentInvoice({vehicle:vehicleCheckout.title,amount,orderReference:null});
        setChosenPaymentMethod('');setVehicleCheckout(null);setPaymentReviewOpen(false);
      }else{setPaymentReviewOpen(false);}
    }catch(e){setProblem(errorText(e));}
    finally{checkoutSubmitLock.current=false;setCheckoutSubmitting(false);}
  };
  const submitInvestmentCheckout=async(event:FormEvent)=>{
    event.preventDefault();
    if(!investmentCheckout||busy||checkoutSubmitting||!threadId||!viewerId)return;
    const data=new FormData(event.currentTarget as HTMLFormElement);
    const amount=String(data.get('amount')||'').replace(/,/g,'').trim();
    const fullName=String(data.get('fullName')||'').trim();
    const email=String(data.get('email')||'').trim();
    const phone=String(data.get('phone')||'').trim();
    const country=String(data.get('country')||'').trim();
    const city=String(data.get('city')||'').trim();
    const address=String(data.get('address')||'').trim();
    const numericAmount=Number(amount);
    if(!Number.isFinite(numericAmount)||numericAmount<=0||!fullName||!email||!phone||!country||!address){
      setProblem('Complete the required investment details and enter a valid USD amount.');
      return;
    }
    setCheckoutSubmitting(true);setProblem('');
    const message=[
      'I want to invest $'+numericAmount.toLocaleString('en-US')+' USD.',
      'Full name: '+fullName,'Email: '+email,'Phone: '+phone,'Country: '+country,
      city?'City: '+city:'','Address: '+address
    ].filter(Boolean).join('\n');
    try{
      const saved={name:fullName,email,phone};
      localStorage.setItem('tesla-markets-customer-details',JSON.stringify(saved));
      sessionStorage.setItem('tesla-markets-customer-details',JSON.stringify(saved));
      setCustomerDetails(saved);
      const sent=await sendQuickMessage(message);
      if(sent){
        setPaymentInvoice({vehicle:'Tesla Markets investment',amount:'$'+numericAmount.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})+' USD',orderReference:null,kind:'investment'});
        setChosenPaymentMethod('');setPaymentReviewOpen(false);setInvestmentCheckout(null);
      }
    }catch(e){setProblem(errorText(e));}
    finally{setCheckoutSubmitting(false);}
  };
  const send=async(e:FormEvent)=>{
    e.preventDefault(); if((!draft.trim()&&!images.length)||busy||!threadId||!viewerId)return;
    const investmentRequest=/\b(?:i\s+)?(?:want|would like|wish|plan|intend|interested)\s+to\s+invest\b|\bstart\s+(?:an?\s+)?investment\b|\binvest\s+\$?\s*[0-9]/i.test(draft.trim());
    if(investmentRequest&&!images.length){
      const amountMatch=draft.match(/(?:\$|usd\s*)\s*([0-9][0-9,]*(?:\.[0-9]{1,2})?)|\b([0-9][0-9,]*(?:\.[0-9]{1,2})?)\s*(?:usd|dollars?)\b/i);
      const amount=amountMatch?(amountMatch[1]||amountMatch[2]).replace(/,/g,''):'';
      setInvestmentCheckout({amount});
      setDraft('');
      setProblem('');
      return;
    }
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
      <div className="chat-panel live-chat-panel"><div ref={messagesRef} onScroll={e=>{const el=e.currentTarget;nearBottomRef.current=el.scrollHeight-el.scrollTop-el.clientHeight<90;}} className="chat-messages live-chat-messages"><div className="chat-day-divider"><span>{tr("Conversation started")}</span></div>{context&&<div className="chat-context-card"><b>{tr("About your enquiry")}</b><span>{context}</span></div>}{messages.map(m=><div key={m.id} className={'chat-message-row '+(m.sender==='visitor'?'mine':'theirs')}><div className={'chat-bubble '+(m.sender==='visitor'?'you':'team')}>{m.messageType&&m.messageType!=='text'&&<RichMessageCard type={m.messageType} data={m.structuredData} onSelectVariant={(variant,data)=>void sendQuickMessage('I want the '+variant+' version of '+String(data?.title||'this vehicle')+'. Please show me the details and next steps.')} onChoosePaymentMethod={async(method)=>{setPaymentReviewOpen(true);const sent=await sendQuickMessage('I would like to pay using '+method+' for this enquiry.',true,true);if(!sent)setPaymentReviewOpen(false);}} onBuyNow={m.sender==='admin'&&(m.messageType==='vehicle_card'||m.messageType==='vehicle_purchase_prompt')?(data)=>openVehicleCheckout(data,'purchase'):undefined} onAddToCart={m.sender==='admin'&&(m.messageType==='vehicle_card'||m.messageType==='vehicle_purchase_prompt')?(data)=>openVehicleCheckout(data,'cart'):undefined}/ >}{m.text&&(!m.messageType||m.messageType==='text'||!m.structuredData)&&<p>{m.text}</p>}{m.attachmentUrl&&<a href={m.attachmentUrl} target="_blank" rel="noreferrer"><img className="chat-attachment" src={m.attachmentUrl} alt="Shared attachment"/></a>}<small>{m.sender==='admin'?tr('Tesla Markets Management'):tr('You')} · {timeLabel(m.createdAt)} {m.sender==='visitor'&&<CheckCheck size={12}/>}</small></div></div>)}{paymentInvoice&&<div className="chat-message-row theirs"><div className="chat-bubble team"><article className="tm-rich-card tm-rich-card-payment_methods"><div className="tm-rich-card-top"><span className="tm-rich-card-brand">TESLA MARKETS</span></div><div className="tm-rich-card-heading"><h3>Available payment methods</h3><p>Select how you would like to pay for {paymentInvoice.vehicle}.</p></div><div className="tm-rich-card-amount"><span>AMOUNT DUE</span><strong>{paymentInvoice.amount}</strong></div><section className="tm-payment-method-grid" aria-label="Available payment methods">{['Apple Pay','Chime','Zelle','PayPal'].map(method=><button type="button" key={method} disabled={!!chosenPaymentMethod||busy} onClick={()=>{setChosenPaymentMethod(method);setPaymentReviewOpen(true);void sendQuickMessage('I would like to proceed using '+method+' for '+paymentInvoice.vehicle+'. Amount: '+paymentInvoice.amount+'. Please provide the verified next steps.',true,true);}}><img className="tm-payment-method-logo" src={'https://cdn.simpleicons.org/'+method.toLowerCase().replace(/\s+/g,'')} alt={method+' logo'} style={{width:40,height:40,objectFit:'contain'}} onError={event=>{event.currentTarget.style.display='none';}}/><b>{method}</b><span className="tm-payment-method-arrow">›</span></button>)}</section>{chosenPaymentMethod&&<section className="tm-payment-account-details"><h4>Payment pending · {chosenPaymentMethod}</h4>{Object.entries(paymentAccountDetails[chosenPaymentMethod]||{}).filter(([key,value])=>['accountName','email','phone','username','instructions'].includes(key)&&String(value||'').trim()).map(([key,value])=><div key={key}><span>{key==='accountName'?'Account name':key==='email'?'Account email':key==='phone'?'Account phone':key==='username'?'Account username':'Payment instructions'}</span><b>{String(value)}</b></div>)}<p>Payment remains pending until Tesla Markets Management verifies receipt. Your selected amount and method are locked for this order.</p></section>}<p className="tm-rich-card-note">{paymentInvoice.kind==='investment'?'Investment funding must follow management-approved and applicable broker procedures. Do not send money to personal payment accounts.':'Do not send money until the payment details shown here have been supplied and verified by Tesla Markets Management.'}</p></article></div></div>}{paymentReviewOpen&&<div className="chat-message-row theirs"><div className="chat-bubble team"><article className="tm-payment-checking-inline"><span className="tm-payment-checking-spinner"><LoaderCircle className="spin" size={20}/></span><div><b>Payment pending · {chosenPaymentMethod||'Selected method'}</b><p>Your selected payment method and amount are locked for this order. Tesla Markets Management will verify the payment before changing the status. Any new question will not change this pending payment.</p><button type="button" className="tm-buy-now-button" onClick={()=>setPaymentReviewOpen(false)}>OK</button></div></article></div></div>}</div>{isTyping&&<><style>{`@keyframes tmTypingBounce{0%,60%,100%{transform:translateY(0);opacity:.45}30%{transform:translateY(-4px);opacity:1}}.tm-typing-bubble{display:flex;align-items:center;gap:5px;padding:13px 16px;min-width:64px}.tm-typing-bubble i{display:block;width:7px;height:7px;border-radius:50%;background:#87919b;animation:tmTypingBounce 1.05s infinite}.tm-typing-bubble i:nth-child(2){animation-delay:.15s}.tm-typing-bubble i:nth-child(3){animation-delay:.3s}`}</style><div className="chat-message-row theirs"><div className="chat-bubble team tm-typing-bubble" aria-label="Tesla Markets is typing"><i/><i/><i/></div></div></>}
      {images.length>0&&<div className="chat-image-previews" aria-label={images.length+' images selected'}><div className="chat-image-preview-heading">{images.length} {tr(images.length===1?'image selected':'images selected')}</div><div className="chat-image-preview-list">{images.map((file,index)=><div className="chat-image-preview-item" key={file.name+'-'+file.size+'-'+file.lastModified}><FileImage size={13}/><span>{file.name}</span><button type="button" onClick={()=>setImages(current=>current.filter((_,i)=>i!==index))} aria-label={'Remove '+file.name}><X size={13}/></button></div>)}</div></div>}{(problem||booting)&&<p className="chat-error" role="status">{problem||tr('Opening secure chat…')}</p>}
      <form className="chat-compose live-chat-compose" onSubmit={send}><div className="chat-attach-wrap"><button type="button" className={'chat-plus-button '+(attachOpen?'active':'')} onClick={()=>setAttachOpen(!attachOpen)} aria-label={tr('Add attachments')}><Plus size={19}/></button>{attachOpen&&<div className="chat-attach-menu"><button type="button" onClick={()=>document.getElementById('customer-chat-file')?.click()}><FileImage size={17}/> {tr('Choose images')}</button><small>{tr("Select multiple JPG, PNG, WEBP or GIF images. Each image can be up to 3 MB.")}</small></div>}<input id="customer-chat-file" className="chat-file-input" type="file" multiple accept="image/png,image/jpeg,image/webp,image/gif" onChange={e=>{const selected=Array.from(e.target.files||[]);setImages(current=>[...current,...selected.filter(file=>!current.some(existing=>existing.name===file.name&&existing.size===file.size&&existing.lastModified===file.lastModified))]);setAttachOpen(false);e.currentTarget.value='';}}/></div><textarea value={draft} rows={1} onChange={e=>setDraft(e.target.value)} placeholder={tr("Type a message…")} aria-label={tr('Write your message')} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();e.currentTarget.form?.requestSubmit();}}}/><button className="chat-send-button" disabled={busy||booting||(!draft.trim()&&!images.length)} aria-label="Send message">{busy?<LoaderCircle className="spin" size={18}/>:<Send size={17}/>}</button></form>
      </div></div></div>
    {investmentCheckout&&<div className="tm-checkout-backdrop" role="presentation" onMouseDown={event=>{if(event.target===event.currentTarget&&!checkoutSubmitting&&!busy)setInvestmentCheckout(null);}}>
      <section className="tm-checkout-dialog" role="dialog" aria-modal="true" aria-labelledby="tm-investment-title">
        <header className="tm-checkout-head"><div><span className="tm-checkout-eyebrow">TESLA MARKETS · INVESTMENT ENQUIRY</span><h2 id="tm-investment-title">Start your investment enquiry</h2><p>Enter your details to prepare your investment summary.</p></div><button type="button" onClick={()=>setInvestmentCheckout(null)} disabled={checkoutSubmitting||busy} aria-label="Close investment form"><X size={20}/></button></header>
        <form className="tm-checkout-form" onSubmit={submitInvestmentCheckout}>
          <label>Intended investment amount (USD)<input name="amount" type="number" min="1" step="0.01" required defaultValue={investmentCheckout.amount} placeholder="3000"/></label>
          <div className="tm-checkout-section-title">Your contact details</div>
          <div className="tm-checkout-grid"><label>Full name<input name="fullName" required autoComplete="name" defaultValue={customerDetails.name} placeholder="Enter your full name"/></label><label>Email address<input name="email" type="email" required autoComplete="email" defaultValue={customerDetails.email} placeholder="you@example.com"/></label><label>Phone number<input name="phone" type="tel" required autoComplete="tel" defaultValue={customerDetails.phone} placeholder="Include country code"/></label></div>
          <div className="tm-checkout-section-title">Country and address</div>
          <div className="tm-checkout-grid tm-checkout-grid-two"><label>Country of residence<input name="country" required autoComplete="country-name" placeholder="Country"/></label><label>City <span>(optional)</span><input name="city" autoComplete="address-level2" placeholder="City"/></label></div>
          <label>Residential address<input name="address" required autoComplete="street-address" placeholder="Street and house/building number"/></label>
          <p className="tm-checkout-security-note">This submits an investment enquiry, not an investment or securities purchase. Management must confirm eligibility and the approved regulated funding process. No returns are guaranteed and no payment is taken here.</p>
          {problem&&<p className="tm-checkout-error" role="alert">{problem}</p>}
          <div className="tm-checkout-actions"><button type="button" className="tm-checkout-cancel" onClick={()=>setInvestmentCheckout(null)} disabled={checkoutSubmitting||busy}>Cancel</button><button type="submit" className="tm-checkout-submit" disabled={checkoutSubmitting||busy||booting||!threadId||!viewerId}>{checkoutSubmitting||busy?'Submitting securely…':'Review investment & continue'}</button></div>
        </form>
      </section>
    </div>}
    {vehicleCheckout&&<div className="tm-checkout-backdrop" role="presentation" onMouseDown={event=>{if(event.target===event.currentTarget&&!checkoutSubmitting&&!busy)setVehicleCheckout(null);}}>
      <section className="tm-checkout-dialog" role="dialog" aria-modal="true" aria-labelledby="tm-checkout-title">
        <header className="tm-checkout-head"><div><span className="tm-checkout-eyebrow">TESLA MARKETS · SECURE ENQUIRY</span><h2 id="tm-checkout-title">{vehicleCheckout.mode==='cart'?'Add to cart':'Start your purchase'}</h2><p>{vehicleCheckout.title}</p></div><button type="button" onClick={()=>setVehicleCheckout(null)} disabled={checkoutSubmitting||busy} aria-label="Close checkout"><X size={20}/></button></header>
        <form className="tm-checkout-form" onSubmit={submitVehicleCheckout}>
          {vehicleCheckout.variants.length>1&&<label>Preferred vehicle version<select required value={vehicleCheckoutForm.variant} onChange={event=>setVehicleCheckoutForm(current=>({...current,variant:event.target.value}))}><option value="">Select a version</option>{vehicleCheckout.variants.map(item=><option key={item.name} value={item.name}>{item.name} · {item.price}</option>)}</select></label>}
          {vehicleCheckout.colors.length>0&&<label>Preferred exterior colour <span>(subject to availability)</span><select value={vehicleCheckoutForm.color} onChange={event=>setVehicleCheckoutForm(current=>({...current,color:event.target.value}))}><option value="">Choose a colour</option>{vehicleCheckout.colors.map((value,i)=><option key={i} value={value}>{value}</option>)}</select></label>}
          {vehicleCheckout.wheels.length>0&&<label>Preferred wheels <span>(subject to availability)</span><select value={vehicleCheckoutForm.wheels} onChange={event=>setVehicleCheckoutForm(current=>({...current,wheels:event.target.value}))}><option value="">Choose wheels</option>{vehicleCheckout.wheels.map((value,i)=><option key={i} value={value}>{value}</option>)}</select></label>}
          <div className="tm-checkout-section-title">Your contact details</div>
          <div className="tm-checkout-grid"><label>Full name<input required autoComplete="name" value={vehicleCheckoutForm.fullName} onChange={event=>setVehicleCheckoutForm(current=>({...current,fullName:event.target.value}))} placeholder="Enter your full name"/></label><label>Email address<input required type="email" autoComplete="email" value={vehicleCheckoutForm.email} onChange={event=>setVehicleCheckoutForm(current=>({...current,email:event.target.value}))} placeholder="you@example.com"/></label><label>Phone number<input required type="tel" inputMode="tel" autoComplete="tel" value={vehicleCheckoutForm.phone} onChange={event=>setVehicleCheckoutForm(current=>({...current,phone:event.target.value}))} placeholder="Include country code"/></label></div>
          <div className="tm-checkout-section-title">Delivery address</div>
          <div className="tm-checkout-grid tm-checkout-grid-two"><label>Country<input required autoComplete="country-name" value={vehicleCheckoutForm.country} onChange={event=>setVehicleCheckoutForm(current=>({...current,country:event.target.value}))} placeholder="Delivery country"/></label><label>City<input required autoComplete="address-level2" value={vehicleCheckoutForm.city} onChange={event=>setVehicleCheckoutForm(current=>({...current,city:event.target.value}))} placeholder="Delivery city"/></label></div>
          <label>Full delivery address<textarea required rows={3} autoComplete="street-address" value={vehicleCheckoutForm.address} onChange={event=>setVehicleCheckoutForm(current=>({...current,address:event.target.value}))} placeholder="Street, house/building number and postal code"/></label>
          <label>Additional delivery instructions <span>(optional)</span><textarea rows={2} value={vehicleCheckoutForm.instructions} onChange={event=>setVehicleCheckoutForm(current=>({...current,instructions:event.target.value}))} placeholder="Anything management should know?"/></label>
          <p className="tm-checkout-security-note">{vehicleCheckout.mode==='purchase'?'Continue to payment submits your vehicle and delivery details, then displays the available payment methods. No payment is taken until management provides verified account details.':'Your details will be saved to your Tesla Markets enquiry and sent to management. No payment is taken here.'} Management must confirm availability, final quotation and approved payment instructions.</p>
          {problem&&<p className="tm-checkout-error" role="alert">{problem}</p>}
          <div className="tm-checkout-actions"><button type="button" className="tm-checkout-cancel" onClick={()=>setVehicleCheckout(null)} disabled={checkoutSubmitting||busy}>Cancel</button><button type="submit" className="tm-checkout-submit" disabled={checkoutSubmitting||busy||booting||!threadId||!viewerId}>{checkoutSubmitting||busy?'Submitting securely…':vehicleCheckout.mode==='cart'?'Add to cart & continue':'Continue to payment'}</button></div>
        </form>
      </section>
    </div>}
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
  const [actionDrawerOpen,setActionDrawerOpen]=useState(false);
  const [pauseBusy,setPauseBusy]=useState(false);
  const [cardMode,setCardMode]=useState(false);
  const [cardTitle,setCardTitle]=useState('');
  const [cardSubtitle,setCardSubtitle]=useState('');
  const [cardRows,setCardRows]=useState('');
  const [paymentAccountMode,setPaymentAccountMode]=useState(false);
  const [paymentAccountMethod,setPaymentAccountMethod]=useState('PayPal');
  const [paymentAccountAmount,setPaymentAccountAmount]=useState('');
  const [paymentAccountName,setPaymentAccountName]=useState('');
  const [paymentAccountDetails,setPaymentAccountDetails]=useState('');
  const [paymentAccountInstructions,setPaymentAccountInstructions]=useState('');
  const [manualVehicles,setManualVehicles]=useState<any[]>([]);
  const [manualVehicleSlug,setManualVehicleSlug]=useState('');
  useEffect(()=>{let active=true;isCurrentUserAdmin().then(({user:current,isAdmin})=>{if(active)setUser(current&&isAdmin?{id:current.id,email:current.email||''}:null);}).catch(e=>setProblem(errorText(e))).finally(()=>{if(active)setChecking(false);});return()=>{active=false;};},[]);
  useEffect(()=>{let active=true;supabase.from('vehicle_catalog').select('name,model,slug,description,price_usd,availability,images,specifications').eq('is_published',true).then(({data,error})=>{if(active){if(error)setProblem(error.message);else setManualVehicles(data||[]);}});return()=>{active=false;};},[]);
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
  const sendPaymentAccountCard=async()=>{
    if(!selected||!user||busy||!paymentAccountName.trim()||!paymentAccountDetails.trim()||!paymentAccountAmount.trim())return;
    setBusy(true);setProblem('');
    try{
      const {error}=await supabase.from('support_messages').insert({
        conversation_id:selected,sender_id:user.id,sender_role:'management',
        body:'Verified '+paymentAccountMethod+' payment details',
        message_type:'payment_account_card',
        structured_data:{
          title:paymentAccountMethod+' payment details',
          subtitle:'VERIFIED PAYMENT INSTRUCTIONS',
          amount:paymentAccountAmount.trim(),amount_label:'AMOUNT TO SEND',
          fields_title:'Payment account',
          fields:[
            {label:'Payment method',value:paymentAccountMethod},
            {label:'Account name',value:paymentAccountName.trim()},
            {label:'Account details',value:paymentAccountDetails.trim()},
            ...(paymentAccountInstructions.trim()?[{label:'Instructions',value:paymentAccountInstructions.trim()}]:[])
          ],
          status:'Awaiting payment verification',
          note:'Send only the exact amount shown. Tesla Markets Management will verify the transfer before confirming payment.'
        },
        attachment_path:null,attachment_name:null,attachment_mime:null
      });
      if(error)throw error;
      const {error:pauseError}=await supabase.from('support_conversations').update({responder_paused:true,updated_at:new Date().toISOString()}).eq('id',selected);
      if(pauseError)throw pauseError;
      setPaymentAccountAmount('');setPaymentAccountName('');setPaymentAccountDetails('');setPaymentAccountInstructions('');setPaymentAccountMode(false);
      await loadMessages();await loadThreads();
    }catch(e){setProblem(errorText(e));}finally{setBusy(false);}
  };
  const sendPaymentMethodsCard=async()=>{
    if(!selected||!user||busy)return;
    setBusy(true);setProblem('');
    try{
      const {error}=await supabase.from('support_messages').insert({
        conversation_id:selected,sender_id:user.id,sender_role:'management',
        body:'Available payment methods',message_type:'payment_methods',
        structured_data:{title:'Choose a payment method',subtitle:'SELECT A PAYMENT OPTION',payment_methods:['Apple Pay','Chime','Zelle','PayPal']},
        attachment_path:null,attachment_name:null,attachment_mime:null
      });
      if(error)throw error;
      const {error:pauseError}=await supabase.from('support_conversations').update({responder_paused:true,updated_at:new Date().toISOString()}).eq('id',selected);
      if(pauseError)throw pauseError;
      await loadMessages();await loadThreads();
    }catch(e){setProblem(errorText(e));}finally{setBusy(false);}
  };
  const sendReceiptPendingCard=async()=>{
    if(!selected||!user||busy)return;
    setBusy(true);setProblem('');
    try{
      const {error}=await supabase.from('support_messages').insert({
        conversation_id:selected,sender_id:user.id,sender_role:'management',
        body:'Payment receipt received — pending verification',
        message_type:'payment_receipt',
        structured_data:{title:'Payment receipt received',subtitle:'PENDING VERIFICATION',status:'Awaiting management verification',note:'Management will confirm once the funds have been checked.'},
        attachment_path:null,attachment_name:null,attachment_mime:null
      });
      if(error)throw error;
      const {error:pauseError}=await supabase.from('support_conversations').update({responder_paused:true,updated_at:new Date().toISOString()}).eq('id',selected);
      if(pauseError)throw pauseError;
      await loadMessages();await loadThreads();
    }catch(e){setProblem(errorText(e));}finally{setBusy(false);}
  };
  const sendVehicleInfoCard=async()=>{
    if(!selected||!user||busy||!manualVehicleSlug)return;
    const vehicle=manualVehicles.find(item=>item.slug===manualVehicleSlug);
    if(!vehicle)return;
    const catalogueSpecs=vehicle.specifications&&typeof vehicle.specifications==="object"?vehicle.specifications:{};
    const officialSpecs=catalogueSpecs.official_specifications&&typeof catalogueSpecs.official_specifications==="object"?catalogueSpecs.official_specifications:{};
    const specs={...catalogueSpecs,...officialSpecs};
    delete specs.official_specifications;
    const metrics=[["Range",specs.range],["0–60 mph",specs.acceleration_0_60],["Top speed",specs.top_speed],["Power",specs.power]].filter(([,value])=>value&&String(value).trim()).map(([label,value])=>({label:String(label),value:String(value)}));
    const rows=[["Model",vehicle.model||vehicle.name],["Published guide price",vehicle.price_usd?"$"+Number(vehicle.price_usd).toLocaleString("en-US")+" USD":"Contact management"],["Drivetrain",specs.drivetrain],["Performance",specs.performance],["Charging",specs.charging||specs.charging_time||specs.charging_details],["Battery",specs.battery],["Tyres",specs.tyres||specs.tires||specs.tyre_size||specs.tire_size],["Availability",vehicle.availability],["Price note",specs.price_note],["Specification source",specs.spec_source_url]].filter(([,value])=>value&&String(value).trim()).map(([label,value])=>({label:String(label),value:String(value)}));
    const sections:any[]=[{title:"Vehicle overview",rows:[{label:"Description",value:String(vehicle.description||"Description to be confirmed by management")}]}];
    if(Array.isArray(specs.features)&&specs.features.length)sections.push({title:"Key features",rows:specs.features.map((value:string)=>({label:"Feature",value:String(value)}))});
    if(Array.isArray(specs.variants)&&specs.variants.length)sections.push({title:"Available versions",rows:specs.variants.map((item:any)=>({label:String(item.name||"Version"),value:String(item.price||"Price to be confirmed")}))});
    if(Array.isArray(specs.colors)&&specs.colors.length)sections.push({title:"Colour preferences",rows:[{label:"Options",value:specs.colors.join(", ")}]});
    if(Array.isArray(specs.wheels)&&specs.wheels.length)sections.push({title:"Wheel preferences",rows:[{label:"Options",value:specs.wheels.join(", ")}]});
    const charging=specs.charging||specs.charging_time||specs.charging_details||specs.supercharging||specs.home_charging;
    if(charging)sections.push({title:"Charging",rows:[{label:"Charging information",value:typeof charging==="string"?charging:JSON.stringify(charging)},{label:"Battery",value:typeof specs.battery==="string"?specs.battery:specs.battery?JSON.stringify(specs.battery):"Confirm exact battery specification"}]});
    const tyres=specs.tyres||specs.tires||specs.tyre_specification||specs.tire_specification||specs.tyre_size||specs.tire_size;
    if(tyres)sections.push({title:"Tyres",rows:[{label:"Tyre specification",value:typeof tyres==="string"?tyres:JSON.stringify(tyres)}]});
    sections.push({title:"Availability and delivery",rows:[{label:"Status",value:String(vehicle.availability||"To be confirmed")},{label:"Next step",value:"Management must confirm market availability, final specification, price, taxes and delivery."}]});
    const data={title:String(vehicle.name||vehicle.model),subtitle:String(specs.subtitle||"TESLA VEHICLE INFORMATION"),vehicle_slug:String(vehicle.slug||""),description:String(vehicle.description||""),image_url:Array.isArray(vehicle.images)?vehicle.images[0]||"": "",gallery_urls:Array.isArray(vehicle.images)?vehicle.images:[],metrics,fields_title:"Vehicle details",fields:rows,sections,purchase_variants:Array.isArray(specs.variants)?specs.variants:[],customization:{colors:Array.isArray(specs.colors)?specs.colors:[],wheels:Array.isArray(specs.wheels)?specs.wheels:[]},note:"This card is sent by Tesla Markets Management. Configuration preferences are not a confirmed factory order.",disclaimer:"Prices and specifications must be checked against the destination market and selected version. Unreleased or unverified specifications are not guaranteed."};
    setBusy(true);setProblem("");
    try{const {error}=await supabase.from("support_messages").insert({conversation_id:selected,sender_id:user.id,sender_role:"management",body:"Vehicle information: "+vehicle.name,message_type:"vehicle_card",structured_data:data,attachment_path:null,attachment_name:null,attachment_mime:null});if(error)throw error;const {error:pauseError}=await supabase.from("support_conversations").update({responder_paused:true,updated_at:new Date().toISOString()}).eq("id",selected);if(pauseError)throw pauseError;setManualVehicleSlug("");await loadMessages();await loadThreads();}catch(e){setProblem(errorText(e));}finally{setBusy(false);}
  };
  const toggleResponder=async()=>{if(!selected||!user||pauseBusy)return;const thread=threads.find(item=>item.id===selected);const next=!(thread?.responderPaused??false);setPauseBusy(true);setProblem("");try{const {error}=await supabase.from("support_conversations").update({responder_paused:next,updated_at:new Date().toISOString()}).eq("id",selected);if(error)throw error;await loadThreads();}catch(e){setProblem(errorText(e));}finally{setPauseBusy(false);}};
  const login=async()=>{const {error}=await supabase.auth.signInWithOtp({email:ADMIN_EMAIL,options:{emailRedirectTo:window.location.origin+'/#admin'}});if(error)setProblem(error.message);else setProblem('A secure sign-in link has been sent to the authorised administrator email. Open it on this device to continue.');};
  if(checking)return <div className="admin-auth-state"><LoaderCircle className="spin"/> Checking administrator access…</div>;
  if(!user)return <div className="admin-auth-state"><ShieldCheck size={30}/><h2>Administrator sign-in</h2><p>Sign in with the authorised Tesla Markets administrator account.</p>{problem&&<p className="chat-error">{problem}</p>}<button className="btn btn-dark" onClick={login}>Sign in securely</button></div>;
  return <div className={'admin-inbox-layout '+(mobileConversation?'show-conversation':'')}><aside className="admin-thread-list"><div className="admin-inbox-heading"><div><b>Messages</b><small>{threads.length} conversations</small></div><button className="icon-btn" onClick={()=>void loadThreads()} aria-label="Refresh messages"><RefreshCw size={16}/></button></div>{threads.length===0?<div className="empty-state"><MessageCircle/><b>No conversations yet</b><span>New customer messages will appear here.</span></div>:threads.map(t=><button key={t.id} className={'admin-thread '+(selected===t.id?'selected':'')} onClick={()=>{setSelected(t.id);setMobileConversation(true);}}><span className="admin-thread-avatar">{t.visitorName.slice(0,1).toUpperCase()}</span><span className="admin-thread-copy"><b>{t.visitorName}</b><small>{t.enquiryType==='vehicle'?'Vehicle enquiry':t.enquiryType==='investment'?'Investment enquiry':t.enquiryType||'Website enquiry'}{t.vehicleModel?' · '+t.vehicleModel:''}{t.enquirySource?' · '+t.enquirySource:''}</small><span>{t.lastMessage}</span></span><time>{new Date(t.updatedAt).toLocaleDateString([], {month:'short',day:'numeric'})}</time></button>)}</aside>
  <section className="admin-conversation"><div className="admin-conversation-head"><button className="admin-mobile-back" onClick={()=>setMobileConversation(false)}><ArrowLeft size={17}/> All messages</button><span className="admin-thread-avatar">{selected?(threads.find(t=>t.id===selected)?.visitorName||'V').slice(0,1).toUpperCase():'TM'}</span><div><b>{selected?(threads.find(t=>t.id===selected)?.visitorName||'Customer'):'Select a conversation'}</b><small>{selected?[threads.find(t=>t.id===selected)?.visitorEmail,threads.find(t=>t.id===selected)?.phone,threads.find(t=>t.id===selected)?.enquiryType,threads.find(t=>t.id===selected)?.vehicleModel].filter(Boolean).join(' · '):'Customer support inbox'} · {user.email}</small></div>{selected&&<button type="button" className={'btn '+(threads.find(t=>t.id===selected)?.responderPaused?'btn-outline':'btn-dark')} onClick={toggleResponder} disabled={pauseBusy} aria-pressed={!(threads.find(t=>t.id===selected)?.responderPaused??false)}>{pauseBusy?'Updating…':threads.find(t=>t.id===selected)?.responderPaused?'AI OFF · Resume AI':'AI ON · Pause AI'}</button>}</div>
  {selected?<><div className="chat-messages admin-chat-messages">{messages.map(m=><div key={m.id} className={'chat-message-row '+(m.sender==='admin'?'mine':'theirs')}><div className={'chat-bubble '+(m.sender==='admin'?'you':'team')}>{m.messageType&&m.messageType!=='text'&&m.structuredData?<RichMessageCard type={m.messageType} data={m.structuredData}/>:m.text&&<p>{m.text}</p>}{m.attachmentUrl&&<a href={m.attachmentUrl} target="_blank" rel="noreferrer"><img className="chat-attachment" src={m.attachmentUrl} alt="Shared attachment"/></a>}<small>{m.sender==='admin'?'Tesla Markets Management':'Customer'} · {timeLabel(m.createdAt)}</small></div></div>)}</div>{actionDrawerOpen&&<div className="tm-admin-action-drawer"><div className="tm-admin-action-drawer-head"><b>Conversation actions</b><button type="button" onClick={()=>setActionDrawerOpen(false)}>Close</button></div>{paymentAccountMode&&<div className="tm-card-composer"><b>Send verified payment account details</b><select value={paymentAccountMethod} onChange={e=>setPaymentAccountMethod(e.target.value)}><option>PayPal</option><option>Zelle</option><option>Chime</option><option>Apple Pay</option></select><input value={paymentAccountAmount} onChange={e=>setPaymentAccountAmount(e.target.value)} placeholder="Exact amount to send, e.g. $42,490.00 USD"/><input value={paymentAccountName} onChange={e=>setPaymentAccountName(e.target.value)} placeholder="Account name"/><textarea rows={2} value={paymentAccountDetails} onChange={e=>setPaymentAccountDetails(e.target.value)} placeholder="Verified payment account details (email, tag, or approved account identifier)"/><textarea rows={2} value={paymentAccountInstructions} onChange={e=>setPaymentAccountInstructions(e.target.value)} placeholder="Optional payment instructions"/><div><button type="button" onClick={()=>setPaymentAccountMode(false)}>Cancel</button><button type="button" disabled={busy||!paymentAccountAmount.trim()||!paymentAccountName.trim()||!paymentAccountDetails.trim()} onClick={()=>void sendPaymentAccountCard()}>{busy?'Sending…':'Send account details'}</button></div></div>}{cardMode&&<div className="tm-card-composer"><b>Send a formatted information card</b><input value={cardTitle} onChange={e=>setCardTitle(e.target.value)} placeholder="Card title"/><input value={cardSubtitle} onChange={e=>setCardSubtitle(e.target.value)} placeholder="Section subtitle (optional)"/><textarea rows={3} value={cardRows} onChange={e=>setCardRows(e.target.value)} placeholder={"One item per line: Label | Value\nTop speed | 130 mph\nRange | 320 miles"}/><div><button type="button" onClick={()=>setCardMode(false)}>Cancel</button><button type="button" disabled={busy||!cardTitle.trim()} onClick={()=>void sendFormattedCard()}>{busy?'Sending…':'Send card'}</button></div></div>}{images.length>0&&<div className="chat-image-previews"><div className="chat-image-preview-heading">{images.length} image{images.length===1?'':'s'} selected</div><div className="chat-image-preview-list">{images.map((file,index)=><div className="chat-image-preview-item" key={file.name+'-'+file.size+'-'+file.lastModified}><FileImage size={13}/><span>{file.name}</span><button type="button" onClick={()=>setImages(current=>current.filter((_,i)=>i!==index))} aria-label={'Remove '+file.name}><X size={13}/></button></div>)}</div></div>}<div className="tm-admin-compose-tools"><select aria-label="Choose a vehicle information card" value={manualVehicleSlug} onChange={e=>setManualVehicleSlug(e.target.value)}><option value="">Vehicle information card…</option>{manualVehicles.map(vehicle=><option key={vehicle.slug} value={vehicle.slug}>{vehicle.name}</option>)}</select><button type="button" disabled={!manualVehicleSlug||busy} onClick={()=>void sendVehicleInfoCard()}>Send vehicle card</button><button type="button" disabled={busy||!selected} onClick={()=>void sendPaymentMethodsCard()}>Send payment methods</button><button type="button" disabled={busy||!selected} onClick={()=>setPaymentAccountMode(v=>!v)}>Payment account details</button><button type="button" disabled={busy||!selected} onClick={()=>void sendReceiptPendingCard()}>Acknowledge receipt</button><button type="button" onClick={()=>setCardMode(v=>!v)}>Create formatted card</button><button type="button" className="tm-admin-attach-action" onClick={()=>document.getElementById('admin-chat-file')?.click()}>Attach image</button></div></div>}<form className="chat-compose admin-compose" onSubmit={reply}><button type="button" className="chat-plus-button tm-admin-actions-toggle" onClick={()=>setActionDrawerOpen(v=>!v)} aria-label={actionDrawerOpen?'Close conversation actions':'Open conversation actions'} aria-expanded={actionDrawerOpen}><Plus size={20}/></button><input id="admin-chat-file" className="chat-file-input" type="file" multiple accept="image/png,image/jpeg,image/webp,image/gif" onChange={e=>{const selected=Array.from(e.target.files||[]);setImages(current=>[...current,...selected.filter(file=>!current.some(existing=>existing.name===file.name&&existing.size===file.size&&existing.lastModified===file.lastModified))]);e.currentTarget.value="";}}/><input value={draft} onChange={e=>setDraft(e.target.value)} placeholder="Type a reply…" aria-label="Type a reply"/><button className="chat-send-button" disabled={busy||(!draft.trim()&&!images.length)} aria-label="Send reply">{busy?<LoaderCircle className="spin" size={18}/>:<Send size={18}/>}</button></form></>:<div className="admin-empty-conversation"><MessageCircle size={34}/><b>Your conversations</b><span>Select a customer on the left to read and reply.</span></div>}{problem&&<p className="chat-error admin-chat-error">{problem}</p>}</section></div>;
}

export function GeneratedGallery() { return null; }
