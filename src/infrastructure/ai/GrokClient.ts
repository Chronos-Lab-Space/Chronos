import { supabase } from "../supabase/client";

export type GrokChatMessage = {
  role: "user" | "assistant" | "system";
  content: string;
};

export type GrokChatRequest = {
  messages: GrokChatMessage[];
  /** Workspace snapshot / RAG-lite context string */
  context?: string;
  model?: string;
  temperature?: number;
};

export type GrokChatResponse = {
  content: string;
  model?: string;
  usage?: unknown;
};

/**
 * Client for the Supabase Edge Function `grok` (xAI proxy).
 * Requires an authenticated session; API key never touches the browser.
 */
export class GrokClient {
  async chat(request: GrokChatRequest): Promise<GrokChatResponse> {
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) {
      throw new Error("Sign in to use Grok in the workspace.");
    }

    const { data, error } = await supabase.functions.invoke("grok", {
      body: {
        messages: request.messages,
        context: request.context,
        model: request.model,
        temperature: request.temperature,
      },
    });

    if (error) {
      throw new Error(error.message || "Grok request failed");
    }

    if (data?.error) {
      const detail =
        typeof data.detail === "string"
          ? data.detail
          : data.detail
            ? JSON.stringify(data.detail)
            : "";
      throw new Error([data.error, detail].filter(Boolean).join(": "));
    }

    const content = String(data?.content ?? "").trim();
    if (!content) {
      throw new Error("Grok returned an empty response.");
    }

    return {
      content,
      model: data?.model,
      usage: data?.usage,
    };
  }
}

export const grokClient = new GrokClient();
