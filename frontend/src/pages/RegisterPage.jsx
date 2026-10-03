import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../hooks/useAuth';
import EmailInput from '../components/EmailInput';

export default function RegisterPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [emailValid, setEmailValid] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [emailSent, setEmailSent] = useState(false);

  async function handleRegister(e) {
    e.preventDefault();
    if (!emailValid) return;
    
    setError('');
    setLoading(true);

    try {
      await api.post('/auth/verify-email/send', { email });
      setEmailSent(true);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to send verification email. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-emerald-500/10 rounded-2xl mb-4 border border-emerald-500/20">
            <svg className="w-8 h-8 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 11c0-1.657-1.343-3-3-3S6 9.343 6 11v2h12v-2c0-1.657-1.343-3-3-3s-3 1.343-3 3z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 13h14v6a2 2 0 01-2 2H7a2 2 0 01-2-2v-6z" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Create Account</h1>
          <p className="text-slate-400 mt-2 text-sm">Secured by biometric hardware encryption</p>
        </div>

        {/* Card */}
        <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-8 shadow-2xl">
          {emailSent ? (
            <div className="text-center py-6">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-500/10 mb-4">
                <svg className="w-8 h-8 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <h2 className="text-xl font-semibold text-white mb-2">Check your inbox</h2>
              <p className="text-slate-400 text-sm mb-6">
                We sent a verification link to <strong className="text-white">{email}</strong>.
                Click it to continue your registration.
              </p>
              <button
                onClick={() => setEmailSent(false)}
                className="text-emerald-400 hover:text-emerald-300 text-sm font-medium transition-colors"
              >
                Use a different email
              </button>
            </div>
          ) : (
            <>
              <form onSubmit={handleRegister} className="space-y-5">
                <EmailInput
                  id="reg-email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onValidated={setEmailValid}
                  accentColor="emerald"
                  disabled={loading}
                />

                {error && (
                  <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3">
                    <p className="text-red-400 text-sm">{error}</p>
                    {error.includes('already exists') && (
                      <button
                        type="button"
                        onClick={() => navigate('/login')}
                        className="mt-2 text-emerald-400 hover:text-emerald-300 text-sm font-semibold transition-colors flex items-center gap-1"
                      >
                        Go to Login &rarr;
                      </button>
                    )}
                  </div>
                )}

                <button
                  id="register-submit-btn"
                  type="submit"
                  disabled={loading || !emailValid}
                  className="w-full bg-emerald-500 hover:bg-emerald-400 disabled:bg-emerald-500/40 disabled:cursor-not-allowed text-white font-semibold rounded-xl py-3.5 text-sm transition-all duration-200 flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20"
                >
                  {loading ? (
                    <>
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                      </svg>
                      Sending link...
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                      Send Verification Email
                    </>
                  )}
                </button>
              </form>

              <p className="text-center text-slate-500 text-sm mt-6">
                Already have an account?{' '}
                <a href="/" className="text-emerald-400 hover:text-emerald-300 transition-colors font-medium">
                  Sign in
                </a>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
