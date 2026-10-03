import { useState } from 'react';

/**
 * One-time recovery code modal.
 * Requires the user to check a confirmation checkbox before dismissal.
 * Used after both initial registration and successful account recovery.
 */
export default function RecoveryCodeModal({
  code,
  onDismiss,
  title = 'Save Your Recovery Code',
  subtitle = 'This code is shown exactly once. Store it somewhere safe — offline is best.',
  dismissLabel = 'I\'ve saved my recovery code',
}) {
  const [confirmed, setConfirmed] = useState(false);
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback: select text
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-md bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden">
        {/* Top warning bar */}
        <div className="bg-amber-500/10 border-b border-amber-500/20 px-6 py-3 flex items-center gap-3">
          <svg className="w-4 h-4 text-amber-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
          </svg>
          <span className="text-amber-400 text-xs font-semibold tracking-wide uppercase">
            Shown Once — Cannot Be Recovered
          </span>
        </div>

        <div className="p-6">
          <h2 className="text-xl font-bold text-white mb-2">{title}</h2>
          <p className="text-slate-400 text-sm mb-6">{subtitle}</p>

          {/* Code display */}
          <div className="bg-slate-900 rounded-xl p-4 mb-4 relative group">
            <p
              id="recovery-code-display"
              className="text-white font-mono text-xl tracking-[0.25em] text-center select-all"
            >
              {code}
            </p>
            <button
              id="copy-recovery-code-btn"
              onClick={handleCopy}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs px-2.5 py-1 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 transition-all"
            >
              {copied ? '✓ Copied' : 'Copy'}
            </button>
          </div>

          <p className="text-slate-500 text-xs text-center mb-5">
            Treat this like a password. Do not email it to yourself or store it in the cloud.
          </p>

          {/* Confirmation checkbox */}
          <label
            htmlFor="recovery-confirm-checkbox"
            className="flex items-start gap-3 cursor-pointer mb-5 group"
          >
            <div className="relative mt-0.5">
              <input
                id="recovery-confirm-checkbox"
                type="checkbox"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
                className="sr-only"
              />
              <div
                className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${
                  confirmed
                    ? 'bg-emerald-500 border-emerald-500'
                    : 'bg-slate-700 border-slate-500 group-hover:border-slate-400'
                }`}
              >
                {confirmed && (
                  <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </div>
            </div>
            <span className="text-sm text-slate-300 leading-snug">
              I have written down or securely stored my recovery code offline.
            </span>
          </label>

          {/* Dismiss button */}
          <button
            id="dismiss-recovery-modal-btn"
            onClick={onDismiss}
            disabled={!confirmed}
            className="w-full bg-emerald-500 hover:bg-emerald-400 disabled:bg-slate-700 disabled:text-slate-500 disabled:cursor-not-allowed text-white font-semibold rounded-xl py-3.5 text-sm transition-all duration-200"
          >
            {dismissLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
