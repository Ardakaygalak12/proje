
import React from 'react';

interface AICoreProps {
  isSpeaking: boolean;
  isListening: boolean;
}

export const AICore: React.FC<AICoreProps> = ({ isSpeaking, isListening }) => {
  return (
    <div className="relative w-64 h-64 flex items-center justify-center">
      {/* Outer Layer: Fast Spin Ring */}
      <div className={`absolute inset-0 border-[3px] border-indigo-500/10 rounded-full animate-[spin_8s_linear_infinite]`} />
      
      {/* Rotating Scanned Ring */}
      <div className={`absolute inset-4 border-[4px] border-t-indigo-500 border-r-transparent border-b-cyan-500 border-l-transparent rounded-full animate-[spin_4s_linear_infinite] opacity-30 shadow-[0_0_20px_rgba(79,70,229,0.3)]`} />
      
      {/* Dashed Pulse Ring */}
      <div className={`absolute inset-10 border-2 border-dashed border-cyan-400/20 rounded-full ${isSpeaking || isListening ? 'animate-[spin_20s_linear_infinite_reverse] opacity-100' : 'opacity-20'}`} />
      
      {/* The Core Orb Container */}
      <div className="relative group">
        {/* Core Glow Shadow */}
        <div className={`absolute inset-[-40px] rounded-full transition-all duration-700 blur-[60px] ${isSpeaking ? 'bg-cyan-500/40 opacity-100' : (isListening ? 'bg-indigo-500/30 opacity-100' : 'bg-slate-500/10 opacity-40')}`} />
        
        {/* Main Orb Body */}
        <div className={`relative w-32 h-32 rounded-full bg-gradient-to-br from-indigo-600 via-indigo-500 to-cyan-400 shadow-[inset_0_0_40px_rgba(255,255,255,0.2)] flex items-center justify-center transition-all duration-500 overflow-hidden border border-white/10 ${isSpeaking ? 'scale-110' : ''}`}>
          
          {/* Internal Energy Center */}
          <div className={`w-16 h-16 rounded-full bg-white transition-all duration-300 blur-xl ${isSpeaking ? 'opacity-80 scale-125' : 'opacity-30 scale-100'}`} />
          
          {/* Sci-Fi Grid Overlay (simulated with CSS lines) */}
          <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.05)_1px,transparent_1px)] bg-[size:10px_10px]" />
          
          {/* Reaction Waves */}
          {isSpeaking && (
            <div className="absolute inset-0 bg-cyan-400/20 animate-pulse" />
          )}
        </div>

        {/* Pulse Expansion Rings */}
        {(isSpeaking || isListening) && (
          <>
            <div className="absolute inset-[-10px] rounded-full border-2 border-cyan-400 animate-[ping_1.5s_cubic-bezier(0,0,0.2,1)_infinite] opacity-40" />
            <div className="absolute inset-[-30px] rounded-full border border-indigo-400 animate-[ping_2s_cubic-bezier(0,0,0.2,1)_infinite] opacity-20" />
          </>
        )}
      </div>

      {/* Floating Satellites (HUD dots) */}
      {[...Array(6)].map((_, i) => (
        <div 
          key={i}
          className={`absolute w-1.5 h-1.5 bg-white rounded-full shadow-[0_0_8px_white] transition-all duration-1000 ${isSpeaking || isListening ? 'opacity-100' : 'opacity-20'}`}
          style={{
            transform: `rotate(${i * 60}deg) translateY(-120px)`,
            animation: 'pulse 2s infinite',
            animationDelay: `${i * 0.3}s`
          }}
        />
      ))}
    </div>
  );
};
