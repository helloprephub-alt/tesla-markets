import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ArrowLeft, LockKeyhole, ShieldCheck } from 'lucide-react';
import { AdminInbox } from './ChatWorkspace';
import { supabase } from './supabaseClient';
import './markets-redesign.css';
import './index.css';

function AdminApp() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [signedIn, setSignedIn] = useState(false);
  const [busy, setBusy] = useState(false);

  const signIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase || busy) { setMessage('Admin sign-in is unavailable.'); return; }
    setBusy(true); setMessage('');
    try {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error) throw error;
      const { data: userData } = await supabase.auth.getUser();
      const { data: profile, error: profileError } = await supabase.from('customer_profiles').select('is_admin').eq('id', userData.user?.id).maybeSingle();
      if (profileError) throw profileError;
      if (profile?.is_admin !== true) {
        await supabase.auth.signOut();
        throw new Error('This account is not authorized as an administrator.');
      }
      setSignedIn(true);
    } catch (err) { setMessage(err instanceof Error ? err.message : 'Unable to sign in.'); }
    finally { setBusy(false); }
  };

  if (signedIn) return <div className="admin-standalone"><header><a href="/" aria-label="Public website"><ArrowLeft size={17}/> Public website</a><div><ShieldCheck size={18}/> TESLA MARKETS <b>ADMIN</b></div><button onClick={async()=>{await supabase?.auth.signOut();setSignedIn(false);}}>Sign out</button></header><main><div className="admin-welcome"><span>PRIVATE MANAGEMENT CONSOLE</span><h1>Administrator<br/><em>workspace.</em></h1><p>Manage customer enquiries and support conversations.</p></div><AdminInbox/></main></div>;

  return <div className="admin-standalone admin-login-page">
    <header><a href="/"><ArrowLeft size={17}/> Public website</a><div><ShieldCheck size={18}/> TESLA MARKETS <b>ADMIN</b></div><span>PRIVATE ACCESS</span></header>
    <main><section className="admin-login-card"><div className="admin-lock"><LockKeyhole size={23}/></div><span>SECURE ADMINISTRATION</span><h1>Admin sign in</h1><p>This is a private dashboard, separate from the customer website.</p>
      <form onSubmit={signIn}><label>Administrator email<input type="email" required autoComplete="username" value={email} onChange={e=>setEmail(e.target.value)}/></label><label>Password<input type="password" required autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)}/></label><button disabled={busy}>{busy?'Checking access…':'Sign in to dashboard'}</button></form>
      {message&&<p className="admin-login-error">{message}</p>}<small>Admin privileges are verified against Supabase after authentication.</small>
    </section></main>
  </div>;
}
createRoot(document.getElementById('root')!).render(<AdminApp/>);
