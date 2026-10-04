import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { startRegistration } from '@simplewebauthn/browser';
import { api } from '../hooks/useAuth';
import RecoveryCodeModal from '../components/RecoveryCodeModal';
import EmailInput from '../components/EmailInput';

// Auto-format input as XXXX-XXXX-XXXX-XXXX
function formatCode(raw) {
  const cleaned = raw.replace(/[^A-Fa-f0-9]/g, '').toUpperCase().slice(0, 16);
  const groups = [];
  for (let i = 0; i < cleaned.length; i += 4) {
    groups.push(cleaned.slice(i, i + 4));
  }
  return groups.join('-');
}

export default function RecoveryPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const prefillEmail = location.state?.email || '';

  const [email, setEmail] = useState(prefillEmail);
  const [emailValid, setEmailValid] = useState(!!prefillEmail);
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [lockoutInfo, setLockoutInfo] = useState(null);
  const [newRecoveryCode, setNewRecoveryCode] = useState(null);
  const [registrationOptions, setRegistrationOptions] = useState(null);
  const [countdown, setCountdown] = useState(null);

  // Countdown timer for lockout display
  useEffect(() => {
    if (!lockoutInfo) return;
    const end = new Date(lockoutInfo.lockedUntil).getTime();
    const tick = setInterval(() => {
      const rem = Math.max(0, Math.ceil((end - Date.now()) / 1000));
      setCountdown(rem);
      if (rem === 0) clearInterval(tick);
    }, 1000);
    return () => clearInterval(tick);
  }, [lockoutInfo]);

  function handleCodeChange(e) {
    setCode(formatCode(e.target.value));
  }

  async function handleRecover(e) {
    e.preventDefault();
    setError('');
    setLockoutInfo(null);
    setLoading(true);

    try {
      const res = await api.post('/auth/recover', { email, recoveryCode: code });
      // Success — show new recovery code and prepare re-enrollment
      setNewRecoveryCode(res.data.newRecoveryCode);
      setRegistrationOptions(res.data.registrationOptions);
    } catch (err) {
      if (err.response?.status === 403) {
        if (err.response.data?.lockedUntil) {
          setLockoutInfo(err.response.data);
        } else {
          setError(err.response.data?.error || 'Incorrect recovery code.');
        }
      } else {
        setError(err.response?.data?.error || 'Recovery failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleReEnroll() {
    if (!registrationOptions) return;
    try {
      const credential = await startRegistration({ optionsJSON: registrationOptions });
      await api.post('/auth/recover/finish', {
        email,
        credentialResponse: credential,
        deviceName: 'Recovered Device',
      });
      setNewRecoveryCode(null);
      navigate('/');
    } catch (err) {
      setNewRecoveryCode(null); // Close the modal so the user can see the error
      setError('Re-enrollment failed: ' + (err.response?.data?.error || err.message || 'Please try again.'));
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-red-950/20 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-amber-500/10 rounded-2xl mb-4 border border-amber-500/20">
            <svg className="w-8 h-8 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Emergency Recovery</h1>
          <p className="text-slate-400 mt-2 text-sm">Enter your 16-character recovery code</p>
        </div>

        <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-8 shadow-2xl">
          {/* Lockout Countdown */}
          {lockoutInfo && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-4 mb-5 text-center">
              <p className="text-red-400 font-semibold text-sm">Account Locked</p>
              {countdown !== null && (
                <p className="text-red-300/80 text-2xl font-mono mt-2">
                  {String(Math.floor(countdown / 60)).padStart(2, '0')}:
                  {String(countdown % 60).padStart(2, '0')}
                </p>
              )}
              <p className="text-red-300/60 text-xs mt-1">A security alert has been sent to your email.</p>
            </div>
          )}

          <form onSubmit={handleRecover} className="space-y-5">
            <EmailInput
              id="recover-email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onValidated={setEmailValid}
              accentColor="amber"
              disabled={loading}
            />

            <div>
              <label htmlFor="recovery-code-input" className="block text-sm font-medium text-slate-300 mb-2">
                Recovery Code
              </label>
              <input
                id="recovery-code-input"
                type="text"
                value={code}
                onChange={handleCodeChange}
                required
                placeholder="XXXX-XXXX-XXXX-XXXX"
                maxLength={19}
                className="w-full bg-slate-900/70 border border-slate-600/50 text-white rounded-xl px-4 py-3 text-sm font-mono placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500/50 transition-all tracking-widest"
              />
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3">
                <p className="text-red-400 text-sm">{error}</p>
              </div>
            )}

            <button
              id="recover-submit-btn"
              type="submit"
              disabled={loading || !!lockoutInfo || !emailValid}
              className="w-full bg-amber-500 hover:bg-amber-400 disabled:bg-amber-500/40 disabled:cursor-not-allowed text-white font-semibold rounded-xl py-3.5 text-sm transition-all duration-200 flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20"
            >
              {loading ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                  </svg>
                  Verifying...
                </>
              ) : (
                'Verify Recovery Code'
              )}
            </button>
          </form>

          <p className="text-center text-slate-500 text-sm mt-6">
            <a href="/" className="text-blue-400 hover:text-blue-300 transition-colors">
              ← Back to Sign In
            </a>
          </p>
        </div>
      </div>

      {/* New recovery code modal after successful recovery */}
      {newRecoveryCode && (
        <RecoveryCodeModal
          code={newRecoveryCode}
          onDismiss={handleReEnroll}
          title="New Recovery Code"
          subtitle="Your devices have been wiped. Save this new code, then re-enroll your passkey."
          dismissLabel="Save & Re-enroll Passkey"
        />
      )}
    </div>
  );
}
