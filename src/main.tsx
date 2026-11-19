import { Component, StrictMode, type ErrorInfo, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';
import './brand-logo-restore.css';

class AppErrorBoundary extends Component<{children:ReactNode},{hasError:boolean}> {
  state = { hasError:false };
  static getDerivedStateFromError() { return { hasError:true }; }
  componentDidCatch(error:Error, info:ErrorInfo) {
    console.error('[Tesla Markets] Application render failure', error, info.componentStack);
  }
  render() {
    if (this.state.hasError) return <main style={{minHeight:'100vh',display:'grid',placeItems:'center',padding:24,background:'#101820',color:'#fff',fontFamily:'Arial,sans-serif'}}>
      <section style={{maxWidth:480,textAlign:'center'}}>
        <p style={{letterSpacing:'.18em',fontSize:12,color:'#e82127'}}>TESLA MARKETS</p>
        <h1 style={{fontSize:28}}>We’re restoring your experience.</h1>
        <p style={{color:'#c4cbd0',lineHeight:1.6}}>A page component did not load correctly. Your account and saved information have not been changed. Reload the page to try again.</p>
        <button onClick={()=>window.location.reload()} style={{padding:'13px 22px',border:0,borderRadius:5,background:'#e82127',color:'#fff',fontWeight:700}}>Reload website</button>
      </section>
    </main>;
    return this.props.children;
  }
}

// Register the lightweight push worker so the admin app can receive notifications
// and meet the service-worker requirement for native PWA installation.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(error => {
      console.error('[Tesla Markets] Service worker registration failed', error);
    });
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppErrorBoundary><App /></AppErrorBoundary>
  </StrictMode>
);
