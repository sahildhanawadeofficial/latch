import { useState, useEffect, useRef } from 'react';
import { api } from '../hooks/useAuth';

// Simple client-side format check before hitting the API
const FORMAT_REGEX = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/;

const STATUS = {
  IDLE: 'idle',
  TYPING: 'typing',
  CHECKING: 'checking',
  VALID: 'valid',
  INVALID: 'invalid',
};

/**
 * Reusable email input with debounced real-time validation.
 * - Instant client-side format check
 * - 600ms debounced DNS MX lookup via /api/auth/validate-email
 * - Visual indicator: spinner → green tick / red cross + message
 *
 * Props:
 *  id          {string}   - input element id
 *  value       {string}   - controlled value
 *  onChange    {fn}       - (e) => void
 *  onValidated {fn}       - (isValid: boolean) => void  ← parent tracks validity
 *  accentColor {string}   - Tailwind color token (default 'blue')
 *  disabled    {boolean}
 */
export default function EmailInput({
  id = 'email-input',
  value,
  onChange,
  onValidated,
  accentColor = 'blue',
  disabled = false,
}) {
  const [status, setStatus] = useState(STATUS.IDLE);
  const [message, setMessage] = useState('');
  const debounceRef = useRef(null);
  const lastCheckedRef = useRef('');

  // Color maps per accent
  const ring = {
    blue: 'focus:ring-blue-500/50 focus:border-blue-500/50',
    emerald: 'focus:ring-emerald-500/50 focus:border-emerald-500/50',
    amber: 'focus:ring-amber-500/50 focus:border-amber-500/50',
  }[accentColor] ?? 'focus:ring-blue-500/50 focus:border-blue-500/50';

  useEffect(() => {
    // Clear any pending check
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!value) {
      setStatus(STATUS.IDLE);
      setMessage('');
      onValidated?.(false);
      return;
    }

    // Instant client-side format check
    if (!FORMAT_REGEX.test(value)) {
      setStatus(STATUS.TYPING);
      setMessage('');
      onValidated?.(false);
      return;
    }

    // Skip if we already verified this exact value
    if (value === lastCheckedRef.current && status === STATUS.VALID) return;

    setStatus(STATUS.CHECKING);
    setMessage('');

    // 600ms debounce before DNS lookup
    debounceRef.current = setTimeout(async () => {
      try {
        await api.post('/auth/validate-email', { email: value });
        lastCheckedRef.current = value;
        setStatus(STATUS.VALID);
        setMessage('');
        onValidated?.(true);
      } catch (err) {
        // If err.response is undefined, the backend is likely offline or unreachable (CORS/Network error)
        const reason = err.response 
          ? (err.response.data?.reason || 'This email domain does not appear to be real.')
          : 'Could not connect to the server to verify this email.';
        
        lastCheckedRef.current = '';
        setStatus(STATUS.INVALID);
        setMessage(reason);
        onValidated?.(false);
      }
    }, 600);

    return () => clearTimeout(debounceRef.current);
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-slate-300 mb-2">
        Email Address
      </label>

      <div className="relative">
        <input
          id={id}
          type="email"
          value={value}
          onChange={onChange}
          required
          disabled={disabled}
          autoComplete="email"
          placeholder="you@example.com"
          className={`w-full bg-slate-900/70 border text-white rounded-xl px-4 py-3 pr-10 text-sm placeholder-slate-500 focus:outline-none focus:ring-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed
            ${status === STATUS.VALID
              ? 'border-emerald-500/60'
              : status === STATUS.INVALID
              ? 'border-red-500/60'
              : `border-slate-600/50 ${ring}`
            }`}
        />

        {/* Status icon on the right */}
        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
          {status === STATUS.CHECKING && (
            <svg className="w-4 h-4 text-slate-400 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
          )}
          {status === STATUS.VALID && (
            <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
          )}
          {status === STATUS.INVALID && (
            <svg className="w-4 h-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
            </svg>
          )}
        </div>
      </div>

      {/* Validation message */}
      {status === STATUS.INVALID && message && (
        <p className="mt-1.5 text-xs text-red-400 flex items-center gap-1.5">
          <svg className="w-3 h-3 shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          {message}
        </p>
      )}
      {status === STATUS.VALID && (
        <p className="mt-1.5 text-xs text-emerald-400 flex items-center gap-1.5">
          <svg className="w-3 h-3 shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
          Valid email address
        </p>
      )}
      {status === STATUS.CHECKING && (
        <p className="mt-1.5 text-xs text-slate-500">Verifying email domain...</p>
      )}
    </div>
  );
}
