export default function SecureBankIntro() {
  return (
    <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-6 mb-8 text-center sm:text-left flex flex-col sm:flex-row items-center justify-between gap-6">
      <div className="flex-1">
        <h2 className="text-2xl font-bold text-white mb-2 tracking-tight">
          Welcome to <span className="text-emerald-400">SecureBank</span>
        </h2>
        <p className="text-slate-400 text-sm max-w-lg leading-relaxed">
          Your financial data is protected by military-grade encryption, biometric validation, and a dynamic 2-Step Biological Intent engine. Our platform ensures that only you have access to your critical operations.
        </p>
      </div>
      <div className="flex-none">
        <div className="inline-flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 px-4 py-2 rounded-full">
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
          </span>
          <span className="text-emerald-400 text-xs font-semibold uppercase tracking-wider">
            Network Secured
          </span>
        </div>
      </div>
    </div>
  );
}
