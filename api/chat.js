export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  try {
    const { message } = req.body
    if (!message) {
      return res.status(400).json({ error: 'Message is required' })
    }

    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      return res.status(500).json({ error: 'GEMINI_API_KEY is missing. Set it in Vercel environment variables.' })
    }

    if (typeof fetch !== 'function') {
      return res.status(500).json({ error: 'Server runtime lacks fetch (Node 18+ required).' })
    }

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 30000)

    const apiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [{ text: message }]
        }]
      }),
      signal: controller.signal
    }).finally(() => clearTimeout(timeout))

    if (!apiResponse.ok) {
      const errText = await apiResponse.text().catch(() => '')
      return res.status(apiResponse.status).json({ error: `Gemini API error ${apiResponse.status}: ${errText}` })
    }

    const data = await apiResponse.json()
    const reply = data?.candidates?.[0]?.content?.parts?.[0]?.text
    if (typeof reply === 'string' && reply.length) {
      res.json({ reply })
    } else {
      return res.status(502).json({ error: 'Invalid Gemini API response structure' })
    }
  } catch (error) {
    console.error('Error calling Gemini API:', error)
    const err = (error && typeof error === 'object') ? error : {}
    const name = err.name || 'Error'
    const code = err.code
    const message = err.message || String(error)
    const isAbort = name === 'AbortError'
    return res.status(500).json({ error: 'Failed to get response from AI', details: { name, code, message, isAbort } })
  }
}