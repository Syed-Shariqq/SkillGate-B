const GEMINI_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

function getGeminiText(payload) {
  const text = payload?.candidates?.[0]?.content?.parts
    ?.map((part) => part?.text)
    .filter((partText) => typeof partText === "string")
    .join("");

  if (!text) {
    throw new Error("Gemini returned no text");
  }

  return text;
}

function getGroqText(payload) {
  const text = payload?.choices?.[0]?.message?.content;

  if (typeof text !== "string" || text.length === 0) {
    throw new Error("GROQ returned no text");
  }

  return text;
}

export async function callGemini(prompt, maxTokens) {
  const apiKey = Deno.env.get("GEMINI_API_KEY");

  if (!apiKey) {
    throw new Error("Missing GEMINI_API_KEY");
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 40000);

  try {
    const response = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [{ text: prompt }],
          },
        ],
        generationConfig: {
          maxOutputTokens: maxTokens,
        },
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errBody = await response.text();
      console.error("[ai] Gemini HTTP error", response.status, errBody);
      throw new Error(`Gemini request failed: ${response.status}`);
    }

    const result = getGeminiText(await response.json());
    return result;
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new Error("Gemini request timed out");
    }

    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function callGroq(prompt, maxTokens) {
  const apiKey = Deno.env.get("GROQ_API_KEY");

  if (!apiKey) {
    throw new Error("Missing GROQ_API_KEY");
  }

  const response = await fetch(GROQ_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      messages: [{ role: "user", content: prompt }],
      max_tokens: maxTokens,
      response_format: { type: "json_object" },
    }),
  });

  if (!response.ok) {
    const errBody = await response.text();
    console.error("[ai] GROQ HTTP error", response.status, errBody);
    throw new Error(`GROQ request failed: ${response.status}`);
  }

  return getGroqText(await response.json());
}

export async function callAI(prompt, maxTokens) {
  try {
    const text = await callGemini(prompt, maxTokens);
    console.log("[ai] provider used: gemini");
    return { data: text, error: null };
  } catch (geminiError) {
    console.error("[ai] Gemini failed", geminiError.message);
    try {
      const text = await callGroq(prompt, maxTokens);
      console.log("[ai] groq raw response:", text.slice(0, 300));
      console.log("[ai] provider used: groq");
      return { data: text, error: null };
    } catch (groqError) {
      console.error("[ai] GROQ failed", groqError.message);
      return {
        data: null,
        error: { type: "AI_UNAVAILABLE", message: "All providers failed" },
      };
    }
  }
}

export function parseJSON(text) {
  const raw = String(text).trim();

  try {
    return { data: JSON.parse(raw), error: null };
  } catch (_) { }

  const stripped = raw
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  try {
    return { data: JSON.parse(stripped), error: null };
  } catch (_) { }

  const match = raw.match(/\{[\s\S]*\}/);
  if (match) {
    try {
      return { data: JSON.parse(match[0]), error: null };
    } catch (_) { }
  }

  return {
    data: null,
    error: { type: "PARSE_ERROR", message: "Invalid JSON" },
  };
}

export function normalizeAIResponse(raw) {
  try {
    if (!raw || !Array.isArray(raw.questions) || raw.questions.length < 1) {
      return {
        data: null,
        error: {
          type: "PARSE_ERROR",
          message: "Invalid response structure",
        },
      };
    }

    return { data: { questions: raw.questions }, error: null };
  } catch (_error) {
    return {
      data: null,
      error: {
        type: "PARSE_ERROR",
        message: "Invalid response structure",
      },
    };
  }
}
