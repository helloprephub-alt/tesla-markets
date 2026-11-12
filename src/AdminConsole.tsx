import { useEffect, useState } from 'react';
import { isCurrentUserAdmin, supabase, supabaseConfigured } from './lib/supabase';
import { Activity, CarFront, ClipboardList, LogOut, MessageCircle, RefreshCw, ShieldCheck, Users, Eye, Settings, CircleUserRound, Menu, X, ChevronDown, LayoutDashboard, Image, Globe, Inbox, Sun, Moon, Search, Bell, Plus, Upload, Pencil, ArrowUpRight, ChevronRight, Monitor, Smartphone, ListTodo, FileClock } from 'lucide-react';
import { AdminInbox } from './ChatWorkspace';

const ADMIN_EMAIL = 'oyejideoluwatobi7@gmail.com';
const ADMIN_AUTH_REDIRECT = 'https://tesla-markets.vercel.app/#admin';
type Thread = { id: string; visitorName?: string; visitorEmail?: string; enquiryType?:string; enquirySource?:string; vehicleModel?:string; phone?:string; createdAt: number; updatedAt: number; lastMessage?: string; status?: string };
type Visit = { id: string; page: string; createdAt: number };
type OperationalOrder = {id:string;reference:string;item:string;status:string;amount:number;currency:string;customerId:string;conversationId:string|null;paymentUrl:string|null;createdAt:number};
type OperationalPayment = {id:string;reference:string;orderId:string;amount:number;currency:string;method:string;providerReference:string|null;status:string;createdAt:number};
type Overview = { conversations: number; messages: number; generatedImages: number; visits: number; clicks: number; onlineNow: number; updatedAt: number };
type AdminTask = {id:string;title:string;description:string;status:string;priority:string;due_at:string|null;created_at:string};
type AdminNotice = {id:string;title:string;body:string;type:string;is_read:boolean;created_at:string};
type AuditEntry = {id:number;action:string;entity_type:string;entity_id:string|null;details:any;created_at:string};
type Section = 'overview' | 'visitors' | 'customers' | 'catalogue' | 'investment' | 'content' | 'media' | 'messages' | 'operations' | 'orders' | 'tasks' | 'notifications' | 'activity' | 'settings' | 'team' | 'analytics' | 'announcements' | 'profile' | 'security';

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
  const [orders,setOrders]=useState<OperationalOrder[]>([]);
  const [payments,setPayments]=useState<OperationalPayment[]>([]);
  const [paymentLinks,setPaymentLinks]=useState<Record<string,string>>({});
  const [orderAmounts,setOrderAmounts]=useState<Record<string,string>>({});
  const [paymentOrderId,setPaymentOrderId]=useState('');
  const [paymentAmount,setPaymentAmount]=useState('');
  const [paymentMethod,setPaymentMethod]=useState('bank_transfer');
  const [paymentProviderReference,setPaymentProviderReference]=useState('');
  const [savingPayment,setSavingPayment]=useState(false);
  const [tasks,setTasks]=useState<AdminTask[]>([]);
  const [notices,setNotices]=useState<AdminNotice[]>([]);
  const [auditEntries,setAuditEntries]=useState<AuditEntry[]>([]);
  const [taskTitle,setTaskTitle]=useState('');
  const [taskDescription,setTaskDescription]=useState('');
  const [taskPriority,setTaskPriority]=useState('normal');
  const [taskDue,setTaskDue]=useState('');
  const [section, setSection] = useState<Section>('overview');
  const [mobileNavOpen,setMobileNavOpen]=useState(false);
  const [collapsedGroups,setCollapsedGroups]=useState<string[]>([]);
  const [adminTheme,setAdminTheme]=useState<'light'|'dark'|'auto'>(()=>{const saved=localStorage.getItem('tesla-admin-theme');return saved==='dark'||saved==='auto'?saved:'light';});
  const [systemTheme,setSystemTheme]=useState<'light'|'dark'>(()=>window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');
  useEffect(()=>{const media=window.matchMedia('(prefers-color-scheme: dark)');const update=()=>setSystemTheme(media.matches?'dark':'light');media.addEventListener?.('change',update);return()=>media.removeEventListener?.('change',update);},[]);
  const toggleAdminTheme=()=>setAdminTheme(current=>{const next=current==='light'?'dark':current==='dark'?'auto':'light';localStorage.setItem('tesla-admin-theme',next);return next;});
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
  const [installPrompt,setInstallPrompt] = useState<any>(null);
  const [isInstalled,setIsInstalled] = useState(false);
  const [notificationPermission,setNotificationPermission] = useState<NotificationPermission>(typeof Notification==='undefined'?'denied':Notification.permission);
  const [notificationStatus,setNotificationStatus] = useState('');
  const [pushSubscribed,setPushSubscribed] = useState(false);
  const [desktopView,setDesktopView] = useState(()=>localStorage.getItem('tesla-admin-desktop-view')==='true');
  const toggleDesktopView=()=>setDesktopView(current=>{const next=!current;localStorage.setItem('tesla-admin-desktop-view',String(next));return next;});

  useEffect(() => {
    const onInstallPrompt = (event: Event) => { event.preventDefault(); setInstallPrompt(event as any); };
    const onInstalled = () => { setIsInstalled(true); setInstallPrompt(null); setNotificationStatus('Tesla Markets Management is installed on this device.'); };
    window.addEventListener('beforeinstallprompt', onInstallPrompt);
    window.addEventListener('appinstalled', onInstalled);
    setIsInstalled(window.matchMedia('(display-mode: standalone)').matches || Boolean((navigator as any).standalone));
    if ('serviceWorker' in navigator) void navigator.serviceWorker.register('/sw.js').catch(() => setNotificationStatus('App worker could not be registered. Refresh and try again.'));
    return () => { window.removeEventListener('beforeinstallprompt', onInstallPrompt); window.removeEventListener('appinstalled', onInstalled); };
  }, []);

  const enablePhoneNotifications = async () => {
    if (!('Notification' in window)) { setNotificationStatus('This browser does not support notifications. Open the admin app in Chrome.'); return; }
    try {
      const permission = await Notification.requestPermission();
      setNotificationPermission(permission);
      if (permission !== 'granted') { setNotificationStatus(permission === 'denied' ? 'Notifications are blocked in browser settings.' : 'Allow notifications to receive new customer-message alerts.'); return; }
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) throw new Error('This browser does not support background push. Install the app in Chrome and try again.');
      const registration = await navigator.serviceWorker.ready;
      const vapidPublicKey = 'BPSV7CwvZmNaYoDMrfs0EelCDW19B-VXNTwFDCoxpEabir9rQs-MvEFJ5M_tqrhdOoG0Dyp5YCP6KfJFm2JQfz0';
      const normalizedKey=vapidPublicKey.replace(/-/g,'+').replace(/_/g,'/');
      const applicationServerKey=Uint8Array.from(atob(normalizedKey+'='.repeat((4-normalizedKey.length%4)%4)),char=>char.charCodeAt(0));
      if(applicationServerKey.length!==65||applicationServerKey[0]!==4)throw new Error('The notification server key is misconfigured. Refresh later or contact support.');
      let subscription=await registration.pushManager.getSubscription();
      if(subscription){
        const existingKey=subscription.options.applicationServerKey;
        const existing=existingKey?Array.from(new Uint8Array(existingKey)):[];
        if(existing.length!==applicationServerKey.length||existing.some((byte,index)=>byte!==applicationServerKey[index])){await subscription.unsubscribe();subscription=null;}
      }
      if(!subscription)subscription=await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey});
      const json = subscription.toJSON();
      const { data: { user: currentUser }, error: userError } = await supabase.auth.getUser();
      if (userError || !currentUser) throw new Error('Your administrator session has expired. Sign in again.');
      const { error: saveError } = await supabase.from('admin_push_subscriptions').upsert({
        user_id: currentUser.id,
        endpoint: subscription.endpoint,
        p256dh: json.keys?.p256dh,
        auth: json.keys?.auth,
        expiration_time: subscription.expirationTime ? new Date(subscription.expirationTime).toISOString() : null,
        updated_at: new Date().toISOString()
      }, { onConflict: 'endpoint' });
      if (saveError) throw saveError;
      await registration.showNotification('Tesla Markets Management', { body: 'This device is subscribed to customer message alerts.', icon: '/icons/admin-icon.svg', badge: '/icons/admin-icon.svg', tag: 'tesla-admin-notifications-enabled' });
      setPushSubscribed(true);
      setNotificationStatus('This phone is subscribed. To re-enable later, return here and tap this button again. If Android permission was blocked, open Chrome site settings → Notifications and allow this site. A closed-app delivery test is still pending.');
    } catch (e) { setPushSubscribed(false);setNotificationStatus(e instanceof Error ? e.message : 'Could not enable notifications.'); }
  };

  const installAdminApp = async () => {
    if (!installPrompt) { setNotificationStatus('In Chrome, open menu ⋮ and choose Install app or Add to Home screen.'); return; }
    try {
      await installPrompt.prompt();
      const choice = await installPrompt.userChoice;
      setNotificationStatus(choice?.outcome === 'accepted' ? 'Installation accepted. Follow the Android prompt to finish.' : 'Installation cancelled. You can install later from Chrome menu ⋮.');
      setInstallPrompt(null);
    } catch { setNotificationStatus('Open Chrome menu ⋮ and choose Install app or Add to Home screen.'); }
  };

  useEffect(() => {
    if (!user) return;
    let active = true;
    const channel = supabase.channel('tesla-admin-customer-message-alerts')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'support_messages', filter: 'sender_role=eq.customer' }, async (payload) => {
        if (!active) return;
        const message = payload.new as { id?: string; body?: string; sender_role?: string };
        if (message.sender_role !== 'customer') return;
        void load();
        // The server-side database webhook sends background push. Realtime only refreshes the open dashboard.
      })
      .subscribe((status) => { if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') setNotificationStatus('Live message connection interrupted. Refresh the admin app to reconnect.'); });
    return () => { active = false; void supabase.removeChannel(channel); };
  }, [user?.email]);


  const load = async () => {
    setRefreshing(true);
    try {
      const [visitCount, clickCount, conversationCount, messageCount, presenceCount, visitorLog, conversationRows, customerCount, orderRows, paymentRows, taskRows, noticeRows, auditRows] = await Promise.all([
        supabase.from('site_visits').select('id', { count:'exact', head:true }),
        supabase.from('site_clicks').select('id', { count:'exact', head:true }),
        supabase.from('support_conversations').select('id', { count:'exact', head:true }),
        supabase.from('support_messages').select('id', { count:'exact', head:true }),
        supabase.from('site_presence').select('visitor_id', { count:'exact', head:true }).gte('last_seen_at', new Date(Date.now()-90000).toISOString()),
        supabase.from('site_visits').select('id,page,created_at').order('created_at',{ascending:false}).limit(100),
        supabase.from('support_conversations').select('id,customer_id,subject,status,updated_at,visitor_email,enquiry_type,enquiry_source,vehicle_model,contact_phone').order('updated_at',{ascending:false}).limit(100),
        supabase.from('customer_profiles').select('id',{count:'exact',head:true}),
        supabase.from('business_orders').select('id,order_reference,item_description,status,agreed_amount,currency,customer_id,conversation_id,payment_url,created_at').order('created_at',{ascending:false}).limit(200),
        supabase.from('business_payments').select('id,payment_reference,order_id,amount,currency,method,provider_reference,status,created_at').order('created_at',{ascending:false}).limit(200),
        supabase.from('admin_tasks').select('id,title,description,status,priority,due_at,created_at').order('created_at',{ascending:false}).limit(200),
        supabase.from('admin_notifications').select('id,title,body,type,is_read,created_at').order('created_at',{ascending:false}).limit(100),
        supabase.from('admin_audit_logs').select('id,action,entity_type,entity_id,details,created_at').order('created_at',{ascending:false}).limit(100),
      ]);
      for (const result of [visitCount,clickCount,conversationCount,messageCount,presenceCount,visitorLog,conversationRows,customerCount,orderRows,paymentRows,taskRows,noticeRows,auditRows]) if (result.error) throw result.error;
      const rows=conversationRows.data||[];
      const ids=rows.map(row=>row.customer_id);
      const {data:profiles,error:profilesError}=ids.length?await supabase.from('customer_profiles').select('id,display_name,email,phone').in('id',ids):{data:[],error:null};
      if(profilesError) throw profilesError;
      const names=new Map((profiles||[]).map(profile=>[profile.id,profile]));
      const mapped=await Promise.all(rows.map(async row=>{
        const {data:last,error:lastError}=await supabase.from('support_messages').select('body,created_at').eq('conversation_id',row.id).order('created_at',{ascending:false}).limit(1).maybeSingle();
        if(lastError) throw lastError;
        const profile=names.get(row.customer_id);return {id:row.id,visitorName:profile?.display_name||'Website visitor',visitorEmail:row.visitor_email||profile?.email||'',phone:row.contact_phone||profile?.phone||'',enquiryType:row.enquiry_type||'general',enquirySource:row.enquiry_source||'Website chat',vehicleModel:row.vehicle_model||'',createdAt:new Date(row.updated_at).getTime(),updatedAt:new Date(row.updated_at).getTime(),lastMessage:last?.body||row.subject||'Conversation opened',status:row.status};
      }));
      setOverview({visits:visitCount.count||0,clicks:clickCount.count||0,conversations:conversationCount.count||0,messages:messageCount.count||0,generatedImages:0,onlineNow:presenceCount.count||0,updatedAt:Date.now()});
      setThreads(mapped);
      setVisits((visitorLog.data||[]).map(row=>({id:row.id,page:row.page,createdAt:new Date(row.created_at).getTime()})));
      setOrders((orderRows.data||[]).map(row=>({id:row.id,reference:row.order_reference||row.id.slice(0,8),item:row.item_description||'Customer request',status:row.status||'draft',amount:Number(row.agreed_amount||0),currency:row.currency||'USD',customerId:row.customer_id,conversationId:row.conversation_id||null,paymentUrl:row.payment_url||null,createdAt:new Date(row.created_at).getTime()})));
      setPaymentLinks(Object.fromEntries((orderRows.data||[]).map(row=>[row.id,row.payment_url||''])));
      setOrderAmounts(Object.fromEntries((orderRows.data||[]).map(row=>[row.id,String(row.agreed_amount||'')])))
      setPayments((paymentRows.data||[]).map(row=>({id:row.id,reference:row.payment_reference,orderId:row.order_id,amount:Number(row.amount||0),currency:row.currency||'USD',method:row.method||'unknown',providerReference:row.provider_reference||null,status:row.status||'pending',createdAt:new Date(row.created_at).getTime()})));
      setTasks((taskRows.data||[]) as AdminTask[]);setNotices((noticeRows.data||[]) as AdminNotice[]);setAuditEntries((auditRows.data||[]) as AuditEntry[]);
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
  const createTask = async () => {
    if(!taskTitle.trim())return;
    try { const {user:current,isAdmin}=await isCurrentUserAdmin(); if(!current||!isAdmin)throw new Error('Administrator session expired.');
      const {data,error:insertError}=await supabase.from('admin_tasks').insert({title:taskTitle.trim(),description:taskDescription.trim(),priority:taskPriority,due_at:taskDue?new Date(taskDue).toISOString():null,created_by:current.id}).select('id,title,description,status,priority,due_at,created_at').single();
      if(insertError)throw insertError;setTasks(currentTasks=>[data as AdminTask,...currentTasks]);setTaskTitle('');setTaskDescription('');setTaskDue('');setTaskPriority('normal');setError('');
    } catch(e){setError(e instanceof Error?e.message:'Could not create task.');}
  };
  const updateTaskStatus = async (taskId:string,status:string) => { try {const {error:updateError}=await supabase.from('admin_tasks').update({status,updated_at:new Date().toISOString()}).eq('id',taskId);if(updateError)throw updateError;setTasks(current=>current.map(task=>task.id===taskId?{...task,status}:task));}catch(e){setError(e instanceof Error?e.message:'Could not update task.');} };
  const markNoticeRead = async (noticeId:string) => {try{const {error:updateError}=await supabase.from('admin_notifications').update({is_read:true}).eq('id',noticeId);if(updateError)throw updateError;setNotices(current=>current.map(item=>item.id===noticeId?{...item,is_read:true}:item));}catch(e){setError(e instanceof Error?e.message:'Could not update notification.');}};
  const updateOrderStatus = async (orderId:string,status:string) => {
    const allowed=['draft','awaiting_payment','processing','completed','cancelled','refunded'];
    if(!allowed.includes(status))return;
    try {
      const {user:current,isAdmin}=await isCurrentUserAdmin();
      if(!current||!isAdmin)throw new Error('Administrator session expired.');
      const {error:updateError}=await supabase.from('business_orders').update({status,updated_at:new Date().toISOString()}).eq('id',orderId);
      if(updateError)throw updateError;
      setOrders(currentOrders=>currentOrders.map(order=>order.id===orderId?{...order,status}:order));
      setError('');
    } catch(e){setError(e instanceof Error?e.message:'Could not update order status.');}
  };
  const sendPaymentLink = async (orderId:string) => {
    const order=orders.find(item=>item.id===orderId);
    const paymentUrl=(paymentLinks[orderId]||'').trim();
    const amount=Number(orderAmounts[orderId]||'');
    if(!order) {setError('Order not found.');return;}
    if(!order.conversationId) {setError('This order is not linked to a customer conversation.');return;}
    if(!/^https:\/\//i.test(paymentUrl)) {setError('Enter a secure HTTPS checkout link from your approved payment provider.');return;}
    if(!Number.isFinite(amount)||amount<=0) {setError('Enter a valid final order amount.');return;}
    try {
      const {user:current,isAdmin}=await isCurrentUserAdmin();
      if(!current||!isAdmin)throw new Error('Administrator session expired.');
      const {error:updateError}=await supabase.from('business_orders').update({
        agreed_amount:amount,payment_url:paymentUrl,status:'awaiting_payment',
        internal_notes:'Management approved the final amount and issued the hosted checkout link. Payment remains unverified until reconciled.',
        updated_at:new Date().toISOString()
      }).eq('id',orderId);
      if(updateError)throw updateError;
      const currency=order.currency||'USD';
      const formatted=new Intl.NumberFormat('en-US',{style:'currency',currency}).format(amount);
      const {error:messageError}=await supabase.from('support_messages').insert({
        conversation_id:order.conversationId,sender_id:current.id,sender_role:'management',
        body:'Tesla Markets Management has approved your vehicle quotation. Use the secure checkout button on this card to complete payment. Your order will remain pending until the payment is verified.',
        message_type:'payment_card',
        structured_data:{
          title:'Your secure vehicle checkout',
          subtitle:'MANAGEMENT APPROVED · PAYMENT AWAITING',
          status:'Awaiting payment',
          amount_label:'APPROVED ORDER TOTAL',
          amount:formatted+' '+currency,
          fields:[
            {label:'Order reference',value:order.reference},
            {label:'Vehicle',value:order.item},
            {label:'Payment status',value:'Not yet paid or verified'}
          ],
          payment_url:paymentUrl,
          note:'After completing checkout, keep your payment confirmation or transaction reference.',
          disclaimer:'Only use the secure checkout link shown here. Tesla Markets will update your order after payment verification.'
        }
      });
      if(messageError)throw messageError;
      await supabase.from('support_conversations').update({last_message_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq('id',order.conversationId);
      setOrders(current=>current.map(item=>item.id===orderId?{...item,amount,currency,status:'awaiting_payment',paymentUrl}:item));
      setError('');
    } catch(e){setError(e instanceof Error?e.message:'Could not send the payment link.');}
  };
  const recordPayment = async () => {
    if(!paymentOrderId||!paymentAmount.trim()||!paymentProviderReference.trim())return;
    const amount=Number(paymentAmount);
    if(!Number.isFinite(amount)||amount<=0){setError('Enter a valid payment amount.');return;}
    setSavingPayment(true);
    try {
      const {user:current,isAdmin}=await isCurrentUserAdmin();
      if(!current||!isAdmin)throw new Error('Administrator session expired.');
      const order=orders.find(item=>item.id===paymentOrderId);
      if(!order)throw new Error('Select a valid order.');
      const reference='TM-PAY-'+new Date().toISOString().slice(0,10).replace(/-/g,'')+'-'+crypto.randomUUID().slice(0,6).toUpperCase();
      const {data,error:insertError}=await supabase.from('business_payments').insert({
        payment_reference:reference,order_id:order.id,customer_id:order.customerId,amount,currency:order.currency,
        method:paymentMethod,provider_reference:paymentProviderReference.trim(),status:'pending',recorded_by:current.id,
        notes:'Recorded by management. Verification required before the order can be marked paid.'
      }).select('id,payment_reference,order_id,amount,currency,method,provider_reference,status,created_at').single();
      if(insertError)throw insertError;
      setPayments(currentPayments=>[{id:data.id,reference:data.payment_reference,orderId:data.order_id,amount:Number(data.amount),currency:data.currency,method:data.method,providerReference:data.provider_reference,status:data.status,createdAt:new Date(data.created_at).getTime()},...currentPayments]);
      setPaymentAmount('');setPaymentProviderReference('');setPaymentOrderId('');
      setError('');
    } catch(e){setError(e instanceof Error?e.message:'Could not record payment.');}
    finally{setSavingPayment(false);}
  };
  const updatePaymentStatus = async (paymentId:string,status:string) => {
    if(!['pending','verified','rejected','refunded'].includes(status))return;
    try {
      const {user:current,isAdmin}=await isCurrentUserAdmin();
      if(!current||!isAdmin)throw new Error('Administrator session expired.');
      const payment=payments.find(item=>item.id===paymentId);
      if(!payment)throw new Error('Payment record not found.');
      const update={status,updated_at:new Date().toISOString(),...(status==='verified'?{verified_by:current.id,verified_at:new Date().toISOString()}:{})};
      const {error:updateError}=await supabase.from('business_payments').update(update).eq('id',paymentId);
      if(updateError)throw updateError;
      setPayments(currentPayments=>currentPayments.map(item=>item.id===paymentId?{...item,status}:item));
      if(status==='verified'){
        const order=orders.find(item=>item.id===payment.orderId);
        if(order){
          const verifiedTotal=payments.filter(item=>item.orderId===order.id&&(item.status==='verified'||item.id===paymentId)).reduce((sum,item)=>sum+item.amount,0);
          const nextStatus=verifiedTotal>=order.amount?'paid':'partially_paid';
          const {error:orderError}=await supabase.from('business_orders').update({status:nextStatus,updated_at:new Date().toISOString()}).eq('id',order.id);
          if(orderError)throw orderError;
          setOrders(currentOrders=>currentOrders.map(item=>item.id===order.id?{...item,status:nextStatus}:item));
        }
      }
      setError('');
    } catch(e){setError(e instanceof Error?e.message:'Could not update payment verification.');}
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

  const activityBuckets = Array.from({length:14},(_,i)=>{const day=new Date();day.setHours(0,0,0,0);day.setDate(day.getDate()-(13-i));const start=day.getTime();return {label:day.toLocaleDateString(undefined,{month:'short',day:'numeric'}),count:visits.filter(v=>v.createdAt>=start&&v.createdAt<start+86400000).length};});
  const maxActivity = Math.max(1,...activityBuckets.map(day=>day.count));

  const nav = [
    { id: 'overview' as const, label: 'Overview', icon: LayoutDashboard, group:'WORKSPACE' },
    { id: 'messages' as const, label: 'Messages & Inbox', icon: MessageCircle, group:'WORKSPACE' },
    { id: 'customers' as const, label: 'Customers', icon: Users, group:'WORKSPACE' },
    { id: 'operations' as const, label: 'Enquiries', icon: ClipboardList, group:'WORKSPACE' },
    { id: 'tasks' as const, label: 'Tasks & Follow-ups', icon: ListTodo, group:'WORKSPACE' },
    { id: 'catalogue' as const, label: 'Vehicle Inventory', icon: CarFront, group:'BUSINESS OPERATIONS' },
    { id: 'investment' as const, label: 'Investment Enquiries', icon: Inbox, group:'BUSINESS OPERATIONS' },
    { id: 'orders' as const, label: 'Orders & Requests', icon: ClipboardList, group:'BUSINESS OPERATIONS' },
    { id: 'team' as const, label: 'Team Management', icon: Users, group:'BUSINESS OPERATIONS' },
    { id: 'content' as const, label: 'Website Manager', icon: Globe, group:'WEBSITE' },
    { id: 'media' as const, label: 'Media Library', icon: Image, group:'WEBSITE' },
    { id: 'announcements' as const, label: 'Content & Announcements', icon: Pencil, group:'WEBSITE' },
    { id: 'analytics' as const, label: 'Analytics & Reports', icon: Activity, group:'INSIGHTS' },
    { id: 'activity' as const, label: 'Activity Logs', icon: FileClock, group:'INSIGHTS' },
    { id: 'notifications' as const, label: 'Notifications', icon: Bell, group:'SYSTEM' },
    { id: 'profile' as const, label: 'Admin Profile', icon: CircleUserRound, group:'SYSTEM' },
    { id: 'security' as const, label: 'Security & Permissions', icon: ShieldCheck, group:'SYSTEM' },
    { id: 'settings' as const, label: 'Settings', icon: Settings, group:'SYSTEM' },
  ];

  return (
    <div className={`admin-console admin-console-standalone admin-console-premium admin-theme-${adminTheme==='auto'?systemTheme:adminTheme} ${desktopView?'admin-desktop-view':''}`}>
      <section className="admin-install-card" style={{display:'flex',flexWrap:'wrap',alignItems:'center',gap:12,justifyContent:'space-between',padding:'14px 18px',margin:'14px 18px',border:'1px solid var(--admin-border,#ddd)',borderRadius:14,background:'var(--admin-panel,#fff)'}}>
        <div style={{minWidth:220,flex:'1 1 240px'}}><b>Install Tesla Markets Management</b><p style={{margin:'4px 0 0',fontSize:13,opacity:.75}}>Add a secure app shortcut to your phone and enable customer message alerts.</p>{notificationStatus&&<small role="status">{notificationStatus}</small>}</div>
        <div style={{display:'flex',gap:8,flexWrap:'wrap'}}><button className="btn btn-outline" type="button" onClick={()=>void enablePhoneNotifications()}>{pushSubscribed?'Device subscribed':notificationPermission==='granted'?'Check notification setup':'Enable notifications'}</button>{!isInstalled&&<button className="btn btn-dark" type="button" onClick={()=>void installAdminApp()}>{installPrompt?'Install admin app':'How to install'}</button>}</div>
      </section>
      <header className="admin-topbar">
        <button className="admin-mobile-menu" onClick={()=>setMobileNavOpen(v=>!v)} aria-label={mobileNavOpen?'Close navigation':'Open navigation'}>{mobileNavOpen?<X size={20}/>:<Menu size={20}/>}</button>
        <div className="admin-console-brand"><span className="admin-brand-mark admin-tesla-mark">T</span><div><b>TESLA MARKETS</b><small>MANAGEMENT CONSOLE</small></div></div>
        <div className="admin-topbar-right"><button className="icon-btn admin-theme-toggle" onClick={toggleAdminTheme} aria-label={'Theme: '+adminTheme+'. Tap to change.'} title={'Theme: '+adminTheme+' · tap to cycle'}>{adminTheme==='light'?<Sun size={16}/>:adminTheme==='dark'?<Moon size={16}/>:<Monitor size={16}/>}</button><button className="icon-btn admin-view-toggle" onClick={toggleDesktopView} aria-label={desktopView?'Use phone layout':'Use desktop layout'} title={desktopView?'Use phone layout':'Use desktop layout'}>{desktopView?<Smartphone size={16}/>:<Monitor size={16}/>}</button><span className="admin-secure-label"><ShieldCheck size={14}/> Secure workspace</span><span className="admin-live-dot"/><span className="admin-topbar-email">{user.email}</span><button className="icon-btn" onClick={()=>void load()} aria-label="Refresh management data" disabled={refreshing}><RefreshCw size={16}/></button><button className="icon-btn" onClick={()=>supabase.auth.signOut().then(()=>setUser(null))} aria-label="Sign out"><LogOut size={16}/></button></div>
      </header>
      <div className="admin-shell">
        <aside className={'admin-console-side '+(mobileNavOpen?'is-open':'')}>
          <div className="admin-sidebar-heading">CONTROL CENTRE</div>
          {['WORKSPACE','BUSINESS OPERATIONS','WEBSITE','INSIGHTS','SYSTEM'].map(group=><div className="admin-nav-group" key={group}><button type="button" className="admin-nav-group-toggle" aria-expanded={!collapsedGroups.includes(group)} onClick={()=>setCollapsedGroups(current=>current.includes(group)?current.filter(item=>item!==group):[...current,group])}><span>{group}</span><ChevronDown size={15} className={collapsedGroups.includes(group)?'is-collapsed':''}/></button>{!collapsedGroups.includes(group)&&<div className="admin-nav-group-items">{nav.filter(item=>item.group===group).map(item=>{const Icon=item.icon;return <button type="button" key={item.id} className={section===item.id?'active':''} onClick={()=>{setSection(item.id);setMobileNavOpen(false);}}><Icon size={17}/><span>{item.label}</span>{section===item.id&&<i/>}</button>})}</div>}</div>)}
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
            </section>
            <div className="tm-dashboard-grid tm-dashboard-grid-primary">
              <section className="tm-dashboard-card tm-activity-chart"><div className="tm-card-heading"><div><h2>Website Activity</h2><p>Recent visitor activity from recorded page views.</p></div><span className="tm-card-chip">Latest {visits.length} records</span></div>
                <div className="tm-chart-area"><div className="tm-chart-y"><span>Recent</span><span>Earlier</span></div><div className="tm-chart-bars">{activityBuckets.map((day,i)=><div key={day.label} title={day.label+': '+day.count+' recorded visits'} style={{height:Math.max(3,(day.count/maxActivity)*100)+'%'}}/>)}{visits.length===0&&<p>No visit records yet.</p>}</div></div><div className="tm-chart-foot"><span>Latest tracked visits</span><b>{overview?.visits??0} total page views</b></div>
              </section>
              <section className="tm-dashboard-card tm-quick-actions-card"><div className="tm-card-heading"><div><h2>Quick Actions</h2><p>Common management tasks.</p></div></div><div className="tm-action-grid"><button onClick={()=>setSection('catalogue')}><CarFront/><span>Add / manage vehicle</span></button><button onClick={()=>setSection('media')}><Upload/><span>Upload media</span></button><button onClick={()=>setSection('investment')}><Inbox/><span>Investment enquiries</span></button><button onClick={()=>setSection('content')}><Pencil/><span>Edit website content</span></button></div></section>
              <section className="tm-dashboard-card tm-recent-enquiries"><div className="tm-card-heading"><div><h2>Recent Enquiries</h2><p>Latest customer conversations.</p></div><button onClick={()=>setSection('operations')}>View all <ArrowUpRight size={13}/></button></div>{threads.filter(t=>!dashboardSearch||[t.visitorName,t.visitorEmail,t.lastMessage].join(' ').toLowerCase().includes(dashboardSearch.toLowerCase())).slice(0,5).map(t=><button className="tm-enquiry-row" key={t.id} onClick={()=>setSection('messages')}><span className="tm-enquiry-avatar">{(t.visitorName||'V').slice(0,1).toUpperCase()}</span><span><b>{t.visitorName||'Website visitor'}</b><small>{t.lastMessage||'Customer enquiry'}</small></span><ChevronRight size={15}/></button>)}{threads.length===0&&<p className="tm-empty">No enquiries recorded yet.</p>}</section>
            </div>
            <div className="tm-dashboard-grid tm-dashboard-grid-secondary">
            </div>
            <section className="tm-dashboard-card tm-chat-dashboard"><div className="tm-card-heading"><div><h2>Customer Conversations</h2><p>Inbox, live replies and customer details.</p></div><button onClick={()=>setSection('messages')}>Open full inbox <ArrowUpRight size={13}/></button></div><AdminInbox/></section>
            <section className="tm-dashboard-card tm-quick-links"><div className="tm-card-heading"><div><h2>Management Sections</h2><p>All website controls in one organized place.</p></div></div><div className="admin-quick-actions">{nav.filter(item=>item.id!=='overview').map(item=><button key={item.id} onClick={()=>setSection(item.id)}>{item.label}</button>)}</div></section>
          </>}
          {section === 'visitors' && <section className="admin-console-panel"><div className="admin-console-panel-head"><div><div className="eyebrow dark">VISITOR ACTIVITY</div><h2>{visits.length} recent page views</h2><p>Page-level activity; this is not a count of unique people.</p></div></div>{visits.slice(0,8).map(v=><div className="tm-activity-row" key={v.id}><span><Activity size={15}/></span><div><b>Page visit recorded</b><small>{v.page}</small></div><time>{new Date(v.createdAt).toLocaleTimeString()}</time></div>)}{visits.length?<div className="admin-table-wrap"><table className="admin-record-table"><thead><tr><th>Page</th><th>Visited at</th><th>Record ID</th></tr></thead><tbody>{visits.map(visit=><tr key={visit.id}><td>{visit.page}</td><td>{new Date(visit.createdAt).toLocaleString()}</td><td>{visit.id.slice(0,12)}</td></tr>)}</tbody></table></div>:<p className="admin-empty-note">No page views recorded yet.</p>}</section>}
          {section === 'customers' && <section className="admin-console-panel"><div className="admin-console-panel-head"><div><div className="eyebrow dark">CUSTOMER DIRECTORY</div><h2>{threads.length} enquiry contacts</h2><p>Customer records based on saved website conversations.</p></div></div>{threads.length?<div className="admin-table-wrap"><table className="admin-record-table"><thead><tr><th>Customer</th><th>Email</th><th>Last activity</th><th>Last message</th></tr></thead><tbody>{threads.map(thread=><tr key={thread.id}><td>{thread.visitorName||'Website visitor'}</td><td>{thread.visitorEmail||'Not provided'}</td><td>{new Date(thread.updatedAt).toLocaleString()}</td><td>{thread.lastMessage||'—'}</td></tr>)}</tbody></table></div>:<p className="admin-empty-note">New customer conversations will appear here.</p>}</section>}
          {section === 'catalogue' && <section className="admin-console-panel"><div className="admin-console-panel-head"><div><div className="eyebrow dark">VEHICLE CATALOGUE</div><h2>Vehicle image collections</h2><p>Review the current vehicle galleries. Vehicle detail and pricing controls are being expanded.</p></div></div><div className="admin-catalogue-grid">{catalogue.map(item=><article key={item.name}><img src={item.first} alt={item.name}/><div><b>{item.name}</b><small>{item.count} attached images</small></div></article>)}</div></section>}
          {section === 'investment' && <section className="admin-console-panel"><div className="admin-console-panel-head"><div><div className="eyebrow dark">CUSTOMER ENQUIRIES</div><h2>Investment enquiries</h2><p>Customer communication and follow-up only. No portfolios, balances, returns, payments or financial records.</p></div></div>{threads.filter(thread=>(thread.enquiryType||'').toLowerCase().includes('invest')).length?<div className="admin-table-wrap"><table className="admin-record-table"><thead><tr><th>Customer</th><th>Contact</th><th>Enquiry</th><th>Status</th><th>Received</th></tr></thead><tbody>{threads.filter(thread=>(thread.enquiryType||'').toLowerCase().includes('invest')).map(thread=><tr key={thread.id}><td>{thread.visitorName||'Website visitor'}</td><td>{thread.visitorEmail||thread.phone||'Not provided'}</td><td>{thread.lastMessage||'Investment information request'}</td><td><select value={thread.status||'new'} onChange={event=>void updateStatus(thread.id,event.target.value)}>{['new','awaiting_response','in_conversation','follow_up_required','interested','completed','closed'].map(status=><option key={status} value={status}>{status.replaceAll('_',' ')}</option>)}</select></td><td>{new Date(thread.updatedAt).toLocaleString()}</td></tr>)}</tbody></table></div>:<p className="admin-empty-note">No investment enquiries have been recorded yet.</p>}</section>}
          {section === 'content' && <section className="admin-console-panel admin-content-editor"><div className="admin-console-panel-head"><div><div className="eyebrow dark">PUBLIC WEBSITE CONTENT</div><h2>Website copy editor</h2><p>Edit the supported homepage, investment page and footer text.</p></div></div><label>Homepage headline<input value={contentDraft.homeHeadline} onChange={e=>setContentDraft(current=>({...current,homeHeadline:e.target.value}))}/></label><label>Homepage description<textarea rows={3} value={contentDraft.homeDescription} onChange={e=>setContentDraft(current=>({...current,homeDescription:e.target.value}))}/></label><label>Investment heading<input value={contentDraft.investmentHeading} onChange={e=>setContentDraft(current=>({...current,investmentHeading:e.target.value}))}/></label><label>Investment description<textarea rows={3} value={contentDraft.investmentDescription} onChange={e=>setContentDraft(current=>({...current,investmentDescription:e.target.value}))}/></label><label>Footer description<textarea rows={2} value={contentDraft.footerBlurb} onChange={e=>setContentDraft(current=>({...current,footerBlurb:e.target.value}))}/></label><div className="admin-content-preview"><b>Live preview</b><h3>{contentDraft.homeHeadline}</h3><p>{contentDraft.homeDescription}</p><h3>{contentDraft.investmentHeading}</h3><p>{contentDraft.investmentDescription}</p><small>{contentDraft.footerBlurb}</small></div><div className="admin-content-actions"><button className="btn btn-outline" onClick={()=>setContentDraft(siteContent)}>Discard changes</button><button className="btn btn-dark" disabled={savingContent} onClick={()=>void saveContent()}>{savingContent?'Saving…':'Publish website content'}</button></div></section>}
          {section === 'media' && <section className="admin-console-panel"><div className="admin-console-panel-head"><div><div className="eyebrow dark">MEDIA LIBRARY</div><h2>Website media</h2><p>Manage investment slides and the management profile image. Vehicle gallery assets remain attached to the current site resources.</p></div></div><div className="admin-media-links"><button onClick={()=>setSection('investment')}>Manage investment images</button><button onClick={()=>setSection('catalogue')}>View vehicle galleries</button><button onClick={()=>setSection('settings')}>Management profile image</button></div></section>}
          {section === 'messages' && <section className="admin-console-panel admin-messages-panel"><div className="admin-console-panel-head"><div><div className="eyebrow dark">CUSTOMER COMMUNICATIONS</div><h2>Customer inbox</h2><p>Customer conversation list and replies. The conversation header and reply bar remain in place while messages scroll.</p></div></div><AdminInbox/></section>}
          {section === 'operations' && <section className="admin-console-panel"><div className="admin-console-panel-head"><div><div className="eyebrow dark">ENQUIRY PIPELINE</div><h2>{threads.length} enquiries</h2><p>Track the current status of each customer enquiry.</p></div></div>{threads.length?<div className="admin-pipeline">{threads.map(thread=><article key={thread.id}><div><b>{thread.visitorName||'Website visitor'}</b><small>{thread.lastMessage||'No message yet'} · {new Date(thread.updatedAt).toLocaleString()}</small></div><label>Status<select value={thread.status||'new'} onChange={event=>void updateStatus(thread.id,event.target.value)}>{statusOptions.map(status=><option key={status} value={status}>{status.replaceAll('_',' ')}</option>)}</select></label></article>)}</div>:<p className="admin-empty-note">New enquiries will appear here.</p>}</section>}
          {section === 'orders' && <><section className="admin-console-panel"><div className="admin-console-panel-head"><div><div className="eyebrow dark">VEHICLE ORDERS & PRO FORMA</div><h2>{orders.length} recorded orders</h2><p>Set the final amount, paste a hosted checkout URL from your approved payment provider, then approve and send it to the customer. Verify incoming funds before marking payment complete.</p></div><button className="btn btn-outline" onClick={()=>void load()} disabled={refreshing}><RefreshCw size={15}/> Refresh</button></div>{orders.length?<div className="admin-table-wrap"><table className="admin-record-table"><thead><tr><th>Reference</th><th>Vehicle</th><th>Final amount (USD)</th><th>Order status</th><th>Checkout link</th><th>Received</th></tr></thead><tbody>{orders.map(order=><tr key={order.id}><td>{order.reference}</td><td>{order.item}</td><td><input aria-label={'Final amount for '+order.reference} type="number" min="0.01" step="0.01" value={orderAmounts[order.id]??String(order.amount)} onChange={event=>setOrderAmounts(current=>({...current,[order.id]:event.target.value}))}/></td><td><select value={order.status} onChange={event=>void updateOrderStatus(order.id,event.target.value)}>{['draft','awaiting_payment','processing','completed','cancelled','refunded'].map(status=><option key={status} value={status}>{status.replaceAll('_',' ')}</option>)}</select></td><td><input aria-label={'Hosted checkout link for '+order.reference} type="url" placeholder="https://…" value={paymentLinks[order.id]??''} onChange={event=>setPaymentLinks(current=>({...current,[order.id]:event.target.value}))}/><button className="btn btn-dark" onClick={()=>void sendPaymentLink(order.id)}>Approve & send link</button></td><td>{new Date(order.createdAt).toLocaleString()}</td></tr>)}</tbody></table></div>:<p className="admin-empty-note">No vehicle orders have been recorded yet.</p>}</section><section className="admin-console-panel"><div className="admin-console-panel-head"><div><div className="eyebrow dark">PAYMENT RECONCILIATION</div><h2>Record an incoming payment</h2><p>Use this for payments received through an independently approved method. New records stay pending until management verifies the transaction.</p></div></div><div className="admin-task-create"><label>Order<select value={paymentOrderId} onChange={event=>setPaymentOrderId(event.target.value)}><option value="">Select an order</option>{orders.filter(order=>!['cancelled','refunded'].includes(order.status)).map(order=><option key={order.id} value={order.id}>{order.reference} · {order.item}</option>)}</select></label><div className="admin-task-fields"><label>Amount (USD)<input type="number" min="0.01" step="0.01" value={paymentAmount} onChange={event=>setPaymentAmount(event.target.value)} placeholder="e.g. 39990"/></label><label>Payment method<select value={paymentMethod} onChange={event=>setPaymentMethod(event.target.value)}><option value="bank_transfer">Bank transfer</option><option value="card">Card / online gateway</option><option value="wire_transfer">International wire</option><option value="other">Other approved method</option></select></label><label>Transaction / provider reference<input value={paymentProviderReference} onChange={event=>setPaymentProviderReference(event.target.value)} placeholder="Bank or gateway reference"/></label><button className="btn btn-dark" disabled={savingPayment||!paymentOrderId||!paymentAmount.trim()||!paymentProviderReference.trim()} onClick={()=>void recordPayment()}>{savingPayment?'Saving…':'Record pending payment'}</button></div></div></section><section className="admin-console-panel"><div className="admin-console-panel-head"><div><div className="eyebrow dark">PAYMENT RECORDS</div><h2>{payments.length} recorded payments</h2><p>Verify only after matching the transaction against the bank or payment provider.</p></div></div>{payments.length?<div className="admin-table-wrap"><table className="admin-record-table"><thead><tr><th>Payment reference</th><th>Order</th><th>Amount</th><th>Method / provider reference</th><th>Verification</th></tr></thead><tbody>{payments.map(payment=><tr key={payment.id}><td>{payment.reference}</td><td>{orders.find(order=>order.id===payment.orderId)?.reference||'Order'}</td><td>{new Intl.NumberFormat('en-US',{style:'currency',currency:payment.currency||'USD'}).format(payment.amount)}</td><td>{payment.method.replaceAll('_',' ')}<small>{payment.providerReference||'No provider reference'}</small></td><td><select value={payment.status} onChange={event=>void updatePaymentStatus(payment.id,event.target.value)}>{['pending','verified','rejected','refunded'].map(status=><option key={status} value={status}>{status}</option>)}</select></td></tr>)}</tbody></table></div>:<p className="admin-empty-note">No payments have been recorded. Payments must be recorded and independently verified.</p>}</section></>}
          {section === 'tasks' && <section className="admin-console-panel"><div className="admin-console-panel-head"><div><div className="eyebrow dark">WORK MANAGEMENT</div><h2>Tasks & follow-ups</h2><p>Create real, saved follow-up tasks for the management team.</p></div></div><div className="admin-task-create"><label>Task title<input value={taskTitle} onChange={e=>setTaskTitle(e.target.value)} placeholder="e.g. Follow up with customer"/></label><label>Description<textarea rows={2} value={taskDescription} onChange={e=>setTaskDescription(e.target.value)} placeholder="What needs to be done?"/></label><div className="admin-task-fields"><label>Priority<select value={taskPriority} onChange={e=>setTaskPriority(e.target.value)}><option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option><option value="urgent">Urgent</option></select></label><label>Due date<input type="datetime-local" value={taskDue} onChange={e=>setTaskDue(e.target.value)}/></label><button className="btn btn-dark" disabled={!taskTitle.trim()} onClick={()=>void createTask()}><Plus size={15}/> Create task</button></div></div><div className="admin-task-list">{tasks.map(task=><article key={task.id}><div><b>{task.title}</b><p>{task.description||'No description provided.'}</p><small>{task.priority.toUpperCase()} priority · {task.due_at?'Due '+new Date(task.due_at).toLocaleString():'No due date'} · Created {new Date(task.created_at).toLocaleDateString()}</small></div><label>Status<select value={task.status} onChange={e=>void updateTaskStatus(task.id,e.target.value)}><option value="open">Open</option><option value="in_progress">In progress</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option></select></label></article>)}{tasks.length===0&&<p className="admin-empty-note">No tasks yet. Create your first follow-up above.</p>}</div></section>}
          {section === 'notifications' && <section className="admin-console-panel"><div className="admin-console-panel-head"><div><div className="eyebrow dark">SYSTEM ALERTS</div><h2>Notifications</h2><p>Saved notifications from the admin notification feed.</p></div></div>{notices.map(item=><article className="admin-notice-row" key={item.id}><span className={item.is_read?'':'unread'}><Bell size={16}/></span><div><b>{item.title}</b><p>{item.body}</p><small>{item.type} · {new Date(item.created_at).toLocaleString()}</small></div>{!item.is_read&&<button className="btn btn-outline" onClick={()=>void markNoticeRead(item.id)}>Mark read</button>}</article>)}{notices.length===0&&<p className="admin-empty-note">No saved notifications yet. New system notifications will appear here.</p>}</section>}
          {section === 'activity' && <section className="admin-console-panel"><div className="admin-console-panel-head"><div><div className="eyebrow dark">ADMIN AUDIT TRAIL</div><h2>Activity logs</h2><p>Recent recorded administrative actions. This view does not invent activity that has not been logged.</p></div></div>{auditEntries.map(entry=><article className="admin-audit-row" key={entry.id}><span><FileClock size={16}/></span><div><b>{entry.action.replaceAll('_',' ')}</b><p>{entry.entity_type}{entry.entity_id?' · '+entry.entity_id:''}</p><small>{new Date(entry.created_at).toLocaleString()} · {JSON.stringify(entry.details||{})}</small></div></article>)}{auditEntries.length===0&&<p className="admin-empty-note">No audit events have been recorded yet.</p>}</section>}
          {section === 'settings' && <><section className="admin-console-panel"><div className="eyebrow dark">ACCOUNT SECURITY</div><h2>Administrator sign-in protection</h2><p>Management access uses your private administrator password. No authenticator code is required.</p><div className="admin-security-row"><div><b>Administrator password</b><small>Only your password is required to sign in.</small></div><span className="admin-security-status">Password protected</span></div></section><section className="admin-console-panel admin-profile-settings"><div className="eyebrow dark">MANAGEMENT PROFILE</div><h2>Chat profile picture</h2><p>Upload or replace the picture displayed beside Tesla Markets Management in customer chat.</p><div className="admin-profile-preview">{profileUrl?<img src={profileUrl} alt="Current management profile"/>:<CircleUserRound size={54}/>}<span>{profileUrl?'Current profile picture':'No custom profile picture saved yet'}</span></div><label className="admin-upload-label">Choose a new profile picture<input type="file" accept="image/png,image/jpeg,image/webp" onChange={event=>setProfileFile(event.target.files?.[0]||null)}/></label><small>JPG, PNG or WEBP · maximum 4 MB</small><button className="btn btn-dark" disabled={!profileFile||savingProfile} onClick={()=>void saveProfile()}>{savingProfile?'Saving…':'Save profile picture'}</button></section></>}
          {section === 'team' && <section className="admin-console-panel"><div className="admin-console-panel-head"><div><div className="eyebrow dark">PEOPLE & ACCESS</div><h2>Team management</h2><p>Team invitations and backend-enforced role assignments require the team-membership service to be configured. No staff accounts are fabricated here.</p></div></div><p className="admin-empty-note">No team directory is connected yet. Existing administrator access remains protected by the current Supabase admin check.</p></section>}
          {section === 'analytics' && <section className="admin-console-panel"><div className="admin-console-panel-head"><div><div className="eyebrow dark">OPERATIONAL REPORTING</div><h2>Activity analytics</h2><p>Recorded operational activity only. Visitor figures are page views, not unique people.</p></div></div><div className="tm-kpi-grid"><article className="tm-kpi-card"><div><small>Registered customers</small><strong>{registeredCustomerCount??'—'}</strong></div></article><article className="tm-kpi-card"><div><small>Recorded page views</small><strong>{overview?.visits??'—'}</strong></div></article><article className="tm-kpi-card"><div><small>Customer conversations</small><strong>{overview?.conversations??'—'}</strong></div></article><article className="tm-kpi-card"><div><small>Messages recorded</small><strong>{overview?.messages??'—'}</strong></div></article></div><div className="admin-table-wrap"><table className="admin-record-table"><thead><tr><th>Date</th><th>Page</th><th>Recorded views</th></tr></thead><tbody>{activityBuckets.map(day=><tr key={day.label}><td>{day.label}</td><td>Website pages</td><td>{day.count}</td></tr>)}</tbody></table></div></section>}
          {section === 'announcements' && <section className="admin-console-panel"><div className="admin-console-panel-head"><div><div className="eyebrow dark">WEBSITE CONTENT</div><h2>Content & announcements</h2><p>Use Website Manager for currently supported public copy. Announcement publishing needs a connected content schema before it can be safely enabled.</p></div></div><button className="btn btn-dark" onClick={()=>setSection('content')}>Open Website Manager</button></section>}
          {section === 'profile' && <section className="admin-console-panel admin-profile-settings"><div className="eyebrow dark">ADMIN PROFILE</div><h2>Management profile</h2><p>Update the profile image displayed in customer communications.</p><div className="admin-profile-preview">{profileUrl?<img src={profileUrl} alt="Current management profile"/>:<CircleUserRound size={54}/>}<span>{profileUrl?'Current profile picture':'No custom profile picture saved yet'}</span></div><label className="admin-upload-label">Choose a new profile picture<input type="file" accept="image/png,image/jpeg,image/webp" onChange={event=>setProfileFile(event.target.files?.[0]||null)}/></label><button className="btn btn-dark" disabled={!profileFile||savingProfile} onClick={()=>void saveProfile()}>{savingProfile?'Saving…':'Save profile picture'}</button></section>}
          {section === 'security' && <section className="admin-console-panel"><div className="eyebrow dark">ACCESS CONTROL</div><h2>Security & permissions</h2><p>Current administrator access is validated by the existing Supabase admin authorization check. Team-level role permissions and 2FA enrollment are not represented as active until their backend policies and flows are configured.</p><div className="admin-security-row"><div><b>Administrator session</b><small>{user.email}</small></div><span className="admin-security-status">Authenticated</span></div><button className="btn btn-outline" onClick={()=>void supabase.auth.signOut()}>Sign out securely</button></section>}
          <footer className="admin-console-footer">Signed in as {user.email} · Private management session · <a href="#home">Open public website</a></footer>
        </main>
      </div>
    </div>
  );
}
