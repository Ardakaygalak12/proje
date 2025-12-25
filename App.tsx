
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Layout } from './components/Layout';
import { AppState, ImageAnalysis, Language, LanguageCode } from './types';
import { geminiService } from './services/geminiService';
import { decode, decodeAudioData, createPcmBlob } from './services/audioUtils';
import { AICore } from './components/AICore';

const LANGUAGES: Record<LanguageCode, Language> = {
  'tr-TR': { code: 'tr-TR', name: 'Türkçe', flag: '🇹🇷', instruction: 'Sen VisionVoice AI asistanısın. Görsel analiz sonuçlarına göre kullanıcıyla samimi ve bilgili bir sohbete gir.' },
  'en-US': { code: 'en-US', name: 'English', flag: '🇺🇸', instruction: 'You are VisionVoice AI. Engage in a knowledgeable and friendly conversation based on vision analysis.' },
  'ru-RU': { code: 'ru-RU', name: 'Русский', flag: '🇷🇺', instruction: 'Вы VisionVoice AI. Участвуйте в дружеской беседе на основе визуального анализа.' },
  'de-DE': { code: 'de-DE', name: 'Deutsch', flag: '🇩🇪', instruction: 'Sie sind VisionVoice AI. Führen Sie ein sachkundiges Gespräch basierend auf der Bildanalyse.' }
};

