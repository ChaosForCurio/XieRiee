import { useEffect, useMemo, useRef, useState } from 'react'
import { Avatar } from '@mui/material'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism'
import './App.css'

type Message = {
  id: string
  role: 'user' | 'assistant'
  content: string
  createdAt: string
  typing?: boolean
  justAdded?: boolean
}

type ImportMetaWithEnv = { env?: Record<string, string | undefined> }

const timeFormatter = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' })

const parseMessageDate = (value: string) => {
  const time = Date.parse(value)
  return Number.isNaN(time) ? new Date() : new Date(time)
}

const isSameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()

const formatDateGroupLabel = (date: Date) => {
  const today = new Date()
  if (isSameDay(date, today)) return 'Today'
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)
  if (isSameDay(date, yesterday)) return 'Yesterday'
  const options: Intl.DateTimeFormatOptions = { weekday: 'long', month: 'long', day: 'numeric' }
  if (date.getFullYear() !== today.getFullYear()) options.year = 'numeric'
  return new Intl.DateTimeFormat(undefined, options).format(date)
}

const formatMessageTime = (value: string) => timeFormatter.format(parseMessageDate(value))

const getAuthorLabel = (role: Message['role']) => (role === 'assistant' ? 'Gemini' : '[You 🧑]')


function App() {
  const [messages, setMessages] = useState<Message[]>(() => {
    try {
      const stored = localStorage.getItem('chatMessages')
      if (!stored) return []
      const parsed = JSON.parse(stored) as Array<Partial<Message>>
      return parsed.map((m) => ({
        id: m?.id || crypto.randomUUID(),
        role: m?.role === 'assistant' ? 'assistant' : 'user',
        content: typeof m?.content === 'string' ? m.content : '',
        createdAt: typeof m?.createdAt === 'string' ? m.createdAt : new Date().toISOString(),
        typing: m?.typing,
        justAdded: m?.justAdded,
      }))
    } catch {
      return []
    }
  })
  const [input, setInput] = useState('')
  const [userName] = useState('Ui Mahadi')
  const [isLoading, setIsLoading] = useState(false)

  // UI state
  const [railOpen, setRailOpen] = useState(true)
  const [profilePicture, setProfilePicture] = useState<string | null>(() => {
    try {
      return localStorage.getItem('profilePicture') || null
    } catch {
      return null
    }
  })
  const [showProfileModal, setShowProfileModal] = useState(false)
  const [showPrivacyModal, setShowPrivacyModal] = useState(false)
  const [imageUrlInput, setImageUrlInput] = useState('')
  const isLanding = useMemo(() => messages.length === 0, [messages.length])

  // On small screens, start with rail closed
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 900px)')
    if (mq.matches) setRailOpen(false)
  }, [])

  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const messagesEndRef = useRef<HTMLDivElement | null>(null)

  const groupedMessages = useMemo(() => {
    if (messages.length === 0) return []
    const sorted = [...messages].sort((a, b) => parseMessageDate(a.createdAt).getTime() - parseMessageDate(b.createdAt).getTime())
    return sorted.reduce<Array<{ key: string; label: string; items: Message[] }>>((acc, message) => {
      const dateObj = parseMessageDate(message.createdAt)
      const dateKey = dateObj.toDateString()
      const lastGroup = acc[acc.length - 1]
      if (!lastGroup || lastGroup.key !== dateKey) {
        acc.push({ key: dateKey, label: formatDateGroupLabel(dateObj), items: [message] })
      } else {
        lastGroup.items.push(message)
      }
      return acc
    }, [])
  }, [messages])

  useEffect(() => {
    const ta = textareaRef.current
    if (!ta) return
    ta.style.height = 'auto'
    ta.style.height = Math.min(160, ta.scrollHeight) + 'px'
  }, [input])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    try {
      if (profilePicture) {
        localStorage.setItem('profilePicture', profilePicture)
      } else {
        localStorage.removeItem('profilePicture')
      }
    } catch (error) {
      console.warn('Failed to save profile picture to localStorage:', error)
    }
  }, [profilePicture])

  useEffect(() => {
    try {
      localStorage.setItem('chatMessages', JSON.stringify(messages))
    } catch (error) {
      console.warn('Failed to save chat messages to localStorage:', error)
    }
  }, [messages])

  const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms))

  const typeOutMessage = async (msgId: string, fullText: string) => {
    const perChar = 14 // ms per character
    const newlinePause = 260 // extra pause at line breaks
    const batch = 2 // update every N chars to reduce re-renders

    let out = ''
    let firstFlush = true
    for (let i = 0; i < fullText.length; i++) {
      out += fullText[i]
      const isNewline = fullText[i] === '\n'
      const shouldFlush = isNewline || i % batch === 0 || i === fullText.length - 1
      if (shouldFlush) {
        setMessages((prev) => prev.map((m) => {
          if (m.id !== msgId) return m
          return { ...m, content: out, justAdded: firstFlush ? true : m.justAdded }
        }))
        // turn off justAdded after the very first flush so blur animation runs once
        if (firstFlush) {
          firstFlush = false
          // allow the browser to paint the blur-in frame before continuing
          await sleep(60)
        }
        await sleep(isNewline ? newlinePause : perChar)
      }
    }
    // finish typing
    setMessages((prev) => prev.map((m) => (m.id === msgId ? { ...m, typing: false, justAdded: false } : m)))
  }

  const sendMessage = async () => {
    const text = input.trim()
    if (!text || isLoading) return
    const userMsg: Message = { id: crypto.randomUUID(), role: 'user', content: text, createdAt: new Date().toISOString() }
    setMessages((prev) => [...prev, userMsg])
    setInput('')
    setIsLoading(true)
    let resolvedUrl = ''
    try {
      const configuredUrl = (import.meta as ImportMetaWithEnv).env?.VITE_API_URL
      const url = configuredUrl && configuredUrl.trim() !== '' ? configuredUrl : '/api/chat'
      resolvedUrl = url
      if (typeof console !== 'undefined' && typeof console.info === 'function') {
        console.info('Chat API URL:', resolvedUrl)
      }

      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 20000) // 20s timeout

      const apiResponse = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message: text }),
        signal: controller.signal,
      }).finally(() => clearTimeout(timeoutId))

      if (!apiResponse.ok) {
        let detail = ''
        try {
          const ct = apiResponse.headers.get('Content-Type') || ''
          if (ct.includes('application/json')) {
            const maybeJson = await apiResponse.json()
            detail = (maybeJson && (maybeJson.error || maybeJson.message)) || JSON.stringify(maybeJson)
          } else {
            detail = await apiResponse.text()
          }
        } catch {
          // ignore detail parse errors
        }
        throw new Error(`Backend error ${apiResponse.status}${detail ? ': ' + detail : ''}`)
      }

      const data = await apiResponse.json()
      const replyText: string = data?.reply || ''

      // Add an assistant message and progressively type it out
      const msgId = crypto.randomUUID()
      const initial: Message = { id: msgId, role: 'assistant', content: '', createdAt: new Date().toISOString(), typing: true, justAdded: true }
      setMessages((prev) => [...prev, initial])

      // Start streaming typing effect
      await typeOutMessage(msgId, replyText)
    } catch (error) {
      console.error('Error calling backend API:', error)
      let msg = 'Unknown error'
      let errorName: string | undefined
      let errorMessage: string | undefined
      if (typeof error === 'object' && error !== null) {
        const potentialName = (error as { name?: unknown }).name
        if (typeof potentialName === 'string') errorName = potentialName
        const potentialMessage = (error as { message?: unknown }).message
        if (typeof potentialMessage === 'string') errorMessage = potentialMessage
      } else if (typeof error === 'string') {
        errorMessage = error
      }
      if (errorName === 'AbortError') {
        msg = 'Request timed out. Please try again.'
      } else if (errorMessage) {
        if (errorMessage.includes('Failed to fetch')) {
          msg = 'Failed to reach the server. Check your internet connection or that the API is running.'
        } else if (errorMessage.includes('Backend error 404')) {
          msg = `Endpoint not found (404) at ${resolvedUrl}. Verify that your backend exposes this path and method (POST) or set VITE_API_URL to the correct endpoint.`
        } else {
          msg = errorMessage
        }
      }
      const errorReply: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: `Sorry, I encountered an error. ${msg}`,
        createdAt: new Date().toISOString(),
      }
      setMessages((prev) => [...prev, errorReply])
    } finally {
      setIsLoading(false)
    }
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const newChat = () => {
    setMessages([])
    setInput('')
  }

  const openSettings = () => alert('Settings coming soon')
  const signOut = () => alert('Signed out (placeholder)')


  const handleProfileClick = () => setShowProfileModal(true)

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (e) => {
        setProfilePicture(e.target?.result as string)
        setShowProfileModal(false)
      }
      reader.readAsDataURL(file)
    }
  }

  const handleUrlSubmit = () => {
    if (imageUrlInput.trim()) {
      setProfilePicture(imageUrlInput.trim())
      setImageUrlInput('')
      setShowProfileModal(false)
    }
  }

  const handleRemovePicture = () => {
    setProfilePicture(null)
    setShowProfileModal(false)
  }

  const openPrivacy = () => setShowPrivacyModal(true)
  const closePrivacy = () => setShowPrivacyModal(false)
  const clearChatHistory = () => {
    try {
      localStorage.removeItem('chatMessages')
    } catch (e) {
      console.warn('Failed to clear chat history from localStorage:', e)
    }
    setMessages([])
    setShowPrivacyModal(false)
  }

  return (
    <div className={`app-root${railOpen ? '' : ' rail-closed'}`}>
      {/* Left sidebar */}
      <aside className="left-sidebar">
        <div className="ls-top">
          <button
            className="ls-toggle"
            aria-label={railOpen ? 'Close sidebar' : 'Open sidebar'}
            data-tip={railOpen ? 'Close sidebar' : 'Open sidebar'}
            onClick={() => setRailOpen((v) => !v)}
          >
            {railOpen ? '‹' : '›'}
          </button>

          <div className="profile" data-tip="Click to change profile picture" onClick={handleProfileClick} style={{ cursor: 'pointer' }}>
            <Avatar
              src={profilePicture || undefined}
              sx={{
                width: 40,
                height: 40,
                bgcolor: profilePicture ? 'transparent' : 'linear-gradient(135deg,#475569,#0ea5e9)',
                border: '2px solid var(--panel)',
                fontWeight: 800,
                fontSize: '14px'
              }}
            >
              {!profilePicture && 'UM'}
            </Avatar>
            <div className="user-meta">
              <div className="name">{userName}</div>
              <div className="role">Free plan</div>
            </div>
          </div>

          <button className="new-chat" data-tip="New" onClick={newChat}>
            <span className="ic">＋</span>
            <span className="label">New chat</span>
          </button>

          <div className="history">
            <div className="hist-title">Your chats</div>
          </div>
        </div>

        <div className="ls-bottom">
          <button className="privacy" data-tip="Privacy" onClick={openPrivacy}>
            <span className="label">Privacy</span>
            <span className="ic">🔒</span>
          </button>
          <button className="settings" data-tip="Settings" onClick={openSettings}>
            <span className="label">Settings</span>
            <span className="ic">⚙</span>
          </button>
          <button className="signout" data-tip="Sign out" onClick={signOut}>
            <span className="label">Sign out</span>
            <span className="ic">⎋</span>
          </button>
        </div>
      </aside>

      {/* Main content area */}
      <main className="main">
        {isLanding ? (
          <section className="landing">
            <h1 className="hero">Hi there, {userName.split(' ')[0]}<br />What would like to know?</h1>



            <div className="composer">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder="Ask whatever you want…"
                rows={1}
              />
              <div className="composer-bar">
                <div className="left">
                  <button className="pill" onClick={() => alert('Web search mode')}>All Web ▾</button>
                </div>
                <div className="right">
                  <span className="counter">0/1000</span>
                  <button className="send" aria-label="Send" onClick={sendMessage} disabled={isLoading}>➤</button>
                </div>
              </div>
            </div>
          </section>
        ) : (
          <section className="chat">
            <div className="messages">
              {groupedMessages.map((group) => (
                <div key={group.key} className="message-group">
                  <div className="date-header">{group.label}</div>
                  {group.items.map((m) => (
                    <div key={m.id} className={`message ${m.role}`}>
                      {m.role === 'assistant' && (
                        <Avatar
                          src="https://miro.medium.com/1*-xb7cKgxlETNml550rqvYA.jpeg"
                          sx={{
                            width: 32,
                            height: 32,
                            bgcolor: 'transparent',
                            border: '1px solid var(--panel)',
                          }}
                          alt="Gemini AI"
                        />
                      )}
                      <div className={`bubble${m.role === 'assistant' && (m.typing || m.justAdded) ? ' blur-reveal' : ''}${m.role === 'assistant' && m.typing ? ' typing' : ''}`}>
                        <div className="message-meta">
                          <span className="author">{getAuthorLabel(m.role)}</span>
                          <time className="timestamp" dateTime={m.createdAt}>{formatMessageTime(m.createdAt)}</time>
                        </div>
                        {m.role === 'assistant' ? (
                          <ReactMarkdown
                            remarkPlugins={[remarkGfm]}
                            components={{
                              // eslint-disable-next-line @typescript-eslint/no-explicit-any
                              code(props: any) {
                                const { className, children, ...rest } = props
                                const match = /language-(\w+)/.exec(className || '')
                                const isInline = !match
                                return !isInline ? (
                                  <SyntaxHighlighter
                                    style={oneDark}
                                    language={match[1]}
                                    PreTag="div"
                                  >
                                    {String(children).replace(/\n$/, '')}
                                  </SyntaxHighlighter>
                                ) : (
                                  <code className={className} {...rest}>
                                    {children}
                                  </code>
                                )
                              },
                            }}
                          >
                            {m.content}
                          </ReactMarkdown>
                        ) : (
                          <div className="message-text">{m.content}</div>
                        )}
                      </div>
                      {m.role === 'user' && (
                        <Avatar
                          src={profilePicture || undefined}
                          sx={{
                            width: 32,
                            height: 32,
                            bgcolor: profilePicture ? 'transparent' : 'linear-gradient(135deg,#475569,#0ea5e9)',
                            border: '1px solid var(--panel)',
                            fontWeight: 800,
                            fontSize: '12px'
                          }}
                        >
                          {!profilePicture && 'UM'}
                        </Avatar>
                      )}
                    </div>
                  ))}
                </div>
              ))}
              {isLoading && (
                <div className="message assistant">
                  <div className="bubble">Thinking...</div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            <div className="composer sticky">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder="Type your message…"
                rows={1}
              />
              <div className="composer-bar">
                <div className="left">
                  <button className="pill" onClick={() => alert('Web search mode')}>All Web ▾</button>
                </div>
                <div className="right">
                  <span className="counter">{Math.min(1000, input.length)}/1000</span>
                  <button className="send" aria-label="Send" onClick={sendMessage} disabled={isLoading}>➤</button>
                </div>
              </div>
            </div>
          </section>
        )}
      </main>

      {/* Profile Picture Modal */}
      {showProfileModal && (
        <div className="modal-overlay" onClick={() => setShowProfileModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>Change Profile Picture</h3>

            <div className="modal-section">
              <h4>Upload from Computer</h4>
              <input
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                style={{ marginBottom: '10px' }}
              />
            </div>

            <div className="modal-section">
              <h4>Or Paste Image URL</h4>
              <input
                type="url"
                placeholder="https://example.com/image.jpg"
                value={imageUrlInput}
                onChange={(e) => setImageUrlInput(e.target.value)}
                style={{ width: '100%', padding: '8px', marginBottom: '10px' }}
              />
              <button onClick={handleUrlSubmit} style={{ padding: '8px 16px', background: 'var(--accent)', color: 'white', border: 'none', borderRadius: '6px' }}>
                Set URL
              </button>
            </div>

            {profilePicture && (
              <div className="modal-section">
                <button onClick={handleRemovePicture} style={{ padding: '8px 16px', background: '#dc3545', color: 'white', border: 'none', borderRadius: '6px' }}>
                  Remove Picture
                </button>
              </div>
            )}

            <button onClick={() => setShowProfileModal(false)} style={{ marginTop: '20px', padding: '8px 16px', background: 'transparent', border: '1px solid var(--border)', borderRadius: '6px' }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Privacy Modal */}
      {showPrivacyModal && (
        <div className="modal-overlay" onClick={closePrivacy}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>Privacy</h3>
            <div className="modal-section">
            </div>
            <div className="modal-section">
              <h4>Clear chat history</h4>
              <p>This removes only your conversation messages and does not affect other site data.</p>
              <button onClick={clearChatHistory} style={{ padding: '8px 16px', background: '#dc3545', color: 'white', border: 'none', borderRadius: '6px' }}>
                Clear Chat History
              </button>
            </div>
            <button onClick={closePrivacy} style={{ marginTop: '20px', padding: '8px 16px', background: 'transparent', border: '1px solid var(--border)', borderRadius: '6px' }}>
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
