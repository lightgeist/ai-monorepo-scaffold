import { StrictMode, lazy, Suspense, useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import { AuthProvider } from './contexts/AuthContext';
const App=lazy(()=>import('./App.jsx'));
const Landing=lazy(()=>import('./Landing.jsx'));
const Legal=lazy(()=>import('./Legal.jsx'));
function Root(){ const [hash,setHash]=useState(window.location.hash); useEffect(()=>{const f=()=>setHash(window.location.hash);window.addEventListener('hashchange',f);return()=>window.removeEventListener('hashchange',f)},[]);if(hash==='#legal')return <Legal/>;if(hash==='#landing'||hash.startsWith('#/pricing')||hash.startsWith('#/account')||hash.startsWith('#/auth')||hash.startsWith('#/oauth'))return <Landing onLaunchApp={()=>{window.location.hash='#app'}}/>;return <App/>; }
createRoot(document.getElementById('root')).render(<StrictMode><AuthProvider><Suspense fallback={<div className="min-h-screen bg-paper text-muted p-12">Loading AtlasShorts…</div>}><Root/></Suspense></AuthProvider></StrictMode>);
