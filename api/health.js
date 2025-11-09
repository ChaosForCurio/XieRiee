export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

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
}