import { useEffect, useState } from 'react';
import { ArrowLeft, LockKeyhole, ShieldCheck } from 'lucide-react';
import { AdminInbox } from './ChatWorkspace';
import { supabase } from './supabaseClient';
import './markets-redesign.css';
import './index.css';

export default function AdminApp() {
  const [privateKey, setPrivateKey] = useState('');
  const [message, setMessage] = useState('');
  const [signedIn, setSignedIn] = useState(false);
  const [busy, setBusy] = useState(false);

  const confirmAdmin = async () => {
    if (!supabase) throw new Error('Admin sign-in is unavailable.');
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData.user) throw new Error('Administrator session could not be verified.');
    const { data: profile, error: profileError } = await supabase
      .from('customer_profiles').select('is_admin').eq('id', userData.user.id).maybeSingle();
    if (profileError) throw profileError;
    if (profile?.is_admin !== true) {
      await supabase.auth.signOut();
      throw new Error('This account is not authorized as an administrator.');
    }
    setSignedIn(true);
  };

  useEffect(() => {
    let active = true;
    const checkExistingSession = async () => {
      if (!supabase) return;
      try {
        const { data } = await supabase.auth.getSession();
        if (data.session) {
          await confirmAdmin();
        }
      } catch {
        if (active) await supabase.auth.signOut();
      }
    };
    void checkExistingSession();
    return () => { active = false; };
  }, []);

  const signIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase || busy) { setMessage('Admin sign-in is unavailable.'); return; }
    setBusy(true); setMessage('');
    try {
      const { data, error } = await supabase.functions.invoke('admin-key-login', {
        body: { key: privateKey },
      });
      if (error) throw new Error('Could not verify the private key. Please try again.');
      if (!data?.token_hash) throw new Error(data?.error || 'Invalid access key.');
      const { error: verifyError } = await supabase.auth.verifyOtp({
        token_hash: data.token_hash,
        type: 'magiclink',
      });
      if (verifyError) throw verifyError;
      setPrivateKey('');
      await confirmAdmin();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Unable to sign in.');
    } finally {
      setBusy(false);
    }
  };

  const signOut = async () => {
    await supabase?.auth.signOut();
    setSignedIn(false);
    setPrivateKey('');
    setMessage('');
  };

  if (signedIn) return <div className="admin-standalone"><header><a href="/" aria-label="Public website"><ArrowLeft size={17}/> Public website</a><div><ShieldCheck size={18}/> TESLA MARKETS <b>ADMIN</b></div><button onClick={signOut}>Sign out</button></header><main><div className="admin-welcome"><span>PRIVATE MANAGEMENT CONSOLE</span><h1>Administrator<br/><em>workspace.</em></h1><p>Manage customer enquiries and support conversations.</p></div><AdminInbox/></main></div>;

  return <div className="admin-standalone admin-login-page">
    <header><a href="/"><ArrowLeft size={17}/> Public website</a><div><ShieldCheck size={18}/> TESLA MARKETS <b>ADMIN</b></div><span>PRIVATE ACCESS</span></header>
    <main><section className="admin-login-card"><div className="admin-lock"><LockKeyhole size={23}/></div><span>SECURE ADMINISTRATION</span><h1>Admin sign in</h1><p>Enter your private administrator key to access the management dashboard.</p>
      <form onSubmit={signIn}><label>Private access key<input type="password" required autoComplete="current-password" value={privateKey} onChange={e=>setPrivateKey(e.target.value)} placeholder="Enter your private key"/></label><button disabled={busy}>{busy?'Verifying access…':'Unlock admin dashboard'}</button></form>
      {message&&<p className="admin-login-error" role="alert">{message}</p>}<small>Access is verified securely by the server. Your key is never saved in this browser.</small>
    </section></main>
  </div>;
}
