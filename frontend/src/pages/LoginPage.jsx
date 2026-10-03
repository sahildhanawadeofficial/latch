import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { startAuthentication } from '@simplewebauthn/browser';
import { api, useAuth } from '../hooks/useAuth';
import EmailInput from '../components/EmailInput';

export default function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [emailValid, setEmailValid] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notRegistered, setNotRegistered] = useState(false);
  const [lockoutInfo, setLockoutInfo] = useState(null);

  async function handleLogin(e) {
    e.preventDefault();
    setError('');
    setLockoutInfo(null);
    setNotRegistered(false);
    setLoading(true);

    try {
      // Step 1: Get authentication options (Risk Engine check happens here)
      const startRes = await api.post('/auth/login/start', { email });
      const options = startRes.data;

      // Step 2: Invoke native biometric authentication
      let assertion;
      try {
        assertion = await startAuthentication({ optionsJSON: options });
      } catch (err) {
        if (err.name === 'NotAllowedError') {
          // Native retries exhausted — redirect to emergency recovery
          navigate('/recover', { state: { email, exhausted: true } });
          return;
        }
        throw err;
      }

      // Step 3: Verify signature on backend
      const finishRes = await api.post('/auth/login/finish', {
        email,
        signatureResponse: assertion,
      });

      // Step 4: Store access token in memory, redirect
      login(finishRes.data.accessToken);
      navigate('/dashboard');
    } catch (err) {
      if (err.response?.status === 403 && err.response.data?.lockedUntil) {
        setLockoutInfo(err.response.data);
      } else if (err.response?.status === 404) {
        // No account in this app — clearly distinct from email validity
        setNotRegistered(true);
      } else {
        setError(err.response?.data?.error || 'Authentication failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-500/10 rounded-2xl mb-4 border border-blue-500/20">
            <svg className="w-8 h-8 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight">SecureBank</h1>
          <p className="text-slate-400 mt-2 text-sm">Touch your passkey sensor to sign in</p>
        </div>

        {/* Card */}
        <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-8 shadow-2xl">
          {/* Lockout Banner */}
          {lockoutInfo && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-4 mb-5">
              <div className="flex items-start gap-3">
                <svg className="w-5 h-5 text-red-400 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M5.07 19H19a2 2 0 001.73-3L13.73 4a2 2 0 00-3.46 0L3.27 16A2 2 0 005.07 19z" />
                </svg>
                <div>
                  <p className="text-red-400 font-semibold text-sm">Account Locked</p>
                  <p className="text-red-300/80 text-xs mt-1">
                    Locked for {lockoutInfo.remainingMinutes} more minute{lockoutInfo.remainingMinutes !== 1 ? 's' : ''} due to a failed recovery attempt.
                  </p>
                </div>
              </div>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-5">
            <EmailInput
              id="login-email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onValidated={setEmailValid}
              accentColor="blue"
              disabled={loading}
            />

            {/* No account registered — show register prompt, not a scary red error */}
            {notRegistered && (
              <div className="bg-slate-700/50 border border-slate-600/50 rounded-xl px-4 py-3.5 flex items-start gap-3">
                <svg className="w-5 h-5 text-slate-400 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                  <p className="text-slate-300 text-sm font-medium">No SecureBank account for this email</p>
                  <p className="text-slate-500 text-xs mt-0.5">
                    Your email is valid, but you haven't registered yet.{' '}
                    <a href="/register" className="text-blue-400 hover:text-blue-300 underline underline-offset-2">
                      Create an account →
                    </a>
                  </p>
                </div>
              </div>
            )}

            {error && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3">
                <p className="text-red-400 text-sm">{error}</p>
              </div>
            )}

            <button
              id="login-submit-btn"
              type="submit"
              disabled={loading || !!lockoutInfo || !emailValid}
              className="w-full bg-blue-500 hover:bg-blue-400 disabled:bg-blue-500/40 disabled:cursor-not-allowed text-white font-semibold rounded-xl py-3.5 text-sm transition-all duration-200 flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20"
            >
              {loading ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  Verifying Biometric...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 11c0-1.657-1.343-3-3-3S6 9.343 6 11v2h12v-2c0-1.657-1.343-3-3-3s-3 1.343-3 3z" />
                  </svg>
                  Sign In with Passkey
                </>
              )}
            </button>
          </form>

          <div className="mt-6 pt-5 border-t border-slate-700/50 flex justify-between items-center">
            <a
              id="go-to-register-link"
              href="/register"
              className="text-slate-400 hover:text-slate-300 text-sm transition-colors"
            >
              Create account
            </a>
            <a
              id="go-to-recover-link"
              href="/recover"
              className="text-amber-400 hover:text-amber-300 text-sm transition-colors font-medium"
            >
              Emergency recovery →
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
