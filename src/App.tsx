import React, { useEffect, useMemo, useRef, useState, type RefObject } from 'react'
import { Avatar } from '@mui/material'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { createClient } from '@insforge/sdk'
import { TransitionGroup } from 'react-transition-group'
import { Collapse } from '@mui/material'
import './App.css'

type Message = {
  id: string
  role: 'user' | 'assistant'
  content: string
  createdAt: string
  typing?: boolean
  justAdded?: boolean
}

type Chat = {
  id: string
  title: string
  messages: Message[]
  createdAt: string
  updatedAt: string
}

type ImportMetaWithEnv = { env?: Record<string, string | undefined> }

type User = {
  id: string;
  email: string;
  name?: string;
  emailVerified: boolean;
  createdAt: string;
  updatedAt: string;
}

type OAuthProvider = 'google' | 'github' | 'linkedin'

type ProviderConfig = {
  provider: OAuthProvider
  label: string
  Icon: () => React.ReactElement
}

type ComposerProps = {
  value: string
  onChange: (value: string) => void
  onSend: () => void
  onKeyDown: (event: React.KeyboardEvent<HTMLTextAreaElement>) => void
  isLoading: boolean
  textareaRef: RefObject<HTMLTextAreaElement | null>
  placeholder: string
  onModeClick: () => void
  isSticky?: boolean
}

const GoogleLogo = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
  </svg>
)

const GitHubLogo = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
  </svg>
)

const LinkedInLogo = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="#0077B5" xmlns="http://www.w3.org/2000/svg">
    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
  </svg>
)

const providerConfigs: ProviderConfig[] = [
  { provider: 'google', label: 'Google', Icon: GoogleLogo },
  { provider: 'github', label: 'GitHub', Icon: GitHubLogo },
  { provider: 'linkedin', label: 'LinkedIn', Icon: LinkedInLogo },
]

const Composer = ({
  value,
  onChange,
  onSend,
  onKeyDown,
  isLoading,
  textareaRef,
  placeholder,
  onModeClick,
  isSticky = false,
}: ComposerProps) => (
  <div className={`composer${isSticky ? ' sticky' : ''}`}>
    <textarea
      ref={textareaRef}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={onKeyDown}
      placeholder={placeholder}
      rows={1}
    />
    <div className="composer-bar">
      <div className="left">
        <button className="pill" onClick={onModeClick}>Web Search</button>
      </div>
      <div className="right">
        <span className="counter">{Math.min(1000, value.length)}/1000</span>
        <button className="send" aria-label="Send" onClick={onSend} disabled={isLoading}>➤</button>
      </div>
    </div>
  </div>
)

const insforge = createClient({
  baseUrl: 'https://k4viciqy.us-east.insforge.app',
  anonKey: 'ik_6eeeb45d61f3f4ea8d0dac9a979e04e0'
});

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

const formatChatUpdatedAt = (value: string) => {
  const date = parseMessageDate(value)
  const now = new Date()
  if (isSameDay(date, now)) {
    return timeFormatter.format(date)
  }
  const options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' }
  if (date.getFullYear() !== now.getFullYear()) options.year = 'numeric'
  return new Intl.DateTimeFormat(undefined, options).format(date)
}

const getAuthorLabel = (role: Message['role'], userName?: string) => (role === 'assistant' ? 'Gemini' : (userName || 'You'))


