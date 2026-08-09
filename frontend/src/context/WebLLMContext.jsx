import { createContext, useState, useEffect, useCallback, useContext } from "react";
import { CreateMLCEngine, hasModelInCache, deleteModelAllInfoInCache, prebuiltAppConfig } from "@mlc-ai/web-llm";

const DEFAULT_MODEL = "Llama-3-8B-Instruct-q4f32_1-MLC";

const WebLLMContext = createContext(null);

export function WebLLMProvider({ children }) {
  const [selectedModelId, setSelectedModelId] = useState(
    localStorage.getItem("vitalx_ai_model") || DEFAULT_MODEL
  );
  
  const [engine, setEngine] = useState(null);
  const [isInitializing, setIsInitializing] = useState(false);
  const [progressText, setProgressText] = useState("");
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState(null);
  const [cacheStatus, setCacheStatus] = useState({});

  // Filter out vision/embedding models for chat
  const availableModels = prebuiltAppConfig.model_list
    .filter(m => m.model_type === undefined || m.model_type === 0);

  const updateCacheStatus = useCallback(async () => {
    const status = {};
    for (const model of availableModels) {
      try {
        status[model.model_id] = await hasModelInCache(model.model_id);
      } catch (e) {
        status[model.model_id] = false;
      }
    }
    setCacheStatus(status);
  }, [availableModels]);

  useEffect(() => {
    updateCacheStatus();
  }, [updateCacheStatus]);

  const init = useCallback(async (overrideModelId) => {
    const modelToLoad = overrideModelId || selectedModelId;
    if (isInitializing) return;

    if (!navigator.gpu) {
      setError("WebGPU is not supported by your browser. Please use Chrome/Edge on a compatible device.");
      return;
    }

    setIsInitializing(true);
    setError(null);
    setProgressText(`Initializing ${modelToLoad}...`);

    try {
      if (engine) {
        await engine.unload();
        setEngine(null);
        setIsReady(false);
      }

      const initProgressCallback = (report) => {
        // Sanitize confusing WebLLM strings
        setProgressText(report.text.replace(/Downloading/g, "Loading into memory"));
      };

      const mlcEngine = await CreateMLCEngine(modelToLoad, {
        initProgressCallback,
        context_window_size: 1024,
      });

      setEngine(mlcEngine);
      setIsReady(true);
      setProgressText("");
      updateCacheStatus();
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
  }, [engine, isInitializing, selectedModelId, updateCacheStatus]);

  const switchModel = useCallback(async (newModelId) => {
    setSelectedModelId(newModelId);
    localStorage.setItem("vitalx_ai_model", newModelId);
    
    // If the engine is currently loaded or error, re-init with the new model immediately
    if (isReady || error) {
      await init(newModelId);
    }
  }, [isReady, error, init]);

  const deleteCache = useCallback(async (modelId) => {
    try {
      await deleteModelAllInfoInCache(modelId);
      updateCacheStatus();
      if (selectedModelId === modelId && engine) {
        await engine.unload();
        setEngine(null);
        setIsReady(false);
        setProgressText("");
      }
    } catch (err) {
      console.error("Failed to delete cache", err);
    }
  }, [engine, selectedModelId, updateCacheStatus]);

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
        isCached: cacheStatus[selectedModelId] || false,
        error,
        init,
        chat,
        selectedModelId,
        availableModels,
        cacheStatus,
        switchModel,
        deleteCache
      }}
    >
      {children}
    </WebLLMContext.Provider>
  );
}

export function useWebLLMContext() {
  return useContext(WebLLMContext);
}
