import { useState, useEffect } from "react";
import { Bot, Send, Download, Sparkles, Loader2, AlertCircle } from "lucide-react";
import { useWebLLMContext } from "../context/WebLLMContext";

export default function ClinicianAIAssistant({ patientName, vitalsHistory = [], notes = [] }) {
  const { init, isInitializing, progressText, isReady, isCached, error, chat } = useWebLLMContext();
  const [summary, setSummary] = useState("");
  const [generatingSummary, setGeneratingSummary] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);

  // Take the last 3 readings for the context to keep it concise and fast
  const recentVitals = vitalsHistory.slice(0, 3).map(v => `HR: ${v.hr}, SpO2: ${v.spo2}%`).join(" | ");
  
  const systemPrompt = `You are a clinical AI assistant for doctors and nurses on the VitalX platform. 
You are viewing data for patient: ${patientName}.
Recent Vitals (last 3 readings): ${recentVitals || "None recorded."}
Provide a concise, professional clinical assessment. Use medical terminology appropriately but keep it brief (2-3 sentences max).`;

  useEffect(() => {
    if (isReady && !summary && !generatingSummary) {
      generateBriefing();
    }
  }, [isReady]);

  const generateBriefing = async () => {
    setGeneratingSummary(true);
    try {
      const response = await chat(
        systemPrompt, 
        "Generate a 10-Second Patient Briefing summarizing their recent vitals history. Be concise."
      );
      setSummary(response);
    } catch (err) {
      setSummary("Failed to generate clinical briefing. You can ask a question below.");
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
      setMessages([...newMessages, { role: "assistant", content: "Error communicating with local AI model." }]);
    } finally {
      setIsTyping(false);
    }
  };

  if (!isReady) {
    return (
      <div className="bg-gradient-to-br from-teal-600 to-emerald-700 rounded-xl p-5 text-white shadow-sm border border-teal-500/30">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-full bg-white dark:bg-ink-800 /20 flex items-center justify-center font-bold text-white tracking-widest text-sm">
            AI
          </div>
          <div>
            <h3 className="font-bold text-lg leading-tight">Clinical AI Assistant</h3>
            <p className="text-teal-100 text-xs font-medium uppercase tracking-wider">Local Private Model</p>
          </div>
        </div>
        <p className="text-sm text-teal-50 mb-4 leading-relaxed">
          Enable the local LLM to generate instant patient briefings and answer clinical questions. Runs 100% offline for HIPAA compliance.
        </p>
        
        {error ? (
          <div className="p-3 bg-red-500/20 rounded-lg text-xs flex items-start gap-2 border border-red-500/30">
            <AlertCircle size={14} className="mt-0.5 flex-shrink-0" />
            <p>{error}</p>
          </div>
        ) : isInitializing ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium text-teal-100">
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
            className="w-full flex items-center justify-center gap-2 bg-white dark:bg-ink-800 text-teal-700 px-4 py-2.5 rounded-lg text-sm font-bold hover:bg-teal-50 transition-colors shadow-sm"
          >
            <Download size={16} /> {isCached ? "Load Offline Clinical AI" : "Download Offline Clinical AI"}
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-ink-800 border border-gray-200 dark:border-ink-600 rounded-xl shadow-sm flex flex-col h-[550px] overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-teal-600 to-emerald-700 p-4 text-white flex items-center gap-3 shrink-0">
        <div className="w-8 h-8 rounded-full bg-white dark:bg-ink-800 /20 flex items-center justify-center font-bold text-white text-xs tracking-widest">
          AI
        </div>
        <div>
          <h3 className="font-bold text-sm">Clinical AI Assistant</h3>
          <p className="text-[10px] text-teal-100 uppercase tracking-wider">Patient: {patientName}</p>
        </div>
      </div>

      {/* Smart Summary Area */}
      <div className="p-4 bg-teal-50/50 border-b border-gray-100 dark:border-ink-700 shrink-0">
        <div className="flex items-center gap-1.5 mb-2 text-teal-700">
          <span className="bg-teal-100 text-teal-700 px-1.5 py-0.5 rounded text-[10px] font-bold tracking-wider">AI</span>
          <span className="text-xs font-bold uppercase tracking-wide">10-Second Briefing</span>
        </div>
        {generatingSummary ? (
          <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 font-medium">
            <Loader2 size={14} className="animate-spin text-teal-600" /> Analyzing vitals history...
          </div>
        ) : (
          <p className="text-sm text-gray-800 dark:text-gray-100 leading-relaxed font-medium">
            {summary}
          </p>
        )}
      </div>

      {/* Chat History */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50 dark:bg-ink-900/50">
        {messages.length === 0 && (
          <div className="text-center text-gray-400 text-sm mt-8">
            Ask a clinical question about {patientName}'s vitals.
          </div>
        )}
        {messages.map((msg, idx) => (
          <div key={idx} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            <div 
              className={`max-w-[85%] rounded-2xl px-4 py-2 text-sm leading-relaxed ${
                msg.role === "user" 
                  ? "bg-teal-600 text-white rounded-br-none" 
                  : "bg-white dark:bg-ink-800 border border-gray-200 dark:border-ink-600 text-gray-800 dark:text-gray-100 rounded-bl-none shadow-sm"
              }`}
            >
              {msg.content}
            </div>
          </div>
        ))}
        {isTyping && (
          <div className="flex justify-start">
            <div className="bg-white dark:bg-ink-800 border border-gray-200 dark:border-ink-600 text-gray-500 dark:text-gray-400 rounded-2xl rounded-bl-none px-4 py-2.5 text-sm flex items-center gap-1.5 shadow-sm">
              <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"></span>
              <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></span>
              <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></span>
            </div>
          </div>
        )}
      </div>

      {/* Input Form */}
      <form onSubmit={handleSend} className="p-3 border-t border-gray-200 dark:border-ink-600 bg-white dark:bg-ink-800 flex items-center gap-2 shrink-0">
        <input 
          type="text" 
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask a question..."
          className="flex-1 bg-gray-50 dark:bg-ink-900 border border-gray-200 dark:border-ink-600 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 transition-colors"
          disabled={isTyping}
        />
        <button 
          type="submit"
          disabled={!input.trim() || isTyping}
          className="w-10 h-10 bg-teal-600 text-white rounded-xl flex items-center justify-center shrink-0 disabled:opacity-50 hover:bg-teal-700 transition-colors"
        >
          <Send size={16} />
        </button>
      </form>
    </div>
  );
}
