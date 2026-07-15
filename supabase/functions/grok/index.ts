// Supabase Edge Function — Grok (xAI) proxy for authenticated workspace users.
// Secrets: XAI_API_KEY (required). Do not expose the key to the browser.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

type GrokRequestBody = {
  messages?: ChatMessage[];
  /** Optional extra system preamble (workspace context). */
  context?: string;
  /** Default grok-4.5 */
  model?: string;
  temperature?: number;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return json({ error: "Missing Authorization header" }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnon = Deno.env.get("SUPABASE_ANON_KEY");
    if (!supabaseUrl || !supabaseAnon) {
      return json({ error: "Supabase env not configured on function" }, 500);
    }

    const userClient = createClient(supabaseUrl, supabaseAnon, {
      global: { headers: { Authorization: authHeader } },
    });
    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser();
    if (userError || !user) {
      return json({ error: "Unauthorized" }, 401);
    }

    const xaiKey = Deno.env.get("XAI_API_KEY");
    if (!xaiKey) {
      return json(
        {
          error:
            "XAI_API_KEY is not set on the Edge Function. Run: supabase secrets set XAI_API_KEY=...",
        },
        503
      );
    }

    const body = (await req.json()) as GrokRequestBody;
    const messages = body.messages ?? [];
    if (!Array.isArray(messages) || messages.length === 0) {
      return json({ error: "messages[] is required" }, 400);
    }

    const systemParts = [
      "You are Grok, wired into Chronos Lab — a temporal workspace for decision-making.",
      "Help the user reason about goals, knowledge, constraints, simulated futures, risks, and next steps.",
      "Be concrete, structured, and decision-oriented. Prefer short sections and bullet points.",
      "Do not invent private user data; use only the context provided.",
    ];
    if (body.context?.trim()) {
      systemParts.push("Workspace context:\n" + body.context.trim().slice(0, 24_000));
    }

    const payload = {
      model: body.model ?? "grok-4.5",
      temperature: body.temperature ?? 0.4,
      messages: [
        { role: "system", content: systemParts.join("\n\n") },
        ...messages.map((m) => ({
          role: m.role === "assistant" || m.role === "system" ? m.role : "user",
          content: String(m.content ?? "").slice(0, 32_000),
        })),
      ],
    };

    const xaiRes = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${xaiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const xaiJson = await xaiRes.json();
    if (!xaiRes.ok) {
      return json(
        {
          error: "Grok API error",
          status: xaiRes.status,
          detail: xaiJson?.error?.message ?? xaiJson,
        },
        502
      );
    }

    const content =
      xaiJson?.choices?.[0]?.message?.content ??
      xaiJson?.output_text ??
      "";

    return json({
      content,
      model: xaiJson?.model ?? payload.model,
      usage: xaiJson?.usage ?? null,
      user_id: user.id,
    });
  } catch (err) {
    return json({ error: (err as Error).message ?? "Unknown error" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
