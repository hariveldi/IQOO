import { useState, useEffect, useRef } from 'react'
import { Send, Mic, Sparkles, Check, X, ShieldAlert, Cpu, Database, Play } from 'lucide-react'
import { apiClient } from '../services/api'
import { AIAction, AIChatResponse } from '@iqoo/shared'
import { AdvancedVoiceCapture } from '../components/AdvancedVoiceCapture'
import { useLocation } from 'react-router-dom'

interface Message {
  id: string
  text: string
  sender: 'user' | 'ai'
  actions?: AIAction[]
  executed?: boolean
  isFallback?: boolean
}

export default function AIPage() {
  const location = useLocation() as { state?: { initialPrompt?: string } }
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      text: "👋 Hi! I'm your AI Productivity Copilot. I analyze your real tasks, dependencies, blockers, and deadlines to help you plan, execute, and make decisions.",
      sender: 'ai',
    },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [executingActions, setExecutingActions] = useState<string | null>(null)
  const [showVoice, setShowVoice] = useState(false)
  const [aiStatus, setAiStatus] = useState<{ provider: string; model: string; isConfigured: boolean } | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const promptFromRoute = location.state?.initialPrompt?.trim()
    if (promptFromRoute) {
      setInput(promptFromRoute)
      window.history.replaceState({}, '', window.location.pathname)
    }
  }, [location.state])

  useEffect(() => {
    apiClient.getAIStatus().then((res) => {
      if (res?.data) {
        setAiStatus(res.data)
      }
    }).catch(() => {
      setAiStatus({ provider: 'local_fallback', model: 'unavailable', isConfigured: false })
    })
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  const handleSend = async (messageText?: string) => {
    const query = messageText || input
    if (!query.trim() || loading) return

    const userMsg: Message = {
      id: Date.now().toString(),
      text: query,
      sender: 'user',
    }

    setMessages((prev) => [...prev, userMsg])
    if (!messageText) setInput('')
    setLoading(true)

    try {
      const res = await apiClient.chat(query)
      const data: AIChatResponse = res.data

      const aiMsg: Message = {
        id: (Date.now() + 1).toString(),
        text: data.message || "I've processed your request.",
        sender: 'ai',
        actions: data.actions && data.actions.length > 0 ? data.actions : undefined,
        isFallback: data.isFallback,
      }

      setMessages((prev) => [...prev, aiMsg])
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          text: `⚠️ Error contacting AI service: ${err?.response?.data?.message || err?.message || 'Unknown error'}`,
          sender: 'ai',
        },
      ])
    } finally {
      setLoading(false)
    }
  }

  const resolveVoiceResultPrompt = (result: any) => {
    const payload = result?.data ?? result
    const extracted = payload?.extractedData ?? payload?.data?.extractedData ?? {}
    const rawContent = payload?.rawContent ?? payload?.data?.rawContent ?? payload?.item?.rawContent ?? payload?.item?.content
    const promptText = rawContent || extracted.title || extracted.description || ''
    return typeof promptText === 'string' ? promptText.trim() : ''
  }

  const handleExecuteActions = async (messageId: string, actions: AIAction[]) => {
    setExecutingActions(messageId)
    try {
      const res = await apiClient.executeAIActions(actions)
      if (res.success) {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === messageId ? { ...msg, executed: true } : msg
          )
        )
        // Add confirmation message
        setMessages((prev) => [
          ...prev,
          {
            id: Date.now().toString(),
            text: `✅ Successfully executed ${actions.length} action(s)! Your tasks and schedules are updated.`,
            sender: 'ai',
          },
        ])
      }
    } catch (err: any) {
      alert(`Failed to execute actions: ${err?.response?.data?.message || err.message}`)
    } finally {
      setExecutingActions(null)
    }
  }

  const promptSuggestions = [
    "What should I do right now and why?",
    "Create a task: Review Q3 engineering spec by Friday 5pm, 45m, high priority",
    "Break down project 'App Redesign' into 3 actionable tasks with dependencies",
    "What tasks are currently blocked or at high risk?",
  ]

  return (
    <div className="w-full max-w-4xl mx-auto flex flex-col h-[calc(100vh-5rem)] bg-slate-50 border border-slate-200 rounded-2xl shadow-sm overflow-hidden my-4">
      {/* Header with Provider & DB context Badges */}
      <div className="p-4 bg-white border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-sm">
            <Sparkles size={18} />
          </div>
          <div>
            <h1 className="text-base font-semibold text-slate-900 flex items-center gap-2">
              AI Productivity Copilot
            </h1>
            <p className="text-xs text-slate-500">Autonomous context-aware reasoning & action engine</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
            <Database size={13} />
            <span>DB Context Active</span>
          </div>
          {aiStatus && (
            <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${
              aiStatus.provider === 'openai' 
                ? 'bg-blue-50 text-blue-700 border-blue-200' 
                : 'bg-amber-50 text-amber-700 border-amber-200'
            }`}>
              <Cpu size={13} />
              <span>
                {aiStatus.provider === 'openai' ? `OpenAI (${aiStatus.model})` : `Local Provider (Deterministic)`}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Chat Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex flex-col ${message.sender === 'user' ? 'items-end' : 'items-start'}`}
          >
            <div
              className={`max-w-2xl px-4 py-3 rounded-2xl text-sm ${
                message.sender === 'user'
                  ? 'bg-blue-600 text-white rounded-br-none shadow-sm'
                  : 'bg-white text-slate-800 border border-slate-200 rounded-bl-none shadow-sm'
              }`}
            >
              {message.isFallback && (
                <div className="flex items-center gap-1 text-xs text-amber-600 font-medium mb-1.5">
                  <ShieldAlert size={13} />
                  <span>Deterministic Fallback Mode</span>
                </div>
              )}
              <p className="whitespace-pre-wrap leading-relaxed">{message.text}</p>
            </div>

            {/* Render Suggested Actions If Any */}
            {message.actions && message.actions.length > 0 && (
              <div className="mt-3 w-full max-w-2xl bg-white border border-indigo-100 rounded-xl p-4 shadow-sm">
                <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-indigo-700 flex items-center gap-1.5">
                    <Sparkles size={14} /> Proposed Actions ({message.actions.length})
                  </span>
                  {message.executed ? (
                    <span className="text-xs font-semibold text-emerald-600 flex items-center gap-1">
                      <Check size={14} /> Executed
                    </span>
                  ) : (
                    <span className="text-xs text-slate-400">Review before execution</span>
                  )}
                </div>

                <div className="space-y-2 mb-3">
                  {message.actions.map((act, idx) => (
                    <div
                      key={idx}
                      className="p-2.5 rounded-lg border border-slate-200 bg-slate-50 text-xs text-slate-700 flex flex-col gap-1"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-indigo-900 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded">
                          {act.type}
                        </span>
                        {act.description && (
                          <span className="text-slate-500 italic">
                            {act.description}
                          </span>
                        )}
                      </div>
                      <div className="font-mono text-slate-600 mt-1 bg-white p-2 rounded border border-slate-200 overflow-x-auto">
                        {act.type === 'CREATE_TASK' && (
                          <span>
                            Title: <strong>{act.data.title}</strong>
                            {act.data.priority && ` • Priority: ${act.data.priority}`}
                            {act.data.estimatedMinutes && ` • ${act.data.estimatedMinutes}m`}
                            {act.data.deadline && ` • Due: ${act.data.deadline}`}
                          </span>
                        )}
                        {act.type === 'UPDATE_TASK' && (
                          <span>
                            Task ID: {act.data.taskId} • Status: {act.data.status || 'Updated'}
                          </span>
                        )}
                        {act.type === 'CREATE_DEPENDENCY' && (
                          <span>
                            Task <strong>{act.data.taskId}</strong> depends on <strong>{act.data.dependsOnTaskId}</strong>
                          </span>
                        )}
                        {act.type === 'CREATE_PROJECT' && (
                          <span>
                            Project: <strong>{act.data.name}</strong>
                          </span>
                        )}
                        {act.type === 'SCHEDULE_PLAN' && (
                          <span>
                            Schedule: {act.data.blocks?.length || 0} blocks planned
                          </span>
                        )}
                        {act.type === 'DELETE_TASK' && (
                          <span>Delete Task ID: {act.data.taskId}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {!message.executed && (
                  <div className="flex items-center gap-2 pt-2">
                    <button
                      onClick={() => handleExecuteActions(message.id, message.actions!)}
                      disabled={executingActions === message.id}
                      className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition font-medium text-xs disabled:opacity-50"
                    >
                      <Play size={14} />
                      {executingActions === message.id ? 'Executing...' : 'Accept & Execute All'}
                    </button>
                    <button
                      onClick={() =>
                        setMessages((prev) =>
                          prev.map((msg) =>
                            msg.id === message.id ? { ...msg, actions: [] } : msg
                          )
                        )
                      }
                      className="px-3 py-2 border border-slate-300 text-slate-600 rounded-lg hover:bg-slate-100 transition text-xs font-medium flex items-center gap-1"
                    >
                      <X size={14} /> Discard
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div className="flex items-center gap-2 text-slate-500 text-xs p-2 bg-white rounded-xl border border-slate-200 w-fit">
            <div className="w-2 h-2 rounded-full bg-blue-600 animate-pulse" />
            <span>AI is querying your database context & reasoning...</span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Suggestion Chips */}
      {messages.length <= 3 && (
        <div className="px-4 py-2 bg-slate-100/70 border-t border-slate-200 flex flex-wrap gap-2">
          {promptSuggestions.map((prompt, i) => (
            <button
              key={i}
              onClick={() => handleSend(prompt)}
              className="text-xs bg-white text-slate-700 hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200 border border-slate-200 px-3 py-1.5 rounded-full transition-all text-left"
            >
              💡 {prompt}
            </button>
          ))}
        </div>
      )}

      {/* Input Bar */}
      <div className="border-t border-slate-200 p-3 bg-white">
        <form
          onSubmit={(e) => {
            e.preventDefault()
            handleSend()
          }}
          className="flex items-center gap-2"
        >
          <button
            type="button"
            onClick={() => setShowVoice(true)}
            className="p-2.5 text-slate-500 hover:text-blue-600 hover:bg-slate-100 rounded-xl transition"
            title="Voice input"
          >
            <Mic size={18} />
          </button>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type instructions (e.g., 'What should I do next?', 'Create task X by Friday')..."
            className="flex-1 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition"
            disabled={loading}
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="p-2.5 bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 rounded-xl transition flex items-center justify-center shadow-sm"
          >
            <Send size={18} />
          </button>
        </form>
      </div>

      {/* Voice Capture Modal */}
      {showVoice && (
        <AdvancedVoiceCapture
          onClose={() => setShowVoice(false)}
          onSuccess={(result) => {
            setShowVoice(false)
            const voicePrompt = resolveVoiceResultPrompt(result)
            if (voicePrompt) {
              handleSend(voicePrompt)
            } else if (result?.data?.extractedData?.title) {
              handleSend(`Create task: ${result.data.extractedData.title}`)
            }
          }}
        />
      )}
    </div>
  )
}



