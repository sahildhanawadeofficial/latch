import { useState, useEffect, useRef } from 'react';
import * as faceapi from 'face-api.js';

import { api } from '../hooks/useAuth';

export default function AuthModal({ isOpen, mode, title, onClose, onSuccess, onError }) {
  const [spin, setSpin] = useState('');
  const [forgotState, setForgotState] = useState('idle'); // 'idle', 'requesting', 'confirming'
  const [resetOTP, setResetOTP] = useState('');
  const [newSpin, setNewSpin] = useState('');
  const [localError, setLocalError] = useState('');
  const [localSuccess, setLocalSuccess] = useState('');
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [isProcessingFace, setIsProcessingFace] = useState(false);
  const videoRef = useRef(null);

  useEffect(() => {
    if (isOpen && mode === 'face') {
      const loadModels = async () => {
        try {
          await Promise.all([
            faceapi.nets.ssdMobilenetv1.loadFromUri('/models'),
            faceapi.nets.faceLandmark68Net.loadFromUri('/models'),
            faceapi.nets.faceRecognitionNet.loadFromUri('/models')
          ]);
          setModelsLoaded(true);
          startVideo();
        } catch (err) {
          onError && onError('Failed to load facial recognition models.');
        }
      };
      loadModels();
    }
  }, [isOpen, mode]);

  const startVideo = () => {
    navigator.mediaDevices.getUserMedia({ video: true })
      .then((stream) => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      })
      .catch((err) => {
        onError && onError('Camera access denied or unavailable.');
      });
  };

  const stopVideo = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      videoRef.current.srcObject.getTracks().forEach(t => t.stop());
    }
  };

  const handleClose = () => {
    stopVideo();
    setSpin('');
    setForgotState('idle');
    setResetOTP('');
    setNewSpin('');
    setLocalError('');
    setLocalSuccess('');
    onClose();
  };

  const handleCapture = async () => {
    if (!videoRef.current) return;
    setIsProcessingFace(true);
    try {
      const detection = await faceapi.detectSingleFace(videoRef.current)
        .withFaceLandmarks()
        .withFaceDescriptor();

      if (!detection) {
        setIsProcessingFace(false);
        if (onError) onError('No face detected. Please ensure you are clearly visible.');
        return;
      }
      stopVideo();
      setIsProcessingFace(false);
      onSuccess(Array.from(detection.descriptor));
    } catch (err) {
      setIsProcessingFace(false);
      if (onError) onError('Face scan failed.');
    }
  };

  const handleSpinSubmit = (e) => {
    e.preventDefault();
    if (spin.length === 4) {
      onSuccess(spin);
      setSpin('');
    }
  };

  const handleRequestOTP = async () => {
    setLocalError('');
    setLocalSuccess('');
    try {
      await api.post('/dashboard/settings/spin-reset-request');
      setForgotState('confirming');
      setLocalSuccess('OTP sent to your email.');
    } catch (err) {
      setLocalError(err.response?.data?.error || 'Failed to send OTP.');
    }
  };

  const handleConfirmReset = async (e) => {
    e.preventDefault();
    setLocalError('');
    setLocalSuccess('');
    if (newSpin.length !== 4) {
      return setLocalError('S-PIN must be 4 digits.');
    }
    try {
      await api.post('/dashboard/settings/spin-reset-confirm', { otp: resetOTP, newSpin });
      setForgotState('idle');
      setSpin('');
      setResetOTP('');
      setNewSpin('');
      setLocalSuccess('S-PIN successfully reset! Please enter it below to proceed.');
    } catch (err) {
      setLocalError(err.response?.data?.error || 'Failed to reset S-PIN.');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="relative w-full max-w-sm bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden">
        
        {/* Close Button */}
        <button 
          onClick={handleClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
        </button>

        <div className="p-6 text-center">
          <h2 className="text-xl font-bold text-white mb-2">{title || 'Authorization Required'}</h2>
          
          {localError && <p className="text-red-400 text-sm mb-4">{localError}</p>}
          {localSuccess && <p className="text-emerald-400 text-sm mb-4">{localSuccess}</p>}
          
          {mode === 'spin' && forgotState === 'idle' && (
            <div className="mt-6">
              <p className="text-slate-400 text-sm mb-4">Enter your 4-digit S-PIN</p>
              <form onSubmit={handleSpinSubmit} className="flex flex-col items-center">
                <input
                  type="password"
                  maxLength={4}
                  autoFocus
                  value={spin}
                  onChange={(e) => setSpin(e.target.value.replace(/\D/g, ''))}
                  className="w-32 bg-slate-900 border-2 border-slate-600 rounded-xl px-4 py-3 text-2xl text-center text-white tracking-widest focus:outline-none focus:border-indigo-500 transition-colors"
                  placeholder="••••"
                />
                <button 
                  type="submit"
                  disabled={spin.length !== 4}
                  className="mt-6 w-full bg-indigo-500 hover:bg-indigo-400 disabled:bg-slate-700 disabled:text-slate-500 text-white font-semibold py-3 rounded-xl transition-colors"
                >
                  Verify S-PIN
                </button>
              </form>
              <button onClick={() => setForgotState('requesting')} className="mt-4 text-sm text-indigo-400 hover:text-indigo-300">
                Forgot S-PIN?
              </button>
            </div>
          )}

          {mode === 'spin' && forgotState === 'requesting' && (
            <div className="mt-6">
              <p className="text-slate-400 text-sm mb-4">We will send a 6-digit OTP code to your registered email address.</p>
              <button 
                onClick={handleRequestOTP}
                className="w-full bg-indigo-500 hover:bg-indigo-400 text-white font-semibold py-3 rounded-xl transition-colors mb-3"
              >
                Send code to mail
              </button>
              <button onClick={() => setForgotState('idle')} className="text-sm text-slate-400 hover:text-white">Cancel</button>
            </div>
          )}

          {mode === 'spin' && forgotState === 'confirming' && (
            <div className="mt-6">
              <form onSubmit={handleConfirmReset} className="flex flex-col items-center gap-4">
                <div>
                  <label className="block text-slate-400 text-xs mb-1 text-left">6-Digit OTP</label>
                  <input
                    type="text"
                    maxLength={6}
                    value={resetOTP}
                    onChange={(e) => setResetOTP(e.target.value.replace(/\D/g, ''))}
                    className="w-full bg-slate-900 border-2 border-slate-600 rounded-xl px-4 py-2 text-white text-center tracking-widest focus:outline-none focus:border-indigo-500"
                    placeholder="••••••"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 text-xs mb-1 text-left">New 4-Digit S-PIN</label>
                  <input
                    type="password"
                    maxLength={4}
                    value={newSpin}
                    onChange={(e) => setNewSpin(e.target.value.replace(/\D/g, ''))}
                    className="w-full bg-slate-900 border-2 border-slate-600 rounded-xl px-4 py-2 text-white text-center tracking-widest focus:outline-none focus:border-indigo-500"
                    placeholder="••••"
                  />
                </div>
                <button 
                  type="submit"
                  disabled={resetOTP.length !== 6 || newSpin.length !== 4}
                  className="w-full bg-emerald-500 hover:bg-emerald-400 disabled:bg-slate-700 disabled:text-slate-500 text-white font-semibold py-3 rounded-xl transition-colors mt-2"
                >
                  Set New S-PIN
                </button>
              </form>
              <button onClick={() => setForgotState('idle')} className="mt-4 text-sm text-slate-400 hover:text-white">Cancel</button>
            </div>
          )}

          {mode === 'face' && (
            <div className="mt-6 flex flex-col items-center">
              <p className="text-slate-400 text-sm mb-4">
                {modelsLoaded ? 'Position your face in the frame' : 'Loading facial recognition models...'}
              </p>
              <div className="relative w-64 h-64 rounded-full overflow-hidden border-4 border-slate-600 bg-slate-900 mx-auto">
                <video 
                  ref={videoRef}
                  autoPlay 
                  muted 
                  playsInline
                  className="w-full h-full object-cover transform -scale-x-100" // Mirror effect
                />
                {isProcessingFace && (
                  <div className="absolute inset-0 bg-indigo-500/20 flex items-center justify-center backdrop-blur-sm">
                    <span className="relative flex h-8 w-8">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-8 w-8 bg-white"></span>
                    </span>
                  </div>
                )}
              </div>
              <button 
                onClick={handleCapture}
                disabled={!modelsLoaded || isProcessingFace}
                className="mt-6 w-full bg-violet-500 hover:bg-violet-400 disabled:bg-slate-700 disabled:text-slate-500 text-white font-semibold py-3 rounded-xl transition-colors"
              >
                {isProcessingFace ? 'Analyzing...' : 'Scan Face'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
