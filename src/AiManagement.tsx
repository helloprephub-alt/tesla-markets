import { useCallback, useEffect, useState } from 'react';
import { supabase } from './lib/supabase';
import { Activity, BookOpen, CarFront, Check, Clock3, FileSearch, RefreshCw, ShieldCheck, Users, X } from 'lucide-react';

type Tab = 'overview' | 'vehicles' | 'knowledge' | 'approvals' | 'research' | 'followups' | 'customers' | 'settings';
type Row = Record<string, any>;

const tabs: { id: Tab; label: string; icon: any }[] = [
  { id: 'overview', label: 'Overview', icon: Activity },
  { id: 'vehicles', label: 'Vehicles', icon: CarFront },
  { id: 'knowledge', label: 'Knowledge', icon: BookOpen },
  { id: 'approvals', label: 'Approvals', icon: ShieldCheck },
  { id: 'research', label: 'Research', icon: FileSearch },
  { id: 'followups', label: 'Follow-ups', icon: Clock3 },
  { id: 'customers', label: 'Customers & memory', icon: Users },
  { id: 'settings', label: 'Settings', icon: ShieldCheck },
];

async function adminAction(action: string, values: Row = {}) {
  const { data, error } = await supabase.functions.invoke('tesla-markets-ai-admin', { body: { action, ...values } });
  if (error) throw new Error(error.message || 'The AI management request failed.');
  if (data?.error) throw new Error(String(data.error));
  return data || {};
}

const panelStyle: React.CSSProperties = { background: 'var(--admin-panel,#fff)', border: '1px solid var(--admin-border,#e5e7eb)', borderRadius: 14, padding: 16 };
const inputStyle: React.CSSProperties = { width: '100%', minWidth: 0, padding: '10px 12px', border: '1px solid var(--admin-border,#d1d5db)', borderRadius: 9, background: 'var(--admin-input,#fff)', color: 'var(--admin-text,#111827)', font: 'inherit' };
const buttonStyle: React.CSSProperties = { border: '1px solid var(--admin-border,#d1d5db)', borderRadius: 9, padding: '9px 12px', background: 'var(--admin-panel,#fff)', color: 'var(--admin-text,#111827)', cursor: 'pointer', fontWeight: 600 };

