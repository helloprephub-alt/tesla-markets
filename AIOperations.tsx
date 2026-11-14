import { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';
import './ai-operations.css';

type Tab = 'overview'|'knowledge'|'approvals'|'research'|'crm'|'followups';
type DocForm = {
  id?: string; version?: number; title: string; category: string; content: string;
  source_url: string; source_type: string; verification_status: string;
  market: string; model_year: string; approved: boolean;
};
const emptyDoc: DocForm = {
  title:'', category:'company_faq', content:'', source_url:'', source_type:'management',
  verification_status:'management_approved', market:'', model_year:'', approved:false
};

const dateLabel=(value?:string|null)=>value?new Date(value).toLocaleString():'—';

async function adminCall(action:string, extra:Record<string,unknown>={}) {
  if(!supabase) throw new Error('Supabase is not configured.');
  const {data,error}=await supabase.functions.invoke('tesla-markets-ai-admin',{body:{action,...extra}});
  if(error) throw new Error(error.message||'Admin operation failed.');
  if(data?.error) throw new Error(data.error);
  return data;
}

export function AIOperations() {
  const [tab,setTab]=useState<Tab>('overview');
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [success,setSuccess]=useState('');
  const [overview,setOverview]=useState<Record<string,number>>({});
  const [documents,setDocuments]=useState<any[]>([]);
  const [approvals,setApprovals]=useState<any[]>([]);
  const [research,setResearch]=useState<any[]>([]);
  const [followups,setFollowups]=useState<any[]>([]);
  const [customers,setCustomers]=useState<any[]>([]);
  const [interactions,setInteractions]=useState<any[]>([]);
  const [selectedCustomer,setSelectedCustomer]=useState('');
  const [doc,setDoc]=useState<DocForm>(emptyDoc);
  const [decisionNote,setDecisionNote]=useState('');
  const [researchEnabled,setResearchEnabled]=useState(false);

  const refresh=async()=>{
    setLoading(true);setError('');
    try{
      const [ov,kn,ap,re,fu,cu,se]=await Promise.all([
        adminCall('overview'),adminCall('list_knowledge'),adminCall('list_approvals'),
        adminCall('list_research'),adminCall('list_followups'),adminCall('list_customers'),
        adminCall('settings')
      ]);
      setOverview(ov.counts||{});setDocuments(kn.documents||[]);setApprovals(ap.approvals||[]);
      setResearch(re.research||[]);setFollowups(fu.followups||[]);setCustomers(cu.customers||[]);
      setResearchEnabled(se.web_research_enabled===true);
    }catch(e){setError(e instanceof Error?e.message:'Unable to load AI operations.');}
    finally{setLoading(false);}
  };
  useEffect(()=>{void refresh();},[]);

  const run=async(action:string,extra:Record<string,unknown>={},message='Updated successfully.')=>{
    setBusy(true);setError('');setSuccess('');
    try{await adminCall(action,extra);setSuccess(message);await refresh();}
    catch(e){setError(e instanceof Error?e.message:'Operation failed.');}
    finally{setBusy(false);}
  };

  const saveDocument=async(e:React.FormEvent)=>{
    e.preventDefault();setBusy(true);setError('');setSuccess('');
    try{
      await adminCall('save_knowledge',doc);
      setDoc(emptyDoc);setSuccess('Knowledge document saved.');await refresh();
    }catch(e){setError(e instanceof Error?e.message:'Could not save document.');}
    finally{setBusy(false);}
  };
  const editDocument=(item:any)=>{
    setDoc({id:item.id,version:item.version,title:item.title||'',category:item.category||'other',
      content:item.content||'',source_url:item.source_url||'',source_type:item.source_type||'management',
      verification_status:item.verification_status||'unverified',market:item.market||'',
      model_year:item.model_year||'',approved:item.approved===true});
    setTab('knowledge');
    window.scrollTo({top:document.body.scrollHeight,behavior:'smooth'});
  };
  const loadInteractions=async(customerId:string)=>{
    setSelectedCustomer(customerId);setInteractions([]);
    try{const result=await adminCall('list_customer_interactions',{customer_id:customerId});setInteractions(result.interactions||[]);}
    catch(e){setError(e instanceof Error?e.message:'Could not load customer history.');}
  };
  const toggleResearch=async()=>{
    if(!researchEnabled){
      const confirmed=window.confirm('Live research uses Cloudflare Web Search through AI Gateway. Confirm that you have added AI Gateway Read permission and configured a provider API key or AI Gateway credits. Search-provider charges may apply. Enable live research?');
      if(!confirmed)return;
      await run('set_research_enabled',{enabled:true,confirm_provider_billing:true},'Live web research enabled.');
    }else{
      await run('set_research_enabled',{enabled:false},'Live web research disabled.');
    }
  };

  const tabs: {id:Tab;label:string}[]=[
    {id:'overview',label:'Overview'},{id:'knowledge',label:'Knowledge centre'},
    {id:'approvals',label:'Approvals'},{id:'research',label:'Research'},
    {id:'crm',label:'CRM & memory'},{id:'followups',label:'Follow-ups'}
  ];
  const metric=(label:string,value:number|undefined)=><div className="aio-metric" key={label}><span>{label}</span><strong>{value??0}</strong></div>;

  return <section className="aio-shell">
    <div className="aio-heading"><div><span>TESLA MARKETS / MANAGEMENT</span><h2>AI operations</h2><p>Knowledge, customer memory, approvals and customer follow-up control.</p></div><button onClick={()=>void refresh()} disabled={loading||busy}>Refresh</button></div>
    <nav className="aio-tabs">{tabs.map(item=><button key={item.id} className={tab===item.id?'active':''} onClick={()=>setTab(item.id)}>{item.label}</button>)}</nav>
    {error&&<div className="aio-alert error" role="alert">{error}</div>}
    {success&&<div className="aio-alert success" role="status">{success}</div>}
    {loading?<div className="aio-empty">Loading AI management data…</div>:null}

    {!loading&&tab==='overview'&&<div className="aio-panel">
      <div className="aio-metrics">
        {metric('Customers',overview.customer_profiles)}
        {metric('Open conversations',overview.open_conversations)}
        {metric('Knowledge documents',overview.ai_knowledge_documents)}
        {metric('Pending approvals',overview.pending_approvals)}
        {metric('Research records',overview.ai_research_logs)}
      </div>
      <div className="aio-note"><b>Operating rules</b><p>Official sources first; reputable independent sources second. One eligible follow-up after 24 hours. Long-term customer memory has privacy controls. Financial and commercial commitments require management approval.</p></div>
      <div className="aio-note"><b>Current research setting</b><p>{researchEnabled?'Live web research is enabled.':'Live web research is disabled pending Cloudflare permission and provider-billing setup.'}</p><button onClick={()=>void toggleResearch()} disabled={busy}>{researchEnabled?'Disable live research':'Configure live research'}</button></div>
    </div>}

    {!loading&&tab==='knowledge'&&<div className="aio-panel">
      <div className="aio-section-title"><div><h3>Business knowledge centre</h3><p>Only approved, current documents are supplied to the AI responder.</p></div></div>
      <form className="aio-doc-form" onSubmit={saveDocument}>
        <div className="aio-form-grid">
          <label>Document title<input required value={doc.title} onChange={e=>setDoc({...doc,title:e.target.value})}/></label>
          <label>Category<select value={doc.category} onChange={e=>setDoc({...doc,category:e.target.value})}>
            <option value="company_faq">Company FAQ</option><option value="vehicle_brochure">Vehicle brochure</option>
            <option value="price_list">Price list</option><option value="sales_procedure">Sales procedure</option>
            <option value="delivery_policy">Delivery policy</option><option value="warranty">Warranty</option>
            <option value="discount_policy">Discount policy</option><option value="investment_information">Investment information</option>
            <option value="customer_service">Customer service</option><option value="terms">Terms</option><option value="other">Other</option>
          </select></label>
          <label>Source type<select value={doc.source_type} onChange={e=>setDoc({...doc,source_type:e.target.value})}>
            <option value="management">Management</option><option value="tesla_official">Tesla official</option>
            <option value="government">Government</option><option value="independent">Independent</option><option value="other">Other</option>
          </select></label>
          <label>Verification<select value={doc.verification_status} onChange={e=>setDoc({...doc,verification_status:e.target.value})}>
            <option value="management_approved">Management approved</option><option value="verified_official">Verified official</option>
            <option value="verified_independent">Verified independent</option><option value="unverified">Unverified</option><option value="outdated">Outdated</option>
          </select></label>
          <label>Market<input value={doc.market} onChange={e=>setDoc({...doc,market:e.target.value})} placeholder="e.g. United States"/></label>
          <label>Model year<input value={doc.model_year} onChange={e=>setDoc({...doc,model_year:e.target.value})} placeholder="e.g. 2026"/></label>
          <label className="aio-wide">Source URL<input type="url" value={doc.source_url} onChange={e=>setDoc({...doc,source_url:e.target.value})} placeholder="https://…"/></label>
          <label className="aio-wide">Document content<textarea required rows={7} value={doc.content} onChange={e=>setDoc({...doc,content:e.target.value})} placeholder="Paste the approved policy, FAQ or vehicle information here."/></label>
        </div>
        <label className="aio-check"><input type="checkbox" checked={doc.approved} onChange={e=>setDoc({...doc,approved:e.target.checked})}/> Approve for AI use (requires a verified or management-approved status)</label>
        <div className="aio-form-actions"><button className="primary" disabled={busy}>{doc.id?'Save changes':'Add knowledge document'}</button>{doc.id&&<button type="button" onClick={()=>setDoc(emptyDoc)}>Cancel edit</button>}</div>
      </form>
      <div className="aio-list">{documents.map(item=><article className="aio-item" key={item.id}>
        <div><b>{item.title}</b><small>{item.category.replace(/_/g,' ')} · {item.source_type} · {item.verification_status}</small><p>{item.content?.slice(0,260)}{item.content?.length>260?'…':''}</p><small>{item.approved?'Approved for AI use':'Not approved'} · Updated {dateLabel(item.updated_at)}</small></div>
        <button onClick={()=>editDocument(item)}>Edit</button>
      </article>)}{!documents.length&&<div className="aio-empty">No knowledge documents have been added yet.</div>}</div>
    </div>}

    {!loading&&tab==='approvals'&&<div className="aio-panel">
      <div className="aio-section-title"><div><h3>Management approval queue</h3><p>Approving a request records management's decision; it does not execute a payment, order or delivery commitment.</p></div></div>
      <label className="aio-note-field">Decision note<input value={decisionNote} onChange={e=>setDecisionNote(e.target.value)} placeholder="Optional note for the audit trail"/></label>
      <div className="aio-list">{approvals.map(item=><article className="aio-item stacked" key={item.id}>
        <div className="aio-item-head"><b>{item.approval_type.replace(/_/g,' ')}</b><span className={'aio-status '+item.status}>{item.status}</span></div>
        <small>Requested {dateLabel(item.requested_at)} · Conversation {item.conversation_id||'—'}</small>
        <pre>{JSON.stringify(item.request_data,null,2)}</pre>
        {item.status==='pending'&&<div className="aio-form-actions"><button className="primary" disabled={busy} onClick={()=>void run('decide_approval',{id:item.id,status:'approved',decision_note:decisionNote},'Approval decision recorded.')}>Approve</button><button className="danger" disabled={busy} onClick={()=>void run('decide_approval',{id:item.id,status:'rejected',decision_note:decisionNote},'Rejection recorded.')}>Reject</button></div>}
        {item.decision_note&&<small>Decision note: {item.decision_note}</small>}
      </article>)}{!approvals.length&&<div className="aio-empty">No approval requests.</div>}</div>
    </div>}

    {!loading&&tab==='research'&&<div className="aio-panel">
      <div className="aio-section-title"><div><h3>Web research audit</h3><p>Research is currently {researchEnabled?'enabled':'disabled'}; sources and retrieval records appear here when used.</p></div><button onClick={()=>void toggleResearch()} disabled={busy}>{researchEnabled?'Disable':'Enable'} research</button></div>
      <div className="aio-warning">Enabling research can incur Cloudflare AI Gateway provider charges. Configure the API token with Workers AI Read and AI Gateway Read, and configure provider BYOK or credits first.</div>
      <div className="aio-list">{research.map(item=><article className="aio-item stacked" key={item.id}>
        <div className="aio-item-head"><b>{item.query}</b><span className={'aio-status '+item.status}>{item.status}</span></div>
        <small>{dateLabel(item.created_at)} · {item.verified?'Official source found':'No official source verification'}</small>
        {(item.sources||[]).map((source:any,index:number)=><p key={index}><a href={source.url} target="_blank" rel="noreferrer">{source.title||source.domain}</a> <small>({source.source_type})</small><br/>{source.description}</p>)}
        {item.error_message&&<small>{item.error_message}</small>}
      </article>)}{!research.length&&<div className="aio-empty">No live research records yet.</div>}</div>
    </div>}

    {!loading&&tab==='crm'&&<div className="aio-panel">
      <div className="aio-section-title"><div><h3>Customer relationship management</h3><p>Manage customer stages, review interactions and control long-term memory.</p></div></div>
      <div className="aio-crm-layout">
        <div className="aio-list">{customers.map(item=><article className={'aio-customer '+(selectedCustomer===item.id?'selected':'')} key={item.id}>
          <button className="aio-customer-main" onClick={()=>void loadInteractions(item.id)}><b>{item.display_name||'Customer'}</b><small>{item.email||'No email'} · {item.phone||'No phone'}</small></button>
          <label>CRM stage<select value={item.crm_stage||'new_enquiry'} onChange={e=>void run('set_crm_stage',{customer_id:item.id,stage:e.target.value},'Customer stage updated.')}><option value="new_enquiry">New enquiry</option><option value="researching">Researching</option><option value="comparing_vehicles">Comparing vehicles</option><option value="purchase_interested">Purchase interested</option><option value="draft_order_created">Draft order created</option><option value="awaiting_management">Awaiting management</option><option value="awaiting_customer">Awaiting customer</option><option value="completed">Completed</option><option value="opted_out">Opted out</option></select></label>
          <div className="aio-memory-control"><span>Long-term memory: {item.memory?.memory_enabled===false?'Off':'On'}</span><button onClick={()=>void run('set_memory_preference',{customer_id:item.id,enabled:item.memory?.memory_enabled===false},'Customer memory preference updated.')}>{item.memory?.memory_enabled===false?'Enable':'Disable'}</button></div>
        </article>)}{!customers.length&&<div className="aio-empty">No customer profiles found.</div>}</div>
        <div className="aio-history"><h4>Customer interaction history</h4>{selectedCustomer?interactions.map(item=><article key={item.id}><b>{item.interaction_type.replace(/_/g,' ')}</b><small>{dateLabel(item.created_at)}</small><p>{item.summary}</p></article>):<div className="aio-empty">Select a customer to view their history.</div>}</div>
      </div>
    </div>}

    {!loading&&tab==='followups'&&<div className="aio-panel">
      <div className="aio-section-title"><div><h3>24-hour follow-up queue</h3><p>One polite follow-up per eligible enquiry. Replies, opt-outs, resolution and management takeover cancel the pending follow-up.</p></div></div>
      <div className="aio-list">{followups.map(item=><article className="aio-item" key={item.conversation_id}>
        <div><b>{item.status}</b><small>Conversation {item.conversation_id}</small><p>Due: {dateLabel(item.due_at)} · Sent: {dateLabel(item.sent_at)}</p><small>{item.cancellation_reason||item.last_error||'No cancellation reason'}</small></div>
        <span className={'aio-status '+item.status}>{item.status}</span>
      </article>)}{!followups.length&&<div className="aio-empty">No follow-up records.</div>}</div>
    </div>}
    <div className="aio-footer">AI operations console · Private administrator access · Changes are recorded in the management audit trail.</div>
  </section>;
}
