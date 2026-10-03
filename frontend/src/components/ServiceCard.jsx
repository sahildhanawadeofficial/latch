export default function ServiceCard({ icon, title, description, onClick, danger }) {
  return (
    <div 
      onClick={onClick}
      className={`group relative overflow-hidden rounded-2xl border p-6 cursor-pointer transition-all duration-300 hover:-translate-y-1 ${
        danger 
          ? 'bg-red-500/5 border-red-500/20 hover:bg-red-500/10 hover:border-red-500/30' 
          : 'bg-slate-800/50 border-slate-700/50 hover:bg-slate-800 hover:border-slate-600'
      }`}
    >
      <div className="flex items-start justify-between mb-4">
        <div className={`p-3 rounded-xl ${danger ? 'bg-red-500/10 text-red-400' : 'bg-emerald-500/10 text-emerald-400'}`}>
          {icon}
        </div>
        <svg 
          className={`w-5 h-5 opacity-0 -translate-x-4 transition-all duration-300 group-hover:opacity-100 group-hover:translate-x-0 ${danger ? 'text-red-400' : 'text-emerald-400'}`} 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
        </svg>
      </div>
      <h3 className="text-lg font-bold text-white mb-2">{title}</h3>
      <p className="text-sm text-slate-400">{description}</p>
    </div>
  );
}
