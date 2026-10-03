import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { startRegistration } from '@simplewebauthn/browser';
import { api } from '../hooks/useAuth';

export default function SyncClaimPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const pairingToken = searchParams.get('token');

  const [status, setStatus] = useState('claiming'); // 'claiming' | 'enrolling' | 'success' | 'error'
  const [error, setError] = useState('');
  const [deviceName, setDeviceName] = useState('');

  useEffect(() => {
    if (!pairingToken) {
      setStatus('error');
      setError('No pairing token found in URL. Please scan the QR code again.');
    }
  }, [pairingToken]);

  async function handleClaim() {
    if (!pairingToken) return;
    setStatus('claiming');
    setError('');

    try {
      // Step 1: Claim the pairing token
      const claimRes = await api.post('/auth/sync/claim', {
        pairingToken,
        deviceName: deviceName || undefined,
      });

      const { registrationOptions, userId } = claimRes.data;
      setStatus('enrolling');

      // Step 2: Invoke native biometric registration on this device
      let credential;
      try {
        credential = await startRegistration({ optionsJSON: registrationOptions });
      } catch (err) {
        if (err.name === 'NotAllowedError') {
          setError('Biometric registration was cancelled.');
          setStatus('error');
          return;
        }
        throw err;
      }

      // Step 3: Finish registration for secondary device
      await api.post('/auth/sync/finish', {
        userId,
        credentialResponse: credential,
        deviceName: deviceName || 'Secondary Device',
      });

      setStatus('success');
    } catch (err) {
      if (err.response?.status === 410) {
        setError('This QR code has expired or already been used. Please generate a new one.');
      } else {
        setError(err.response?.data?.error || 'Pairing failed. Please try again.');
      }
      setStatus('error');
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-sm text-center">
        <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-8 shadow-2xl">

          {status === 'success' ? (
            <div>
              <div className="inline-flex items-center justify-center w-16 h-16 bg-emerald-500/10 rounded-2xl mb-4 border border-emerald-500/20">
                <svg className="w-8 h-8 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-xl font-bold text-white mb-2">Device Paired!</h2>
              <p className="text-slate-400 text-sm mb-6">This device can now sign in with its passkey.</p>
              <button
                id="go-to-login-btn"
                onClick={() => navigate('/')}
                className="w-full bg-emerald-500 hover:bg-emerald-400 text-white font-semibold rounded-xl py-3 text-sm transition-all"
              >
                Sign In Now
              </button>
            </div>
          ) : status === 'error' ? (
            <div>
              <div className="inline-flex items-center justify-center w-16 h-16 bg-red-500/10 rounded-2xl mb-4 border border-red-500/20">
                <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <h2 className="text-xl font-bold text-white mb-2">Pairing Failed</h2>
              <p className="text-red-400 text-sm mb-6">{error}</p>
              <button
                id="go-to-login-err-btn"
                onClick={() => navigate('/')}
                className="w-full bg-slate-700 hover:bg-slate-600 text-white font-semibold rounded-xl py-3 text-sm transition-all"
              >
                Back to Sign In
              </button>
            </div>
          ) : (
            <div>
              <div className="inline-flex items-center justify-center w-16 h-16 bg-violet-500/10 rounded-2xl mb-4 border border-violet-500/20">
                <svg className="w-8 h-8 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
              </div>
              <h2 className="text-xl font-bold text-white mb-2">
                {status === 'enrolling' ? 'Enrolling Passkey...' : 'Pair This Device'}
              </h2>
              <p className="text-slate-400 text-sm mt-2">
                {status === 'enrolling'
                  ? 'Touch your passkey sensor when prompted.'
                  : 'Register your passkey on this device.'}
              </p>

              {status === 'claiming' && (
                <>
                  <input
                    id="sync-device-name-input"
                    type="text"
                    value={deviceName}
                    onChange={(e) => setDeviceName(e.target.value)}
                    placeholder="Device name (optional)"
                    className="w-full bg-slate-900/70 border border-slate-600/50 text-white rounded-xl px-4 py-3 text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50 mb-4 transition-all"
                  />
                  <button
                    id="start-pair-btn"
                    onClick={handleClaim}
                    className="w-full bg-violet-500 hover:bg-violet-400 text-white font-semibold rounded-xl py-3.5 text-sm transition-all shadow-lg shadow-violet-500/20"
                  >
                    Enroll Passkey
                  </button>
                </>
              )}

              {status === 'enrolling' && (
                <div className="flex justify-center">
                  <svg className="w-8 h-8 text-violet-400 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                  </svg>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