const App: React.FC = () => {
  const [state, setState] = useState<AppState>(AppState.IDLE);
  const [lang, setLang] = useState<LanguageCode>('tr-TR');
  const [history, setHistory] = useState<ImageAnalysis[]>([]);
  const [currentAnalysis, setCurrentAnalysis] = useState<ImageAnalysis | null>(null);
  const [isLiveActive, setIsLiveActive] = useState(false);
  const [isAISpeaking, setIsAISpeaking] = useState(false);
  const [currentTranscription, setCurrentTranscription] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showPopup, setShowPopup] = useState(false);
  const [tempImage, setTempImage] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const streamRef = useRef<MediaStream | null>(null);
  const liveSessionRef = useRef<any>(null);

  const initAudio = () => {
    if (!outputAudioContextRef.current) {
      outputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    }
    if (!inputAudioContextRef.current) {
      inputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
    }
  };

  const startCamera = async (facingMode: 'environment' | 'user' = 'environment') => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode } });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
      }
    } catch (err) {
      if (facingMode === 'environment') startCamera('user');
      else setErrorMsg("Kamera erişimi engellendi.");
    }
  };

  const processImage = async (dataUrl: string) => {
    const parts = dataUrl.split(',');
    if (parts.length < 2) return;
    const base64 = parts[1];
    const mimeType = parts[0].match(/:(.*?);/)?.[1] || 'image/jpeg';

    setTempImage(dataUrl);
    setState(AppState.ANALYZING);
    setErrorMsg(null);

    try {
      const result = await geminiService.analyzeImage(base64, mimeType, LANGUAGES[lang].name);
      setCurrentAnalysis(result);
      setHistory(prev => [result, ...prev]);
      setShowPopup(true);
      
      initAudio();
      setState(AppState.SPEAKING);
      setIsAISpeaking(true);
      
      const voices: Record<LanguageCode, string> = { 'tr-TR': 'Kore', 'en-US': 'Zephyr', 'ru-RU': 'Puck', 'de-DE': 'Charon' };
      const audio = await geminiService.generateSpeech(result.summary, voices[lang]);
      await playAudio(audio);
      
      setIsAISpeaking(false);
      setState(AppState.LIVE_CHAT);
      startLiveInteraction(result);
    } catch (err: any) {
      setErrorMsg(err?.message || "Sistem hatası.");
      setState(AppState.ERROR);
    }
  };

  const playAudio = async (base64: string) => {
    const ctx = outputAudioContextRef.current;
    if (!ctx) return;
    if (ctx.state === 'suspended') await ctx.resume();
    const buffer = await decodeAudioData(decode(base64), ctx, 24000, 1);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    return new Promise<void>(r => { source.onended = () => r(); source.start(); });
  };

  const startLiveInteraction = async (analysisData: ImageAnalysis) => {
    if (isLiveActive) return;
    initAudio();

    const instruction = `${LANGUAGES[lang].instruction} Analiz: "${analysisData.summary}". Detaylar: ${analysisData.details.join(', ')}.`;
    const voices: Record<LanguageCode, string> = { 'tr-TR': 'Kore', 'en-US': 'Zephyr', 'ru-RU': 'Puck', 'de-DE': 'Charon' };

    const callbacks = {
      onopen: () => { setIsLiveActive(true); startMicStream(); },
      onmessage: async (m: any) => {
        const audio = m.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
        if (audio && outputAudioContextRef.current) {
          const ctx = outputAudioContextRef.current;
          setIsAISpeaking(true);
          nextStartTimeRef.current = Math.max(nextStartTimeRef.current, ctx.currentTime);
          const buffer = await decodeAudioData(decode(audio), ctx, 24000, 1);
          const source = ctx.createBufferSource();
          source.buffer = buffer;
          source.connect(ctx.destination);
          source.addEventListener('ended', () => {
            sourcesRef.current.delete(source);
            if (sourcesRef.current.size === 0) setIsAISpeaking(false);
          });
          source.start(nextStartTimeRef.current);
          nextStartTimeRef.current += buffer.duration;
          sourcesRef.current.add(source);
        }
        if (m.serverContent?.inputTranscription) setCurrentTranscription(t => t + m.serverContent.inputTranscription.text);
        if (m.serverContent?.outputTranscription) setCurrentTranscription(t => t + ' (AI: ' + m.serverContent.outputTranscription.text + ')');
        if (m.serverContent?.turnComplete) setCurrentTranscription('');
        if (m.serverContent?.interrupted) {
          sourcesRef.current.forEach(s => { try { s.stop(); } catch(e){} });
          sourcesRef.current.clear();
          setIsAISpeaking(false);
          nextStartTimeRef.current = 0;
        }
      },
      onerror: () => setIsLiveActive(false),
      onclose: () => setIsLiveActive(false)
    };
    liveSessionRef.current = geminiService.getLiveSession(callbacks, instruction, voices[lang]);
  };

  const startMicStream = async () => {
    try {
      const mic = await navigator.mediaDevices.getUserMedia({ audio: true });
      const ctx = inputAudioContextRef.current;
      if (!ctx) return;
      const source = ctx.createMediaStreamSource(mic);
      const processor = ctx.createScriptProcessor(4096, 1, 1);
      processor.onaudioprocess = (e) => {
        const pcm = createPcmBlob(e.inputBuffer.getChannelData(0));
        if (liveSessionRef.current) liveSessionRef.current.then((s: any) => s.sendRealtimeInput({ media: pcm }));
      };
      source.connect(processor);
      processor.connect(ctx.destination);
    } catch (err) { setErrorMsg("Mikrofon erişilemedi."); }
  };

  const closeInteraction = () => {
    setShowPopup(false);
    if (liveSessionRef.current) liveSessionRef.current.then((s: any) => s.close());
    setIsLiveActive(false);
    setIsAISpeaking(false);
    setCurrentTranscription('');
  };

  useEffect(() => { startCamera(); }, []);

  return (
    <Layout>
      <div className="relative min-h-[80vh] flex flex-col">
        {/* HUD Elements */}
        <div className="absolute top-0 left-0 w-32 h-32 border-l-2 border-t-2 border-cyan-500/20 pointer-events-none" />
        <div className="absolute bottom-0 right-0 w-32 h-32 border-r-2 border-b-2 border-indigo-500/20 pointer-events-none" />

        <div className="flex justify-between items-center mb-8 px-4">
           <div className="flex flex-col">
              <span className="text-[10px] font-black text-cyan-500 uppercase tracking-[0.5em]">Vision System v2.5</span>
              <span className="text-xs text-slate-500 font-mono">LATENCY: 42ms | ENCRYPTION: AES-256</span>
           </div>
           <div className="flex items-center space-x-4">
              <button 
                onClick={() => setState(AppState.HISTORY)}
                className="p-3 bg-slate-900 border border-white/5 rounded-2xl text-slate-400 hover:text-white transition-all shadow-xl"
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              </button>
              <button 
                onClick={() => setState(AppState.SETTINGS)}
                className="flex items-center space-x-3 bg-slate-900 border border-white/5 px-6 py-3 rounded-2xl hover:bg-slate-800 transition-all shadow-xl"
              >
                <span className="text-xl">{LANGUAGES[lang].flag}</span>
                <span className="text-sm font-bold text-slate-200">{LANGUAGES[lang].name}</span>
              </button>
           </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center flex-1">
          {/* Main Viewport */}
          <div className="lg:col-span-7 relative group">
             <div className="absolute -inset-1 bg-gradient-to-r from-cyan-500 to-indigo-600 rounded-[48px] blur-2xl opacity-10 group-hover:opacity-30 transition duration-1000"></div>
             <div className="glass rounded-[48px] aspect-video lg:aspect-square overflow-hidden relative border-white/10 shadow-3xl bg-black">
                {!tempImage ? (
                  <>
                    <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover opacity-60 mix-blend-screen" />
                    <div className="absolute inset-0 flex flex-col items-center justify-center space-y-8 bg-slate-950/30">
                       <button onClick={() => {
                          const ctx = canvasRef.current?.getContext('2d');
                          if (videoRef.current && canvasRef.current && ctx) {
                            canvasRef.current.width = videoRef.current.videoWidth;
                            canvasRef.current.height = videoRef.current.videoHeight;
                            ctx.drawImage(videoRef.current, 0, 0);
                            processImage(canvasRef.current.toDataURL('image/jpeg'));
                          }
                       }} className="relative group/scan">
                          <div className="absolute inset-[-20px] bg-cyan-500/20 rounded-full animate-ping" />
                          <div className="w-24 h-24 bg-gradient-to-tr from-cyan-600 to-indigo-600 rounded-full flex items-center justify-center border-4 border-white/10 shadow-[0_0_50px_rgba(34,211,238,0.4)] group-active/scan:scale-90 transition-all">
                             <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                          </div>
                       </button>
                       <label className="flex flex-col items-center cursor-pointer space-y-2 opacity-60 hover:opacity-100 transition-opacity">
                          <span className="text-[10px] font-black uppercase tracking-[0.5em] text-white">Upload Archive</span>
                          <input type="file" className="hidden" accept="image/*" onChange={e => {
                             const f = e.target.files?.[0];
                             if (f) { const r = new FileReader(); r.onload = () => processImage(r.result as string); r.readAsDataURL(f); }
                          }} />
                       </label>
                    </div>
                  </>
                ) : (
                  <div className="relative w-full h-full">
                     <img src={tempImage} className="w-full h-full object-cover" alt="Scan" />
                     <button onClick={() => { setTempImage(null); setState(AppState.IDLE); startCamera(); }} className="absolute top-8 right-8 p-4 bg-black/60 backdrop-blur-xl rounded-2xl border border-white/10 text-white hover:bg-black/90 transition-all">
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                     </button>
                  </div>
                )}
                <canvas ref={canvasRef} className="hidden" />
             </div>
          </div>

          {/* Data Feed */}
          <div className="lg:col-span-5 space-y-8">
             <div className="space-y-2">
                <h1 className="text-6xl font-black text-white leading-none tracking-tighter">DEEP<br /><span className="text-cyan-400">SCAN.</span></h1>
                <p className="text-slate-400 font-medium max-w-sm">Görselin ötesindeki gerçeği keşfet. VisionVoice, her pikseli canlı bir veri akışına dönüştürür.</p>
             </div>

             {state === AppState.ANALYZING && (
               <div className="flex items-center space-x-6 p-8 glass rounded-[32px] border-cyan-500/20">
                  <div className="w-10 h-10 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin" />
                  <div className="flex flex-col">
                     <span className="text-sm font-black text-white uppercase tracking-widest">Neural Processing</span>
                     <span className="text-xs text-slate-500 animate-pulse">Analysing objects & searching web...</span>
                  </div>
               </div>
             )}

             {currentAnalysis && (
               <div className="space-y-6 animate-in slide-in-from-right-8 duration-500">
                  <div className="glass p-8 rounded-[40px] border-l-4 border-cyan-400 space-y-4 shadow-2xl">
                     <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black text-cyan-500 uppercase">Analysis Summary</span>
                        <button onClick={() => setShowPopup(true)} className="p-2 bg-white/5 rounded-xl hover:bg-white/10 text-white"><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg></button>
                     </div>
                     <p className="text-lg font-medium text-slate-200 leading-relaxed italic">"{currentAnalysis.summary}"</p>
                  </div>

                  {currentAnalysis.sources && currentAnalysis.sources.length > 0 && (
                    <div className="glass p-6 rounded-[32px] border-white/5">
                       <h4 className="text-[10px] font-black uppercase text-slate-500 mb-4 tracking-widest">Grounded Intelligence (Sources)</h4>
                       <div className="flex flex-col gap-3">
                          {currentAnalysis.sources.slice(0, 3).map((s, i) => (
                             <a key={i} href={s.uri} target="_blank" className="flex items-center justify-between p-3 bg-white/5 rounded-2xl hover:bg-white/10 transition-colors border border-white/5">
                                <span className="text-xs font-bold text-slate-300 truncate pr-4">{s.title}</span>
                                <svg className="w-4 h-4 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                             </a>
                          ))}
                       </div>
                    </div>
                  )}
               </div>
             )}
          </div>
        </div>

        {/* Interaction HUD (Popup) */}
        {showPopup && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-950/95 backdrop-blur-3xl" onClick={closeInteraction} />
            <div className="relative glass w-full max-w-2xl rounded-[64px] p-16 flex flex-col items-center border-white/5 shadow-[0_0_200px_rgba(34,211,238,0.2)]">
               <button onClick={closeInteraction} className="absolute top-12 right-12 p-3 bg-white/5 rounded-full text-slate-500 hover:text-white transition-all"><svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
               
               <AICore isSpeaking={isAISpeaking} isListening={isLiveActive && !isAISpeaking} />
               
               <div className="mt-16 text-center space-y-6 w-full">
                  <div className="inline-block px-4 py-1 bg-cyan-500/10 border border-cyan-500/20 rounded-full">
                    <span className="text-[10px] font-black text-cyan-400 uppercase tracking-[0.5em]">Active Core Link</span>
                  </div>
                  <h3 className="text-4xl font-black text-white">
                    {isAISpeaking ? 'Core Transmitting' : (isLiveActive ? 'Awaiting Input' : 'Syncing...')}
                  </h3>
                  
                  {/* Visualizer bars */}
                  <div className="flex items-end justify-center space-x-1 h-16">
                     {[...Array(24)].map((_, i) => (
                       <div key={i} className={`w-1.5 bg-gradient-to-t from-cyan-600 to-indigo-500 rounded-full transition-all duration-75 ${isAISpeaking || isLiveActive ? 'animate-pulse' : 'h-1 opacity-20'}`} style={{ height: (isAISpeaking || isLiveActive) ? `${Math.random() * 80 + 20}%` : '4px', animationDelay: `${i * 0.05}s` }} />
                     ))}
                  </div>

                  <div className="min-h-[60px] flex items-center justify-center px-12">
                    <p className="text-slate-400 text-lg italic font-medium leading-relaxed">
                      {currentTranscription || 'Bağlantı aktif. Görsel hakkında ne bilmek istersin?'}
                    </p>
                  </div>
               </div>
            </div>
          </div>
        )}

        {/* History Sidebar */}
        {state === AppState.HISTORY && (
          <div className="fixed inset-0 z-[70] flex justify-end">
             <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setState(AppState.IDLE)} />
             <div className="relative glass w-full max-w-md h-full p-10 border-l border-white/10 shadow-3xl animate-in slide-in-from-right duration-300 overflow-y-auto">
                <div className="flex items-center justify-between mb-10">
                   <h2 className="text-2xl font-black text-white tracking-tight">SCAN HISTORY</h2>
                   <button onClick={() => setState(AppState.IDLE)} className="p-2 hover:text-white text-slate-500"><svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
                </div>
                <div className="space-y-6">
                   {history.length === 0 ? (
                     <p className="text-slate-500 text-sm italic">Henüz bir tarama kaydı bulunmuyor.</p>
                   ) : (
                     history.map(item => (
                       <button key={item.id} onClick={() => { setCurrentAnalysis(item); setTempImage(item.imageData); setState(AppState.IDLE); }} className="w-full group text-left space-y-3 p-4 bg-slate-900 rounded-3xl border border-white/5 hover:border-cyan-500/50 transition-all">
                          <img src={item.imageData} className="w-full h-32 object-cover rounded-2xl opacity-40 group-hover:opacity-80 transition-opacity" />
                          <p className="text-xs font-bold text-white line-clamp-2">{item.summary}</p>
                          <span className="text-[10px] text-slate-600 font-mono">{new Date(item.timestamp).toLocaleTimeString()}</span>
                       </button>
                     ))
                   )}
                </div>
             </div>
          </div>
        )}

        {/* Settings Modal */}
        {state === AppState.SETTINGS && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={() => setState(AppState.IDLE)} />
            <div className="relative glass w-full max-w-sm rounded-[40px] p-10 border-white/10 shadow-3xl animate-in zoom-in-95 duration-300">
              <h3 className="text-2xl font-black text-white mb-8 tracking-tight">Tercihler</h3>
              <div className="space-y-3">
                {Object.values(LANGUAGES).map(l => (
                  <button key={l.code} onClick={() => { setLang(l.code); setState(AppState.IDLE); }} className={`w-full group flex items-center justify-between p-5 rounded-3xl border transition-all ${lang === l.code ? 'bg-indigo-600 border-indigo-400 text-white' : 'bg-slate-900 border-white/5 text-slate-400 hover:bg-slate-800'}`}>
                    <div className="flex items-center space-x-4"><span className="text-2xl">{l.flag}</span><span className="font-bold">{l.name}</span></div>
                    {lang === l.code && <div className="w-3 h-3 bg-white rounded-full shadow-[0_0_10px_white]" />}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default App;
