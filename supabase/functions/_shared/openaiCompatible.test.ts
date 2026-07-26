import { describe, expect, it } from "vitest";
import {
  buildChatCompletionBody,
  chatCompletionsUrl,
  parseChatCompletion,
  stripReasoning,
} from "./openaiCompatible";

describe("chatCompletionsUrl", () => {
  it("appends the path to a bare base URL", () => {
    expect(chatCompletionsUrl("https://api.groq.com/openai/v1")).toBe(
      "https://api.groq.com/openai/v1/chat/completions"
    );
  });

  it("tolerates a trailing slash", () => {
    expect(chatCompletionsUrl("https://api.together.xyz/v1/")).toBe(
      "https://api.together.xyz/v1/chat/completions"
    );
  });

  it("accepts a full endpoint without doubling the path", () => {
    expect(chatCompletionsUrl("https://openrouter.ai/api/v1/chat/completions")).toBe(
      "https://openrouter.ai/api/v1/chat/completions"
    );
  });

  it("rejects an empty base URL rather than building a relative path", () => {
    expect(() => chatCompletionsUrl("   ")).toThrow(/AI_BASE_URL/);
  });
});

describe("buildChatCompletionBody", () => {
  it("puts system and prompt in the right roles and never streams", () => {
    const body = buildChatCompletionBody({
      model: "some-open-model",
      system: "be brief",
      prompt: "rewrite this",
      maxTokens: 280,
    });
    expect(body.model).toBe("some-open-model");
    expect(body.messages).toEqual([
      { role: "system", content: "be brief" },
      { role: "user", content: "rewrite this" },
    ]);
    expect(body.max_tokens).toBe(280);
    expect(body.stream).toBe(false);
    // Open hosts do accept sampling params, unlike Opus 5.
    expect(body.temperature).toBe(0.3);
  });

  it("honours an explicit temperature", () => {
    expect(
      buildChatCompletionBody({
        model: "m",
        system: "",
        prompt: "p",
        maxTokens: 10,
        temperature: 0,
      }).temperature
    ).toBe(0);
  });
});

describe("stripReasoning", () => {
  it("removes a closed think block", () => {
    expect(stripReasoning("<think>weighing options</think>Ship the staged beta.")).toBe(
      "Ship the staged beta."
    );
  });

  it("removes multiple blocks and trims", () => {
    expect(stripReasoning("<think>a</think> One. <think>b</think> Two. ")).toBe("One.  Two.");
  });

  it("drops an unterminated block — the model ran out of budget mid-thought", () => {
    expect(stripReasoning("Ship it.<think>but what if the runway")).toBe("Ship it.");
  });

  it("leaves ordinary prose untouched", () => {
    expect(stripReasoning("  Ship the staged beta.  ")).toBe("Ship the staged beta.");
  });
});

describe("parseChatCompletion", () => {
  const ok = {
    model: "llama-3.3-70b-versatile",
    choices: [
      { index: 0, message: { role: "assistant", content: " Ship it. " }, finish_reason: "stop" },
    ],
    usage: { prompt_tokens: 356, completion_tokens: 118 },
  };

  it("maps a normal completion", () => {
    const r = parseChatCompletion(ok, "fallback");
    expect(r.text).toBe("Ship it.");
    expect(r.model).toBe("llama-3.3-70b-versatile");
    expect(r.promptTokens).toBe(356);
    expect(r.completionTokens).toBe(118);
    expect(r.finishReason).toBe("stop");
  });

  it("strips reasoning from the content", () => {
    const r = parseChatCompletion(
      { ...ok, choices: [{ message: { content: "<think>hmm</think>Ship it." } }] },
      "fallback"
    );
    expect(r.text).toBe("Ship it.");
  });

  it("returns empty text when content is null, without throwing", () => {
    // A reasoning model that spent its whole budget thinking, or a
    // refusal. Empty text is the engine's fail-open signal.
    const r = parseChatCompletion(
      { ...ok, choices: [{ message: { content: null, reasoning_content: "..." } }] },
      "fallback"
    );
    expect(r.text).toBe("");
  });

  it("returns empty text when there are no choices at all", () => {
    expect(parseChatCompletion({ model: "m", choices: [] }, "fallback").text).toBe("");
  });

  it("throws on an error object returned inside a 200", () => {
    expect(() =>
      parseChatCompletion({ error: { message: "rate limit exceeded" } }, "fallback")
    ).toThrow(/rate limit exceeded/);
  });

  it("throws on a non-object body", () => {
    expect(() => parseChatCompletion("nope", "fallback")).toThrow(/non-object/);
  });

  it("falls back to the requested model when the response omits one", () => {
    expect(parseChatCompletion({ choices: [] }, "requested-model").model).toBe("requested-model");
  });

  it("treats missing or malformed usage as zero rather than NaN", () => {
    const r = parseChatCompletion({ choices: [], usage: { prompt_tokens: "12" } }, "m");
    expect(r.promptTokens).toBe(0);
    expect(r.completionTokens).toBe(0);
  });
});
