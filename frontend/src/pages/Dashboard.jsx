import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import SecureBankIntro from '../components/SecureBankIntro';
import ServiceCard from '../components/ServiceCard';
import AuthModal from '../components/AuthModal';
import { useAuth, api } from '../hooks/useAuth';

export default function Dashboard() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  // State Machine
  const [activeAction, setActiveAction] = useState(null); // 'balance', 'history', 'send', 'setSPIN', 'setFace'
  const [authMode, setAuthMode] = useState(null); // 'spin' or 'face'
  const [setupStatus, setSetupStatus] = useState({ hasSPIN: false, hasFace: false, spinSetAt: null, faceSetAt: null, username: '' });
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [supportOpen, setSupportOpen] = useState(false);
  const [theme, setTheme] = useState('dark');

  useEffect(() => {
    // Fetch setup status on mount
    api.get('/dashboard/status').then(res => setSetupStatus(res.data)).catch(() => {});

    const handleOpenNotifications = () => setNotificationsOpen(true);
    const handleOpenSupport = () => setSupportOpen(true);
    document.addEventListener('open-notifications', handleOpenNotifications);
    document.addEventListener('open-support', handleOpenSupport);
    return () => {
      document.removeEventListener('open-notifications', handleOpenNotifications);
      document.removeEventListener('open-support', handleOpenSupport);
    };
  }, []);

  // Compute expirations (90 days)
  const spinExpiry = setupStatus.spinSetAt ? new Date(new Date(setupStatus.spinSetAt).getTime() + 90 * 24 * 60 * 60 * 1000) : null;
  const faceExpiry = setupStatus.faceSetAt ? new Date(new Date(setupStatus.faceSetAt).getTime() + 90 * 24 * 60 * 60 * 1000) : null;

  
  // Data State
  const [authSpin, setAuthSpin] = useState('');
  const [pendingTransfer, setPendingTransfer] = useState(null);
  const [transferFormOpen, setTransferFormOpen] = useState(false);
  const [displayData, setDisplayData] = useState(null); // Holds balance or history data
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const clearState = () => {
    setActiveAction(null);
    setAuthMode(null);
    setAuthSpin('');
    setPendingTransfer(null);
    setTransferFormOpen(false);
  };

  const clearAlerts = () => {
    setError('');
    setSuccess('');
  };

  const handleAuthSuccess = async (data) => {
    clearAlerts();
    
    try {
      if (authMode === 'spin') {
        if (activeAction === 'setSPIN') {
          await api.post('/dashboard/settings/spin', { spin: data });
          setSuccess('S-PIN has been successfully updated.');
          api.get('/dashboard/status').then(res => setSetupStatus(res.data));
          clearState();
        } else if (activeAction === 'balance') {
          const res = await api.post('/dashboard/transactions/balance', { spin: data });
          setDisplayData({ type: 'balance', data: res.data });
          clearState();
        } else if (activeAction === 'history') {
          const res = await api.post('/dashboard/transactions/history', { spin: data });
          setDisplayData({ type: 'history', data: res.data.history });
          clearState();
        } else if (activeAction === 'send') {
          // Transition to Step 2: Face
          setAuthSpin(data);
          setAuthMode('face');
        }
      } else if (authMode === 'face') {
        if (activeAction === 'setFace') {
          await api.post('/dashboard/settings/face', { descriptor: data });
          setSuccess('Facial biometric descriptor saved successfully.');
          api.get('/dashboard/status').then(res => setSetupStatus(res.data));
          clearState();
        } else if (activeAction === 'send') {
          await api.post('/dashboard/transactions/transfer', {
            spin: authSpin,
            faceDescriptor: data,
            amount: pendingTransfer.amount,
            recipient: pendingTransfer.recipient
          });
          setSuccess(`Successfully sent ₹${pendingTransfer.amount} to ${pendingTransfer.recipient}.`);
          clearState();
        }
      }
    } catch (err) {
      const errMsg = err.response?.data?.error || err.message || 'An error occurred.';
      if (authMode === 'face' && activeAction === 'send') {
        clearState(); // Abort transaction on face failure
      }
      setError(errMsg);
    }
  };

  const handleSignOut = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className={`min-h-screen flex ${theme === 'dark' ? 'bg-slate-900' : 'bg-slate-100'}`}>
      {/* Sidebar Navigation */}
      <Sidebar 
        user={{ ...user, ...setupStatus }}
        onSetSPIN={() => { 
          clearAlerts();
          if (setupStatus.hasSPIN) return setSuccess('Your S-PIN is already set. You can reset it after 3 months.');
          clearState(); setActiveAction('setSPIN'); setAuthMode('spin'); 
        }}
        onRegisterFace={() => { 
          clearAlerts();
          if (setupStatus.hasFace) return setSuccess('Your Facecard is already set. You can reset it after 3 months.');
          clearState(); setActiveAction('setFace'); setAuthMode('face'); 
        }}
        onFacecardAlreadyRegistered={() => {
          clearAlerts();
          setSuccess('Your Facecard is already set. You can reset it after 3 months.');
        }}
        onOpenSettings={() => { clearAlerts(); setSettingsOpen(true); }}
        onSignOut={handleSignOut}
      />

      {/* Main Content Area */}
      <div className="flex-1 p-8 overflow-y-auto">
        <div className="max-w-4xl mx-auto">
          <SecureBankIntro />

          {/* Alert Banners */}
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-400 p-4 rounded-xl mb-6">
              {error}
            </div>
          )}
          {success && (
            <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 p-4 rounded-xl mb-6">
              {success}
            </div>
          )}

          {/* Primary Action Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <ServiceCard 
              title="Check Balance"
              description="View your current account balance securely."
              icon={<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
              onClick={() => { clearAlerts(); clearState(); setDisplayData(null); setActiveAction('balance'); setAuthMode('spin'); }}
            />
            <ServiceCard 
              title="Transaction History"
              description="Review your recent deposits and withdrawals."
              icon={<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>}
              onClick={() => { clearAlerts(); clearState(); setDisplayData(null); setActiveAction('history'); setAuthMode('spin'); }}
            />
            <ServiceCard 
              title="Send Money"
              description="High-risk action requiring 2-Step Biological verification."
              danger={true}
              icon={<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>}
              onClick={() => { clearAlerts(); clearState(); setDisplayData(null); setTransferFormOpen(true); }}
            />
          </div>

          {/* Inline Data Display */}
          {displayData?.type === 'balance' && (
            <div className="bg-slate-800 rounded-2xl p-8 text-center border border-slate-700">
              <h3 className="text-slate-400 text-sm uppercase tracking-wider mb-2">Available Balance</h3>
              <p className="text-5xl font-bold text-white mb-2">
                <span className="text-slate-500">₹</span>{displayData.data.balance}
              </p>
              <p className="text-emerald-400 text-sm">Valid as of {new Date().toLocaleTimeString()}</p>
            </div>
          )}

          {displayData?.type === 'history' && (
            <div className="bg-slate-800 rounded-2xl p-6 border border-slate-700">
              <h3 className="text-white font-bold text-lg mb-4">Recent Transactions</h3>
              <div className="space-y-4">
                {displayData.data.map((tx) => (
                  <div key={tx.id} className="flex justify-between items-center p-4 bg-slate-900/50 rounded-xl">
                    <div>
                      <p className="text-white font-medium">{tx.description}</p>
                      <p className="text-slate-500 text-xs">{tx.date}</p>
                    </div>
                    <span className={`font-bold ${tx.amount.startsWith('-') ? 'text-white' : 'text-emerald-400'}`}>
                      {tx.amount}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      </div>

      {/* Auth Modal Interceptor */}
      <AuthModal
        isOpen={authMode !== null}
        mode={authMode}
        title={
          authMode === 'spin' 
            ? (activeAction === 'setSPIN' ? 'Create S-PIN' : 'Enter S-PIN to Authorize')
            : (activeAction === 'setFace' ? 'Register Face Descriptor' : 'Step 2: Verify Identity')
        }
        onClose={clearState}
        onSuccess={handleAuthSuccess}
        onError={setError}
      />

      {/* Transfer Form Modal */}
      {transferFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className={`w-full max-w-sm border rounded-2xl p-6 ${theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200 shadow-xl'}`}>
            <h2 className={`text-xl font-bold mb-4 ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>Send Money</h2>
            <form onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.target);
              setPendingTransfer({ recipient: fd.get('recipient'), amount: fd.get('amount') });
              setTransferFormOpen(false);
              setActiveAction('send');
              setAuthMode('spin'); // Kickoff 2-Step Auth
            }}>
              <div className="mb-4">
                <label className="block text-slate-400 text-sm mb-2">Recipient Email or Username</label>
                <input required name="recipient" type="text" className={`w-full border rounded-xl px-4 py-2 ${theme === 'dark' ? 'bg-slate-900 border-slate-600 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'}`} />
              </div>
              <div className="mb-6">
                <label className="block text-slate-400 text-sm mb-2">Amount (INR)</label>
                <input required name="amount" type="number" step="0.01" min="1" className={`w-full border rounded-xl px-4 py-2 ${theme === 'dark' ? 'bg-slate-900 border-slate-600 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'}`} />
              </div>
              <div className="flex gap-3">
                <button type="button" onClick={() => setTransferFormOpen(false)} className={`flex-1 py-2 rounded-xl ${theme === 'dark' ? 'bg-slate-700 text-white' : 'bg-slate-200 text-slate-700'}`}>Cancel</button>
                <button type="submit" className="flex-1 py-2 rounded-xl bg-emerald-500 text-white font-bold">Proceed</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {settingsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className={`w-full max-w-sm border rounded-2xl p-6 ${theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200 shadow-xl'}`}>
            <div className="flex justify-between items-center mb-6">
              <h2 className={`text-xl font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>Settings</h2>
              <button onClick={() => setSettingsOpen(false)} className="text-slate-400 hover:text-slate-500">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            
            <div className="mb-6">
              <label className="block text-slate-400 text-sm mb-2">Theme</label>
              <div className="flex gap-2">
                <button 
                  onClick={() => setTheme('dark')} 
                  className={`flex-1 py-2 rounded-xl border ${theme === 'dark' ? 'border-indigo-500 bg-indigo-500/10 text-indigo-400' : 'border-slate-700 text-slate-400'}`}
                >Dark</button>
                <button 
                  onClick={() => setTheme('light')} 
                  className={`flex-1 py-2 rounded-xl border ${theme === 'light' ? 'border-indigo-500 bg-indigo-50 text-indigo-600' : 'border-slate-300 text-slate-500'}`}
                >Light</button>
              </div>
            </div>

            <form onSubmit={async (e) => {
              e.preventDefault();
              const fd = new FormData(e.target);
              try {
                await api.post('/dashboard/settings/username', { username: fd.get('username') });
                setSetupStatus(s => ({ ...s, username: fd.get('username') }));
                setSuccess('Username updated successfully.');
                setSettingsOpen(false);
              } catch(err) {
                setError('Failed to update username.');
              }
            }}>
              <div className="mb-6">
                <label className="block text-slate-400 text-sm mb-2">Change Username</label>
                <input 
                  required 
                  name="username" 
                  type="text" 
                  defaultValue={setupStatus.username}
                  placeholder="Enter new username"
                  className={`w-full border rounded-xl px-4 py-2 ${theme === 'dark' ? 'bg-slate-900 border-slate-600 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'}`} 
                />
              </div>
              <button type="submit" className="w-full py-2 rounded-xl bg-indigo-500 text-white font-bold">Save Changes</button>
            </form>
          </div>
        </div>
      )}

      {/* Notifications Modal */}
      {notificationsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className={`w-full max-w-sm border rounded-2xl p-6 ${theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200 shadow-xl'}`}>
            <div className="flex justify-between items-center mb-6">
              <h2 className={`text-xl font-bold flex items-center gap-2 ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                <svg className="w-5 h-5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
                Notifications
              </h2>
              <button onClick={() => setNotificationsOpen(false)} className="text-slate-400 hover:text-slate-500">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            
            {!(spinExpiry || faceExpiry) ? (
              <div className={`p-6 rounded-xl text-center shadow-inner ${theme === 'dark' ? 'bg-slate-900/50' : 'bg-slate-50'}`}>
                <p className="text-slate-400 font-medium">No new notifications.</p>
                <p className="text-slate-500 text-sm mt-1">You are all caught up!</p>
              </div>
            ) : (
              <div className="space-y-4">
                {spinExpiry && (
                  <div className={`p-4 rounded-xl ${theme === 'dark' ? 'bg-slate-900/50' : 'bg-slate-50'}`}>
                    <p className={`text-sm ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>
                      S-PIN expiring on <strong>{spinExpiry.toLocaleDateString()}</strong>. Please reset your S-PIN on or before {spinExpiry.toLocaleDateString()}.
                    </p>
                  </div>
                )}
                {faceExpiry && (
                  <div className={`p-4 rounded-xl ${theme === 'dark' ? 'bg-slate-900/50' : 'bg-slate-50'}`}>
                    <p className={`text-sm ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>
                      Facecard expiring on <strong>{faceExpiry.toLocaleDateString()}</strong>. Please update your Facecard on or before {faceExpiry.toLocaleDateString()}.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Support Modal */}
      {supportOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className={`w-full max-w-sm border rounded-2xl p-6 ${theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200 shadow-xl'}`}>
            <div className="flex justify-between items-center mb-6">
              <h2 className={`text-xl font-bold flex items-center gap-2 ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                <svg className="w-5 h-5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
                Help & Support
              </h2>
              <button onClick={() => setSupportOpen(false)} className="text-slate-400 hover:text-slate-500">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            
            <div className={`p-6 rounded-xl shadow-inner text-center ${theme === 'dark' ? 'bg-slate-900/50' : 'bg-slate-50'}`}>
              <div className="w-12 h-12 bg-emerald-500/10 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
              </div>
              <h3 className={`font-bold mb-2 ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>Contact Support</h3>
              <p className="text-slate-500 text-sm mb-4">Reach out to us at the following email address to ask for any help or query:</p>
              <a href="mailto:swathi3209@gmail.com" className="inline-block bg-indigo-500 hover:bg-indigo-400 text-white font-semibold py-2 px-6 rounded-xl transition-colors">
                swathi3209@gmail.com
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
