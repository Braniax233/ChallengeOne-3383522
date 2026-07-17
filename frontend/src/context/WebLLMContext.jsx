import { createContext, useState, useEffect, useCallback, useContext } from "react";
import { CreateMLCEngine, hasModelInCache } from "@mlc-ai/web-llm";

const MODEL_ID = "SmolLM2-135M-Instruct-q0f32-MLC";

const WebLLMContext = createContext(null);

export function WebLLMProvider({ children }) {
  const [engine, setEngine] = useState(null);
  const [isInitializing, setIsInitializing] = useState(false);
  const [progressText, setProgressText] = useState("");
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState(null);
  const [isCached, setIsCached] = useState(false);

  useEffect(() => {
    hasModelInCache(MODEL_ID).then(setIsCached).catch(() => {});
  }, []);

  const init = useCallback(async () => {
    if (engine || isInitializing) return;

    if (!navigator.gpu) {
      setError("WebGPU is not supported by your browser. Please use Chrome/Edge on a compatible device.");
      return;
    }

    setIsInitializing(true);
    setError(null);
    setProgressText("Initializing AI Engine...");

    try {
      const initProgressCallback = (report) => {
        // Sanitize confusing WebLLM strings that say "Downloading" during the memory cache phase
        setProgressText(report.text.replace(/Downloading/g, "Loading into memory"));
      };

      const mlcEngine = await CreateMLCEngine(MODEL_ID, {
        initProgressCallback,
        context_window_size: 1024,
      });

      setEngine(mlcEngine);
      setIsReady(true);
      setProgressText("");
    } catch (err) {
      console.error("WebLLM Init Error:", err);
      if (err.message?.includes("GPU")) {
        setError("Your device/browser doesn't support WebGPU (required for offline AI). Please use Chrome/Edge on a compatible device.");
      } else {
        setError(`Failed to load AI: ${err.message}`);
      }
    } finally {
      setIsInitializing(false);
    }
  }, [engine, isInitializing]);

  const chat = useCallback(async (systemPrompt, userMessage, history = []) => {
    if (!engine) throw new Error("Engine not ready");

    const messages = [
      { role: "system", content: systemPrompt },
      ...history,
      { role: "user", content: userMessage }
    ];

    try {
      const response = await engine.chat.completions.create({
        messages,
      });
      return response.choices[0].message.content ?? "";
    } catch (err) {
      console.error("Chat error:", err);
      throw err;
    }
  }, [engine]);

  return (
    <WebLLMContext.Provider
      value={{
        engine,
        isInitializing,
        progressText,
        isReady,
        isCached,
        error,
        init,
        chat
      }}
    >
      {children}
    </WebLLMContext.Provider>
  );
}

export function useWebLLMContext() {
  return useContext(WebLLMContext);
}
