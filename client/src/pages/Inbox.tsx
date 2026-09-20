import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '../services/api'
import { InboxItemCard } from '../components/InboxItemCard'
import {
  Inbox as InboxIcon,
  Mic,
  Image as ImageIcon,
  FileText,
  Sparkles,
  CheckCheck,
  Send,
  Loader2,
  RefreshCw
} from 'lucide-react'

export default function InboxPage() {
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState<'ALL' | 'PENDING' | 'CONVERTED' | 'REJECTED'>('ALL')
  const [captureMode, setCaptureMode] = useState<'text' | 'voice' | 'image' | 'document'>('text')
  const [isProcessing, setIsProcessing] = useState(false)
  const [textInput, setTextInput] = useState('')
  const [docTitle, setDocTitle] = useState('')
  const [isListening, setIsListening] = useState(false)
  const [voiceTranscript, setVoiceTranscript] = useState('')
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [batchLoading, setBatchLoading] = useState(false)

  const { data: inboxData, isLoading, refetch } = useQuery({
    queryKey: ['inbox'],
    queryFn: () => apiClient.getInbox(),
  })

  const rawItems = inboxData?.data?.items || inboxData?.data || []
  const items: any[] = Array.isArray(rawItems) ? rawItems : []

  const handleStatusChange = () => {
    refetch()
    queryClient.invalidateQueries({ queryKey: ['tasks'] })
  }

  // Voice capture simulation & Web Speech API
  const handleToggleVoice = () => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      alert('Speech Recognition is not supported in this browser. Please type your voice note.')
      return
    }

    if (isListening) {
      setIsListening(false)
      return
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    const recognition = new SpeechRecognition()
    recognition.continuous = false
    recognition.interimResults = true
    recognition.lang = 'en-US'

    recognition.onstart = () => setIsListening(true)
    recognition.onresult = (event: any) => {
      const transcript = Array.from(event.results)
        .map((r: any) => r[0].transcript)
        .join('')
      setVoiceTranscript(transcript)
    }
    recognition.onerror = (event: any) => {
      console.error('Speech error', event.error)
      setIsListening(false)
    }
    recognition.onend = () => setIsListening(false)

    recognition.start()
  }

  const handleCaptureText = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!textInput.trim()) return
    setIsProcessing(true)
    try {
      await apiClient.extractFromVoice(textInput) // Smart AI extraction
      setTextInput('')
      refetch()
    } catch (err) {
      console.error('Failed to capture text:', err)
    } finally {
      setIsProcessing(false)
    }
  }

  const handleCaptureVoiceSubmit = async () => {
    if (!voiceTranscript.trim()) return
    setIsProcessing(true)
    try {
      await apiClient.captureVoice(voiceTranscript)
      setVoiceTranscript('')
      refetch()
    } catch (err) {
      console.error('Failed to process voice:', err)
    } finally {
      setIsProcessing(false)
    }
  }

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = async (event) => {
      const base64 = event.target?.result as string
      setImagePreview(base64)
      setIsProcessing(true)
      try {
        await apiClient.captureImage(base64, file.type)
        setImagePreview(null)
        refetch()
      } catch (err) {
        console.error('Image capture failed:', err)
      } finally {
        setIsProcessing(false)
      }
    }
    reader.readAsDataURL(file)
  }

  const handleDocumentSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!textInput.trim()) return
    setIsProcessing(true)
    try {
      await apiClient.extractFromDocument(textInput, docTitle || 'Meeting Notes.md')
      setTextInput('')
      setDocTitle('')
      refetch()
    } catch (err) {
      console.error('Document capture failed:', err)
    } finally {
      setIsProcessing(false)
    }
  }

  const handleAcceptAllPending = async () => {
    const pendingItems = items.filter((i) => i.status === 'PENDING')
    if (pendingItems.length === 0) return
    setBatchLoading(true)
    try {
      for (const item of pendingItems) {
        const extracted = item.extractedData || {}
        await apiClient.convertToTask(item.id, {
          title: extracted.title || item.rawContent?.slice(0, 50) || 'Inbox Task',
          description: extracted.description || item.rawContent || '',
          priority: extracted.priority || 'MEDIUM',
          estimatedMinutes: extracted.estimatedMinutes || 30,
        })
      }
      refetch()
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
    } catch (err) {
      console.error('Batch triage failed:', err)
    } finally {
      setBatchLoading(false)
    }
  }

  const filteredItems = items.filter((item) => {
    if (activeTab === 'ALL') return true
    return item.status === activeTab
  })

  const pendingCount = items.filter((i) => i.status === 'PENDING').length

  return (
    <div className="w-full max-w-4xl mx-auto p-4 md:p-6 pb-24 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold">
              <InboxIcon className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Action Inbox & Triage</h1>
              <p className="text-xs text-slate-500">
                Multi-modal capture hub: raw thoughts, voice memos & meeting notes triaged into structured tasks.
              </p>
            </div>
          </div>
        </div>

        {pendingCount > 0 && (
          <button
            onClick={handleAcceptAllPending}
            disabled={batchLoading}
            className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-xl text-xs font-bold hover:shadow-md transition disabled:opacity-50"
          >
            {batchLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <CheckCheck className="w-4 h-4" />
            )}
            Auto-Convert All Pending ({pendingCount})
          </button>
        )}
      </div>

      {/* Capture Section */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-indigo-600" />
            <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Smart AI Input Stream
            </span>
          </div>
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs font-semibold">
            <button
              onClick={() => setCaptureMode('text')}
              className={`px-3 py-1 rounded-lg transition ${
                captureMode === 'text' ? 'bg-white text-indigo-600 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Text
            </button>
            <button
              onClick={() => setCaptureMode('voice')}
              className={`px-3 py-1 rounded-lg transition flex items-center gap-1 ${
                captureMode === 'voice' ? 'bg-white text-indigo-600 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Mic size={12} /> Voice
            </button>
            <button
              onClick={() => setCaptureMode('image')}
              className={`px-3 py-1 rounded-lg transition flex items-center gap-1 ${
                captureMode === 'image' ? 'bg-white text-indigo-600 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <ImageIcon size={12} /> Image OCR
            </button>
            <button
              onClick={() => setCaptureMode('document')}
              className={`px-3 py-1 rounded-lg transition flex items-center gap-1 ${
                captureMode === 'document' ? 'bg-white text-indigo-600 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <FileText size={12} /> Document
            </button>
          </div>
        </div>

        {/* Capture Form - Text */}
        {captureMode === 'text' && (
          <form onSubmit={handleCaptureText} className="flex gap-2">
            <input
              type="text"
              placeholder="Dump a thought, e.g. 'Review pull request #42 by Friday 3pm urgent'..."
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <button
              type="submit"
              disabled={isProcessing || !textInput.trim()}
              className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl font-bold text-xs hover:bg-indigo-700 disabled:opacity-50 transition flex items-center gap-1.5"
            >
              {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              Extract
            </button>
          </form>
        )}

        {/* Capture Form - Voice */}
        {captureMode === 'voice' && (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleToggleVoice}
                className={`p-3 rounded-xl flex items-center gap-2 text-xs font-bold transition ${
                  isListening
                    ? 'bg-rose-500 text-white animate-pulse'
                    : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100'
                }`}
              >
                <Mic size={16} />
                {isListening ? 'Listening... Click to stop' : 'Start Voice Capture'}
              </button>
              <span className="text-xs text-slate-500">
                {isListening ? 'Speak your task or meeting summary...' : 'Or type transcription below'}
              </span>
            </div>
            <textarea
              rows={3}
              placeholder="Voice transcription preview..."
              value={voiceTranscript}
              onChange={(e) => setVoiceTranscript(e.target.value)}
              className="w-full px-4 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleCaptureVoiceSubmit}
                disabled={isProcessing || !voiceTranscript.trim()}
                className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 disabled:opacity-50 transition flex items-center gap-1.5"
              >
                {isProcessing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles size={14} />}
                Process Voice Note
              </button>
            </div>
          </div>
        )}

        {/* Capture Form - Image OCR */}
        {captureMode === 'image' && (
          <div className="space-y-3">
            <label className="border-2 border-dashed border-slate-300 rounded-xl p-6 flex flex-col items-center justify-center cursor-pointer hover:border-indigo-500 hover:bg-indigo-50/20 transition text-center">
              {imagePreview ? (
                <img src={imagePreview} alt="Preview" className="max-h-36 rounded-lg object-contain mb-2" />
              ) : (
                <ImageIcon className="w-8 h-8 text-slate-400 mb-2" />
              )}
              <span className="text-xs font-bold text-slate-700">Upload Screenshot or Whiteboard Photo</span>
              <span className="text-[11px] text-slate-400 mt-1">PNG, JPG, WEBP (Auto OCR + Task Extraction)</span>
              <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
            </label>
            {isProcessing && (
              <div className="flex items-center justify-center gap-2 py-3 text-xs font-semibold text-indigo-600">
                <Loader2 className="w-4 h-4 animate-spin" /> Extracting actionable tasks from image...
              </div>
            )}
          </div>
        )}

        {/* Capture Form - Document */}
        {captureMode === 'document' && (
          <form onSubmit={handleDocumentSubmit} className="space-y-3">
            <input
              type="text"
              placeholder="Document / Meeting Title (e.g. Q3 Sprint Planning Notes)"
              value={docTitle}
              onChange={(e) => setDocTitle(e.target.value)}
              className="w-full px-4 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <textarea
              rows={4}
              placeholder="Paste meeting transcript or document markdown here to parse action items..."
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              className="w-full px-4 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={isProcessing || !textInput.trim()}
                className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 disabled:opacity-50 transition flex items-center gap-1.5"
              >
                {isProcessing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles size={14} />}
                Extract Action Items
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          {(['ALL', 'PENDING', 'CONVERTED', 'REJECTED'] as const).map((tab) => {
            const count =
              tab === 'ALL'
                ? items.length
                : items.filter((i) => i.status === tab).length
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition ${
                  activeTab === tab
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {tab === 'CONVERTED' ? 'CONVERTED TO TASKS' : tab} ({count})
              </button>
            )
          })}
        </div>
        <button
          onClick={() => refetch()}
          className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition"
          title="Refresh Inbox"
        >
          <RefreshCw size={14} />
        </button>
      </div>

      {/* Items List */}
      {isLoading ? (
        <div className="space-y-4 animate-pulse">
          <div className="h-32 bg-slate-200 rounded-2xl"></div>
          <div className="h-32 bg-slate-200 rounded-2xl"></div>
        </div>
      ) : filteredItems.length > 0 ? (
        <div className="space-y-4">
          {filteredItems.map((item: any) => (
            <InboxItemCard
              key={item.id}
              item={item}
              onStatusChange={handleStatusChange}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-slate-200 p-8 space-y-3">
          <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
            <CheckCheck className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-slate-900">Inbox Zero Reached!</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            All captured items in this view have been processed or converted into organized execution tasks.
          </p>
        </div>
      )}
    </div>
  )
}

