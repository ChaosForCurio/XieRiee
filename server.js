import express from 'express'
import dotenv from 'dotenv'
import cors from 'cors'
import { existsSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

dotenv.config({ path: join(__dirname, '.env') })

const app = express()
const port = process.env.PORT || 3001
const clientDir = join(__dirname, 'dist')
const indexHtmlPath = join(clientDir, 'index.html')
const hasClientBuild = existsSync(indexHtmlPath)

app.use(cors())
app.use(express.json())

app.post('/api/chat', async (req, res) => {
  try {
    const { message } = req.body
    if (!message) {
      return res.status(400).json({ error: 'Message is required' })
    }

    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      return res.status(500).json({ error: 'GEMINI_API_KEY is missing. Put it in xieriee/.env or set env before starting the server.' })
    }

    if (typeof fetch !== 'function') {
      return res.status(500).json({ error: 'Server runtime lacks fetch (Node 18+ required). Please upgrade Node and restart the server.' })
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
})

// Simple health endpoint to help diagnose environment/network
app.get('/api/health', async (req, res) => {
  const hasFetch = typeof fetch === 'function'
  const hasKey = !!process.env.GEMINI_API_KEY
  let connectivity = null
  if (hasFetch) {
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 5000)
      const r = await fetch('https://generativelanguage.googleapis.com', { method: 'HEAD', signal: controller.signal })
      clearTimeout(timeout)
      connectivity = { ok: true, status: r.status }
    } catch (e) {
      connectivity = { ok: false, name: e?.name, code: e?.code, message: e?.message }
    }
  }
  res.json({ ok: true, node: process.version, hasFetch, hasKey, connectivity })
})

if (hasClientBuild) {
  app.use(express.static(clientDir))
  app.get('/*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next()
    res.sendFile(indexHtmlPath)
  })
}

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`)
})
