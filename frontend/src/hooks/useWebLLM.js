import { useState, useEffect, useCallback } from "react";
import { CreateMLCEngine } from "@mlc-ai/web-llm";

// The model we want to run. Llama 3.2 1B is incredibly fast and smart.
const MODEL_ID = "Llama-3.2-1B-Instruct-q4f16_1-MLC";

export default function useWebLLM() {
  const [engine, setEngine] = useState(null);
  const [isInitializing, setIsInitializing] = useState(false);
  const [progressText, setProgressText] = useState("");
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState(null);

  // Initialize the AI engine
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
        setProgressText(report.text);
      };

      const mlcEngine = await CreateMLCEngine(MODEL_ID, {
        initProgressCallback,
      });

      setEngine(mlcEngine);
      setIsReady(true);
      setProgressText("");
    } catch (err) {
      console.error("WebLLM Init Error:", err);
      setError(`Failed to initialize the AI model: ${err.message || "Unknown error"}. Please check your connection or try again later.`);
    } finally {
      setIsInitializing(false);
    }
  }, [engine, isInitializing]);

  // Chat function to generate responses
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

  return {
    engine,
    isInitializing,
    progressText,
    isReady,
    error,
    init,
    chat
  };
}
