import { useEffect, useState } from 'react';
import { isCurrentUserAdmin, supabase, supabaseConfigured } from './lib/supabase';
import { Activity, CarFront, ClipboardList, LogOut, MessageCircle, RefreshCw, ShieldCheck, Users, Eye, Settings, CircleUserRound, Menu, X, ShoppingBag, ChevronDown, LayoutDashboard, Image, Globe, Inbox, Sun, Moon, Search, Bell, Plus, Upload, Pencil, ArrowUpRight, ChevronRight, Monitor, Smartphone, ListTodo, FileClock, Home, Grid2X2 } from 'lucide-react';
import { AdminInbox } from './ChatWorkspace';
import { AiManagement } from './AiManagement';
import { getDiscountedPrice, storeProducts } from './marketplace-catalog';

const ADMIN_EMAIL = 'oyejideoluwatobi7@gmail.com';
const ADMIN_AUTH_REDIRECT = 'https://tesla-markets.vercel.app/#admin';
type Thread = { id: string; visitorName?: string; visitorEmail?: string; enquiryType?:string; enquirySource?:string; vehicleModel?:string; phone?:string; preferredLanguage?:string; createdAt: number; updatedAt: number; lastMessage?: string; status?: string };
type Visit = { id: string; page: string; createdAt: number };
type OperationalOrder = {id:string;reference:string;item:string;status:string;amount:number;currency:string;customerId:string;conversationId:string|null;paymentUrl:string|null;createdAt:number};
type OperationalPayment = {id:string;reference:string;orderId:string;amount:number;currency:string;method:string;providerReference:string|null;status:string;proofPath:string|null;proofUrl:string|null;createdAt:number};
type PaymentAccountConfig = {enabled?:boolean;accountName?:string;email?:string;phone?:string;username?:string;instructions?:string};
type ShopOrderReview = {
  id:string; reference:string; customerName:string; email:string; phone:string;
  address:string; city:string; region:string|null; postalCode:string|null; country:string;
  deliveryCarrier:string|null; trackingNumber:string|null; trackingUrl:string|null;
  items:Array<{product_id?:string;name:string;quantity:number;selected_size?:string|null;unit_price:number;original_unit_price?:number;discount_percent?:number}>;
  subtotal:number; discountTotal:number; currency:string; status:string; createdAt:number;
};
type ShopProofReview = {
  id:string; orderId:string; method:string; storagePath:string; signedUrl:string;
  status:string; reviewNote:string|null; createdAt:number; reviewedAt:string|null;
};
type Overview = { conversations: number; messages: number; generatedImages: number; visits: number; clicks: number; onlineNow: number; updatedAt: number };
type AdminTask = {id:string;title:string;description:string;status:string;priority:string;due_at:string|null;created_at:string};
type AdminNotice = {id:string;title:string;body:string;type:string;is_read:boolean;created_at:string};
type AuditEntry = {id:number;action:string;entity_type:string;entity_id:string|null;details:any;created_at:string};
type CustomerProfileRecord = {id:string;display_name:string;email:string;phone:string;crm_stage:string;created_at:string;is_admin:boolean};
type VehicleEnquiryRecord = {id:string;customer_id:string;vehicle_model:string;configuration:any;customer_note:string;status:string;created_at:string;customerName:string;customerEmail:string;customerPhone:string};
type InvestmentEnquiryRecord = {id:string;customer_id:string;opportunity:string;category:string;customer_question:string;status:string;created_at:string;customerName:string;customerEmail:string};
type VehicleCatalogRecord = {id:string;name:string;model:string;slug:string;price_usd:string;availability:string;is_published:boolean;verification_status:string;source_type:string|null;source_url:string|null;last_verified_at:string|null;images:string[]};
function AdminShopImage({src,name}:{src:string;name:string}) {
  const [status,setStatus]=useState<'loading'|'loaded'|'failed'>('loading');
  return <div className="admin-shop-image-check">
    <img src={src} alt={name} loading="lazy" onLoad={()=>setStatus('loaded')} onError={()=>setStatus('failed')}/>
    <small className={status}>{status==='loaded'?'Image loaded':status==='failed'?'Image failed':'Checking image…'}</small>
  </div>;
}

type Section = 'shop' | 'ai' | 'overview' | 'visitors' | 'customers' | 'catalogue' | 'vehicleEnquiries' | 'investment' | 'content' | 'media' | 'messages' | 'operations' | 'orders' | 'tasks' | 'notifications' | 'activity' | 'settings' | 'team' | 'analytics' | 'translations' | 'announcements' | 'profile' | 'security';

