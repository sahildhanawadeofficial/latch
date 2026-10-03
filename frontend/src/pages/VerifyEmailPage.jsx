import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { startRegistration } from '@simplewebauthn/browser';
import { api } from '../hooks/useAuth';
import RecoveryCodeModal from '../components/RecoveryCodeModal';

export default function VerifyEmailPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  const [verifying, setVerifying] = useState(true);
  const [verifyError, setVerifyError] = useState('');
  
  const [email, setEmail] = useState('');
  const [verificationJWT, setVerificationJWT] = useState('');
  
  const [registering, setRegistering] = useState(false);
  const [registerError, setRegisterError] = useState('');
  const [recoveryCode, setRecoveryCode] = useState(null);
  const [showRecoveryModal, setShowRecoveryModal] = useState(false);

  useEffect(() => {
    if (!token) {
      setVerifyError('No verification token provided.');
      setVerifying(false);
      return;
    }

    async function verifyToken() {
      try {
        const res = await api.post('/auth/verify-email/confirm', { token });
        setEmail(res.data.email);
        setVerificationJWT(res.data.verificationJWT);
      } catch (err) {
        setVerifyError(err.response?.data?.error || 'Verification failed. The link may have expired.');
      } finally {
        setVerifying(false);
      }
    }

    verifyToken();
  }, [token]);

  async function handleRegister(e) {
    e.preventDefault();

    setRegisterError('');
    setRegistering(true);

    try {
      // Step 1: Start registration (passing the verificationJWT)
      const startRes = await api.post('/auth/register/start', { 
        email, 
        verificationJWT 
      });

      // Step 2: Trigger browser biometric prompt
      const assertion = await startRegistration(startRes.data);

      // Step 3: Finish registration on backend
      const finishRes = await api.post('/auth/register/finish', {
        email,
        credentialResponse: assertion,
      });

      // Success! Show recovery code
      setRecoveryCode(finishRes.data.recoveryCode);
      setShowRecoveryModal(true);
    } catch (err) {
      setRegisterError(err.response?.data?.error || 'Registration failed. Please try again.');
    } finally {
      setRegistering(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background Gradients */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-emerald-500/20 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-500/10 rounded-full blur-[120px] pointer-events-none" />

      <div className="w-full max-w-md relative z-10">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-slate-800/80 border border-slate-700/50 shadow-xl mb-6">
            <span className="text-3xl">✅</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-white mb-3">
            Email Verification
          </h1>
          <p className="text-slate-400">Complete your SecureBank registration</p>
        </div>

        <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-8 shadow-2xl">
          {verifying ? (
            <div className="flex flex-col items-center justify-center py-8">
              <svg className="w-8 h-8 text-emerald-500 animate-spin mb-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              <p className="text-slate-300">Verifying your secure link...</p>
            </div>
          ) : verifyError ? (
            <div className="text-center py-4">
              <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-4 mb-6">
                <p className="text-red-400 font-medium">{verifyError}</p>
              </div>
              <button
                onClick={() => navigate('/register')}
                className="text-emerald-400 hover:text-emerald-300 font-medium transition-colors"
              >
                ← Back to Registration
              </button>
            </div>
          ) : (
            <form onSubmit={handleRegister} className="space-y-5">
              <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl px-4 py-3 mb-6">
                <p className="text-emerald-400 text-sm flex items-center gap-2">
                  <svg className="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  Email verified successfully!
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Email Address
                </label>
                <input
                  type="email"
                  value={email}
                  disabled
                  className="w-full bg-slate-900/50 border border-slate-700 text-slate-400 rounded-xl px-4 py-3 text-sm cursor-not-allowed"
                />
              </div>

              {registerError && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3">
                  <p className="text-red-400 text-sm">{registerError}</p>
                  {registerError.includes('already exists') && (
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
                type="submit"
                disabled={registering}
                className="w-full bg-emerald-500 hover:bg-emerald-400 disabled:bg-emerald-500/40 disabled:cursor-not-allowed text-white font-semibold rounded-xl py-3.5 text-sm transition-all duration-200 flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20"
              >
                {registering ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                    Enrolling Device...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 11c0-1.657-1.343-3-3-3S6 9.343 6 11v2h12v-2c0-1.657-1.343-3-3-3s-3 1.343-3 3z" />
                    </svg>
                    Register Passkey
                  </>
                )}
              </button>
            </form>
          )}
        </div>
      </div>

      {showRecoveryModal && (
        <RecoveryCodeModal
          code={recoveryCode}
          onDismiss={() => navigate('/login')}
        />
      )}
    </div>
  );
}
