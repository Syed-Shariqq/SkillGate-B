const GEMINI_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent'
const GROK_URL = 'https://api.x.ai/v1/chat/completions'

function getGeminiText(payload) {
  const text = payload?.candidates?.[0]?.content?.parts
    ?.map((part) => part?.text)
    .filter((partText) => typeof partText === 'string')
    .join('')

  if (!text) {
    throw new Error('Gemini returned no text')
  }

  return text
}

function getGrokText(payload) {
  const text = payload?.choices?.[0]?.message?.content

  if (typeof text !== 'string' || text.length === 0) {
    throw new Error('Grok returned no text')
  }

  return text
}

export async function callGemini(prompt, maxTokens) {
  const apiKey = Deno.env.get('GEMINI_API_KEY')

  if (!apiKey) {
    throw new Error('Missing GEMINI_API_KEY')
  }

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 8000)

  try {
    const response = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [{ text: prompt }],
          },
        ],
        generationConfig: {
          maxOutputTokens: maxTokens,
        },
      }),
      signal: controller.signal,
    })

    if (!response.ok) {
      throw new Error(`Gemini request failed: ${response.status}`)
    }

    return getGeminiText(await response.json())
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw new Error('Gemini request timed out')
    }

    throw error
  } finally {
    clearTimeout(timeoutId)
  }
}

export async function callGrok(prompt, maxTokens) {
  const apiKey = Deno.env.get('GROK_API_KEY')

  if (!apiKey) {
    throw new Error('Missing GROK_API_KEY')
  }

  const response = await fetch(GROK_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'grok-2-latest',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: maxTokens,
    }),
  })

  if (!response.ok) {
    throw new Error(`Grok request failed: ${response.status}`)
  }

  return getGrokText(await response.json())
}

export async function callAI(prompt, maxTokens) {
  try {
    const text = await callGemini(prompt, maxTokens)
    console.log('[ai] provider used: gemini')
    return { data: text, error: null }
  } catch (_geminiError) {
    try {
      const text = await callGrok(prompt, maxTokens)
      console.log('[ai] provider used: grok')
      return { data: text, error: null }
    } catch (_grokError) {
      return {
        data: null,
        error: { type: 'AI_UNAVAILABLE', message: 'All providers failed' },
      }
    }
  }
}

export function parseJSON(text) {
  try {
    const cleaned = String(text)
      .trim()
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim()

    return { data: JSON.parse(cleaned), error: null }
  } catch (_error) {
    return {
      data: null,
      error: { type: 'PARSE_ERROR', message: 'Invalid JSON' },
    }
  }
}

export function normalizeAIResponse(raw) {
  try {
    if (!raw || !Array.isArray(raw.questions) || raw.questions.length < 1) {
      return {
        data: null,
        error: {
          type: 'PARSE_ERROR',
          message: 'Invalid response structure',
        },
      }
    }

    return { data: { questions: raw.questions }, error: null }
  } catch (_error) {
    return {
      data: null,
      error: {
        type: 'PARSE_ERROR',
        message: 'Invalid response structure',
      },
    }
  }
}