function App() {
  const [chats, setChats] = useState<Chat[]>(() => {
    try {
      const stored = localStorage.getItem('chatSessions')
      if (stored) {
        const parsed = JSON.parse(stored) as Array<Partial<Chat>>
        const chats: Chat[] = parsed.map((chat) => ({
          id: chat?.id || crypto.randomUUID(),
          title: chat?.title || 'New Chat',
          messages: (chat?.messages || []).map((m) => ({
            id: m?.id || crypto.randomUUID(),
            role: (m?.role === 'assistant' ? 'assistant' : 'user') as Message['role'],
            content: typeof m?.content === 'string' ? m.content : '',
            createdAt: typeof m?.createdAt === 'string' ? m.createdAt : new Date().toISOString(),
            typing: m?.typing,
            justAdded: m?.justAdded,
          })),
          createdAt: chat?.createdAt || new Date().toISOString(),
          updatedAt: chat?.updatedAt || new Date().toISOString(),
        }))
        // Ensure at least one chat exists
        if (chats.length > 0) {
          return chats
        }
      }

      // Migrate from old single chat format
      const oldMessages = localStorage.getItem('chatMessages')
      if (oldMessages) {
        const parsed = JSON.parse(oldMessages) as Array<Partial<Message>>
        const messages = parsed.map((m) => ({
          id: m?.id || crypto.randomUUID(),
          role: (m?.role === 'assistant' ? 'assistant' : 'user') as Message['role'],
          content: typeof m?.content === 'string' ? m.content : '',
          createdAt: typeof m?.createdAt === 'string' ? m.createdAt : new Date().toISOString(),
          typing: m?.typing,
          justAdded: m?.justAdded,
        }))
        const now = new Date().toISOString()
        const defaultChat: Chat = {
          id: crypto.randomUUID(),
          title: 'Chat',
          messages,
          createdAt: now,
          updatedAt: now,
        }
        return [defaultChat]
      }

      // Create a default chat if no chats exist
      const now = new Date().toISOString()
      const defaultChat: Chat = {
        id: crypto.randomUUID(),
        title: 'New Chat',
        messages: [],
        createdAt: now,
        updatedAt: now,
      }
      return [defaultChat]
    } catch {
      // Create a default chat on error
      const now = new Date().toISOString()
      const defaultChat: Chat = {
        id: crypto.randomUUID(),
        title: 'New Chat',
        messages: [],
        createdAt: now,
        updatedAt: now,
      }
      return [defaultChat]
    }
  })

  const [currentChatId, setCurrentChatId] = useState<string>(() => {
    try {
      const stored = localStorage.getItem('currentChatId')
      return stored || ''
    } catch {
      return ''
    }
  })
  const [input, setInput] = useState('')
  const [user, setUser] = useState<User | null>(null)

  // Handle input change with word limit
  const handleInputChange = (value: string) => {
    const wordCount = value.trim().split(/\s+/).filter(word => word.length > 0).length
    if (wordCount <= 1000) {
      setInput(value)
    }
    // If over limit, don't update the input
  }
  const [isLoading, setIsLoading] = useState(false)
  const [loadingProvider, setLoadingProvider] = useState<OAuthProvider | null>(null)
  const [authError, setAuthError] = useState<string | null>(null)

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

  // Computed values
  const currentChat = useMemo(() => {
    return chats.find(chat => chat.id === currentChatId) || null
  }, [chats, currentChatId])

  const messages = useMemo(() => {
    return currentChat?.messages || []
  }, [currentChat])

  const isLanding = useMemo(() => messages.length === 0, [messages.length])

  // On small screens, start with rail closed
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 900px)')
    if (mq.matches) setRailOpen(false)
  }, [])

  // Initialize current chat
  useEffect(() => {
    if (!currentChatId && chats.length > 0) {
      setCurrentChatId(chats[0].id)
    }
  }, [currentChatId, chats])

  const textareaRef = useRef<HTMLTextAreaElement>(null)
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
      localStorage.setItem('chatSessions', JSON.stringify(chats))
    } catch (error) {
      console.warn('Failed to save chat sessions to localStorage:', error)
    }
  }, [chats])

  useEffect(() => {
    try {
      if (currentChatId) {
        localStorage.setItem('currentChatId', currentChatId)
      } else {
        localStorage.removeItem('currentChatId')
      }
    } catch (error) {
      console.warn('Failed to save current chat ID to localStorage:', error)
    }
  }, [currentChatId])

  useEffect(() => {
    const getSession = async () => {
      const { data } = await insforge.auth.getCurrentSession()
      if (data?.session) {
        setUser(data.session.user)
        setAuthError(null) // Clear any errors if user is authenticated
      }
    }
    getSession()
  }, [])

  // Check for OAuth callback on page load
  useEffect(() => {
    const checkAuthCallback = async () => {
      try {
        const { data } = await insforge.auth.getCurrentSession()
        if (data?.session) {
          console.log('Found session from OAuth callback:', data.session.user.email)
          setUser(data.session.user)
          setAuthError(null) // Clear any errors if sign up is complete
          // Clean up URL hash/search params after successful authentication
          if (window.location.hash || window.location.search) {
            window.history.replaceState({}, document.title, window.location.pathname)
          }
        } else {
          // Only set error if sign up is not completed and we have OAuth params
          if (window.location.hash || window.location.search) {
            setAuthError('Sign in was not completed. Please try again.')
          }
        }
      } catch (error) {
        console.error('Error checking auth callback:', error)
        // Only set error if sign up is not completed and we have OAuth params
        if (window.location.hash || window.location.search) {
          setAuthError('Sign in was not completed. Please try again.')
        }
      }
    }

    // Check if we're returning from OAuth (hash or search params might contain tokens)
    if (window.location.hash || window.location.search) {
      console.log('Detected potential OAuth callback, checking session...')
      checkAuthCallback()
    }
  }, [])



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
        updateMessageInCurrentChat(msgId, (m) => ({ ...m, content: out, justAdded: firstFlush ? true : m.justAdded }))
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
    updateMessageInCurrentChat(msgId, (m) => ({ ...m, typing: false, justAdded: false }))
  }

  const handleSend = async () => {
    const text = input.trim()
    if (!text || isLoading || !currentChatId) return
    const userMsg: Message = { id: crypto.randomUUID(), role: 'user', content: text, createdAt: new Date().toISOString() }
    addMessageToCurrentChat(userMsg)

    // Update chat title with the latest user message
    const updatedMessages = currentChat ? [...currentChat.messages, userMsg] : [userMsg]
    const newTitle = generateChatTitle(updatedMessages)
    updateChatTitle(currentChatId, newTitle)

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
      const timeoutId = setTimeout(() => controller.abort(), 20000)

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
          detail = ''
        }
        throw new Error(`Backend error ${apiResponse.status}${detail ? ': ' + detail : ''}`)
      }

      const data = await apiResponse.json()
      const replyText: string = data?.reply || ''

      const msgId = crypto.randomUUID()
      const initial: Message = { id: msgId, role: 'assistant', content: '', createdAt: new Date().toISOString(), typing: true, justAdded: true }
      addMessageToCurrentChat(initial)

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
      addMessageToCurrentChat(errorReply)
    } finally {
      setIsLoading(false)
    }
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const generateChatTitle = (messages: Message[]): string => {
    if (messages.length === 0) return 'New Chat'
    // Find the most recent user message
    const latestUserMessage = [...messages].reverse().find(msg => msg.role === 'user')
    if (latestUserMessage) {
      // Take first 30 characters of the latest user message
      const content = latestUserMessage.content.slice(0, 30)
      return content.length < latestUserMessage.content.length ? content + '...' : content
    }
    return 'New Chat'
  }

  const createNewChat = () => {
    if (chats.length >= 6) return // Limit to 6 chats

    const now = new Date().toISOString()
    const newChat: Chat = {
      id: crypto.randomUUID(),
      title: 'New Chat',
      messages: [],
      createdAt: now,
      updatedAt: now,
    }
    setChats(prev => [newChat, ...prev])
    setCurrentChatId(newChat.id)
    setInput('')
  }

  const selectChat = (chatId: string) => {
    setCurrentChatId(chatId)
    setInput('')
  }

  const deleteChat = (chatId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    // Prevent deletion if this is the last chat
    if (chats.length <= 1) {
      alert('You must have at least one chat in your history. Please create a new chat before deleting this one.')
      return
    }
    if (window.confirm('Are you sure you want to delete this chat?')) {
      setChats(prev => {
        const filtered = prev.filter(chat => chat.id !== chatId)
        if (currentChatId === chatId) {
          setCurrentChatId(filtered.length > 0 ? filtered[0].id : '')
        }
        return filtered
      })
    }
  }

  const updateChatTitle = (chatId: string, title: string) => {
    setChats(prev => prev.map(chat =>
      chat.id === chatId
        ? { ...chat, title, updatedAt: new Date().toISOString() }
        : chat
    ))
  }

  // Helper functions for updating current chat messages
  const updateCurrentChatMessages = (updater: (messages: Message[]) => Message[]) => {
    if (!currentChatId) return
    setChats(prev => prev.map(chat =>
      chat.id === currentChatId
        ? { ...chat, messages: updater(chat.messages), updatedAt: new Date().toISOString() }
        : chat
    ))
  }

  const addMessageToCurrentChat = (message: Message) => {
    updateCurrentChatMessages(prev => [...prev, message])
  }

  const updateMessageInCurrentChat = (messageId: string, updater: (message: Message) => Message) => {
    updateCurrentChatMessages(prev => prev.map(msg =>
      msg.id === messageId ? updater(msg) : msg
    ))
  }

  const openSettings = () => alert('Settings coming soon')
  const signOut = async () => {
    await insforge.auth.signOut()
    setUser(null)
    setChats([])
    setCurrentChatId('')
    setInput('')
  }

  const signInWithProvider = async (provider: 'google' | 'github' | 'linkedin') => {
    try {
      setAuthError(null)
      setLoadingProvider(provider)
      console.log(`Starting OAuth flow for ${provider} with redirect to:`, window.location.origin)
      const { data, error } = await insforge.auth.signInWithOAuth({
        provider,
        redirectTo: window.location.origin
      })

      if (error) {
        console.error('OAuth error:', error)
        setLoadingProvider(null)
        // Only show error if user is not authenticated (sign up not completed)
        const { data: sessionData } = await insforge.auth.getCurrentSession()
        if (!sessionData?.session) {
          setAuthError(`Failed to sign in with ${provider}. Please try again.`)
        }
        return
      }

      // If no error, OAuth call succeeded - check for redirect URL or immediate authentication
      // First, check if user is already authenticated (some OAuth flows authenticate immediately)
      const { data: sessionData } = await insforge.auth.getCurrentSession()
      if (sessionData?.session) {
        // User is authenticated, so OAuth worked - clear any errors and update user
        setAuthError(null)
        setLoadingProvider(null)
        setUser(sessionData.session.user)
        return
      }

      // Check if we have a URL to redirect to
      const redirectUrl = data?.url || (data as any)?.redirectUrl || (data as any)?.redirect_to
      if (redirectUrl && typeof redirectUrl === 'string' && redirectUrl.trim() !== '') {
        console.log('Redirecting to OAuth URL:', redirectUrl)
        // Clear any errors before redirecting
        setAuthError(null)
        // Redirect will happen, so we don't need to reset loading state
        window.location.href = redirectUrl
        return
      }

      // If we reach here, no error was returned, user is not authenticated, and no redirect URL found
      // Since the OAuth call succeeded (no error), we should trust that the flow is working
      // The redirect might happen asynchronously or the URL might be in a different format
      // Only show error if we can definitively confirm SSO failed
      
      // Log for debugging (can be removed in production)
      console.log('OAuth response data:', data)
      console.log('No redirect URL found, but OAuth call succeeded - checking if authentication happens asynchronously')
      
      // Wait a moment to see if authentication or redirect happens asynchronously
      // Some OAuth implementations handle redirects internally
      await new Promise(resolve => setTimeout(resolve, 1500))
      
      // Final check if user got authenticated
      const { data: finalSessionData } = await insforge.auth.getCurrentSession()
      if (finalSessionData?.session) {
        // User is authenticated - OAuth worked, don't show error
        setAuthError(null)
        setLoadingProvider(null)
        setUser(finalSessionData.session.user)
        return
      }
      
      // If we still don't have authentication and no redirect happened, it might be a real failure
      // However, since the OAuth call succeeded (no error), we should be very conservative
      // Only show error if we're absolutely certain - check if we're still on the same page
      // (if redirect happened, we wouldn't reach here)
      
      // Don't show error if OAuth call succeeded - trust the SDK
      // The redirect might be happening in a way we can't detect, or authentication might happen on callback
      console.warn('OAuth call succeeded but no immediate redirect URL or authentication detected. This might be normal for some OAuth flows.')
      setLoadingProvider(null)
      // Don't set error - let the OAuth callback handler manage the state
      // The error will only show if the callback handler confirms failure
    } catch (error) {
      console.error('Sign in error:', error)
      setLoadingProvider(null)
      // Only show error if user is not authenticated (sign up not completed)
      try {
        const { data: sessionData } = await insforge.auth.getCurrentSession()
        if (!sessionData?.session) {
          setAuthError(`Failed to sign in with ${provider}. Please try again.`)
        }
      } catch {
        setAuthError(`Failed to sign in with ${provider}. Please try again.`)
      }
    }
  }

  const ProviderButton = ({ provider, label, Icon }: ProviderConfig) => {
    const isThisProviderLoading = loadingProvider === provider
    return (
      <button
        onClick={() => signInWithProvider(provider)}
        disabled={loadingProvider !== null}
        className="signin-button"
      >
        <Icon />
        {isThisProviderLoading ? 'Signing in...' : `Sign in with ${label}`}
      </button>
    )
  }

  const handleModeClick = () => alert('Web search mode')

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
      localStorage.removeItem('chatSessions')
      localStorage.removeItem('currentChatId')
    } catch (e) {
      console.warn('Failed to clear chat history from localStorage:', e)
    }
    // Create a new empty chat after clearing to ensure at least one chat exists
    const now = new Date().toISOString()
    const newChat: Chat = {
      id: crypto.randomUUID(),
      title: 'New Chat',
      messages: [],
      createdAt: now,
      updatedAt: now,
    }
    setChats([newChat])
    setCurrentChatId(newChat.id)
    setShowPrivacyModal(false)
  }

  if (!user) {
    return (
      <div className="signin-page">
        <h1>Sign in to XieRiee</h1>
        <div className="signin-buttons">
          {providerConfigs.map((config) => (
            <ProviderButton key={config.provider} {...config} />
          ))}
        </div>
        {authError && (
          <div className="auth-error">
            {authError}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className={`app-root${railOpen ? '' : ' rail-closed'}`}>
      {/* Left sidebar */}
      <aside className="left-sidebar">
        <div className="ls-top">
          <button
            className="ls-toggle"
            aria-label={railOpen ? 'Collapse sidebar' : 'Expand sidebar'}
            data-tip={railOpen ? 'Collapse sidebar' : 'Expand sidebar'}
            onClick={() => setRailOpen(!railOpen)}
          >
            {railOpen ? '⟨' : '⟩'}
          </button>

          <div className="profile" data-tip="Profile" onClick={handleProfileClick} style={{ cursor: 'pointer' }}>
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
              {!profilePicture && (user?.name ? user.name.split(' ').map(n => n[0]).join('').toUpperCase() : 'U')}
            </Avatar>
            <div className="user-meta">
              <div className="name">{user?.name || user?.email || 'User'}</div>
            </div>
          </div>

          <button
            className={`new-chat ${chats.length >= 6 ? 'disabled' : ''}`}
            onClick={createNewChat}
            disabled={chats.length >= 6}
          >
            <span className="ic">＋</span>
            <span className="label">New chat</span>
          </button>

          <button
            className="chat-history-btn"
            data-tip="Chat history"
            onClick={() => setRailOpen(!railOpen)}
          >
            <span className="ic">📋</span>
            <span className="label">Chat history</span>
            {railOpen && (
              <div className="quota">
                <span className="chat-progress">{chats.length}/6</span>
              </div>
            )}
          </button>

          <div className="history">
            <div className="chat-list" style={{ maxHeight: '300px', overflowY: 'auto' }}>
              {chats.length === 0 ? (
                <div className="empty-chat-state">
                  <div className="empty-icon">📋</div>
                  <div className="empty-text">No chats yet</div>
                  <div className="empty-hint">Start a new conversation to get started</div>
                </div>
              ) : (
                <TransitionGroup>
                  {chats.map((chat) => {
                    const isActive = chat.id === currentChatId
                    return (
                      <Collapse key={chat.id}>
                        <button
                          className={`chat-item${isActive ? ' active' : ''}`}
                          onClick={() => selectChat(chat.id)}
                          type="button"
                        >
                          <div className="chat-content">
                            <div className="chat-title">{chat.title}</div>
                            <div className="chat-meta">
                              <span className="message-count">{chat.messages.length} msg{chat.messages.length === 1 ? '' : 's'}</span>
                              <span className="chat-date">{formatChatUpdatedAt(chat.updatedAt)}</span>
                            </div>
                          </div>
                          <button
                            className={`delete-chat${chats.length <= 1 ? ' disabled' : ''}`}
                            onClick={(e) => deleteChat(chat.id, e)}
                            aria-label="Delete chat"
                            type="button"
                            disabled={chats.length <= 1}
                            title={chats.length <= 1 ? 'You must have at least one chat' : 'Delete chat'}
                          >
                            ×
                          </button>
                        </button>
                      </Collapse>
                    )
                  })}
                </TransitionGroup>
              )}
            </div>
          </div>
        </div>

        <div className="ls-bottom">
          <button className="privacy" data-tip="Privacy manager" onClick={openPrivacy}>
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
            <h1 className="hero">Hi there, {user?.name?.split(' ')[0] || 'Guest'}<br />What would like to know?</h1>



            <Composer
              textareaRef={textareaRef}
              value={input}
              onChange={handleInputChange}
              onSend={handleSend}
              onKeyDown={onKeyDown}
              placeholder="Ask whatever you want…"
              isLoading={isLoading}
              onModeClick={handleModeClick}
            />
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
                          <span className="author">{getAuthorLabel(m.role, user?.name)}</span>
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

            <Composer
              textareaRef={textareaRef}
              value={input}
              onChange={handleInputChange}
              onSend={handleSend}
              onKeyDown={onKeyDown}
              placeholder="Type your message…"
              isLoading={isLoading}
              onModeClick={handleModeClick}
              isSticky
            />
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
