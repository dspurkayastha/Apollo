"use client";

import { useCallback, useRef, useState } from "react";

export interface SSEMessage {
  type: "delta" | "complete" | "error";
  text?: string;
  parsed?: Record<string, unknown> | null;
  message?: string;
  raw?: string;
}

interface UseSSEOptions {
  onDelta?: (text: string) => void;
  onComplete?: (data: SSEMessage) => void;
  onError?: (message: string) => void;
}

interface UseSSEReturn {
  start: (url: string, options?: RequestInit) => void;
  stop: () => void;
  isStreaming: boolean;
  streamedText: string;
  error: string | null;
}

export function useSSE(options: UseSSEOptions = {}): UseSSEReturn {
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamedText, setStreamedText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const stop = useCallback(() => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setIsStreaming(false);
  }, []);

  const start = useCallback(
    (url: string, fetchOptions?: RequestInit) => {
      stop();
      setStreamedText("");
      setError(null);
      setIsStreaming(true);

      const controller = new AbortController();
      abortControllerRef.current = controller;

      fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        ...fetchOptions,
        signal: controller.signal,
      })
        .then(async (response) => {
          if (!response.ok) {
            const errorBody = await response.json().catch(() => ({}));
            const msg =
              (errorBody as Record<string, Record<string, string>>)?.error?.message ??
              `Request failed with status ${response.status}`;
            setError(msg);
            options.onError?.(msg);
            setIsStreaming(false);
            return;
          }

          const reader = response.body?.getReader();
          if (!reader) {
            setError("No response stream available");
            setIsStreaming(false);
            return;
          }

          const decoder = new TextDecoder();
          let buffer = "";
          let accumulated = "";

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() ?? "";

            for (const line of lines) {
              if (!line.startsWith("data: ")) continue;
              const data = line.slice(6).trim();

              if (data === "[DONE]") {
                setIsStreaming(false);
                return;
              }

              try {
                const msg = JSON.parse(data) as SSEMessage;

                if (msg.type === "delta" && msg.text) {
                  accumulated += msg.text;
                  setStreamedText(accumulated);
                  options.onDelta?.(msg.text);
                } else if (msg.type === "complete") {
                  options.onComplete?.(msg);
                } else if (msg.type === "error") {
                  setError(msg.message ?? "Unknown error");
                  options.onError?.(msg.message ?? "Unknown error");
                }
              } catch {
                // Ignore malformed SSE messages
              }
            }
          }

          setIsStreaming(false);
        })
        .catch((err: Error) => {
          if (err.name !== "AbortError") {
            setError(err.message);
            options.onError?.(err.message);
          }
          setIsStreaming(false);
        });
    },
    [options, stop]
  );

  return { start, stop, isStreaming, streamedText, error };
}