export function AiManagement() {
  const [tab, setTab] = useState<Tab>('overview');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [overview, setOverview] = useState<Row | null>(null);
  const [vehicles, setVehicles] = useState<Row[]>([]);
  const [knowledge, setKnowledge] = useState<Row[]>([]);
  const [approvals, setApprovals] = useState<Row[]>([]);
  const [research, setResearch] = useState<Row[]>([]);
  const [followups, setFollowups] = useState<Row[]>([]);
  const [customers, setCustomers] = useState<Row[]>([]);
  const [webResearchEnabled, setWebResearchEnabled] = useState(false);
  const [billingConfirmed, setBillingConfirmed] = useState(false);
  const [vehicleDraft, setVehicleDraft] = useState<Row | null>(null);
  const [knowledgeDraft, setKnowledgeDraft] = useState<Row | null>(null);

  const load = useCallback(async (target: Tab = tab) => {
    setBusy(true); setError(''); setNotice('');
    try {
      if (target === 'overview') {
        const result = await adminAction('overview');
        setOverview(result.counts || {});
      } else if (target === 'vehicles') {
        const result = await adminAction('list_vehicles');
        setVehicles(result.vehicles || []);
      } else if (target === 'knowledge') {
        const result = await adminAction('list_knowledge');
        setKnowledge(result.documents || []);
      } else if (target === 'approvals') {
        const result = await adminAction('list_approvals');
        setApprovals(result.approvals || []);
      } else if (target === 'research') {
        const result = await adminAction('list_research');
        setResearch(result.research || []);
      } else if (target === 'followups') {
        const result = await adminAction('list_followups');
        setFollowups(result.followups || []);
      } else if (target === 'customers') {
        const result = await adminAction('list_customers');
        setCustomers(result.customers || []);
      } else if (target === 'settings') {
        const result = await adminAction('settings');
        setWebResearchEnabled(result.web_research_enabled === true);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load AI management data.');
    } finally {
      setBusy(false);
    }
  }, [tab]);

  useEffect(() => { void load(tab); }, [tab, load]);

  const decide = async (id: string, status: 'approved' | 'rejected') => {
    setBusy(true); setError(''); setNotice('');
    try {
      await adminAction('decide_approval', { id, status, decision_note: status === 'approved' ? 'Approved by management.' : 'Rejected by management.' });
      setNotice('Approval decision saved. No external payment or commercial action was executed.');
      await load('approvals');
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not save approval decision.'); }
    finally { setBusy(false); }
  };

  const saveVehicle = async () => {
    if (!vehicleDraft) return;
    setBusy(true); setError(''); setNotice('');
    try {
      let specifications: Row = {};
      try { specifications = typeof vehicleDraft.specifications_text === 'string' ? JSON.parse(vehicleDraft.specifications_text || '{}') : (vehicleDraft.specifications || {}); }
      catch { throw new Error('Specifications must be valid JSON.'); }
      await adminAction('save_vehicle', {
        id: vehicleDraft.id || undefined, name: vehicleDraft.name, model: vehicleDraft.model,
        slug: vehicleDraft.slug, description: vehicleDraft.description || '',
        price_usd: vehicleDraft.price_usd === '' ? null : Number(vehicleDraft.price_usd),
        availability: vehicleDraft.availability || 'unknown', featured: vehicleDraft.featured === true,
        is_published: vehicleDraft.is_published === true, specifications,
        model_year: vehicleDraft.model_year || '', market: vehicleDraft.market || '',
        source_url: vehicleDraft.source_url || '', source_type: vehicleDraft.source_type || 'management',
        verification_status: vehicleDraft.verification_status || 'unverified'
      });
      setVehicleDraft(null); setNotice('Vehicle catalogue record saved. Publishing is controlled by its verification status.');
      await load('vehicles');
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not save vehicle.'); }
    finally { setBusy(false); }
  };

  const saveKnowledge = async () => {
    if (!knowledgeDraft) return;
    setBusy(true); setError(''); setNotice('');
    try {
      await adminAction('save_knowledge', {
        id: knowledgeDraft.id || undefined, title: knowledgeDraft.title, category: knowledgeDraft.category || 'company_faq',
        content: knowledgeDraft.content, source_url: knowledgeDraft.source_url || '',
        source_type: knowledgeDraft.source_type || 'management',
        verification_status: knowledgeDraft.verification_status || 'unverified',
        market: knowledgeDraft.market || '', model_year: knowledgeDraft.model_year || '',
        approved: knowledgeDraft.approved === true, version: knowledgeDraft.version || 1
      });
      setKnowledgeDraft(null); setNotice('Knowledge document saved. Only approved and verified documents are supplied to the AI.');
      await load('knowledge');
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not save knowledge document.'); }
    finally { setBusy(false); }
  };

  const togglePreference = async (customerId: string, field: 'memory' | 'followup', enabled: boolean) => {
    setBusy(true); setError('');
    try {
      await adminAction(field === 'memory' ? 'set_memory_preference' : 'set_followup_preference', { customer_id: customerId, enabled });
      setNotice(field === 'memory' ? 'Customer memory preference updated.' : 'Customer follow-up preference updated.');
      await load('customers');
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not update customer preference.'); }
    finally { setBusy(false); }
  };

  const setStage = async (customerId: string, stage: string) => {
    setBusy(true); setError('');
    try { await adminAction('set_crm_stage', { customer_id: customerId, stage }); setNotice('Customer stage updated.'); await load('customers'); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not update customer stage.'); }
    finally { setBusy(false); }
  };

  const toggleResearch = async () => {
    if (!billingConfirmed) { setError('Before enabling live research, confirm that an AI Gateway provider key or credits are configured and that you have reviewed any charges.'); return; }
    setBusy(true); setError(''); setNotice('');
    try {
      const result = await adminAction('set_research_enabled', { enabled: !webResearchEnabled, confirm_provider_billing: true });
      setWebResearchEnabled(result.web_research_enabled === true);
      setNotice(result.web_research_enabled ? 'Live research has been enabled. Monitor provider usage and billing.' : 'Live research has been disabled.');
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not update research settings.'); }
    finally { setBusy(false); }
  };

  const field = (label: string, value: any, onChange: (value: string) => void, placeholder = '') => (
    <label style={{ display: 'grid', gap: 6, fontSize: 13, fontWeight: 600, minWidth: 0 }}>
      {label}<input style={inputStyle} value={value ?? ''} placeholder={placeholder} onChange={e => onChange(e.target.value)} />
    </label>
  );

  const status = (value: any) => <span style={{ display: 'inline-flex', padding: '4px 8px', borderRadius: 20, background: '#eef2f7', color: '#334155', fontSize: 11, fontWeight: 700 }}>{String(value || 'unknown').replaceAll('_', ' ').toUpperCase()}</span>;

  return <section style={{ display: 'grid', gap: 14 }}>
    <div style={{ ...panelStyle, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
      <div><div style={{ fontSize: 11, letterSpacing: 1.3, fontWeight: 800, opacity: .65 }}>TESLA MARKETS / AI OPERATIONS</div><h2 style={{ margin: '5px 0' }}>AI Management Centre</h2><p style={{ margin: 0, opacity: .72, fontSize: 13 }}>Control knowledge, customer memory, research, approvals and follow-ups.</p></div>
      <button style={buttonStyle} type="button" onClick={() => void load()} disabled={busy}><RefreshCw size={15} style={{ verticalAlign: 'middle', marginRight: 6 }}/>Refresh</button>
    </div>
    <nav aria-label="AI management sections" style={{ display: 'flex', gap: 7, overflowX: 'auto', paddingBottom: 3 }}>
      {tabs.map(item => { const Icon = item.icon; return <button key={item.id} type="button" onClick={() => setTab(item.id)} style={{ ...buttonStyle, whiteSpace: 'nowrap', background: tab === item.id ? '#17191d' : 'var(--admin-panel,#fff)', color: tab === item.id ? '#fff' : 'var(--admin-text,#111827)' }}><Icon size={14} style={{ verticalAlign: 'middle', marginRight: 5 }}/>{item.label}</button>; })}
    </nav>
    {error && <div role="alert" style={{ ...panelStyle, borderColor: '#dc2626', color: '#b91c1c' }}>{error}</div>}
    {notice && <div role="status" style={{ ...panelStyle, borderColor: '#16a34a' }}>{notice}</div>}
    {busy && <div style={{ fontSize: 13, opacity: .7 }}>Loading or saving AI management data…</div>}

    {tab === 'overview' && <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(145px,1fr))', gap: 10 }}>
      {[
        ['Customers', overview?.customer_profiles], ['Conversations', overview?.support_conversations],
        ['Knowledge documents', overview?.ai_knowledge_documents], ['Pending approvals', overview?.pending_approvals],
        ['Research records', overview?.ai_research_logs], ['Open conversations', overview?.open_conversations]
      ].map(([label, value]) => <article key={String(label)} style={panelStyle}><div style={{ fontSize: 12, opacity: .7 }}>{label}</div><strong style={{ display: 'block', fontSize: 27, marginTop: 6 }}>{value ?? '—'}</strong></article>)}
      <article style={{ ...panelStyle, gridColumn: '1/-1' }}><b>Operating policy</b><p style={{ fontSize: 13, lineHeight: 1.6, marginBottom: 0 }}>Official sources first; reputable independent sources second. One polite 24-hour follow-up. Customer-specific memory with privacy controls. Research unknowns before explaining uncertainty or escalating. AI may answer independently but requires management approval for financial and commercial commitments.</p></article>
    </div>}

    {tab === 'vehicles' && <>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}><h3 style={{ margin: 0 }}>Vehicle catalogue</h3><button style={buttonStyle} onClick={() => setVehicleDraft({ name: '', model: '', slug: '', description: '', price_usd: '', availability: 'unknown', source_type: 'management', verification_status: 'unverified', specifications_text: '{\n  \"variants\": [],\n  \"colors\": [],\n  \"wheels\": [],\n  \"features\": []\n}' })}>Add vehicle</button></div>
      {vehicleDraft && <div style={panelStyle}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))', gap: 10 }}>
          {field('Vehicle name', vehicleDraft.name, v => setVehicleDraft((d:any)=>({...d,name:v})))}
          {field('Model', vehicleDraft.model, v => setVehicleDraft((d:any)=>({...d,model:v})))}
          {field('Slug', vehicleDraft.slug, v => setVehicleDraft((d:any)=>({...d,slug:v})), 'model-y')}
          {field('Price (USD)', vehicleDraft.price_usd, v => setVehicleDraft((d:any)=>({...d,price_usd:v})))}
          {field('Model year', vehicleDraft.model_year, v => setVehicleDraft((d:any)=>({...d,model_year:v})))}
          {field('Market', vehicleDraft.market, v => setVehicleDraft((d:any)=>({...d,market:v})))}
          {field('Source URL', vehicleDraft.source_url, v => setVehicleDraft((d:any)=>({...d,source_url:v})))}
        </div>
        <label style={{ display: 'grid', gap: 6, marginTop: 10, fontSize: 13, fontWeight: 600 }}>Description<textarea style={{ ...inputStyle, minHeight: 90 }} value={vehicleDraft.description || ''} onChange={e => setVehicleDraft((d:any)=>({...d,description:e.target.value}))}/></label>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 10, marginTop: 10 }}>
          <label>Availability<select style={inputStyle} value={vehicleDraft.availability || 'unknown'} onChange={e=>setVehicleDraft((d:any)=>({...d,availability:e.target.value}))}>{['unknown','available','limited','unavailable','coming_soon'].map(v=><option key={v}>{v}</option>)}</select></label>
          <label>Source type<select style={inputStyle} value={vehicleDraft.source_type || 'management'} onChange={e=>setVehicleDraft((d:any)=>({...d,source_type:e.target.value}))}>{['management','tesla_official','government','independent','other'].map(v=><option key={v}>{v}</option>)}</select></label>
          <label>Verification<select style={inputStyle} value={vehicleDraft.verification_status || 'unverified'} onChange={e=>setVehicleDraft((d:any)=>({...d,verification_status:e.target.value}))}>{['unverified','verified_official','verified_independent','management_approved','outdated'].map(v=><option key={v}>{v}</option>)}</select></label>
        </div>
        <label style={{ display: 'flex', gap: 8, marginTop: 10, fontSize: 13 }}><input type="checkbox" checked={vehicleDraft.featured === true} onChange={e=>setVehicleDraft((d:any)=>({...d,featured:e.target.checked}))}/> Featured vehicle</label>
        <label style={{ display: 'flex', gap: 8, marginTop: 8, fontSize: 13 }}><input type="checkbox" checked={vehicleDraft.is_published === true} onChange={e=>setVehicleDraft((d:any)=>({...d,is_published:e.target.checked}))}/> Publish when verified</label>
        <label style={{ display: 'grid', gap: 6, marginTop: 10, fontSize: 13, fontWeight: 600 }}>Specifications JSON<textarea style={{ ...inputStyle, minHeight: 170, fontFamily: 'monospace' }} value={vehicleDraft.specifications_text ?? JSON.stringify(vehicleDraft.specifications || {}, null, 2)} onChange={e=>setVehicleDraft((d:any)=>({...d,specifications_text:e.target.value}))}/></label>
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}><button style={buttonStyle} onClick={()=>setVehicleDraft(null)}>Cancel</button><button style={{...buttonStyle,background:'#17191d',color:'#fff'}} disabled={busy} onClick={()=>void saveVehicle()}>Save vehicle</button></div>
      </div>}
      <div style={{ display: 'grid', gap: 9 }}>{vehicles.map(vehicle=><article key={vehicle.id} style={panelStyle}><div style={{ display:'flex',justifyContent:'space-between',gap:10,flexWrap:'wrap' }}><div><b>{vehicle.name}</b><div style={{fontSize:12,opacity:.7}}>{vehicle.model} · {vehicle.slug} · {vehicle.price_usd ? '$'+Number(vehicle.price_usd).toLocaleString('en-US') : 'Price not set'}</div></div><div>{status(vehicle.verification_status)} {status(vehicle.availability)}</div></div><p style={{fontSize:13,opacity:.75}}>{vehicle.description}</p><button style={buttonStyle} onClick={()=>setVehicleDraft({...vehicle,price_usd:vehicle.price_usd ?? '',specifications_text:JSON.stringify(vehicle.specifications || {},null,2)})}>Edit vehicle</button></article>)}</div>
    </>}

    {tab === 'knowledge' && <>
      <div style={{ display:'flex',justifyContent:'space-between',gap:10,flexWrap:'wrap' }}><h3 style={{margin:0}}>Approved knowledge library</h3><button style={buttonStyle} onClick={()=>setKnowledgeDraft({title:'',category:'company_faq',content:'',source_type:'management',verification_status:'unverified',approved:false})}>Add document</button></div>
      {knowledgeDraft && <div style={panelStyle}>
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(190px,1fr))',gap:10}}>
          {field('Title',knowledgeDraft.title,v=>setKnowledgeDraft((d:any)=>({...d,title:v})))}
          <label>Category<select style={inputStyle} value={knowledgeDraft.category||'company_faq'} onChange={e=>setKnowledgeDraft((d:any)=>({...d,category:e.target.value}))}>{['company_faq','vehicle_brochure','price_list','sales_procedure','delivery_policy','warranty','discount_policy','investment_information','customer_service','terms','other'].map(v=><option key={v}>{v}</option>)}</select></label>
          {field('Source URL',knowledgeDraft.source_url,v=>setKnowledgeDraft((d:any)=>({...d,source_url:v})))}
          <label>Source type<select style={inputStyle} value={knowledgeDraft.source_type||'management'} onChange={e=>setKnowledgeDraft((d:any)=>({...d,source_type:e.target.value}))}>{['management','tesla_official','government','independent','other'].map(v=><option key={v}>{v}</option>)}</select></label>
          <label>Verification<select style={inputStyle} value={knowledgeDraft.verification_status||'unverified'} onChange={e=>setKnowledgeDraft((d:any)=>({...d,verification_status:e.target.value}))}>{['unverified','verified_official','verified_independent','management_approved','outdated'].map(v=><option key={v}>{v}</option>)}</select></label>
          {field('Market',knowledgeDraft.market,v=>setKnowledgeDraft((d:any)=>({...d,market:v})))}
          {field('Model year',knowledgeDraft.model_year,v=>setKnowledgeDraft((d:any)=>({...d,model_year:v})))}
        </div>
        <label style={{display:'grid',gap:6,marginTop:10,fontSize:13,fontWeight:600}}>Knowledge content<textarea style={{...inputStyle,minHeight:180}} value={knowledgeDraft.content||''} onChange={e=>setKnowledgeDraft((d:any)=>({...d,content:e.target.value}))}/></label>
        <label style={{display:'flex',gap:8,marginTop:10,fontSize:13}}><input type="checkbox" checked={knowledgeDraft.approved===true} onChange={e=>setKnowledgeDraft((d:any)=>({...d,approved:e.target.checked}))}/> Approve for AI use (only verified or management-approved content is supplied)</label>
        <div style={{display:'flex',gap:8,marginTop:12}}><button style={buttonStyle} onClick={()=>setKnowledgeDraft(null)}>Cancel</button><button style={{...buttonStyle,background:'#17191d',color:'#fff'}} disabled={busy||!knowledgeDraft.title||!knowledgeDraft.content} onClick={()=>void saveKnowledge()}>Save knowledge</button></div>
      </div>}
      <div style={{display:'grid',gap:9}}>{knowledge.map(doc=><article key={doc.id} style={panelStyle}><div style={{display:'flex',justifyContent:'space-between',gap:8,flexWrap:'wrap'}}><b>{doc.title}</b>{status(doc.verification_status)}</div><div style={{fontSize:12,opacity:.7}}>{doc.category} · {doc.approved?'Approved':'Not approved'} · Version {doc.version}</div><p style={{fontSize:13,whiteSpace:'pre-wrap'}}>{String(doc.content||'').slice(0,420)}{String(doc.content||'').length>420?'…':''}</p><button style={buttonStyle} onClick={()=>setKnowledgeDraft({...doc})}>Edit document</button></article>)}</div>
    </>}

    {tab === 'approvals' && <div style={{display:'grid',gap:9}}>{approvals.map(item=><article key={item.id} style={panelStyle}><div style={{display:'flex',justifyContent:'space-between',gap:8,flexWrap:'wrap'}}><b>{String(item.approval_type||'Approval').replaceAll('_',' ')}</b>{status(item.status)}</div><p style={{fontSize:13,whiteSpace:'pre-wrap'}}>{JSON.stringify(item.request_data||{},null,2)}</p><small style={{opacity:.7}}>{new Date(item.requested_at).toLocaleString()}</small>{item.status==='pending'&&<div style={{display:'flex',gap:8,marginTop:10}}><button style={{...buttonStyle,background:'#166534',color:'#fff'}} disabled={busy} onClick={()=>void decide(item.id,'approved')}><Check size={14} style={{verticalAlign:'middle',marginRight:4}}/>Approve</button><button style={{...buttonStyle,background:'#991b1b',color:'#fff'}} disabled={busy} onClick={()=>void decide(item.id,'rejected')}><X size={14} style={{verticalAlign:'middle',marginRight:4}}/>Reject</button></div>}</article>)}{!approvals.length&&<p style={{opacity:.7}}>No approval requests are recorded.</p>}</div>}

    {tab === 'research' && <div style={{display:'grid',gap:9}}>{research.map(item=><article key={item.id} style={panelStyle}><div style={{display:'flex',justifyContent:'space-between',gap:8,flexWrap:'wrap'}}><b>{item.query}</b>{status(item.status)}</div><p style={{fontSize:12,opacity:.7}}>Verified: {item.verified?'Yes':'No'} · {item.model||'Model not recorded'} · {item.retrieved_at?new Date(item.retrieved_at).toLocaleString():'Not retrieved'}</p><p style={{fontSize:13,whiteSpace:'pre-wrap'}}>{item.answer_summary||item.findings||item.error_message||'No research summary recorded.'}</p>{Array.isArray(item.sources)&&item.sources.map((source:any,index:number)=><div key={index} style={{fontSize:12,marginTop:7}}><a href={source.url||source.link||'#'} target="_blank" rel="noreferrer">{source.title||source.url||'Research source'}</a><p>{source.description||source.snippet||''}</p></div>)}</article>)}{!research.length&&<p style={{opacity:.7}}>No web research records yet. Research remains disabled until its provider billing and token permissions are configured.</p>}</div>}

    {tab === 'followups' && <div style={{display:'grid',gap:9}}>{followups.map(item=><article key={item.source_message_id||item.conversation_id} style={panelStyle}><div style={{display:'flex',justifyContent:'space-between',gap:8,flexWrap:'wrap'}}><b>{item.customer_id||'Customer'}</b>{status(item.status)}</div><p style={{fontSize:13}}>Due: {item.due_at?new Date(item.due_at).toLocaleString():'—'} · Sent: {item.sent_at?new Date(item.sent_at).toLocaleString():'Not sent'}</p><small style={{opacity:.7}}>Attempts: {item.attempt_count||0} · {item.cancellation_reason||item.last_error||'No error recorded'}</small></article>)}{!followups.length&&<p style={{opacity:.7}}>No follow-up jobs recorded.</p>}</div>}

    {tab === 'customers' && <div style={{display:'grid',gap:9}}>{customers.map(customer=><article key={customer.id} style={panelStyle}><div style={{display:'flex',justifyContent:'space-between',gap:8,flexWrap:'wrap'}}><div><b>{customer.display_name||'Website visitor'}</b><div style={{fontSize:12,opacity:.7}}>{customer.email||'No email'} · {customer.phone||'No phone'}</div></div>{status(customer.crm_stage||'new enquiry')}</div><div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))',gap:10,marginTop:12}}><label style={{fontSize:12}}>CRM stage<select style={inputStyle} value={customer.crm_stage||'new_enquiry'} onChange={e=>void setStage(customer.id,e.target.value)}>{['new_enquiry','researching','comparing_vehicles','purchase_interested','draft_order_created','awaiting_management','awaiting_customer','completed','opted_out'].map(v=><option key={v} value={v}>{v.replaceAll('_',' ')}</option>)}</select></label><label style={{display:'flex',gap:8,alignItems:'center',fontSize:12}}><input type="checkbox" checked={customer.memory?.memory_enabled!==false} onChange={e=>void togglePreference(customer.id,'memory',e.target.checked)}/> Customer memory enabled</label><label style={{display:'flex',gap:8,alignItems:'center',fontSize:12}}><input type="checkbox" checked={customer.memory?.follow_up_enabled!==false} onChange={e=>void togglePreference(customer.id,'followup',e.target.checked)}/> 24-hour follow-up enabled</label></div><details style={{marginTop:10}}><summary style={{cursor:'pointer',fontSize:12}}>View stored preferences and memory</summary><pre style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere',fontSize:11,background:'var(--admin-input,#f8fafc)',padding:10,borderRadius:8}}>{JSON.stringify(customer.memory||{},null,2)}</pre></details></article>)}{!customers.length&&<p style={{opacity:.7}}>No customer profiles returned.</p>}</div>}

    {tab === 'settings' && <article style={panelStyle}>
      <h3 style={{marginTop:0}}>Research provider controls</h3><div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:10,flexWrap:'wrap'}}><div><b>Live web research</b><p style={{fontSize:13,opacity:.72}}>Official sources are searched first; reputable independent sources are used when official results are unavailable.</p></div>{status(webResearchEnabled?'enabled':'disabled')}</div>
      <label style={{display:'flex',gap:8,alignItems:'flex-start',fontSize:13,marginTop:12}}><input type="checkbox" checked={billingConfirmed} onChange={e=>setBillingConfirmed(e.target.checked)}/> I confirm that an AI Gateway provider key or credits are configured and I have reviewed possible provider charges.</label>
      <button style={{...buttonStyle,marginTop:12,background:'#17191d',color:'#fff'}} disabled={busy||!billingConfirmed} onClick={()=>void toggleResearch()}>{webResearchEnabled?'Disable live research':'Enable live research'}</button>
      <p style={{fontSize:12,opacity:.7,marginBottom:0}}>Do not enable until the Cloudflare token has AI Gateway Read permission and a provider key or credits are available. Workers AI's daily free neuron allowance does not automatically include web-search provider usage.</p>
    </article>}
  </section>;
}
