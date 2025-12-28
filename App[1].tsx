
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import Header from './components/Header';
import MessageList from './components/MessageList';
import { Message, Role } from './types';
import { geminiService } from './services/gemini';

const App: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [attachedImage, setAttachedImage] = useState<{ data: string; mimeType: string } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showWorkflowModal, setShowWorkflowModal] = useState(false);
  const [isVsCode, setIsVsCode] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [indexedFilesCount, setIndexedFilesCount] = useState(0);

  const messagesRef = useRef<Message[]>([]);
  const isLoadingRef = useRef<boolean>(false);
  const attachedImageRef = useRef<{ data: string; mimeType: string } | null>(null);
  const currentInputRef = useRef<string>('');
  const recognitionRef = useRef<any>(null);

  useEffect(() => { messagesRef.current = messages; }, [messages]);
  useEffect(() => { isLoadingRef.current = isLoading; }, [isLoading]);
  useEffect(() => { attachedImageRef.current = attachedImage; }, [attachedImage]);
  useEffect(() => { currentInputRef.current = input; }, [input]);

  // Voice Recognition Initialization
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = true;
      recognitionRef.current.lang = 'en-US';

      recognitionRef.current.onresult = (event: any) => {
        const transcript = Array.from(event.results)
          .map((result: any) => result[0])
          .map((result: any) => result.transcript)
          .join('');
        setInput(transcript);
      };

      recognitionRef.current.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        setIsListening(false);
      };
    }
  }, []);

  const toggleListening = () => {
    if (!recognitionRef.current) {
      alert("Speech recognition is not supported in this browser. Please use a modern browser like Chrome or Edge.");
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
    } else {
      setIsListening(true);
      recognitionRef.current.start();
    }
  };

  const handleSend = useCallback(async (overrideInput?: string) => {
    if (isLoadingRef.current) return;

    const textToSend = (overrideInput !== undefined ? overrideInput : currentInputRef.current).trim();
    const currentImage = attachedImageRef.current;

    if (!textToSend && !currentImage) return;

    const userMsg: Message = {
      id: uuidv4(),
      role: Role.USER,
      text: textToSend || (currentImage ? "[IMAGE_PAYLOAD_ATTACHED]" : ""),
      timestamp: Date.now(),
      image: currentImage || undefined
    };

    setInput('');
    setAttachedImage(null);
    setMessages(prev => [...prev, userMsg]);
    setIsLoading(true);

    try {
      const solution = await geminiService.solveError(userMsg.text, messagesRef.current, currentImage || undefined);
      
      const modelMsg: Message = {
        id: uuidv4(),
        role: solution.role as Role || Role.MODEL,
        text: solution.text || "PROTOCOL_ERROR: FAILED TO BROADCAST.",
        timestamp: Date.now(),
        groundingUrls: solution.groundingUrls,
        sources: solution.sources,
      };
      setMessages(prev => [...prev, modelMsg]);
    } catch (error) {
      console.error(error);
      const errorMsg: Message = {
        id: uuidv4(),
        role: Role.MODEL,
        text: "PULSE_CRITICAL: Uplink severed. Network anomaly detected.",
        timestamp: Date.now(),
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const isVscodeEnv = window.parent !== window || (window as any).acquireVsCodeApi;
    if (isVscodeEnv) setIsVsCode(true);

    const handleMessage = (event: MessageEvent) => {
      const message = event.data;
      if (message && message.type === 'TERMINAL_ERROR_PAYLOAD') {
        handleSend(`[TERMINAL_PULSE_CAPTURE] Analyzying terminal pulse:\n\n${message.data}`);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [handleSend]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = (reader.result as string).split(',')[1];
        setAttachedImage({ data: base64String, mimeType: file.type });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleIndexFiles = () => {
    setIndexedFilesCount(prev => prev + 5);
    handleSend("Indexing complete. Knowledge Vault updated with project local context.");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-screen bg-slate-950 text-slate-100 overflow-hidden bg-grid">
      <Header />
      
      <main className="flex-1 flex flex-col relative">
        <MessageList 
          messages={messages} 
          isLoading={isLoading} 
          onSuggestionClick={(text) => handleSend(text)}
        />
        
        {/* Input Dock */}
        <div className="p-6 md:p-10 relative z-10">
          <div className="max-w-4xl mx-auto">
            <div className="flex items-center gap-3 overflow-x-auto no-scrollbar pb-4 px-2">
                <button 
                  onClick={() => handleSend("Initiate Qwen & Ollama Configuration Wizard.")}
                  className="flex-shrink-0 px-5 py-2.5 rounded-2xl glass-card text-[10px] font-black uppercase tracking-widest text-emerald-400 hover:bg-emerald-500/10 hover:border-emerald-500/40 transition-all flex items-center gap-3 border border-emerald-500/20 shadow-[0_0_15px_rgba(16,185,129,0.1)]"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.1a2 2 0 0 1-1-1.72v-.51a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>
                  Configure LLM Nodes
                </button>
                <button 
                  onClick={() => handleSend("Show me the roadmap to build an AI agent in Google AI Studio.")}
                  className="flex-shrink-0 px-5 py-2.5 rounded-2xl glass-card text-[10px] font-black uppercase tracking-widest text-indigo-400 hover:bg-indigo-500/10 hover:border-indigo-500/40 transition-all flex items-center gap-3 border border-indigo-500/20"
                >
                  <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                  AI Studio Roadmap
                </button>
                <button 
                  onClick={() => handleSend("Compare AI platforms: Gemini vs Claude vs Azure for IT issues.")}
                  className="flex-shrink-0 px-5 py-2.5 rounded-2xl glass-card text-[10px] font-black uppercase tracking-widest text-rose-400 hover:bg-rose-500/10 hover:border-rose-500/40 transition-all flex items-center gap-3 border border-rose-500/20"
                >
                  <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                  Platform Sync
                </button>
                <button 
                  onClick={() => setShowWorkflowModal(true)}
                  className="flex-shrink-0 px-5 py-2.5 rounded-2xl glass-card text-[10px] font-black uppercase tracking-widest text-slate-400 hover:bg-white/5 transition-all border border-white/10"
                >
                  Blueprint Hub
                </button>
            </div>

            <div className="relative group animate-message">
              <div className="absolute -inset-1 bg-gradient-to-r from-emerald-500/20 via-indigo-500/20 to-emerald-500/20 rounded-[2.5rem] blur-xl opacity-0 group-focus-within:opacity-100 transition-opacity"></div>
              <div className="relative glass-card rounded-[2.5rem] p-2 flex items-center gap-2 border-white/10 group-focus-within:border-emerald-500/30 transition-all">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={isVsCode ? "Uplink active. Awaiting terminal pulse..." : "Enter command or paste diagnostic logs..."}
                  className="flex-1 bg-transparent text-slate-100 rounded-[2rem] py-4 px-6 focus:outline-none resize-none placeholder:text-slate-600 font-medium text-[15px] min-h-[64px] max-h-[200px]"
                  rows={1}
                />
                <div className="flex items-center gap-2 pr-2">
                  <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileChange} />
                  
                  {/* Voice Input Button */}
                  <button
                    onClick={toggleListening}
                    className={`p-3.5 rounded-2xl transition-all border ${
                      isListening 
                        ? 'bg-rose-500/20 border-rose-500 text-rose-500 shadow-[0_0_15px_rgba(244,63,94,0.3)] animate-pulse' 
                        : 'bg-slate-800/50 border-white/5 text-slate-400 hover:text-cyan-400 hover:bg-cyan-500/10'
                    }`}
                    title={isListening ? "Stop Listening" : "Voice Command"}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                    </svg>
                  </button>

                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="p-3.5 rounded-2xl bg-slate-800/50 text-slate-400 hover:text-emerald-400 hover:bg-emerald-500/10 transition-all border border-white/5"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => handleSend()}
                    disabled={(!input.trim() && !attachedImage) || isLoading}
                    className={`p-4 rounded-2xl transition-all ${
                      (!input.trim() && !attachedImage) || isLoading 
                        ? 'bg-slate-800 text-slate-600 cursor-not-allowed' 
                        : 'bg-gradient-to-br from-emerald-400 to-cyan-600 text-white shadow-lg shadow-emerald-500/20 hover:scale-105 active:scale-95'
                    }`}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Blueprint Modal */}
      {showWorkflowModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-2xl z-[100] flex items-center justify-center p-6 animate-in fade-in duration-300">
          <div className="glass-card rounded-[3rem] w-full max-w-6xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh] border-white/10 animate-in zoom-in-95 duration-500 cubic-bezier(0.16, 1, 0.3, 1)">
            <div className="p-10 border-b border-white/5 flex justify-between items-center bg-white/[0.02]">
              <div className="flex items-center gap-6">
                <div className="w-16 h-16 bg-indigo-500/10 rounded-3xl flex items-center justify-center text-indigo-400 border border-indigo-500/20 shadow-inner relative">
                   <div className="absolute inset-0 rounded-3xl border-2 border-indigo-500/20 pulse-ring-slow"></div>
                   <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                   </svg>
                </div>
                <div>
                  <h2 className="text-3xl font-black tracking-tight text-white uppercase italic">Blueprint <span className="text-indigo-500">Hub</span></h2>
                  <p className="text-[10px] text-slate-500 font-black uppercase tracking-[0.4em] mt-1">Orchestration Interface</p>
                </div>
              </div>
              <button onClick={() => setShowWorkflowModal(false)} className="w-12 h-12 flex items-center justify-center rounded-2xl bg-white/5 text-slate-400 hover:text-white hover:bg-rose-500/10 transition-all border border-white/5">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-10 space-y-16">
              {/* Configuration Wizard Section */}
              <section className="space-y-8">
                <div className="flex items-center gap-4">
                   <h3 className="text-[11px] font-black text-emerald-500 uppercase tracking-[0.4em]">Neural Node Sync (Qwen/Ollama)</h3>
                   <div className="flex-1 h-[1px] bg-emerald-500/20"></div>
                </div>
                <div className="p-8 glass-card rounded-[2.5rem] border-emerald-500/10 bg-emerald-500/[0.02] flex flex-col md:flex-row items-center justify-between gap-8">
                  <div className="flex-1">
                    <h4 className="text-xl font-black text-white italic uppercase tracking-tight mb-2">Configure LLM Credentials</h4>
                    <p className="text-slate-500 text-sm leading-relaxed max-w-xl">
                      Guide your environment setup for DASHSCOPE_API_KEY (Qwen) and local Ollama nodes. 
                      This process follows the high-fidelity protocol used in systems like Claude Code for robust API integration.
                    </p>
                  </div>
                  <button 
                    onClick={() => { handleSend("Guide me through the Qwen & Ollama configuration protocol."); setShowWorkflowModal(false); }}
                    className="flex-shrink-0 px-10 py-5 bg-emerald-500 text-slate-950 rounded-3xl text-[11px] font-black uppercase tracking-[0.2em] hover:scale-105 hover:bg-emerald-400 transition-all shadow-[0_10px_30px_rgba(16,185,129,0.3)]"
                  >
                    Start Wizard
                  </button>
                </div>
              </section>

              {/* Roadmap Section */}
              <section className="space-y-8">
                <div className="flex items-center gap-4">
                   <h3 className="text-[11px] font-black text-indigo-500 uppercase tracking-[0.4em]">AI Evolution Roadmap</h3>
                   <div className="flex-1 h-[1px] bg-indigo-500/20"></div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 relative">
                   {[
                     { step: "01", title: "AI Studio Start", desc: "Build in Google AI Studio using System Instructions.", color: "indigo" },
                     { step: "02", title: "RAG Injection", desc: "Connect your Neural Vault for local code context.", color: "emerald" },
                     { step: "03", title: "Tool Arming", desc: "Add Google Search & CLI Function Calling.", color: "cyan" },
                     { step: "04", title: "Cloud Deployment", desc: "Push to GCP Run for global scalability.", color: "rose" }
                   ].map((item, i) => (
                     <div key={i} className="glass-card p-6 rounded-[2rem] border-white/5 hover:border-indigo-500/20 transition-all group cursor-default">
                        <span className={`text-4xl font-black text-slate-800 group-hover:text-indigo-500/20 transition-colors`}>{item.step}</span>
                        <h4 className="font-bold text-white mt-2 uppercase tracking-tighter text-sm italic">{item.title}</h4>
                        <p className="text-[11px] text-slate-500 mt-2 leading-relaxed font-medium">{item.desc}</p>
                     </div>
                   ))}
                </div>
              </section>

              {/* Platform Comparison */}
              <section className="space-y-8">
                <div className="flex items-center gap-4">
                   <h3 className="text-[11px] font-black text-rose-500 uppercase tracking-[0.4em]">Platform Pulse Matrix</h3>
                   <div className="flex-1 h-[1px] bg-rose-500/20"></div>
                </div>
                <div className="overflow-hidden rounded-[2rem] border border-white/5 bg-white/[0.01]">
                  <table className="w-full text-left text-[12px]">
                    <thead className="bg-white/5 uppercase font-black tracking-widest text-slate-400">
                      <tr>
                        <th className="px-6 py-4">Capability</th>
                        <th className="px-6 py-4 text-emerald-400 italic">Gemini (AI Studio)</th>
                        <th className="px-6 py-4">Claude 3.5</th>
                        <th className="px-6 py-4">GPT-4o</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5 font-medium text-slate-300">
                      <tr>
                        <td className="px-6 py-4 font-bold text-slate-500 uppercase tracking-tighter text-[10px]">Max Log Capacity</td>
                        <td className="px-6 py-4 text-emerald-400">2M Tokens (Best for IT)</td>
                        <td className="px-6 py-4">200K Tokens</td>
                        <td className="px-6 py-4">128K Tokens</td>
                      </tr>
                      <tr>
                        <td className="px-6 py-4 font-bold text-slate-500 uppercase tracking-tighter text-[10px]">Log Reasoning</td>
                        <td className="px-6 py-4">High (Native Multimodal)</td>
                        <td className="px-6 py-4 text-white font-bold">Excellent (Logic)</td>
                        <td className="px-6 py-4">Balanced</td>
                      </tr>
                      <tr>
                        <td className="px-6 py-4 font-bold text-slate-500 uppercase tracking-tighter text-[10px]">Live Web Data</td>
                        <td className="px-6 py-4">Integrated Search Grounding</td>
                        <td className="px-6 py-4">External Search</td>
                        <td className="px-6 py-4">Bing Integration</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <p className="text-[10px] text-slate-600 font-bold uppercase tracking-widest text-center italic">Verdict: Use Gemini for Terminal Debugging & Claude for Complex Refactoring.</p>
              </section>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
