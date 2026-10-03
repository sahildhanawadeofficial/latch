import { useState, useEffect, useCallback } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { api } from '../hooks/useAuth';

const TOKEN_TTL = 120; // seconds

export default function DeviceSyncPage() {
  const [pairingToken, setPairingToken] = useState(null);
  const [timeLeft, setTimeLeft] = useState(TOKEN_TTL);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // The URL a secondary device will open after scanning the QR
  const claimUrl = pairingToken
    ? `${window.location.origin}/sync/claim?token=${pairingToken}`
    : null;

  const generateToken = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.post('/auth/sync/token');
      setPairingToken(res.data.pairingToken);
      setTimeLeft(TOKEN_TTL);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to generate pairing token.');
    } finally {
      setLoading(false);
    }
  }, []);

  // Generate token on mount
  useEffect(() => {
    generateToken();
  }, [generateToken]);

  // Countdown timer — auto-refresh QR on expiry
  useEffect(() => {
    if (!pairingToken) return;
    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          generateToken(); // Auto-refresh
          return TOKEN_TTL;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [pairingToken, generateToken]);

  const progress = (timeLeft / TOKEN_TTL) * 100;
  const isExpiring = timeLeft <= 20;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-violet-500/10 rounded-2xl mb-4 border border-violet-500/20">
            <svg className="w-8 h-8 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white">Add a Device</h1>
          <p className="text-slate-400 mt-2 text-sm">Scan this QR code with your other device</p>
        </div>

        <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-6 shadow-2xl text-center">
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 mb-4">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          {/* QR Code */}
          <div className="flex items-center justify-center mb-4">
            {loading ? (
              <div className="w-48 h-48 bg-slate-700/50 rounded-xl flex items-center justify-center">
                <svg className="w-8 h-8 text-slate-400 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
              </div>
            ) : claimUrl ? (
              <div className="p-3 bg-white rounded-xl shadow-lg">
                <QRCodeSVG value={claimUrl} size={180} level="H" />
              </div>
            ) : null}
          </div>

          {/* Countdown bar */}
          {pairingToken && !loading && (
            <div className="mt-4">
              <div className="flex justify-between items-center mb-1.5">
                <span className="text-xs text-slate-500">Token expires in</span>
                <span className={`text-sm font-mono font-bold ${isExpiring ? 'text-red-400' : 'text-slate-300'}`}>
                  {String(Math.floor(timeLeft / 60)).padStart(2, '0')}:
                  {String(timeLeft % 60).padStart(2, '0')}
                </span>
              </div>
              <div className="w-full bg-slate-700/50 rounded-full h-1.5">
                <div
                  className={`h-1.5 rounded-full transition-all duration-1000 ${isExpiring ? 'bg-red-500' : 'bg-violet-500'}`}
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-slate-600 text-xs mt-2">QR code auto-refreshes on expiry</p>
            </div>
          )}

          <button
            id="refresh-qr-btn"
            onClick={generateToken}
            disabled={loading}
            className="mt-4 text-violet-400 hover:text-violet-300 text-sm transition-colors disabled:opacity-40"
          >
            ↻ Refresh QR manually
          </button>
        </div>

        <p className="text-center text-slate-500 text-xs mt-6">
          The secondary device will be prompted for passkey enrollment after scanning.
        </p>
      </div>
    </div>
  );
}
