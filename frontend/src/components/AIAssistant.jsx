import { useState, useEffect } from "react";
import { Bot, Send, Download, Sparkles, Loader2, AlertCircle } from "lucide-react";
import { useWebLLMContext } from "../context/WebLLMContext";

export default function AIAssistant({ vitals }) {
  const { init, isInitializing, progressText, isReady, isCached, error, chat } = useWebLLMContext();
  const [summary, setSummary] = useState("");
  const [generatingSummary, setGeneratingSummary] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);

  const vitalsText = `Heart Rate: ${vitals.hr || "N/A"} bpm, SpO2: ${vitals.spo2 || "N/A"}%, BMI: ${vitals.bmi || "N/A"}`;
  
  const systemPrompt = `You are a helpful, empathetic medical AI assistant for the VitalX platform. 
The patient's current vitals are: ${vitalsText}.
Do NOT diagnose the patient. Offer general, non-diagnostic lifestyle advice based on their vitals and answer their questions simply. Keep answers very concise (1-3 sentences max).`;

  useEffect(() => {
    if (isReady && !summary && !generatingSummary) {
      generateSummary();
    }
  }, [isReady]);

  const generateSummary = async () => {
    setGeneratingSummary(true);
    try {
      const response = await chat(
        systemPrompt, 
        "Based on my current vitals, give me a quick 2-sentence summary of how I am doing and one lifestyle tip."
      );
      setSummary(response);
    } catch (err) {
      setSummary("Failed to generate summary. You can try asking a question below.");
    } finally {
      setGeneratingSummary(false);
    }
  };

  const handleSend = async (e) => {
    e.preventDefault();
    if (!input.trim() || isTyping) return;

    const userMsg = input.trim();
    setInput("");
    
    const newMessages = [...messages, { role: "user", content: userMsg }];
    setMessages(newMessages);
    setIsTyping(true);

    try {
      const reply = await chat(systemPrompt, userMsg, newMessages);
      setMessages([...newMessages, { role: "assistant", content: reply }]);
    } catch (err) {
      setMessages([...newMessages, { role: "assistant", content: "Sorry, I encountered an error." }]);
    } finally {
      setIsTyping(false);
    }
  };

  if (!isReady) {
    return (
      <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl p-6 text-white shadow-sm">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-full bg-white dark:bg-ink-800 /20 flex items-center justify-center font-bold text-white tracking-widest text-sm">
            AI
          </div>
          <div>
            <h3 className="font-bold text-lg leading-tight">Offline AI Assistant</h3>
            <p className="text-indigo-100 text-xs">Powered by Llama 3.2</p>
          </div>
        </div>
        <p className="text-sm text-indigo-50 mb-5 leading-relaxed">
          Download our tiny, fast AI model (~800MB) directly into your browser. It runs 100% offline, keeping your health data completely private.
        </p>
        
        {error ? (
          <div className="p-3 bg-red-500/20 rounded-lg text-xs flex items-start gap-2">
            <AlertCircle size={14} className="mt-0.5 flex-shrink-0" />
            <p>{error}</p>
          </div>
        ) : isInitializing ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Loader2 size={16} className="animate-spin" />
              <span>{progressText || "Loading..."}</span>
            </div>
            <div className="h-1.5 w-full bg-white dark:bg-ink-800 /20 rounded-full overflow-hidden">
              <div className="h-full bg-white dark:bg-ink-800 rounded-full animate-pulse w-full"></div>
            </div>
          </div>
        ) : (
          <button 
            onClick={init}
            className="w-full flex items-center justify-center gap-2 bg-white dark:bg-ink-800 text-indigo-700 px-4 py-3 rounded-xl text-sm font-bold hover:bg-indigo-50 transition-colors shadow-sm"
          >
            <Download size={18} /> {isCached ? "Load Offline AI" : "Download Offline AI"}
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-ink-800 border border-gray-100 dark:border-ink-700 rounded-xl shadow-sm flex flex-col h-[500px] overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-500 to-purple-600 p-4 text-white flex items-center gap-3 shrink-0">
        <div className="w-8 h-8 rounded-full bg-white dark:bg-ink-800 /20 flex items-center justify-center font-bold text-white text-xs tracking-widest">
          AI
        </div>
        <div>
          <h3 className="font-bold text-sm">VitalX Assistant</h3>
          <p className="text-[10px] text-indigo-100 uppercase tracking-wider">Running Offline</p>
        </div>
      </div>

      {/* Smart Summary Area */}
      <div className="p-4 bg-indigo-50/50 border-b border-gray-100 dark:border-ink-700 shrink-0">
        <div className="flex items-center gap-1.5 mb-2 text-indigo-700">
          <span className="bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded text-[10px] font-bold tracking-wider">AI</span>
          <span className="text-xs font-bold uppercase tracking-wide">Smart Summary</span>
        </div>
        {generatingSummary ? (
          <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
            <Loader2 size={14} className="animate-spin" /> Analyzing vitals...
          </div>
        ) : (
          <p className="text-sm text-gray-700 dark:text-gray-200 leading-relaxed font-medium">
            {summary}
          </p>
        )}
      </div>

      {/* Chat History */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50 dark:bg-ink-900/30">
        {messages.length === 0 && (
          <div className="text-center text-gray-400 text-sm mt-8">
            Ask me a question about your vitals or health!
          </div>
        )}
        {messages.map((msg, idx) => (
          <div key={idx} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            <div 
              className={`max-w-[85%] rounded-2xl px-4 py-2 text-sm ${
                msg.role === "user" 
                  ? "bg-brand text-white rounded-br-none" 
                  : "bg-gray-100 dark:bg-ink-700 text-gray-800 dark:text-gray-100 rounded-bl-none"
              }`}
            >
              {msg.content}
            </div>
          </div>
        ))}
        {isTyping && (
          <div className="flex justify-start">
            <div className="bg-gray-100 dark:bg-ink-700 text-gray-500 dark:text-gray-400 rounded-2xl rounded-bl-none px-4 py-2 text-sm flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"></span>
              <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></span>
              <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></span>
            </div>
          </div>
        )}
      </div>

      {/* Input Form */}
      <form onSubmit={handleSend} className="p-3 border-t border-gray-100 dark:border-ink-700 bg-white dark:bg-ink-800 flex items-center gap-2 shrink-0">
        <input 
          type="text" 
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask a question..."
          className="flex-1 bg-gray-50 dark:bg-ink-900 border border-gray-200 dark:border-ink-600 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand"
          disabled={isTyping}
        />
        <button 
          type="submit"
          disabled={!input.trim() || isTyping}
          className="w-10 h-10 bg-brand text-white rounded-xl flex items-center justify-center shrink-0 disabled:opacity-50 hover:bg-brand-600 transition-colors"
        >
          <Send size={16} />
        </button>
      </form>
    </div>
  );
}
