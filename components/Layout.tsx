
import React from 'react';

interface LayoutProps {
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  return (
    <div className="min-h-screen flex flex-col items-center bg-slate-950 text-slate-200 selection:bg-indigo-500 selection:text-white">
      <header className="w-full max-w-6xl px-6 py-8 flex items-center justify-between border-b border-slate-800/50">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white">VisionVoice <span className="text-indigo-400">AI</span></h1>
            <p className="text-xs text-slate-400 font-medium">Next-Gen Multimodal Intelligence</p>
          </div>
        </div>
        <div className="hidden md:flex items-center space-x-6">
          <span className="text-sm font-medium text-slate-400">Gemini 2.5 Live Enabled</span>
          <div className="h-2 w-2 rounded-full bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.6)] animate-pulse" />
        </div>
      </header>
      <main className="flex-1 w-full max-w-6xl p-4 md:p-8">
        {children}
      </main>
      <footer className="w-full py-6 text-center text-slate-500 text-xs border-t border-slate-800/50">
        Powered by Google Gemini & React
      </footer>
    </div>
  );
};