const catalogue = [
  { name: 'Model 3', count: 5, first: '/resources/model-3-1.jpg' },
  { name: 'Model Y', count: 5, first: '/resources/model-y-1.jpg' },
  { name: 'Cybertruck', count: 10, first: '/resources/cybertruck-1.jpg' },
  { name: 'Roadster', count: 5, first: '/resources/roadster-1.jpg' },
  { name: 'Tesla Semi', count: 10, first: '/resources/semi-1.jpg' },
];
const statusOptions = ['open', 'pending', 'closed'];
const getTeslaPushApplicationServerKey = async () => {
  const response = await fetch('/api/push-config', { cache: 'no-store' });
  if (!response.ok) throw new Error('The notification server key could not be loaded.');
  const config = await response.json() as { publicKey?: string };
  const publicKey = config.publicKey || '';
  const normalizedKey = publicKey.replace(/-/g, '+').replace(/_/g, '/');
  const applicationServerKey = Uint8Array.from(atob(normalizedKey + '='.repeat((4 - normalizedKey.length % 4) % 4)), char => char.charCodeAt(0));
  if (applicationServerKey.length !== 65 || applicationServerKey[0] !== 4) throw new Error('The notification server key is invalid.');
  return applicationServerKey;
};
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
  const [translationIssues,setTranslationIssues]=useState<Array<{id:string;target_language:string;issue_type:string;component:string|null;details:any;created_at:string}>>([]);
  const [customerProfiles,setCustomerProfiles]=useState<CustomerProfileRecord[]>([]);
  const [vehicleEnquiries,setVehicleEnquiries]=useState<VehicleEnquiryRecord[]>([]);
  const [investmentEnquiries,setInvestmentEnquiries]=useState<InvestmentEnquiryRecord[]>([]);
  const [vehicleCatalog,setVehicleCatalog]=useState<VehicleCatalogRecord[]>([]);
  const [updatingVehicleCatalog,setUpdatingVehicleCatalog]=useState<string|null>(null);
  const [updatingEnquiry,setUpdatingEnquiry]=useState<string|null>(null);
  const [visits, setVisits] = useState<Visit[]>([]);
  const [orders,setOrders]=useState<OperationalOrder[]>([]);
  const [payments,setPayments]=useState<OperationalPayment[]>([]);
  const [shopOrders,setShopOrders]=useState<ShopOrderReview[]>([]);
  const [shopTrackingDrafts,setShopTrackingDrafts]=useState<Record<string,{carrier:string;number:string;url:string}>>({});
  const [shopProofs,setShopProofs]=useState<ShopProofReview[]>([]);
  const [reviewingShopProof,setReviewingShopProof]=useState<string|null>(null);
  const [shopProofRejectionReasons,setShopProofRejectionReasons]=useState<Record<string,string>>({});
  const [updatingShopOrder,setUpdatingShopOrder]=useState<string|null>(null);
  const [paymentLinks,setPaymentLinks]=useState<Record<string,string>>({});
  const [orderAmounts,setOrderAmounts]=useState<Record<string,string>>({});
  const [paymentOrderId,setPaymentOrderId]=useState('');
  const [paymentAmount,setPaymentAmount]=useState('');
  const [paymentMethod,setPaymentMethod]=useState('bank_transfer');
  const [paymentProviderReference,setPaymentProviderReference]=useState('');
  const [paymentAccountDetails,setPaymentAccountDetails]=useState<Record<string,PaymentAccountConfig>>({});
  const [giftCardEnabled,setGiftCardEnabled]=useState(false);
  const [savingPaymentAccounts,setSavingPaymentAccounts]=useState(false);
  const [savingPayment,setSavingPayment]=useState(false);
  const [tasks,setTasks]=useState<AdminTask[]>([]);
  const [notices,setNotices]=useState<AdminNotice[]>([]);
  const [auditEntries,setAuditEntries]=useState<AuditEntry[]>([]);
  const [taskTitle,setTaskTitle]=useState('');
  const [taskDescription,setTaskDescription]=useState('');
  const [taskPriority,setTaskPriority]=useState('normal');
  const [taskDue,setTaskDue]=useState('');
  const [section, setSection] = useState<Section>('overview');
  const [shopCatalogueSearch,setShopCatalogueSearch]=useState('');
  const [mobileNavOpen,setMobileNavOpen]=useState(false);
  const [moreOpen,setMoreOpen]=useState(false);
  const [installedAppMode,setInstalledAppMode]=useState(()=>window.matchMedia('(display-mode: standalone)').matches || Boolean((navigator as any).standalone));
  useEffect(()=>{
    const media=window.matchMedia('(display-mode: standalone)');
    const update=()=>setInstalledAppMode(media.matches || Boolean((navigator as any).standalone));
    media.addEventListener?.('change',update);
    window.addEventListener('appinstalled',update);
    return()=>{media.removeEventListener?.('change',update);window.removeEventListener('appinstalled',update);};
  },[]);
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
  const [showInstallCard,setShowInstallCard] = useState(false);
  const [isInstalled,setIsInstalled] = useState(false);
  const [notificationPermission,setNotificationPermission] = useState<NotificationPermission>(typeof Notification==='undefined'?'denied':Notification.permission);
  const [notificationStatus,setNotificationStatus] = useState('');
  const [pushSubscribed,setPushSubscribed] = useState(false);
  const [pushBusy,setPushBusy] = useState(false);
  const [desktopView,setDesktopView] = useState(()=>localStorage.getItem('tesla-admin-desktop-view')==='true');
  const toggleDesktopView=()=>setDesktopView(current=>{const next=!current;localStorage.setItem('tesla-admin-desktop-view',String(next));return next;});

  useEffect(() => {
    const standalone = () => window.matchMedia('(display-mode: standalone)').matches || Boolean((navigator as any).standalone);
    const alreadyInstalled = standalone() || localStorage.getItem('tesla-admin-installed') === 'true';
    setIsInstalled(alreadyInstalled);
    const onInstallPrompt = (event: Event) => {
      event.preventDefault();
      if (!alreadyInstalled && localStorage.getItem('tesla-admin-install-dismissed') !== 'true') { setInstallPrompt(event as any); setShowInstallCard(true); }
    };
    const onInstalled = () => {
      setIsInstalled(true);
      setInstalledAppMode(true);
      setInstallPrompt(null);
      setShowInstallCard(true);
      localStorage.setItem('tesla-admin-installed', 'true');
      localStorage.removeItem('tesla-admin-install-dismissed');
      setNotificationStatus('Tesla Markets Management is installed on this device.');
    };
    window.addEventListener('beforeinstallprompt', onInstallPrompt);
    window.addEventListener('appinstalled', onInstalled);
    if ('serviceWorker' in navigator) void navigator.serviceWorker.register('/sw.js').catch(() => setNotificationStatus('App worker could not be registered. Refresh and try again.'));
    return () => { window.removeEventListener('beforeinstallprompt', onInstallPrompt); window.removeEventListener('appinstalled', onInstalled); };
  }, []);

  useEffect(() => {
    const installed = window.matchMedia('(display-mode: standalone)').matches || Boolean((navigator as any).standalone) || localStorage.getItem('tesla-admin-installed') === 'true';
    if (installed) {
      if (typeof Notification !== 'undefined' && Notification.permission !== 'granted' && localStorage.getItem('tesla-admin-notifications-dismissed') !== 'true') {
        const timer = window.setTimeout(() => setShowInstallCard(true), 850);
        return () => window.clearTimeout(timer);
      }
      return;
    }
    if (localStorage.getItem('tesla-admin-install-dismissed') === 'true') return;
    const timer = window.setTimeout(() => setShowInstallCard(true), 1100);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const restorePushState = async () => {
      try {
        if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
        const registration = await navigator.serviceWorker.ready;
        let subscription = await registration.pushManager.getSubscription();
        if (!subscription || cancelled) { if (!cancelled) setPushSubscribed(false); return; }
        const { data: { user: currentUser }, error: userError } = await supabase.auth.getUser();
        if (userError || !currentUser || cancelled) return;

        // Migrate subscriptions created with the previous hard-coded VAPID key.
        const applicationServerKey = await getTeslaPushApplicationServerKey();
        const existingKey = subscription.options.applicationServerKey;
        const existing = existingKey ? Array.from(new Uint8Array(existingKey)) : [];
        const expected = Array.from(applicationServerKey);
        if (existing.length !== expected.length || existing.some((byte, index) => byte !== expected[index])) {
          const oldEndpoint = subscription.endpoint;
          await subscription.unsubscribe();
          subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey });
          const json = subscription.toJSON();
          const { error: saveError } = await supabase.from('admin_push_subscriptions').upsert({
            user_id: currentUser.id, endpoint: subscription.endpoint, p256dh: json.keys?.p256dh, auth: json.keys?.auth,
            expiration_time: subscription.expirationTime ? new Date(subscription.expirationTime).toISOString() : null,
            updated_at: new Date().toISOString()
          }, { onConflict: 'endpoint' });
          if (saveError) throw saveError;
          await supabase.from('admin_push_subscriptions').delete().eq('user_id', currentUser.id).eq('endpoint', oldEndpoint);
        }
        const { data, error } = await supabase.from('admin_push_subscriptions').select('endpoint').eq('user_id', currentUser.id).eq('endpoint', subscription.endpoint).maybeSingle();
        if (error) throw error;
        if (!data && Notification.permission === 'granted') {
          const json = subscription.toJSON();
          const { error: saveError } = await supabase.from('admin_push_subscriptions').upsert({
            user_id: currentUser.id, endpoint: subscription.endpoint, p256dh: json.keys?.p256dh, auth: json.keys?.auth,
            expiration_time: subscription.expirationTime ? new Date(subscription.expirationTime).toISOString() : null,
            updated_at: new Date().toISOString()
          }, { onConflict: 'endpoint' });
          if (saveError) throw saveError;
        }
        if (!cancelled) setPushSubscribed(true);
      } catch (error) {
        if (!cancelled) setNotificationStatus(error instanceof Error ? error.message : 'Could not check this app notification subscription. Tap Enable app notifications to retry.');
      }
    };
    void restorePushState();
    return () => { cancelled = true; };
  }, []);

  const enablePhoneNotifications = async () => {
    if (!('Notification' in window)) { setNotificationStatus('Notifications are not supported in this app environment.'); return; }
    setPushBusy(true);
    try {
      let permission = Notification.permission;
      if (permission !== 'granted') permission = await Notification.requestPermission();
      setNotificationPermission(permission);
      if (permission !== 'granted') { setNotificationStatus(permission === 'denied' ? 'Notifications are blocked for this app in Android settings.' : 'Allow notifications to continue.'); return; }
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) throw new Error('Push notifications are not supported in this app environment.');
      const registration = await navigator.serviceWorker.ready;
      const applicationServerKey = await getTeslaPushApplicationServerKey();
      let subscription=await registration.pushManager.getSubscription();
      if(subscription){
        const existingKey=subscription.options.applicationServerKey;
        const existing=existingKey?Array.from(new Uint8Array(existingKey)):[];
        if(existing.length!==applicationServerKey.length||existing.some((byte,index)=>byte!==applicationServerKey[index])){ await subscription.unsubscribe(); subscription=null; }
      }
      if(!subscription) subscription=await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey});
      const json=subscription.toJSON();
      const {data:{user:currentUser},error:userError}=await supabase.auth.getUser();
      if(userError||!currentUser) throw new Error('Your administrator session has expired. Sign in again.');
      const {error:saveError}=await supabase.from('admin_push_subscriptions').upsert({user_id:currentUser.id,endpoint:subscription.endpoint,p256dh:json.keys?.p256dh,auth:json.keys?.auth,expiration_time:subscription.expirationTime?new Date(subscription.expirationTime).toISOString():null,updated_at:new Date().toISOString()},{onConflict:'endpoint'});
      if(saveError) throw saveError;
      setPushSubscribed(true);
      setShowInstallCard(false);
      localStorage.setItem('tesla-admin-notifications-dismissed','true');
      setNotificationStatus('Notifications are enabled for this app. You can turn them off here at any time.');
      await registration.showNotification('Tesla Markets Management',{body:'Customer message alerts are enabled on this app.',icon:'/icons/tesla-app-icon-192.png',badge:'/icons/tesla-app-icon-192.png',tag:'tesla-admin-notifications-enabled'});
    } catch(e) { setPushSubscribed(false); setNotificationStatus(e instanceof Error?e.message:'Could not enable notifications.'); }
    finally { setPushBusy(false); }
  };

  const disablePhoneNotifications = async () => {
    setPushBusy(true);
    try {
      const registration=await navigator.serviceWorker.ready;
      const subscription=await registration.pushManager.getSubscription();
      if(subscription){
        const {error:deleteError}=await supabase.from('admin_push_subscriptions').delete().eq('endpoint',subscription.endpoint);
        if(deleteError) throw deleteError;
        const removed=await subscription.unsubscribe();
        if(!removed) throw new Error('The browser did not confirm that notifications were disabled. Try again.');
      }
      setPushSubscribed(false);
      setNotificationStatus('Notifications are turned off for this app on this phone.');
    } catch(e) { setNotificationStatus(e instanceof Error?e.message:'Could not turn off notifications.'); }
    finally { setPushBusy(false); }
  };

  const installAdminApp = async () => {
    if (!installPrompt) { setNotificationStatus('The automatic install prompt is unavailable in this browser. Use Chrome menu ⋮ → Install app. Do not choose Add to Home screen.'); return; }
    try {
      await installPrompt.prompt();
      const choice = await installPrompt.userChoice;
      setNotificationStatus(choice?.outcome === 'accepted' ? 'Installation accepted. Follow the Android prompt to finish.' : 'Installation cancelled. You can install later from Chrome menu ⋮ → Install app.');
      setInstallPrompt(null);
    } catch { setNotificationStatus('Open Chrome menu ⋮ and choose Install app. Do not choose Add to Home screen.'); }
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
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'admin_notifications' }, () => {
        if (active) void load();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'store_orders' }, () => {
        if (active) void load();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'store_payment_submissions' }, () => {
        if (active) void load();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'site_presence' }, () => {
        if (active) void load();
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'site_visits' }, () => {
        if (active) void load();
      })
      .subscribe((status) => { if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') setNotificationStatus('Live message connection interrupted. Refresh the admin app to reconnect.'); });
    return () => { active = false; void supabase.removeChannel(channel); };
  }, [user?.email]);


  const load = async () => {
    setRefreshing(true);
    try {
      const [visitCount, clickCount, conversationCount, messageCount, presenceCount, visitorLog, conversationRows, customerCount, customerProfileRows, vehicleEnquiryRows, investmentEnquiryRows, vehicleCatalogRows, orderRows, paymentRows, storeOrderRows, storeProofRows, taskRows, noticeRows, auditRows, translationIssueRows] = await Promise.all([
        supabase.from('site_visits').select('id', { count:'exact', head:true }),
        supabase.from('site_clicks').select('id', { count:'exact', head:true }),
        supabase.from('support_conversations').select('id', { count:'exact', head:true }),
        supabase.from('support_messages').select('id', { count:'exact', head:true }),
        supabase.from('site_presence').select('visitor_id', { count:'exact', head:true }).gte('last_seen_at', new Date(Date.now()-90000).toISOString()),
        supabase.from('site_visits').select('id,page,created_at').order('created_at',{ascending:false}).limit(100),
        supabase.from('support_conversations').select('id,customer_id,subject,status,updated_at,visitor_email,enquiry_type,enquiry_source,vehicle_model,contact_phone,preferred_language').order('updated_at',{ascending:false}).limit(100),
        supabase.from('customer_profiles').select('id',{count:'exact',head:true}).eq('is_admin',false),
        supabase.from('customer_profiles').select('id,display_name,email,phone,crm_stage,created_at,is_admin').order('created_at',{ascending:false}).limit(500),
        supabase.from('vehicle_enquiries').select('id,customer_id,vehicle_model,configuration,customer_note,status,created_at,updated_at').order('created_at',{ascending:false}).limit(200),
        supabase.from('investment_enquiries').select('id,customer_id,opportunity,category,customer_question,status,created_at,updated_at').order('created_at',{ascending:false}).limit(200),
        supabase.from('vehicle_catalog').select('id,name,model,slug,price_usd,availability,is_published,verification_status,source_type,source_url,last_verified_at,images').order('name'),
        supabase.from('business_orders').select('id,order_reference,item_description,status,agreed_amount,currency,customer_id,conversation_id,payment_url,created_at').order('created_at',{ascending:false}).limit(200),
        supabase.from('business_payments').select('id,payment_reference,order_id,amount,currency,method,provider_reference,proof_path,status,created_at').order('created_at',{ascending:false}).limit(200),
        supabase.from('store_orders').select('id,order_reference,customer_name,customer_email,customer_phone,delivery_address,delivery_city,delivery_region,delivery_postal_code,delivery_country,delivery_carrier,tracking_number,tracking_url,items,subtotal,discount_total,currency,status,created_at').order('created_at',{ascending:false}).limit(200),
        supabase.from('store_payment_submissions').select('id,order_id,payment_method,proof_storage_path,status,review_note,reviewed_at,created_at').order('created_at',{ascending:false}).limit(200),
        supabase.from('admin_tasks').select('id,title,description,status,priority,due_at,created_at').order('created_at',{ascending:false}).limit(200),
        supabase.from('admin_notifications').select('id,title,body,type,is_read,created_at').order('created_at',{ascending:false}).limit(100),
        supabase.from('admin_audit_logs').select('id,action,entity_type,entity_id,details,created_at').order('created_at',{ascending:false}).limit(100),
        supabase.from('translation_issues').select('id,target_language,issue_type,component,details,created_at').order('created_at',{ascending:false}).limit(100),
      ]);
      for (const result of [visitCount,clickCount,conversationCount,messageCount,presenceCount,visitorLog,conversationRows,customerCount,customerProfileRows,vehicleEnquiryRows,investmentEnquiryRows,vehicleCatalogRows,orderRows,paymentRows,storeOrderRows,storeProofRows,taskRows,noticeRows,auditRows,translationIssueRows]) if (result.error) throw result.error;
      setTranslationIssues((translationIssueRows.data||[]) as any[]);
      const rows=conversationRows.data||[];
      const profiles=customerProfileRows.data||[];
      const names=new Map(profiles.map(profile=>[profile.id,profile]));
      setCustomerProfiles(profiles.filter(profile=>!profile.is_admin));
      setRegisteredCustomerCount(customerCount.count??profiles.filter(profile=>!profile.is_admin).length);
      setVehicleEnquiries((vehicleEnquiryRows.data||[]).map(row=>{const profile=names.get(row.customer_id);const delivery=row.configuration?.delivery||{};return {id:row.id,customer_id:row.customer_id,vehicle_model:row.vehicle_model,configuration:row.configuration||{},customer_note:row.customer_note||'',status:row.status||'new',created_at:row.created_at,customerName:profile?.display_name||delivery.full_name||'Customer',customerEmail:profile?.email||delivery.email||'',customerPhone:profile?.phone||delivery.phone||''};}));
      setInvestmentEnquiries((investmentEnquiryRows.data||[]).map(row=>{const profile=names.get(row.customer_id);return {id:row.id,customer_id:row.customer_id,opportunity:row.opportunity||'Investment information',category:row.category||'public_market_information',customer_question:row.customer_question||'',status:row.status||'new',created_at:row.created_at,customerName:profile?.display_name||'Customer',customerEmail:profile?.email||''};}));
      setVehicleCatalog((vehicleCatalogRows.data||[]).map(row=>({id:row.id,name:row.name,model:row.model,slug:row.slug,price_usd:String(row.price_usd||''),availability:row.availability||'coming_soon',is_published:!!row.is_published,verification_status:row.verification_status||'unverified',source_type:row.source_type||null,source_url:row.source_url||null,last_verified_at:row.last_verified_at||null,images:Array.isArray(row.images)?row.images:[]})));
      const mapped=await Promise.all(rows.map(async row=>{
        const {data:last,error:lastError}=await supabase.from('support_messages').select('body,created_at').eq('conversation_id',row.id).order('created_at',{ascending:false}).limit(1).maybeSingle();
        if(lastError) throw lastError;
        const profile=names.get(row.customer_id);return {id:row.id,visitorName:profile?.display_name||'Website visitor',visitorEmail:row.visitor_email||profile?.email||'',phone:row.contact_phone||profile?.phone||'',preferredLanguage:row.preferred_language||'en',enquiryType:row.enquiry_type||'general',enquirySource:row.enquiry_source||'Website chat',vehicleModel:row.vehicle_model||'',createdAt:new Date(row.updated_at).getTime(),updatedAt:new Date(row.updated_at).getTime(),lastMessage:last?.body||row.subject||'Conversation opened',status:row.status};
      }));
      setOverview({visits:visitCount.count||0,clicks:clickCount.count||0,conversations:conversationCount.count||0,messages:messageCount.count||0,generatedImages:0,onlineNow:presenceCount.count||0,updatedAt:Date.now()});
      setThreads(mapped);
      setVisits((visitorLog.data||[]).map(row=>({id:row.id,page:row.page,createdAt:new Date(row.created_at).getTime()})));
      setOrders((orderRows.data||[]).map(row=>({id:row.id,reference:row.order_reference||row.id.slice(0,8),item:row.item_description||'Customer request',status:row.status||'draft',amount:Number(row.agreed_amount||0),currency:row.currency||'USD',customerId:row.customer_id,conversationId:row.conversation_id||null,paymentUrl:row.payment_url||null,createdAt:new Date(row.created_at).getTime()})));
      setPaymentLinks(Object.fromEntries((orderRows.data||[]).map(row=>[row.id,row.payment_url||''])));
      setOrderAmounts(Object.fromEntries((orderRows.data||[]).map(row=>[row.id,String(row.agreed_amount||'')])))
      const mappedPayments=await Promise.all((paymentRows.data||[]).map(async row=>{let proofUrl:string|null=null;const proofPath=row.proof_path||null;if(proofPath){try{const {data:signed}=await supabase.storage.from('support-attachments').createSignedUrl(proofPath,900);proofUrl=signed?.signedUrl||null;}catch{proofUrl=null;}}return{id:row.id,reference:row.payment_reference,orderId:row.order_id,amount:Number(row.amount||0),currency:row.currency||'USD',method:row.method||'unknown',providerReference:row.provider_reference||null,status:row.status||'pending',proofPath,proofUrl,createdAt:new Date(row.created_at).getTime()};}));
       setPayments(mappedPayments);
      const mappedShopOrders=(storeOrderRows.data||[]).map(row=>({
        id:row.id,reference:row.order_reference,customerName:row.customer_name,email:row.customer_email,phone:row.customer_phone,
        address:row.delivery_address,city:row.delivery_city,region:row.delivery_region||null,postalCode:row.delivery_postal_code||null,country:row.delivery_country,
        deliveryCarrier:row.delivery_carrier||null,trackingNumber:row.tracking_number||null,trackingUrl:row.tracking_url||null,
        items:Array.isArray(row.items)?row.items:[],subtotal:Number(row.subtotal||0),discountTotal:Number(row.discount_total||0),
        currency:row.currency||'USD',status:row.status||'awaiting_payment',createdAt:new Date(row.created_at).getTime()
      }));
      setShopOrders(mappedShopOrders);
      setShopTrackingDrafts(Object.fromEntries(mappedShopOrders.map(order=>[order.id,{carrier:order.deliveryCarrier||'',number:order.trackingNumber||'',url:order.trackingUrl||''}])));
      const signedShopProofs=await Promise.all((storeProofRows.data||[]).map(async row=>{
        const {data:signed,error:signedError}=await supabase.storage.from('shop-payment-proofs').createSignedUrl(row.proof_storage_path,900);
        if(signedError) throw signedError;
        return {id:row.id,orderId:row.order_id,method:row.payment_method,storagePath:row.proof_storage_path,
          signedUrl:signed?.signedUrl||'',status:row.status||'pending',reviewNote:row.review_note||null,
          createdAt:new Date(row.created_at).getTime(),reviewedAt:row.reviewed_at||null};
      }));
      setShopProofs(signedShopProofs);
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
      const { data, error: settingsError } = await supabase.from('site_settings').select('key,value').in('key',['public_site_content','investment_gallery','payment_account_details']);
      if(settingsError){setError(settingsError.message);return;}
      const contentRow=data?.find(row=>row.key==='public_site_content');
      const galleryRow=data?.find(row=>row.key==='investment_gallery');
      const paymentAccountsRow=data?.find(row=>row.key==='payment_account_details');
      if(paymentAccountsRow?.value&&typeof paymentAccountsRow.value==='object'){
        const saved=paymentAccountsRow.value as Record<string,any>;
        const normalized:Record<string,PaymentAccountConfig>={};
        for(const method of ['PayPal','Zelle','Chime','Apple Pay']){
          const details=saved[method]&&typeof saved[method]==='object'?saved[method]:{};
          const hasRecipient=[details.accountName,details.email,details.phone,details.username].some(value=>typeof value==='string'&&value.trim().length>0);
          normalized[method]={...details,enabled:typeof details.enabled==='boolean'?details.enabled:hasRecipient};
        }
        setPaymentAccountDetails(normalized);
        setGiftCardEnabled(saved.giftCardEnabled===true);
      }
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
  const markAllNoticesRead = async () => {
    try {
      const {error:updateError}=await supabase.from('admin_notifications').update({is_read:true}).eq('is_read',false);
      if(updateError)throw updateError;
      setNotices(current=>current.map(item=>({...item,is_read:true})));
      setError('');
    } catch(e) {
      setError(e instanceof Error?e.message:'Could not mark notifications as read.');
    }
  };

  const reviewShopPaymentProof = async (proofId:string, decision:'approve'|'reject', reason = '') => {
    const proof=shopProofs.find(item=>item.id===proofId);
    const order=proof?shopOrders.find(item=>item.id===proof.orderId):null;
    if(!proof||!order){setError('The shop payment proof or order could not be found.');return;}
    if(decision==='reject'&&!reason.trim()){setError('Enter a rejection reason for the customer.');return;}
    setReviewingShopProof(proofId);
    try {
      const {user:current,isAdmin}=await isCurrentUserAdmin();
      if(!current||!isAdmin) throw new Error('Administrator session expired.');
      const now=new Date().toISOString();
      const proofStatus=decision==='approve'?'approved_pending_settlement':'rejected';
      const orderStatus=decision==='approve'?'proof_approved_pending_settlement':'payment_proof_rejected';
      const note=decision==='approve'
        ? 'Your submission has been reviewed and accepted by management. Your order is awaiting its next fulfilment update.'
        : reason.trim();
      const {error:proofError}=await supabase.from('store_payment_submissions').update({
        status:proofStatus,review_note:note,reviewed_by:current.id,reviewed_at:now
      }).eq('id',proofId);
      if(proofError) throw proofError;
      const {error:orderError}=await supabase.from('store_orders').update({
        status:orderStatus,updated_at:now
      }).eq('id',order.id);
      if(orderError) throw orderError;
      setShopProofs(currentProofs=>currentProofs.map(item=>item.id===proofId?{...item,status:proofStatus,reviewNote:note,reviewedAt:now}:item));
      setShopOrders(currentOrders=>currentOrders.map(item=>item.id===order.id?{...item,status:orderStatus}:item));
      setShopProofRejectionReasons(currentReasons=>({...currentReasons,[proofId]:''}));
      setError('');
    } catch(e) {
      setError(e instanceof Error?e.message:'Could not review this payment submission.');
    } finally {
      setReviewingShopProof(null);
    }
  };

  const updateShopOrderProgress = async (orderId:string,status:string) => {
    const allowed=['saved_for_later','awaiting_payment','proof_submitted','payment_proof_rejected','proof_approved_pending_settlement','processing','shipped','delivered','completed','cancelled'];
    if(!allowed.includes(status))return;
    setUpdatingShopOrder(orderId);
    try {
      const {user:current,isAdmin}=await isCurrentUserAdmin();
      if(!current||!isAdmin)throw new Error('Administrator session expired.');
      const now=new Date().toISOString();
      const {error:updateError}=await supabase.from('store_orders').update({status,updated_at:now}).eq('id',orderId);
      if(updateError)throw updateError;
      setShopOrders(currentOrders=>currentOrders.map(order=>order.id===orderId?{...order,status,createdAt:order.createdAt}:order));
      setError('');
    } catch(e) {
      setError(e instanceof Error?e.message:'Could not update this shop order.');
    } finally {
      setUpdatingShopOrder(null);
    }
  };

  const saveShopOrderTracking = async (orderId:string) => {
    const draft=shopTrackingDrafts[orderId]||{carrier:'',number:'',url:''};
    const carrier=draft.carrier.trim(),number=draft.number.trim(),url=draft.url.trim();
    if((carrier&&!number)||(!carrier&&number)){setError('Enter both the delivery carrier and tracking number, or clear both fields.');return;}
    if(url){try{const parsed=new URL(url);if(parsed.protocol!=='https:')throw new Error();}catch{setError('Tracking links must be valid HTTPS URLs.');return;}}
    setUpdatingShopOrder(orderId);
    try{
      const {user:current,isAdmin}=await isCurrentUserAdmin();
      if(!current||!isAdmin)throw new Error('Administrator session expired.');
      const now=new Date().toISOString();
      const patch={delivery_carrier:carrier||null,tracking_number:number||null,tracking_url:url||null,updated_at:now};
      const {error:updateError}=await supabase.from('store_orders').update(patch).eq('id',orderId);
      if(updateError)throw updateError;
      setShopOrders(currentOrders=>currentOrders.map(order=>order.id===orderId?{...order,deliveryCarrier:carrier||null,trackingNumber:number||null,trackingUrl:url||null}:order));
      setError('');
    }catch(e){setError(e instanceof Error?e.message:'Could not save shipment tracking details.');}
    finally{setUpdatingShopOrder(null);}
  };

  const updateVehicleCatalogRecord = async (vehicleId:string,patch:{verification_status?:string;is_published?:boolean;availability?:string}) => {
    const currentVehicle=vehicleCatalog.find(item=>item.id===vehicleId);
    if(!currentVehicle)return;
    const nextStatus=patch.verification_status??currentVehicle.verification_status;
    if(patch.is_published===true&&nextStatus!=='verified'){setError('A vehicle cannot be published until its price, source and specification are verified.');return;}
    const safePatch:{verification_status?:string;is_published?:boolean;availability?:string;last_verified_at?:string}={...patch};
    if(patch.verification_status==='verified')safePatch.last_verified_at=new Date().toISOString();
    if(patch.verification_status&&patch.verification_status!=='verified')safePatch.is_published=false;
    setUpdatingVehicleCatalog(vehicleId);
    try{
      const {user:currentUser,isAdmin}=await isCurrentUserAdmin();
      if(!currentUser||!isAdmin)throw new Error('Administrator session expired.');
      const {error:updateError}=await supabase.from('vehicle_catalog').update(safePatch).eq('id',vehicleId);
      if(updateError)throw updateError;
      setVehicleCatalog(items=>items.map(item=>item.id===vehicleId?{...item,...safePatch}:item));
      setError('');
    }catch(e){setError(e instanceof Error?e.message:'Could not update vehicle inventory.');}
    finally{setUpdatingVehicleCatalog(null);}
  };

  const updateVehicleEnquiryStatus = async (enquiryId:string,status:string) => {
    const allowed=['new','contacted','in_progress','closed'];
    if(!allowed.includes(status))return;
    setUpdatingEnquiry('vehicle:'+enquiryId);
    try{
      const {user:current,isAdmin}=await isCurrentUserAdmin();
      if(!current||!isAdmin)throw new Error('Administrator session expired.');
      const {error:updateError}=await supabase.from('vehicle_enquiries').update({status,updated_at:new Date().toISOString()}).eq('id',enquiryId);
      if(updateError)throw updateError;
      setVehicleEnquiries(items=>items.map(item=>item.id===enquiryId?{...item,status}:item));
      setError('');
    }catch(e){setError(e instanceof Error?e.message:'Could not update the vehicle enquiry.');}
    finally{setUpdatingEnquiry(null);}
  };

  const updateInvestmentEnquiryStatus = async (enquiryId:string,status:string) => {
    const allowed=['new','under_review','awaiting_response','follow_up_required','referred_for_verification','closed'];
    if(!allowed.includes(status))return;
    setUpdatingEnquiry('investment:'+enquiryId);
    try{
      const {user:current,isAdmin}=await isCurrentUserAdmin();
      if(!current||!isAdmin)throw new Error('Administrator session expired.');
      const {error:updateError}=await supabase.from('investment_enquiries').update({status,updated_at:new Date().toISOString()}).eq('id',enquiryId);
      if(updateError)throw updateError;
      setInvestmentEnquiries(items=>items.map(item=>item.id===enquiryId?{...item,status}:item));
      setError('');
    }catch(e){setError(e instanceof Error?e.message:'Could not update the investment enquiry.');}
    finally{setUpdatingEnquiry(null);}
  };

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
      setPayments(currentPayments=>[{id:data.id,reference:data.payment_reference,orderId:data.order_id,amount:Number(data.amount),currency:data.currency,method:data.method,providerReference:data.provider_reference,status:data.status,proofPath:null,proofUrl:null,createdAt:new Date(data.created_at).getTime()},...currentPayments]);
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
      const order=orders.find(item=>item.id===payment.orderId);
      const update={status,updated_at:new Date().toISOString(),...(status==='verified'?{verified_by:current.id,verified_at:new Date().toISOString()}:{})};
      const {error:updateError}=await supabase.from('business_payments').update(update).eq('id',paymentId);
      if(updateError)throw updateError;
      setPayments(currentPayments=>currentPayments.map(item=>item.id===paymentId?{...item,status}:item));
      let nextOrderStatus=order?.status||'awaiting_payment';
      if(status==='verified'&&order){
        const verifiedTotal=payments.filter(item=>item.orderId===order.id&&(item.status==='verified'||item.id===paymentId)).reduce((sum,item)=>sum+item.amount,0);
        nextOrderStatus=verifiedTotal>=order.amount?'paid':'partially_paid';
        const {error:orderError}=await supabase.from('business_orders').update({status:nextOrderStatus,updated_at:new Date().toISOString()}).eq('id',order.id);
        if(orderError)throw orderError;
        setOrders(currentOrders=>currentOrders.map(item=>item.id===order.id?{...item,status:nextOrderStatus}:item));
      }
      if(order?.conversationId&&(status==='verified'||status==='rejected')){
        const {data:conversation,error:conversationError}=await supabase.from('support_conversations').select('delivery_details').eq('id',order.conversationId).maybeSingle();
        if(conversationError)throw conversationError;
        const details=conversation?.delivery_details&&typeof conversation.delivery_details==='object'?conversation.delivery_details:{};
        const lock=details.payment_lock&&typeof details.payment_lock==='object'?details.payment_lock:null;
        if(lock&&(lock.payment_record_id===payment.id||lock.payment_reference===payment.reference)){
          const nextLock={...lock,status:status==='rejected'?'rejected':nextOrderStatus==='paid'?'verified':'partially_paid',...(status==='verified'?{verified_at:new Date().toISOString()}:{rejected_at:new Date().toISOString()})};
          const {error:lockError}=await supabase.from('support_conversations').update({delivery_details:{...details,payment_lock:nextLock},updated_at:new Date().toISOString()}).eq('id',order.conversationId);
          if(lockError)throw lockError;
        }
      }
      if(order?.conversationId&&(status==='verified'||status==='rejected')){
        const verified=status==='verified';
        const body=verified
          ? 'Tesla Markets Management has verified payment '+payment.reference+' for order '+order.reference+'. The verified amount is '+new Intl.NumberFormat('en-US',{style:'currency',currency:payment.currency||'USD'}).format(payment.amount)+'. Current order status: '+nextOrderStatus.replaceAll('_',' ')+'.'
          : 'Tesla Markets Management could not verify the submitted payment evidence for order '+order.reference+'. No payment has been confirmed. Please contact management in this conversation for the next steps. Do not send passwords, one-time codes, card security codes or gift-card redemption codes.';
        const {error:messageError}=await supabase.from('support_messages').insert({
          conversation_id:order.conversationId,sender_id:current.id,sender_role:'management',
          body,message_type:'payment_receipt',
          structured_data:{
            title:verified?'Payment verified':'Payment needs review',
            subtitle:verified?'MANAGEMENT CONFIRMED':'NOT VERIFIED',
            status:verified?nextOrderStatus.replaceAll('_',' '):'Needs management review',
            fields:[
              {label:'Order reference',value:order.reference},
              {label:'Payment reference',value:payment.reference},
              {label:'Payment method',value:payment.method.replaceAll('_',' ')},
              {label:'Amount',value:new Intl.NumberFormat('en-US',{style:'currency',currency:payment.currency||'USD'}).format(payment.amount)}
            ],
            note:verified?'Management has checked the payment record. Keep this order reference for future support.':'The submitted evidence has not been accepted as proof of settlement. Management will explain what is needed next.'
          }
        });
        if(messageError)throw messageError;
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

  const savePaymentAccountDetails = async () => {
    setSavingPaymentAccounts(true);
    try {
      const {user:current,isAdmin}=await isCurrentUserAdmin();
      if(!current||!isAdmin)throw new Error('Your administrator session has expired. Sign in again.');
      for(const method of ['PayPal','Zelle','Chime','Apple Pay']){
        const details=paymentAccountDetails[method]||{};
        const hasRecipient=[details.accountName,details.email,details.phone,details.username].some(value=>typeof value==='string'&&value.trim().length>0);
        if(details.enabled===true&&!hasRecipient)throw new Error('Enter a verified recipient identifier for '+method+' before enabling it.');
      }
      const {error:saveError}=await supabase.from('site_settings').upsert({key:'payment_account_details',value:{...paymentAccountDetails,giftCardEnabled},updated_at:new Date().toISOString(),updated_by:current.id},{onConflict:'key'});
      if(saveError)throw saveError;
      setError('Payment instructions saved. Customers can see only the details entered here.');
    } catch(e){setError(e instanceof Error?e.message:'Could not save payment instructions.');}
    finally{setSavingPaymentAccounts(false);}
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
    { id: 'ai' as const, label: 'AI Management', icon: Activity, group:'WORKSPACE' },
    { id: 'messages' as const, label: 'Messages & Inbox', icon: MessageCircle, group:'WORKSPACE' },
    { id: 'customers' as const, label: 'Customers', icon: Users, group:'WORKSPACE' },
    { id: 'operations' as const, label: 'Enquiries', icon: ClipboardList, group:'WORKSPACE' },
    { id: 'tasks' as const, label: 'Tasks & Follow-ups', icon: ListTodo, group:'WORKSPACE' },
    { id: 'shop' as const, label: 'Shop Catalogue', icon: ShoppingBag, group:'BUSINESS OPERATIONS' },
    { id: 'catalogue' as const, label: 'Vehicle Inventory', icon: CarFront, group:'BUSINESS OPERATIONS' },
    { id: 'vehicleEnquiries' as const, label: 'Vehicle Enquiries', icon: CarFront, group:'BUSINESS OPERATIONS' },
    { id: 'investment' as const, label: 'Investment Enquiries', icon: Inbox, group:'BUSINESS OPERATIONS' },
    { id: 'orders' as const, label: 'Orders & Requests', icon: ClipboardList, group:'BUSINESS OPERATIONS' },
    { id: 'team' as const, label: 'Team Management', icon: Users, group:'BUSINESS OPERATIONS' },
    { id: 'content' as const, label: 'Website Manager', icon: Globe, group:'WEBSITE' },
    { id: 'media' as const, label: 'Media Library', icon: Image, group:'WEBSITE' },
    { id: 'announcements' as const, label: 'Content & Announcements', icon: Pencil, group:'WEBSITE' },
    { id: 'analytics' as const, label: 'Analytics & Reports', icon: Activity, group:'INSIGHTS' },
    { id: 'translations' as const, label: 'Language & Translation', icon: Globe, group:'INSIGHTS' },
    { id: 'activity' as const, label: 'Activity Logs', icon: FileClock, group:'INSIGHTS' },
    { id: 'notifications' as const, label: 'Notifications', icon: Bell, group:'SYSTEM' },
    { id: 'profile' as const, label: 'Admin Profile', icon: CircleUserRound, group:'SYSTEM' },
    { id: 'security' as const, label: 'Security & Permissions', icon: ShieldCheck, group:'SYSTEM' },
    { id: 'settings' as const, label: 'Settings', icon: Settings, group:'SYSTEM' },
  ];

  return (
    <div className={`admin-console admin-console-standalone admin-console-premium admin-theme-${adminTheme==='auto'?systemTheme:adminTheme} ${desktopView?'admin-desktop-view':''}`}>
      {installedAppMode&&<nav className="admin-app-bottom-nav" aria-label="App navigation">
        <button type="button" className={section==='overview'?'active':''} onClick={()=>{setSection('overview');setMoreOpen(false);}}><Home size={21}/><span>Home</span></button>
        <button type="button" className={section==='messages'?'active':''} onClick={()=>{setSection('messages');setMoreOpen(false);}}><MessageCircle size={21}/><span>Inbox</span></button>
        <button type="button" className={section==='customers'?'active':''} onClick={()=>{setSection('customers');setMoreOpen(false);}}><Users size={21}/><span>Customers</span></button>
        <button type="button" className={moreOpen?'active':''} onClick={()=>setMoreOpen(value=>!value)}><Grid2X2 size={21}/><span>More</span></button>
      </nav>}
      {installedAppMode&&moreOpen&&<div className="admin-app-more-backdrop" onClick={()=>setMoreOpen(false)}>
        <section className="admin-app-more-sheet" role="dialog" aria-modal="true" aria-label="More management sections" onClick={event=>event.stopPropagation()}>
          <div className="admin-app-more-heading"><div><b>More</b><small>All management tools</small></div><button type="button" onClick={()=>setMoreOpen(false)} aria-label="Close more menu"><X size={20}/></button></div>
          <div className="admin-app-more-grid">{nav.filter(item=>!['overview','messages','customers'].includes(item.id)).map(item=>{const Icon=item.icon;return <button type="button" key={item.id} className={section===item.id?'active':''} onClick={()=>{setSection(item.id);setMoreOpen(false);}}><Icon size={20}/><span>{item.label}</span><ChevronRight size={16}/></button>})}</div>
        </section>
      </div>}
      <header className="admin-topbar">
        <button className="admin-mobile-menu" onClick={()=>setMobileNavOpen(v=>!v)} aria-label={mobileNavOpen?'Close navigation':'Open navigation'}>{mobileNavOpen?<X size={20}/>:<Menu size={20}/>}</button>
        <div className="admin-console-brand"><img className="admin-brand-lockup" src="/tesla-markets-logo.jpg" alt="Tesla Markets logo"/></div>
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
          {section === 'ai' && <AiManagement/>}
          {section === 'overview' && <>
            <div className="tm-dashboard-toolbar">
              <label className="tm-global-search"><Search size={17}/><input value={dashboardSearch} onChange={e=>setDashboardSearch(e.target.value)} placeholder="Search customers, orders, vehicles…"/><kbd>Ctrl K</kbd></label>
              <button className="tm-notification-button" aria-label={`Notifications${notices.filter(item=>!item.is_read).length?`, ${notices.filter(item=>!item.is_read).length} unread`:""}`} onClick={()=>setSection("notifications")}><Bell size={18}/>{notices.some(item=>!item.is_read)&&<i/>}</button>
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
              <section className="tm-dashboard-card tm-recent-enquiries"><div className="tm-card-heading"><div><h2>Recent Enquiries</h2><p>Latest customer conversations.</p></div><button onClick={()=>setSection('operations')}>View all <ArrowUpRight size={13}/></button></div>{threads.filter(t=>!dashboardSearch||[t.visitorName,t.visitorEmail,t.lastMessage].join(' ').toLowerCase().includes(dashboardSearch.toLowerCase())).slice(0,5).map(t=><button className="tm-enquiry-row" key={t.id} onClick={()=>setSection('messages')}><span className="tm-enquiry-avatar">{(t.visitorName||'V').slice(0,1).toUpperCase()}</span><span><b>{t.visitorName||'Website visitor'}</b><small>{t.lastMessage||'Customer enquiry'}</small><small>Preferred language: {(t.preferredLanguage||'en').toUpperCase()}</small></span><ChevronRight size={15}/></button>)}{threads.length===0&&<p className="tm-empty">No enquiries recorded yet.</p>}</section>
            </div>
            <div className="tm-dashboard-grid tm-dashboard-grid-secondary">
            </div>
            <section className="tm-dashboard-card tm-chat-dashboard"><div className="tm-card-heading"><div><h2>Customer Conversations</h2><p>Inbox, live replies and customer details.</p></div><button onClick={()=>setSection('messages')}>Open full inbox <ArrowUpRight size={13}/></button></div><AdminInbox/></section>
            <section className="tm-dashboard-card tm-quick-links"><div className="tm-card-heading"><div><h2>Management Sections</h2><p>All website controls in one organized place.</p></div></div><div className="admin-quick-actions">{nav.filter(item=>item.id!=='overview').map(item=><button key={item.id} onClick={()=>setSection(item.id)}>{item.label}</button>)}</div></section>
          </>}
          {section === 'visitors' && <section className="admin-console-panel"><div className="admin-console-panel-head"><div><div className="eyebrow dark">VISITOR ACTIVITY</div><h2>{visits.length} recent page views</h2><p>Page-level activity; this is not a count of unique people.</p></div></div>{visits.slice(0,8).map(v=><div className="tm-activity-row" key={v.id}><span><Activity size={15}/></span><div><b>Page visit recorded</b><small>{v.page}</small></div><time>{new Date(v.createdAt).toLocaleTimeString()}</time></div>)}{visits.length?<div className="admin-table-wrap"><table className="admin-record-table"><thead><tr><th>Page</th><th>Visited at</th><th>Record ID</th></tr></thead><tbody>{visits.map(visit=><tr key={visit.id}><td>{visit.page}</td><td>{new Date(visit.createdAt).toLocaleString()}</td><td>{visit.id.slice(0,12)}</td></tr>)}</tbody></table></div>:<p className="admin-empty-note">No page views recorded yet.</p>}</section>}
          {section === 'customers' && <section className="admin-console-panel"><div className="admin-console-panel-head"><div><div className="eyebrow dark">CUSTOMER DIRECTORY</div><h2>{customerProfiles.length} registered customers</h2><p>Customer accounts from the protected customer profile directory.</p></div></div>{customerProfiles.length?<div className="admin-table-wrap"><table className="admin-record-table"><thead><tr><th>Customer</th><th>Email</th><th>Phone</th><th>CRM stage</th><th>Joined</th></tr></thead><tbody>{customerProfiles.filter(profile=>[profile.display_name,profile.email,profile.phone].join(' ').toLowerCase().includes(dashboardSearch.toLowerCase())).map(profile=><tr key={profile.id}><td>{profile.display_name||'Customer'}</td><td>{profile.email||'—'}</td><td>{profile.phone||'—'}</td><td>{(profile.crm_stage||'new').replaceAll('_',' ')}</td><td>{new Date(profile.created_at).toLocaleDateString()}</td></tr>)}</tbody></table></div>:<p className="admin-empty-note">No registered customers found.</p>}</section>}
          {section === 'shop' && <section className="admin-console-panel">
            <div className="admin-console-panel-head"><div><div className="eyebrow dark">PUBLIC SHOP INVENTORY</div><h2>Shop catalogue overview</h2><p>Live catalogue audit sourced from the same approved product list used by the storefront. Product editing and publishing controls require a connected catalogue-management schema; this page does not pretend code-managed listings are editable.</p></div></div>
            <div className="tm-kpi-grid">
              <article className="tm-kpi-card"><div><small>Published products</small><strong>{storeProducts.length}</strong></div></article>
              <article className="tm-kpi-card"><div><small>With product photos</small><strong>{storeProducts.filter(product=>Boolean(product.image)).length}</strong></div></article>
              <article className="tm-kpi-card"><div><small>With galleries</small><strong>{storeProducts.filter(product=>(product.gallery||[]).length>0).length}</strong></div></article>
              <article className="tm-kpi-card"><div><small>Partner listings</small><strong>{storeProducts.filter(product=>product.brandType.includes('Partner')).length}</strong></div></article>
            </div>
            <label className="admin-shop-search">Search shop catalogue<input value={shopCatalogueSearch} onChange={event=>setShopCatalogueSearch(event.target.value)} placeholder="Search product, category or department"/></label>
            <div className="admin-table-wrap"><table className="admin-record-table"><thead><tr><th>Product</th><th>Department</th><th>Listed price</th><th>Offer</th><th>Image checks</th><th>Source</th></tr></thead><tbody>
              {storeProducts.filter(product=>(product.name+' '+product.category+' '+product.department).toLowerCase().includes(shopCatalogueSearch.toLowerCase())).map(product=><tr key={product.id}>
                <td><div className="admin-shop-product"><AdminShopImage src={product.image||""} name={product.name}/><span><b>{product.name}</b><small>{product.category}</small></span></div></td>
                <td>{product.department}</td>

                <td>{getDiscountedPrice(product)!==null ? "$"+getDiscountedPrice(product) : "Price on request"}{getDiscountedPrice(product)!==null&&<small className="admin-shop-original">List price: {"$"+product.originalPrice}</small>}</td>
                <td>{product.discountPercent>0?product.discountPercent+"%":"—"}</td>
                <td>{product.image?"Primary image set":"Missing image"} · {(product.gallery||[]).length+1} image(s)</td>
                <td>{product.brandType}</td>
              </tr>)}
            </tbody></table></div>
            {!storeProducts.length&&<p className="admin-empty-note">No approved products are currently published.</p>}
          </section>}
          {section === 'catalogue' && <section className="admin-console-panel"><div className="admin-console-panel-head"><div><div className="eyebrow dark">VEHICLE CATALOGUE</div><h2>Vehicle image collections</h2><p>Review the current vehicle galleries. Vehicle detail and pricing controls are being expanded.</p></div></div><div className="admin-catalogue-grid">{catalogue.map(item=><article key={item.name}><img src={item.first} alt={item.name}/><div><b>{item.name}</b><small>{item.count} attached images</small></div></article>)}</div></section>}
          {section === 'vehicleEnquiries' && <section className="admin-console-panel"><div className="admin-console-panel-head"><div><div className="eyebrow dark">CUSTOMER VEHICLE REQUESTS</div><h2>{vehicleEnquiries.length} vehicle enquiries</h2><p>Vehicle configurations and purchase requests submitted by customers. A request is not a confirmed factory order or payment.</p></div></div>{vehicleEnquiries.length?<div className="admin-table-wrap"><table className="admin-record-table"><thead><tr><th>Customer</th><th>Vehicle / configuration</th><th>Delivery details</th><th>Customer note</th><th>Status</th><th>Received</th></tr></thead><tbody>{vehicleEnquiries.map(enquiry=>{const delivery=enquiry.configuration?.delivery||{};return <tr key={enquiry.id}><td>{enquiry.customerName}<small>{enquiry.customerEmail||'—'}{enquiry.customerPhone?' · '+enquiry.customerPhone:''}</small></td><td><b>{enquiry.vehicle_model}</b><small>{enquiry.configuration?.selected_variant||'Variant not selected'} · {enquiry.configuration?.action==='cart'?'Added to cart':'Purchase request'}</small></td><td>{[delivery.address,delivery.city,delivery.country].filter(Boolean).join(', ')||'Not provided'}</td><td>{enquiry.customer_note||'—'}</td><td><select value={enquiry.status} disabled={updatingEnquiry==='vehicle:'+enquiry.id} onChange={event=>void updateVehicleEnquiryStatus(enquiry.id,event.target.value)}>{['new','contacted','in_progress','closed'].map(status=><option key={status} value={status}>{status.replaceAll('_',' ')}</option>)}</select></td><td>{new Date(enquiry.created_at).toLocaleString()}</td></tr>;})}</tbody></table></div>:<p className="admin-empty-note">No vehicle enquiries have been recorded yet.</p>}</section>}
          {section === 'investment' && <section className="admin-console-panel"><div className="admin-console-panel-head"><div><div className="eyebrow dark">CUSTOMER ENQUIRIES</div><h2>{investmentEnquiries.length} investment enquiries</h2><p>Enquiry and follow-up records only. This workspace does not execute trades, hold customer funds or provide regulated investment advice.</p></div></div>{investmentEnquiries.length?<div className="admin-table-wrap"><table className="admin-record-table"><thead><tr><th>Customer</th><th>Contact</th><th>Opportunity / category</th><th>Customer question</th><th>Status</th><th>Received</th></tr></thead><tbody>{investmentEnquiries.map(enquiry=><tr key={enquiry.id}><td>{enquiry.customerName}</td><td>{enquiry.customerEmail||'—'}</td><td>{enquiry.opportunity}<small>{enquiry.category.replaceAll('_',' ')}</small></td><td>{enquiry.customer_question||'—'}</td><td><select value={enquiry.status} disabled={updatingEnquiry==='investment:'+enquiry.id} onChange={event=>void updateInvestmentEnquiryStatus(enquiry.id,event.target.value)}>{['new','under_review','awaiting_response','follow_up_required','referred_for_verification','closed'].map(status=><option key={status} value={status}>{status.replaceAll('_',' ')}</option>)}</select></td><td>{new Date(enquiry.created_at).toLocaleString()}</td></tr>)}</tbody></table></div>:<p className="admin-empty-note">No investment enquiries have been recorded yet.</p>}</section>}
          {section === 'content' && <section className="admin-console-panel admin-content-editor"><div className="admin-console-panel-head"><div><div className="eyebrow dark">PUBLIC WEBSITE CONTENT</div><h2>Website copy editor</h2><p>Edit the supported homepage, investment page and footer text.</p></div></div><label>Homepage headline<input value={contentDraft.homeHeadline} onChange={e=>setContentDraft(current=>({...current,homeHeadline:e.target.value}))}/></label><label>Homepage description<textarea rows={3} value={contentDraft.homeDescription} onChange={e=>setContentDraft(current=>({...current,homeDescription:e.target.value}))}/></label><label>Investment heading<input value={contentDraft.investmentHeading} onChange={e=>setContentDraft(current=>({...current,investmentHeading:e.target.value}))}/></label><label>Investment description<textarea rows={3} value={contentDraft.investmentDescription} onChange={e=>setContentDraft(current=>({...current,investmentDescription:e.target.value}))}/></label><label>Footer description<textarea rows={2} value={contentDraft.footerBlurb} onChange={e=>setContentDraft(current=>({...current,footerBlurb:e.target.value}))}/></label><div className="admin-content-preview"><b>Live preview</b><h3>{contentDraft.homeHeadline}</h3><p>{contentDraft.homeDescription}</p><h3>{contentDraft.investmentHeading}</h3><p>{contentDraft.investmentDescription}</p><small>{contentDraft.footerBlurb}</small></div><div className="admin-content-actions"><button className="btn btn-outline" onClick={()=>setContentDraft(siteContent)}>Discard changes</button><button className="btn btn-dark" disabled={savingContent} onClick={()=>void saveContent()}>{savingContent?'Saving…':'Publish website content'}</button></div></section>}
          {section === 'media' && <section className="admin-console-panel"><div className="admin-console-panel-head"><div><div className="eyebrow dark">MEDIA LIBRARY</div><h2>Website media</h2><p>Manage investment slides and the management profile image. Vehicle gallery assets remain attached to the current site resources.</p></div></div><div className="admin-media-links"><button onClick={()=>setSection('investment')}>Manage investment images</button><button onClick={()=>setSection('catalogue')}>View vehicle galleries</button><button onClick={()=>setSection('settings')}>Management profile image</button></div></section>}
          {section === 'messages' && <section className="admin-console-panel admin-messages-panel"><div className="admin-console-panel-head"><div><div className="eyebrow dark">CUSTOMER COMMUNICATIONS</div><h2>Customer inbox</h2><p>Customer conversation list and replies. The conversation header and reply bar remain in place while messages scroll.</p></div></div><AdminInbox/></section>}
          {section === 'operations' && <section className="admin-console-panel"><div className="admin-console-panel-head"><div><div className="eyebrow dark">ENQUIRY PIPELINE</div><h2>{threads.length} enquiries</h2><p>Track the current status of each customer enquiry.</p></div></div>{threads.length?<div className="admin-pipeline">{threads.map(thread=><article key={thread.id}><div><b>{thread.visitorName||'Website visitor'}</b><small>{thread.lastMessage||'No message yet'} · {new Date(thread.updatedAt).toLocaleString()}</small></div><label>Status<select value={thread.status||'new'} onChange={event=>void updateStatus(thread.id,event.target.value)}>{statusOptions.map(status=><option key={status} value={status}>{status.replaceAll('_',' ')}</option>)}</select></label></article>)}</div>:<p className="admin-empty-note">New enquiries will appear here.</p>}</section>}
          {section === 'orders' && <>
            <section className="admin-console-panel">
              <div className="admin-console-panel-head">
                <div><div className="eyebrow dark">SHOP PAYMENT PROOF REVIEW</div><h2>{shopProofs.filter(proof=>proof.status==='pending').length} pending reviews</h2><p>Review the uploaded gift-card image, then approve or reject the evidence. Accepted submissions move to fulfilment review; rejected submissions include a reason for the customer.</p></div>
                <button className="btn btn-outline" onClick={()=>void load()} disabled={refreshing}><RefreshCw size={15}/> Refresh</button>
              </div>
              {shopProofs.length ? <div className="tm-shop-review-grid">
                {shopProofs.map(proof=>{
                  const order=shopOrders.find(item=>item.id===proof.orderId);
                  return <article className="tm-shop-review-card" key={proof.id}>
                    <div className="tm-shop-review-top"><b>{order?.reference||proof.orderId.slice(0,8)}</b><span className={'tm-shop-review-status '+proof.status}>{proof.status.replaceAll('_',' ')}</span></div>
                    {order && <>
                      <h3>{order.customerName}</h3>
                      <p>{order.email} · {order.phone}</p>
                      <p>{order.address}, {order.city}{order.region?', '+order.region:''}{order.postalCode?' '+order.postalCode:''}, {order.country}</p>
                      <div className="tm-shop-review-items">{order.items.map((item,index)=><div key={item.product_id||index}><span>{item.name} × {item.quantity}{item.selected_size?' · '+item.selected_size:''}</span><b>{new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(item.unit_price*item.quantity)}</b></div>)}</div>
                      <div className="tm-shop-review-total"><span>Order total</span><b>{new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(order.subtotal)}</b></div>
                    </>}
                    <div className="tm-shop-review-method">Payment method: <b>{proof.method.replaceAll('_',' ')}</b></div>
                    {proof.signedUrl ? <a className="tm-shop-review-proof" href={proof.signedUrl} target="_blank" rel="noreferrer"><img src={proof.signedUrl} alt={'Payment proof for '+(order?.reference||'shop order')}/><span>Open full image</span></a> : <p className="admin-empty-note">Proof image unavailable. Refresh to request a new secure link.</p>}
                    {proof.reviewNote && <small className="tm-shop-review-note">{proof.reviewNote}</small>}
                    {proof.status==='pending' && <div className="tm-shop-review-actions tm-shop-review-actions-expanded">
                      <button className="btn btn-dark" disabled={reviewingShopProof===proof.id} onClick={()=>void reviewShopPaymentProof(proof.id,'approve')}>Accept submission</button>
                      <label className="tm-shop-rejection-field">Reason for rejection
                        <textarea rows={3} value={shopProofRejectionReasons[proof.id]||''} onChange={event=>setShopProofRejectionReasons(current=>({...current,[proof.id]:event.target.value}))} placeholder="Write the reason the customer should see…"/>
                      </label>
                      <button className="btn btn-outline" disabled={reviewingShopProof===proof.id||!(shopProofRejectionReasons[proof.id]||'').trim()} onClick={()=>void reviewShopPaymentProof(proof.id,'reject',shopProofRejectionReasons[proof.id]||'')}>Reject with reason</button>
                    </div>}
                    <small className="tm-shop-review-date">Submitted {new Date(proof.createdAt).toLocaleString()}{proof.reviewedAt?' · Reviewed '+new Date(proof.reviewedAt).toLocaleString():''}</small>
                  </article>;
                })}
              </div> : <p className="admin-empty-note">No shop payment proofs have been submitted yet.</p>}
            </section>
            <section className="admin-console-panel">
              <div className="admin-console-panel-head"><div><div className="eyebrow dark">SHOP ORDERS</div><h2>{shopOrders.length} customer orders</h2><p>Orders saved for later, awaiting proof and reviewed orders are listed here.</p></div></div>
              {shopOrders.length ? <div className="tm-shop-orders-list">{shopOrders.map(order=><article key={order.id}>
                <div><b>{order.reference}</b><small>{order.customerName} · {order.email}</small><small>{order.items.map(item=>item.name+' × '+item.quantity).join(' · ')}</small></div>
                <b>{new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(order.subtotal)}</b>
                <span className={'tm-shop-review-status '+order.status}>{order.status.replaceAll('_',' ')}</span>
                <label className="tm-shop-order-progress-control">Order progress
                  <select value={order.status} disabled={updatingShopOrder===order.id} onChange={event=>void updateShopOrderProgress(order.id,event.target.value)}>
                    <option value="saved_for_later">Saved for later</option>
                    <option value="awaiting_payment">Not submitted yet</option>
                    <option value="proof_submitted">Submission received · pending review</option>
                    <option value="payment_proof_rejected">Submission rejected</option>
                    <option value="proof_approved_pending_settlement">Review accepted · awaiting fulfilment</option>
                    <option value="processing">Processing</option><option value="shipped">Shipped</option><option value="delivered">Delivered</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option>
                  </select>
                </label>
                <div className="tm-shop-order-tracking-fields">
                  <label>Delivery carrier<input value={shopTrackingDrafts[order.id]?.carrier||''} placeholder="e.g. DHL, FedEx" onChange={event=>setShopTrackingDrafts(current=>({...current,[order.id]:{...(current[order.id]||{carrier:'',number:'',url:''}),carrier:event.target.value}}))}/></label>
                  <label>Tracking number<input value={shopTrackingDrafts[order.id]?.number||''} placeholder="Shipment tracking number" onChange={event=>setShopTrackingDrafts(current=>({...current,[order.id]:{...(current[order.id]||{carrier:'',number:'',url:''}),number:event.target.value}}))}/></label>
                  <label>Tracking link (HTTPS)<input type="url" value={shopTrackingDrafts[order.id]?.url||''} placeholder="https://carrier.example/track/…" onChange={event=>setShopTrackingDrafts(current=>({...current,[order.id]:{...(current[order.id]||{carrier:'',number:'',url:''}),url:event.target.value}}))}/></label>
                  <button className="btn btn-outline" type="button" disabled={updatingShopOrder===order.id} onClick={()=>void saveShopOrderTracking(order.id)}>{updatingShopOrder===order.id?'Saving…':'Save tracking'}</button>
                </div>
              </article>)}</div> : <p className="admin-empty-note">No shop orders have been saved yet.</p>}
            </section>
            <section className="admin-console-panel"><div className="admin-console-panel-head"><div><div className="eyebrow dark">VEHICLE ORDERS & PRO FORMA</div><h2>{orders.length} recorded orders</h2><p>Set the final amount, paste a hosted checkout URL from your approved payment provider, then approve and send it to the customer. Verify incoming funds before marking payment complete.</p></div><button className="btn btn-outline" onClick={()=>void load()} disabled={refreshing}><RefreshCw size={15}/> Refresh</button></div>{orders.length?<div className="admin-table-wrap"><table className="admin-record-table"><thead><tr><th>Reference</th><th>Vehicle</th><th>Final amount (USD)</th><th>Order status</th><th>Checkout link</th><th>Received</th></tr></thead><tbody>{orders.map(order=><tr key={order.id}><td>{order.reference}</td><td>{order.item}</td><td><input aria-label={'Final amount for '+order.reference} type="number" min="0.01" step="0.01" value={orderAmounts[order.id]??String(order.amount)} onChange={event=>setOrderAmounts(current=>({...current,[order.id]:event.target.value}))}/></td><td><select value={order.status} onChange={event=>void updateOrderStatus(order.id,event.target.value)}>{['draft','awaiting_payment','processing','completed','cancelled','refunded'].map(status=><option key={status} value={status}>{status.replaceAll('_',' ')}</option>)}</select></td><td><input aria-label={'Hosted checkout link for '+order.reference} type="url" placeholder="https://…" value={paymentLinks[order.id]??''} onChange={event=>setPaymentLinks(current=>({...current,[order.id]:event.target.value}))}/><button className="btn btn-dark" onClick={()=>void sendPaymentLink(order.id)}>Approve & send link</button></td><td>{new Date(order.createdAt).toLocaleString()}</td></tr>)}</tbody></table></div>:<p className="admin-empty-note">No vehicle orders have been recorded yet.</p>}</section><section className="admin-console-panel"><div className="admin-console-panel-head"><div><div className="eyebrow dark">PAYMENT RECONCILIATION</div><h2>Record an incoming payment</h2><p>Use this for payments received through an independently approved method. New records stay pending until management verifies the transaction.</p></div></div><div className="admin-task-create"><label>Order<select value={paymentOrderId} onChange={event=>setPaymentOrderId(event.target.value)}><option value="">Select an order</option>{orders.filter(order=>!['cancelled','refunded'].includes(order.status)).map(order=><option key={order.id} value={order.id}>{order.reference} · {order.item}</option>)}</select></label><div className="admin-task-fields"><label>Amount (USD)<input type="number" min="0.01" step="0.01" value={paymentAmount} onChange={event=>setPaymentAmount(event.target.value)} placeholder="e.g. 39990"/></label><label>Payment method<select value={paymentMethod} onChange={event=>setPaymentMethod(event.target.value)}><option value="paypal">PayPal</option><option value="zelle">Zelle</option><option value="apple_pay">Apple Pay (management-assisted)</option><option value="chime">Chime</option><option value="gift_card">Gift card</option><option value="bank_transfer">Bank transfer</option><option value="card">Card / online gateway</option><option value="wire_transfer">International wire</option><option value="other">Other approved method</option></select></label><label>Transaction / provider reference<input value={paymentProviderReference} onChange={event=>setPaymentProviderReference(event.target.value)} placeholder="Bank or gateway reference"/></label><button className="btn btn-dark" disabled={savingPayment||!paymentOrderId||!paymentAmount.trim()||!paymentProviderReference.trim()} onClick={()=>void recordPayment()}>{savingPayment?'Saving…':'Record pending payment'}</button></div></div></section><section className="admin-console-panel"><div className="admin-console-panel-head"><div><div className="eyebrow dark">PAYMENT RECORDS</div><h2>{payments.length} recorded payments</h2><p>Verify only after matching the transaction against the bank or payment provider.</p></div></div>{payments.length?<div className="admin-table-wrap"><table className="admin-record-table"><thead><tr><th>Payment reference</th><th>Order</th><th>Amount</th><th>Method / provider reference</th><th>Evidence</th><th>Verification</th></tr></thead><tbody>{payments.map(payment=><tr key={payment.id}><td>{payment.reference}</td><td>{orders.find(order=>order.id===payment.orderId)?.reference||'Order'}</td><td>{new Intl.NumberFormat('en-US',{style:'currency',currency:payment.currency||'USD'}).format(payment.amount)}</td><td>{payment.method.replaceAll('_',' ')}<small>{payment.providerReference||'No provider reference'}</small></td><td>{payment.proofUrl?<a href={payment.proofUrl} target="_blank" rel="noreferrer">View evidence</a>:payment.proofPath?'Evidence stored':'—'}</td><td><select value={payment.status} onChange={event=>void updatePaymentStatus(payment.id,event.target.value)}>{['pending','verified','rejected','refunded'].map(status=><option key={status} value={status}>{status}</option>)}</select></td></tr>)}</tbody></table></div>:<p className="admin-empty-note">No payments have been recorded. Payments must be recorded and independently verified.</p>}</section></>}
          {section === 'tasks' && <section className="admin-console-panel"><div className="admin-console-panel-head"><div><div className="eyebrow dark">WORK MANAGEMENT</div><h2>Tasks & follow-ups</h2><p>Create real, saved follow-up tasks for the management team.</p></div></div><div className="admin-task-create"><label>Task title<input value={taskTitle} onChange={e=>setTaskTitle(e.target.value)} placeholder="e.g. Follow up with customer"/></label><label>Description<textarea rows={2} value={taskDescription} onChange={e=>setTaskDescription(e.target.value)} placeholder="What needs to be done?"/></label><div className="admin-task-fields"><label>Priority<select value={taskPriority} onChange={e=>setTaskPriority(e.target.value)}><option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option><option value="urgent">Urgent</option></select></label><label>Due date<input type="datetime-local" value={taskDue} onChange={e=>setTaskDue(e.target.value)}/></label><button className="btn btn-dark" disabled={!taskTitle.trim()} onClick={()=>void createTask()}><Plus size={15}/> Create task</button></div></div><div className="admin-task-list">{tasks.map(task=><article key={task.id}><div><b>{task.title}</b><p>{task.description||'No description provided.'}</p><small>{task.priority.toUpperCase()} priority · {task.due_at?'Due '+new Date(task.due_at).toLocaleString():'No due date'} · Created {new Date(task.created_at).toLocaleDateString()}</small></div><label>Status<select value={task.status} onChange={e=>void updateTaskStatus(task.id,e.target.value)}><option value="open">Open</option><option value="in_progress">In progress</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option></select></label></article>)}{tasks.length===0&&<p className="admin-empty-note">No tasks yet. Create your first follow-up above.</p>}</div></section>}
          {section === 'notifications' && <section className="admin-console-panel"><div className="admin-console-panel-head"><div><div className="eyebrow dark">SYSTEM ALERTS</div><h2>Notifications</h2><p>Saved notifications from the admin notification feed.</p></div>{notices.some(item=>!item.is_read)&&<button className="btn btn-outline" onClick={()=>void markAllNoticesRead()}>Mark all read</button>}</div>{notices.map(item=><article className="admin-notice-row" key={item.id}><span className={item.is_read?'':'unread'}><Bell size={16}/></span><div><b>{item.title}</b><p>{item.body}</p><small>{item.type} · {new Date(item.created_at).toLocaleString()}</small></div>{!item.is_read&&<button className="btn btn-outline" onClick={()=>void markNoticeRead(item.id)}>Mark read</button>}</article>)}{notices.length===0&&<p className="admin-empty-note">No saved notifications yet. New system notifications will appear here.</p>}</section>}
          {section === 'activity' && <section className="admin-console-panel"><div className="admin-console-panel-head"><div><div className="eyebrow dark">ADMIN AUDIT TRAIL</div><h2>Activity logs</h2><p>Recent recorded administrative actions. This view does not invent activity that has not been logged.</p></div></div>{auditEntries.map(entry=><article className="admin-audit-row" key={entry.id}><span><FileClock size={16}/></span><div><b>{entry.action.replaceAll('_',' ')}</b><p>{entry.entity_type}{entry.entity_id?' · '+entry.entity_id:''}</p><small>{new Date(entry.created_at).toLocaleString()} · {JSON.stringify(entry.details||{})}</small></div></article>)}{auditEntries.length===0&&<p className="admin-empty-note">No audit events have been recorded yet.</p>}</section>}
          {section === 'settings' && <><section className="admin-console-panel admin-app-notification-settings"><div className="eyebrow dark">DEVICE ALERTS</div><h2>App notifications</h2><p>Receive customer message alerts on this phone, including when the admin app is closed. Notification controls are kept here in Settings.</p><div className="admin-notification-controls">{pushSubscribed?<span className="admin-security-status">Notifications enabled on this device</span>:<span className="admin-empty-note">Notifications are not enabled on this device</span>}{pushSubscribed?<button className="btn btn-outline" type="button" disabled={pushBusy} onClick={()=>void disablePhoneNotifications()}>{pushBusy?"Please wait…":"Turn off notifications"}</button>:<button className="btn btn-dark" type="button" disabled={pushBusy} onClick={()=>void enablePhoneNotifications()}>{pushBusy?"Please wait…":"Enable app notifications"}</button>}{!isInstalled&&<button className="btn btn-outline" type="button" onClick={()=>void installAdminApp()}>Install admin app</button>}</div>{notificationStatus&&<small role="status" className="admin-notification-status">{notificationStatus}</small>}</section><section className="admin-console-panel admin-payment-account-editor"><div className="eyebrow dark">CUSTOMER PAYMENT INSTRUCTIONS</div><h2>Verified payment account details</h2><p>Enable each payment method separately and enter only the recipient details management has verified. Customers receive only the instructions for the method they selected. Never enter passwords, OTPs, card numbers, CVVs, Apple Pay passcodes, or gift-card PINs or redemption codes. Apple Pay here is management-assisted; it is not a direct Apple Pay gateway integration.</p><label className="admin-payment-giftcard-toggle"><input type="checkbox" checked={giftCardEnabled} onChange={e=>setGiftCardEnabled(e.target.checked)}/> Enable optional gift-card fallback (shown only when enabled and no primary payment account is configured)</label>{(['PayPal','Zelle','Chime','Apple Pay'] as const).map(method=><div className="admin-payment-account-method" key={method}><h3>{method}</h3><label className="admin-payment-giftcard-toggle"><input type="checkbox" checked={paymentAccountDetails[method]?.enabled===true} onChange={e=>setPaymentAccountDetails(current=>({...current,[method]:{...current[method],enabled:e.target.checked}}))}/> Enable {method} for customer checkout</label><div className="admin-payment-account-fields"><label>Account holder name<input value={paymentAccountDetails[method]?.accountName||''} onChange={e=>setPaymentAccountDetails(current=>({...current,[method]:{...current[method],accountName:e.target.value}}))} placeholder="Verified account holder name"/></label><label>{method==='PayPal'?'PayPal email':'Account email'}<input type="email" value={paymentAccountDetails[method]?.email||''} onChange={e=>setPaymentAccountDetails(current=>({...current,[method]:{...current[method],email:e.target.value}}))} placeholder={method==='PayPal'?'name@example.com':'Verified email, if applicable'}/></label><label>Phone number<input value={paymentAccountDetails[method]?.phone||''} onChange={e=>setPaymentAccountDetails(current=>({...current,[method]:{...current[method],phone:e.target.value}}))} placeholder="Verified phone, if applicable"/></label><label>Username / payment handle<input value={paymentAccountDetails[method]?.username||''} onChange={e=>setPaymentAccountDetails(current=>({...current,[method]:{...current[method],username:e.target.value}}))} placeholder="Verified payment handle"/></label><label className="wide">Additional instructions<textarea value={paymentAccountDetails[method]?.instructions||''} onChange={e=>setPaymentAccountDetails(current=>({...current,[method]:{...current[method],instructions:e.target.value}}))} placeholder="Only approved payment instructions"/></label></div></div>)}<button className="btn btn-dark" type="button" disabled={savingPaymentAccounts} onClick={()=>void savePaymentAccountDetails()}>{savingPaymentAccounts?'Saving…':'Save verified payment details'}</button></section><section className="admin-console-panel"><div className="eyebrow dark">ACCOUNT SECURITY</div><h2>Administrator sign-in protection</h2><p>Management access uses your private administrator password. No authenticator code is required.</p><div className="admin-security-row"><div><b>Administrator password</b><small>Only your password is required to sign in.</small></div><span className="admin-security-status">Password protected</span></div></section><section className="admin-console-panel admin-profile-settings"><div className="eyebrow dark">MANAGEMENT PROFILE</div><h2>Chat profile picture</h2><p>Upload or replace the picture displayed beside Tesla Markets Management in customer chat.</p><div className="admin-profile-preview">{profileUrl?<img src={profileUrl} alt="Current management profile"/>:<CircleUserRound size={54}/>}<span>{profileUrl?'Current profile picture':'No custom profile picture saved yet'}</span></div><label className="admin-upload-label">Choose a new profile picture<input type="file" accept="image/png,image/jpeg,image/webp" onChange={event=>setProfileFile(event.target.files?.[0]||null)}/></label><small>JPG, PNG or WEBP · maximum 4 MB</small><button className="btn btn-dark" disabled={!profileFile||savingProfile} onClick={()=>void saveProfile()}>{savingProfile?'Saving…':'Save profile picture'}</button></section></>}
          {section === 'team' && <section className="admin-console-panel"><div className="admin-console-panel-head"><div><div className="eyebrow dark">PEOPLE & ACCESS</div><h2>Team management</h2><p>Team invitations and backend-enforced role assignments require the team-membership service to be configured. No staff accounts are fabricated here.</p></div></div><p className="admin-empty-note">No team directory is connected yet. Existing administrator access remains protected by the current Supabase admin check.</p></section>}
          {section === 'translations' && <section className="admin-console-panel"><div className="admin-console-panel-head"><div><div className="eyebrow dark">LANGUAGE OPERATIONS</div><h2>Translation health</h2><p>Review recent translation-service errors, affected languages and interface components. Original customer messages remain unchanged.</p></div><button className="btn btn-outline" type="button" onClick={()=>void load()}><RefreshCw size={14}/> Refresh</button></div><div className="tm-kpi-grid"><article className="tm-kpi-card"><div><small>Languages enabled</small><strong>59</strong></div></article><article className="tm-kpi-card"><div><small>Reported issues</small><strong>{translationIssues.length}</strong></div></article><article className="tm-kpi-card"><div><small>Languages affected</small><strong>{new Set(translationIssues.map(issue=>issue.target_language)).size}</strong></div></article><article className="tm-kpi-card"><div><small>Latest report</small><strong>{translationIssues[0]?new Date(translationIssues[0].created_at).toLocaleDateString():'None'}</strong></div></article></div>{translationIssues.length?<div className="admin-table-wrap"><table className="admin-record-table"><thead><tr><th>Time</th><th>Language</th><th>Issue</th><th>Component</th><th>Details</th></tr></thead><tbody>{translationIssues.map(issue=><tr key={issue.id}><td>{new Date(issue.created_at).toLocaleString()}</td><td>{issue.target_language.toUpperCase()}</td><td>{issue.issue_type.replace(/_/g,' ')}</td><td>{issue.component||'—'}</td><td>{JSON.stringify(issue.details||{}).slice(0,180)}</td></tr>)}</tbody></table></div>:<p className="tm-empty">No translation issues have been reported.</p>}</section>}
          {section === 'analytics' && <section className="admin-console-panel"><div className="admin-console-panel-head"><div><div className="eyebrow dark">OPERATIONAL REPORTING</div><h2>Activity analytics</h2><p>Recorded operational activity only. Visitor figures are page views, not unique people.</p></div></div><div className="tm-kpi-grid"><article className="tm-kpi-card"><div><small>Registered customers</small><strong>{registeredCustomerCount??'—'}</strong></div></article><article className="tm-kpi-card"><div><small>Recorded page views</small><strong>{overview?.visits??'—'}</strong></div></article><article className="tm-kpi-card"><div><small>Customer conversations</small><strong>{overview?.conversations??'—'}</strong></div></article><article className="tm-kpi-card"><div><small>Messages recorded</small><strong>{overview?.messages??'—'}</strong></div></article></div><div className="admin-table-wrap"><table className="admin-record-table"><thead><tr><th>Date</th><th>Page</th><th>Recorded views</th></tr></thead><tbody>{activityBuckets.map(day=><tr key={day.label}><td>{day.label}</td><td>Website pages</td><td>{day.count}</td></tr>)}</tbody></table></div></section>}
          {section === 'announcements' && <section className="admin-console-panel"><div className="admin-console-panel-head"><div><div className="eyebrow dark">WEBSITE CONTENT</div><h2>Content & announcements</h2><p>Use Website Manager for currently supported public copy. Announcement publishing needs a connected content schema before it can be safely enabled.</p></div></div><button className="btn btn-dark" onClick={()=>setSection('content')}>Open Website Manager</button></section>}
          {section === 'profile' && <section className="admin-console-panel admin-profile-settings"><div className="eyebrow dark">ADMIN PROFILE</div><h2>Management profile</h2><p>Update the profile image displayed in customer communications.</p><div className="admin-profile-preview">{profileUrl?<img src={profileUrl} alt="Current management profile"/>:<CircleUserRound size={54}/>}<span>{profileUrl?'Current profile picture':'No custom profile picture saved yet'}</span></div><label className="admin-upload-label">Choose a new profile picture<input type="file" accept="image/png,image/jpeg,image/webp" onChange={event=>setProfileFile(event.target.files?.[0]||null)}/></label><button className="btn btn-dark" disabled={!profileFile||savingProfile} onClick={()=>void saveProfile()}>{savingProfile?'Saving…':'Save profile picture'}</button></section>}
          {section === 'security' && <section className="admin-console-panel"><div className="eyebrow dark">ACCESS CONTROL</div><h2>Security & permissions</h2><p>Current administrator access is validated by the existing Supabase admin authorization check. Team-level role permissions and 2FA enrollment are not represented as active until their backend policies and flows are configured.</p><div className="admin-security-row"><div><b>Administrator session</b><small>{user.email}</small></div><span className="admin-security-status">Authenticated</span></div><button className="btn btn-outline" onClick={()=>void supabase.auth.signOut()}>Sign out securely</button></section>}
          <footer className="admin-console-footer">Signed in as {user.email} · Private management session · <a href="#home">Open public website</a></footer>
        </main>
      </div>
      {showInstallCard && <div className="tm-install-overlay" role="presentation">
        <section className="tm-install-dialog" role="dialog" aria-modal="true" aria-labelledby="tm-install-title">
          <img src="/icons/tesla-app-icon-512.png" alt="" className="tm-install-icon"/>
          <div className="tm-install-eyebrow">TESLA MARKETS · PRIVATE MANAGEMENT</div>
          <h2 id="tm-install-title">{isInstalled || installedAppMode ? 'Enable app notifications' : 'Install your management app'}</h2>
          <p>{isInstalled || installedAppMode ? 'Allow notifications to receive new customer messages, vehicle enquiries, orders and important management alerts, even when the app is closed.' : 'Keep your customer inbox, vehicle enquiries, AI management and dashboard together in a dedicated app on this device.'}</p>
          {(isInstalled || installedAppMode) ? <button type="button" className="tm-install-primary" disabled={pushBusy || pushSubscribed} onClick={()=>void enablePhoneNotifications()}>{pushBusy ? 'Enabling…' : pushSubscribed ? 'Notifications enabled' : 'Enable notifications'}</button> : <><button type="button" className="tm-install-primary" onClick={()=>void installAdminApp()}>Install now</button>{!installPrompt && <p className="tm-install-help">Tap <b>Install now</b>. If Chrome cannot open the install prompt automatically, open Chrome menu ⋮ and choose <b>Install app</b>. Do not choose <b>Add to Home screen</b>, which creates a browser shortcut.</p>}</>}
          <button type="button" className="tm-install-later" onClick={()=>{localStorage.setItem('tesla-admin-install-dismissed','true');localStorage.setItem('tesla-admin-notifications-dismissed','true');setInstallPrompt(null);setShowInstallCard(false);}}>Not now</button>
        </section>
      </div>}
    </div>
  );
}
