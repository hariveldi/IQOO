import { useState, useEffect, useRef, useCallback } from 'react'
import {
  Mic,
  MicOff,
  Radio,
  Sparkles,
  CheckCircle,
  AlertCircle,
  Wifi,
  WifiOff,
  ArrowRight,
  Clock,
  Layers,
  ShieldCheck,
  Cpu,
  Filter,
  Target,
  Send,
  Calendar,
  Laptop,
  Edit3,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react'
import { apiClient } from '../services/api'
import { useNavigate } from 'react-router-dom'
import { AICommitment } from '@iqoo/shared'
import {
  initLocalClassifier,
  classifyConversationSegment,
  getLocalModelStatus,
  onModelStatusChange,
  type LocalModelStatus,
  type LocalClassificationResult,
} from '../ai/localClassifier'

interface CreatedTaskInfo {
  id?: string
  title: string
  description?: string
  priority?: string
  deadline?: string
  status?: string
}

interface ActiveCommitmentState {
  commitment: AICommitment
  task: CreatedTaskInfo
  stage: 'detected' | 'ready' | 'executing' | 'completed' | 'failed'
  isEditingDraft: boolean
  draftText: string
  executionResult?: string
  errorReason?: string
}

export default function AmbientAI() {
  const navigate = useNavigate()
  const [isListening, setIsListening] = useState(false)
  const [currentUtterance, setCurrentUtterance] = useState('')
  const [processing, setProcessing] = useState(false)
  const [createdTasks, setCreatedTasks] = useState<CreatedTaskInfo[]>([])
  const [latestTask, setLatestTask] = useState<CreatedTaskInfo | null>(null)
  const [activeCommitment, setActiveCommitment] = useState<ActiveCommitmentState | null>(null)
  const [copiedDraft, setCopiedDraft] = useState(false)
  const [taskChoices, setTaskChoices] = useState<Record<string, 'phone' | 'laptop' | 'both'>>({})
  const [transferStatus, setTransferStatus] = useState<Record<string, string>>({})
  const [transferLoading, setTransferLoading] = useState<Record<string, boolean>>({})
  const [error, setError] = useState<string | null>(null)

  // On-device Local AI Pre-filter state (WASM / ONNX)
  const [modelStatus, setModelStatus] = useState<LocalModelStatus>(getLocalModelStatus())
  const [latestFilterResult, setLatestFilterResult] = useState<LocalClassificationResult | null>(null)

  // Office Kit connection status
  const [officeKitStatus, setOfficeKitStatus] = useState<{
    connected: boolean
    laptop: { deviceId: string; name: string; lastSeen: string; ip?: string } | null
    pendingDocumentsCount: number
  }>({ connected: false, laptop: null, pendingDocumentsCount: 0 })

  const isListeningRef = useRef(false)
  const mediaStreamRef = useRef<MediaStream | null>(null)
  const recognitionRef = useRef<any>(null)

  // Initialize on-device local classifier on mount
  useEffect(() => {
    initLocalClassifier().catch((err) => {
      console.warn('[On-Device AI] Initialization warning:', err)
    })
    const unsubscribe = onModelStatusChange(setModelStatus)
    return () => {
      unsubscribe()
    }
  }, [])

  // Fetch Office Kit connection status
  const fetchOfficeKitStatus = useCallback(async () => {
    try {
      const res = await apiClient.getOfficeKitStatus()
      if (res?.data) {
        setOfficeKitStatus(res.data)
      }
    } catch {
      // ignore
    }
  }, [])

  useEffect(() => {
    fetchOfficeKitStatus()
    const interval = setInterval(fetchOfficeKitStatus, 3000)
    const onVisibility = () => {
      if (document.visibilityState === 'visible') fetchOfficeKitStatus()
    }
    window.addEventListener('focus', onVisibility)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      clearInterval(interval)
      window.removeEventListener('focus', onVisibility)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [fetchOfficeKitStatus])

  // Stop microphone capture and clean up hardware resources
  const stopListening = useCallback(() => {
    isListeningRef.current = false
    setIsListening(false)

    // Stop Web Speech Recognition
    if (recognitionRef.current) {
      try {
        recognitionRef.current.onend = null
        recognitionRef.current.onerror = null
        recognitionRef.current.stop()
      } catch {
        // ignore
      }
      recognitionRef.current = null
    }

    // Release hardware microphone tracks
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop())
      mediaStreamRef.current = null
    }

    setCurrentUtterance('')
  }, [])

  // Process live spoken conversation segment through local on-device filter -> Gemini action pipeline
  const processConversationSegment = async (spokenText: string) => {
    const text = spokenText.trim()
    if (!text || text.length < 5) return

    setProcessing(true)
    setError(null)

    try {
      // 1. Run local on-device AI classifier (WASM/ONNX) BEFORE calling Gemini
      const classification = await classifyConversationSegment(text)
      setLatestFilterResult(classification)

      // 2. If classified as non-actionable noise, skip Gemini and terminate processing
      if (!classification.actionable) {
        console.info(
          `[On-Device AI] Speech filtered locally as non-actionable: "${text}" ` +
          `(${(classification.confidence * 100).toFixed(1)}% conf, ${classification.latencyMs}ms). Gemini SKIPPED.`
        )
        setProcessing(false)
        return
      }

      console.info(
        `[On-Device AI] Speech confirmed actionable: "${text}" ` +
        `(${(classification.confidence * 100).toFixed(1)}% conf, ${classification.latencyMs}ms). Calling Gemini pipeline...`
      )

      // 3. Send verified actionable speech transcript to existing Gemini action pipeline
      const res = await apiClient.processActionPipeline({
        text,
        autoExecute: true,
      })

      const data = res?.data
      const exec = data?.executionResult
      const actionType = (data?.action?.type || '').toLowerCase()
      const comm = data?.commitment || data?.extractedInfo?.commitment

      // If Gemini identifies a task or commitment and creates it in SQLite
      if (actionType.includes('task') || exec?.title || comm?.isCommitment) {
        const newTask: CreatedTaskInfo = {
          id: exec?.id || `task_${Date.now()}`,
          title: exec?.title || data?.action?.data?.title || data?.extractedInfo?.title || text,
          description: exec?.description || data?.action?.data?.description || data?.extractedInfo?.summary,
          priority: exec?.priority || data?.action?.data?.priority || 'MEDIUM',
          deadline: exec?.deadline || data?.action?.data?.deadline,
          status: exec?.status || 'TODO',
        }

        setLatestTask(newTask)
        setCreatedTasks((prev) => [newTask, ...prev])

        // If a structured commitment was extracted, initialize the Commitment-to-Action state
        if (comm && comm.isCommitment) {
          const draft = comm.draftExecution?.draftText ||
            (comm.person
              ? `Hi ${comm.person}, I'll ${comm.action}${comm.deadline ? ` by ${comm.deadline}` : ''}.`
              : `I'll ${comm.action}${comm.deadline ? ` by ${comm.deadline}` : ''}.`)

          setActiveCommitment({
            commitment: comm,
            task: newTask,
            stage: 'ready',
            isEditingDraft: false,
            draftText: draft,
          })
        }

        await fetchOfficeKitStatus()
      }
    } catch (err: any) {
      console.warn('Ambient speech processing notice:', err)
      setError(err?.response?.data?.message || err?.message || 'Error processing ambient speech')
    } finally {
      setProcessing(false)
    }
  }

  // Start real microphone capture
  const startListening = async () => {
    setError(null)
    setLatestTask(null)

    // 1. Explicit user opt-in: Request real hardware microphone stream
    let stream: MediaStream | null = null
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Microphone access is not supported by your browser.')
      }
      stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      mediaStreamRef.current = stream
    } catch (err: any) {
      console.error('Microphone permission error:', err)
      setError(
        err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError'
          ? 'Microphone permission was denied. Please allow microphone access in your browser.'
          : `Could not access microphone: ${err.message}`
      )
      return
    }

    // 2. Start real speech recognition
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition

    if (!SpeechRecognition) {
      setError(
        'Speech Recognition API is not supported in this browser. Please use Chrome, Edge, or Safari.'
      )
      return
    }

    isListeningRef.current = true
    setIsListening(true)

    const initRecognizer = () => {
      if (!isListeningRef.current) return

      try {
        const recognition = new SpeechRecognition()
        recognition.continuous = false
        recognition.interimResults = true
        recognition.lang = 'en-US'

        recognition.onresult = (event: any) => {
          let interim = ''
          let final = ''

          for (let i = event.resultIndex; i < event.results.length; i++) {
            const transcript = event.results[i][0].transcript
            if (event.results[i].isFinal) {
              final += transcript + ' '
            } else {
              interim += transcript
            }
          }

          const currentText = (final || interim).trim()
          if (currentText) {
            setCurrentUtterance(currentText)
          }

          if (final.trim()) {
            // Meaningful conversation segment finalized -> send to Gemini
            processConversationSegment(final.trim())
          }
        }

        recognition.onerror = (event: any) => {
          if (event.error !== 'no-speech') {
            console.warn('SpeechRecognition event notice:', event.error)
          }
        }

        recognition.onend = () => {
          // Keep ambient listening loop active while isListening is true
          if (isListeningRef.current) {
            setTimeout(() => {
              if (isListeningRef.current) initRecognizer()
            }, 300)
          }
        }

        recognitionRef.current = recognition
        recognition.start()
      } catch (err) {
        console.warn('Recognition start error:', err)
      }
    }

    initRecognizer()
  }

  // Option 1: 📱 Keep on Phone (Task remains in SQLite)
  const handleOptionKeepOnPhone = (task: CreatedTaskInfo) => {
    const key = task.id || task.title
    setTaskChoices((prev) => ({ ...prev, [key]: 'phone' }))
    setTransferStatus((prev) => ({
      ...prev,
      [key]: '📱 Task saved securely in SQLite on phone. Kept on mobile device.',
    }))
  }

  // Option 2: 💻 Send to Laptop (via Office Kit)
  const handleOptionSendToLaptop = async (task: CreatedTaskInfo) => {
    const key = task.id || task.title

    if (!officeKitStatus.connected) {
      setTransferStatus((prev) => ({
        ...prev,
        [key]: '⚠️ Laptop not connected. Please connect your laptop via Office Kit to transfer.',
      }))
      return
    }

    setTransferLoading((prev) => ({ ...prev, [key]: true }))
    try {
      const res = await apiClient.transferTaskToLaptop({
        taskId: task.id,
        title: task.title,
        description: task.description,
        priority: task.priority,
        deadline: task.deadline,
        status: task.status,
      })

      setTaskChoices((prev) => ({ ...prev, [key]: 'laptop' }))
      setTransferStatus((prev) => ({
        ...prev,
        [key]: `💻 Synced to laptop (${res?.data?.laptopName || officeKitStatus.laptop?.name || 'Office Kit'}). Task preserved in SQLite.`,
      }))
      await fetchOfficeKitStatus()
    } catch (err: any) {
      setTransferStatus((prev) => ({
        ...prev,
        [key]: `Transfer failed: ${err?.response?.data?.message || err?.message}`,
      }))
    } finally {
      setTransferLoading((prev) => ({ ...prev, [key]: false }))
    }
  }

  // Option 3: 📱💻 Both (Task in SQLite + transferred to Laptop)
  const handleOptionSendToBoth = async (task: CreatedTaskInfo) => {
    const key = task.id || task.title

    if (!officeKitStatus.connected) {
      setTransferStatus((prev) => ({
        ...prev,
        [key]: '⚠️ Laptop not connected. Task is saved on phone, but laptop sync requires a connected laptop.',
      }))
      return
    }

    setTransferLoading((prev) => ({ ...prev, [key]: true }))
    try {
      const res = await apiClient.transferTaskToLaptop({
        taskId: task.id,
        title: task.title,
        description: task.description,
        priority: task.priority,
        deadline: task.deadline,
        status: task.status,
      })

      setTaskChoices((prev) => ({ ...prev, [key]: 'both' }))
      setTransferStatus((prev) => ({
        ...prev,
        [key]: `📱💻 Task active on Phone (SQLite) AND synced to ${res?.data?.laptopName || officeKitStatus.laptop?.name || 'Laptop'} via Office Kit!`,
      }))
      await fetchOfficeKitStatus()
    } catch (err: any) {
      setTransferStatus((prev) => ({
        ...prev,
        [key]: `Transfer failed: ${err?.response?.data?.message || err?.message}`,
      }))
    } finally {
      setTransferLoading((prev) => ({ ...prev, [key]: false }))
    }
  }

  // Real Commitment Execution Handlers
  const handleConfirmExecute = async () => {
    if (!activeCommitment) return
    setActiveCommitment((prev) => prev ? { ...prev, stage: 'executing', errorReason: undefined } : null)

    const { commitment, task, draftText } = activeCommitment
    const execType = commitment.executionType

    try {
      if (execType === 'message') {
        // Real browser messaging handoff: Web Share API if supported, or clipboard copy + mailto/sms protocol
        let deliveredVia = 'Clipboard'
        if (typeof navigator !== 'undefined' && navigator.clipboard) {
          try {
            await navigator.clipboard.writeText(draftText)
            setCopiedDraft(true)
            setTimeout(() => setCopiedDraft(false), 3000)
          } catch {
            // ignore
          }
        }

        if (typeof navigator !== 'undefined' && (navigator as any).share) {
          try {
            await (navigator as any).share({
              title: commitment.draftExecution?.title || task.title,
              text: draftText,
            })
            deliveredVia = 'System Share'
          } catch (e: any) {
            if (e.name !== 'AbortError') {
              console.warn('Share API notice:', e)
            }
          }
        }

        // Mark task completed in SQLite
        if (task.id) {
          await apiClient.updateTask(task.id, { status: 'COMPLETED' }).catch(() => {})
        }

        setActiveCommitment((prev) => prev ? {
          ...prev,
          stage: 'completed',
          executionResult: `✓ Message draft prepared for ${commitment.person || 'recipient'} and copied to ${deliveredVia}. Task updated to COMPLETED in SQLite.`,
        } : null)
        await fetchOfficeKitStatus()
      } else if (execType === 'calendar') {
        // Real calendar event preparation: Google Calendar URL
        const eventTitle = encodeURIComponent(commitment.draftExecution?.title || task.title)
        const eventDetails = encodeURIComponent(draftText || task.description || '')
        const gcalUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${eventTitle}&details=${eventDetails}`
        window.open(gcalUrl, '_blank')

        if (task.id) {
          await apiClient.updateTask(task.id, { status: 'COMPLETED' }).catch(() => {})
        }

        setActiveCommitment((prev) => prev ? {
          ...prev,
          stage: 'completed',
          executionResult: `✓ Calendar event prepared and dispatched to calendar application. Task scheduled in SQLite.`,
        } : null)
        await fetchOfficeKitStatus()
      } else if (execType === 'laptop') {
        // Reuse existing Office Kit laptop connection
        if (!officeKitStatus.connected) {
          setActiveCommitment((prev) => prev ? {
            ...prev,
            stage: 'failed',
            errorReason: 'Laptop not connected. Please connect your laptop via Office Kit to transfer execution context.',
          } : null)
          return
        }

        const res = await apiClient.transferTaskToLaptop({
          taskId: task.id,
          title: task.title,
          description: draftText || task.description,
          priority: task.priority,
          deadline: task.deadline,
          status: task.status,
        })

        if (task.id) {
          await apiClient.updateTask(task.id, { status: 'COMPLETED' }).catch(() => {})
        }

        setActiveCommitment((prev) => prev ? {
          ...prev,
          stage: 'completed',
          executionResult: `✓ Complete commitment context transferred to ${res?.data?.laptopName || officeKitStatus.laptop?.name || 'Laptop'} via Office Kit.`,
        } : null)
        await fetchOfficeKitStatus()
      } else {
        // General task execution
        if (task.id) {
          await apiClient.updateTask(task.id, { status: 'COMPLETED' }).catch(() => {})
        }
        setActiveCommitment((prev) => prev ? {
          ...prev,
          stage: 'completed',
          executionResult: `✓ Action completed & task committed to SQLite database.`,
        } : null)
        await fetchOfficeKitStatus()
      }
    } catch (err: any) {
      setActiveCommitment((prev) => prev ? {
        ...prev,
        stage: 'failed',
        errorReason: err?.response?.data?.message || err?.message || 'Execution failed',
      } : null)
    }
  }

  const handleCancelExecute = () => {
    setActiveCommitment(null)
  }

  const handleRetryExecute = () => {
    if (activeCommitment) {
      setActiveCommitment({
        ...activeCommitment,
        stage: 'ready',
        errorReason: undefined,
      })
    }
  }

  // Clean up on component unmount
  useEffect(() => {
    return () => {
      stopListening()
    }
  }, [stopListening])

  return (
    <div className="w-full max-w-4xl mx-auto p-4 sm:p-6 space-y-6 pb-16">
      {/* Header Banner */}
      <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center text-white shadow-md shadow-indigo-500/20">
              <Radio className={`w-5 h-5 ${isListening ? 'animate-pulse' : ''}`} />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-bold text-gray-900">
                  Ambient AI
                </h1>
                <span className="text-[11px] px-2 py-0.5 rounded-full font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                  Active Foreground Mode
                </span>
                {/* On-device AI Status Badge */}
                {modelStatus === 'ready' && (
                  <span className="text-[11px] px-2 py-0.5 rounded-full font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                    <Cpu className="w-3 h-3 text-emerald-600" />
                    On-device AI: Ready (WASM ONNX)
                  </span>
                )}
                {modelStatus === 'loading' && (
                  <span className="text-[11px] px-2 py-0.5 rounded-full font-semibold bg-amber-50 text-amber-700 border border-amber-200 flex items-center gap-1">
                    <Sparkles className="w-3 h-3 animate-spin text-amber-600" />
                    On-device AI: Loading model...
                  </span>
                )}
                {modelStatus === 'fallback' && (
                  <span className="text-[11px] px-2 py-0.5 rounded-full font-semibold bg-slate-100 text-slate-700 border border-slate-200 flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3 text-slate-500" />
                    On-device AI: Fallback (Passthrough)
                  </span>
                )}
                {modelStatus === 'unloaded' && (
                  <span className="text-[11px] px-2 py-0.5 rounded-full font-semibold bg-slate-50 text-slate-500 border border-slate-200 flex items-center gap-1">
                    <Cpu className="w-3 h-3 text-slate-400" />
                    On-device AI: Initializing...
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-500 mt-0.5">
                Listen to conversations and automatically turn actionable information into tasks.
              </p>
            </div>
          </div>
        </div>

        {/* Laptop Connection Badge */}
        <div className="flex items-center gap-2 self-start sm:self-center">
          {officeKitStatus.connected ? (
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-semibold text-emerald-800">
              <Wifi className="w-3.5 h-3.5 text-emerald-600 animate-pulse" />
              <span>Laptop: {officeKitStatus.laptop?.name || 'Connected'}</span>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium text-gray-600">
                <WifiOff className="w-3.5 h-3.5 text-gray-400" />
                <span>Laptop not connected</span>
              </div>
              <button
                onClick={() => navigate('/office-kit')}
                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-sm transition-all"
              >
                CONNECT LAPTOP
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Main Ambient Microphone Control Card */}
      <div className="bg-white rounded-3xl p-8 border border-gray-200 shadow-sm text-center space-y-6">
        {/* Large Microphone Button */}
        <div className="relative inline-block">
          <button
            onClick={isListening ? stopListening : startListening}
            className={`w-28 h-28 rounded-full flex items-center justify-center text-white transition-all transform hover:scale-105 shadow-xl ${
              isListening
                ? 'bg-red-600 animate-pulse ring-8 ring-red-100 shadow-red-500/40'
                : 'bg-gradient-to-tr from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 shadow-indigo-500/30'
            }`}
            title={isListening ? 'Stop Listening' : 'Start Listening'}
          >
            {isListening ? <Mic className="w-12 h-12" /> : <MicOff className="w-12 h-12" />}
          </button>

          {/* Activity Ping Indicator */}
          {isListening && (
            <span className="absolute top-1 right-1 flex h-6 w-6">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-6 w-6 bg-red-500 text-white text-[10px] font-bold items-center justify-center">
                LIVE
              </span>
            </span>
          )}
        </div>

        {/* State / Action Buttons */}
        <div className="space-y-3">
          <div className="flex items-center justify-center gap-2">
            <span
              className={`text-sm font-bold uppercase tracking-wider ${
                isListening ? 'text-red-600 animate-pulse' : 'text-gray-500'
              }`}
            >
              {isListening ? 'LISTENING...' : 'Microphone OFF'}
            </span>
          </div>

          <div>
            {isListening ? (
              <button
                onClick={stopListening}
                className="px-8 py-3 bg-red-600 hover:bg-red-700 text-white text-sm font-bold rounded-2xl shadow-md shadow-red-500/20 transition-all transform active:scale-95"
              >
                STOP LISTENING
              </button>
            ) : (
              <button
                onClick={startListening}
                className="px-8 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white text-sm font-bold rounded-2xl shadow-md shadow-indigo-500/20 transition-all transform active:scale-95"
              >
                START LISTENING
              </button>
            )}
          </div>

          <p className="text-xs text-gray-500 max-w-md mx-auto">
            {isListening
              ? 'Ambient microphone active. On-device local filter screens speech instantly via WASM ONNX before forwarding actionable tasks to Gemini.'
              : 'Press Start Listening to allow microphone access and begin active conversation monitoring.'}
          </p>
        </div>

        {/* Real-time Microphone Activity Indicator */}
        {isListening && (
          <div className="p-4 bg-indigo-50/60 rounded-2xl border border-indigo-100 space-y-2 animate-in fade-in">
            <div className="flex items-center justify-center gap-1.5 h-6">
              <div className="w-1.5 bg-indigo-600 rounded-full animate-pulse h-3" />
              <div className="w-1.5 bg-indigo-500 rounded-full animate-pulse h-5" />
              <div className="w-1.5 bg-purple-600 rounded-full animate-pulse h-6" />
              <div className="w-1.5 bg-indigo-500 rounded-full animate-pulse h-4" />
              <div className="w-1.5 bg-indigo-600 rounded-full animate-pulse h-2" />
            </div>
            <p className="text-xs font-medium text-indigo-950 italic">
              {currentUtterance ? `"${currentUtterance}"` : 'Listening for conversation...'}
            </p>
            {processing && (
              <div className="flex items-center justify-center gap-1.5 text-xs text-indigo-700 font-semibold">
                <Sparkles className="w-3.5 h-3.5 animate-spin" />
                <span>Evaluating conversation segment for actionable tasks...</span>
              </div>
            )}
          </div>
        )}

        {/* Live On-device AI Pre-Filter Telemetry */}
        {latestFilterResult && (
          <div className="p-3 bg-gray-50 border border-gray-200 rounded-2xl text-left text-xs space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="font-bold text-gray-700 flex items-center gap-1.5">
                <Filter className="w-3.5 h-3.5 text-indigo-600" />
                On-Device AI Pre-Filter
              </span>
              <span className="text-[10px] text-gray-400 font-mono">
                {latestFilterResult.modelName} • {latestFilterResult.latencyMs}ms
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`text-[11px] font-bold px-2 py-0.5 rounded-md ${
                  latestFilterResult.actionable
                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                    : 'bg-slate-200 text-slate-700 border border-slate-300'
                }`}
              >
                {latestFilterResult.actionable ? '✅ ACTIONABLE' : '🚫 NON-ACTIONABLE (IGNORED)'}
              </span>
              <span className="text-gray-500">
                Confidence: <strong>{(latestFilterResult.confidence * 100).toFixed(1)}%</strong>
              </span>
              <span className="text-gray-400">•</span>
              <span className={latestFilterResult.actionable ? 'text-indigo-600 font-semibold' : 'text-gray-500'}>
                Gemini API: {latestFilterResult.actionable ? '⚡ CALLED' : '🛑 SKIPPED (Bandwidth & Token Saved)'}
              </span>
            </div>
            <p className="text-[11px] text-gray-500 italic">
              {latestFilterResult.reason}
            </p>
          </div>
        )}

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center justify-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </div>

      {/* Commitment-to-Action Card: Real Commitment Detected & Prepared */}
      {activeCommitment && (
        <div className="bg-gradient-to-br from-indigo-50/90 via-white to-purple-50/60 rounded-3xl p-6 sm:p-7 border-2 border-indigo-300 shadow-lg space-y-5 animate-in fade-in slide-in-from-top-2">
          {/* Banner Header */}
          <div className="flex items-center justify-between border-b border-indigo-100 pb-3.5">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-600 text-white flex items-center justify-center shadow-md">
                <Target className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] uppercase tracking-wider font-bold text-indigo-700 block">
                  Commitment Intelligence
                </span>
                <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                  COMMITMENT DETECTED
                  <span className="text-[11px] px-2 py-0.5 rounded-full font-bold bg-indigo-100 text-indigo-800">
                    {Math.round(activeCommitment.commitment.confidence * 100)}% Confidence
                  </span>
                </h3>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs px-3 py-1 rounded-full font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                Saved in SQLite
              </span>
              <button
                onClick={() => navigate('/tasks')}
                className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold flex items-center gap-0.5"
              >
                View in Tasks <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          </div>

          {/* Extracted Commitment Metadata Summary */}
          <div className="p-4 bg-white rounded-2xl border border-indigo-100 shadow-sm space-y-3">
            <p className="text-sm font-semibold text-gray-900 italic">
              "You promised to {activeCommitment.commitment.action}
              {activeCommitment.commitment.person ? ` for ${activeCommitment.commitment.person}` : ''}
              {activeCommitment.commitment.deadline ? ` ${activeCommitment.commitment.deadline}` : ''}."
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-xs">
              <div className="p-2.5 bg-gray-50 rounded-xl border border-gray-100">
                <span className="text-[10px] uppercase font-bold text-gray-400 block">Owner</span>
                <span className="font-semibold text-gray-800">{activeCommitment.commitment.owner || 'You'}</span>
              </div>
              <div className="p-2.5 bg-gray-50 rounded-xl border border-gray-100">
                <span className="text-[10px] uppercase font-bold text-gray-400 block">Action</span>
                <span className="font-semibold text-gray-800">{activeCommitment.commitment.action}</span>
              </div>
              <div className="p-2.5 bg-gray-50 rounded-xl border border-gray-100">
                <span className="text-[10px] uppercase font-bold text-gray-400 block">Person</span>
                <span className="font-semibold text-gray-800">{activeCommitment.commitment.person || 'Personal'}</span>
              </div>
              <div className="p-2.5 bg-gray-50 rounded-xl border border-gray-100">
                <span className="text-[10px] uppercase font-bold text-gray-400 block">Deadline</span>
                <span className="font-semibold text-gray-800">{activeCommitment.commitment.deadline || 'Flexible'}</span>
              </div>
            </div>
          </div>

          {/* Stage: Ready to Execute */}
          {(activeCommitment.stage === 'ready' || activeCommitment.stage === 'detected') && (
            <div className="p-5 bg-indigo-50/50 rounded-2xl border border-indigo-200 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-indigo-900 uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-indigo-600" />
                  READY TO EXECUTE
                </span>
                <span className="text-xs font-bold px-2.5 py-0.5 rounded-md bg-indigo-100 text-indigo-800 uppercase flex items-center gap-1">
                  {activeCommitment.commitment.executionType === 'message' && <Send className="w-3 h-3" />}
                  {activeCommitment.commitment.executionType === 'calendar' && <Calendar className="w-3 h-3" />}
                  {activeCommitment.commitment.executionType === 'laptop' && <Laptop className="w-3 h-3" />}
                  Type: {activeCommitment.commitment.executionType}
                </span>
              </div>

              <div>
                <span className="text-xs text-gray-700 font-semibold block mb-1.5">
                  Action: {activeCommitment.commitment.draftExecution?.title || activeCommitment.task.title}
                </span>
                {activeCommitment.isEditingDraft ? (
                  <textarea
                    value={activeCommitment.draftText}
                    onChange={(e) => setActiveCommitment({ ...activeCommitment, draftText: e.target.value })}
                    className="w-full text-xs p-3 border border-indigo-300 rounded-xl focus:ring-2 focus:ring-indigo-500 bg-white"
                    rows={3}
                  />
                ) : (
                  <div className="p-3.5 bg-white rounded-xl border border-indigo-100 text-xs font-medium text-gray-800 shadow-sm">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] uppercase tracking-wider font-bold text-gray-400">
                        Draft:
                      </span>
                      {copiedDraft && (
                        <span className="text-[10px] text-emerald-600 font-bold">
                          ✓ Copied to clipboard
                        </span>
                      )}
                    </div>
                    <p className="italic">"{activeCommitment.draftText}"</p>
                  </div>
                )}
              </div>

              {/* Confirmation / Execution Action Buttons */}
              <div className="flex flex-wrap items-center gap-2.5 pt-1">
                <button
                  onClick={handleConfirmExecute}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center gap-2 transform active:scale-95"
                >
                  <Send className="w-3.5 h-3.5" />
                  CONFIRM & EXECUTE
                </button>
                <button
                  onClick={() => setActiveCommitment({ ...activeCommitment, isEditingDraft: !activeCommitment.isEditingDraft })}
                  className="px-4 py-2.5 bg-white hover:bg-gray-50 border border-gray-300 text-gray-700 font-semibold text-xs rounded-xl transition-all flex items-center gap-1.5"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  {activeCommitment.isEditingDraft ? 'Done Editing' : 'EDIT'}
                </button>
                <button
                  onClick={handleCancelExecute}
                  className="px-4 py-2.5 bg-white hover:bg-gray-50 border border-gray-300 text-gray-500 font-semibold text-xs rounded-xl transition-all"
                >
                  CANCEL
                </button>
              </div>
            </div>
          )}

          {/* Stage: Executing Loader */}
          {activeCommitment.stage === 'executing' && (
            <div className="p-6 bg-white rounded-2xl border border-indigo-100 text-center space-y-2">
              <Sparkles className="w-6 h-6 text-indigo-600 animate-spin mx-auto" />
              <p className="text-xs font-bold text-gray-900">Executing commitment action via real handler...</p>
            </div>
          )}

          {/* Stage: Completed */}
          {activeCommitment.stage === 'completed' && (
            <div className="p-5 bg-emerald-50 rounded-2xl border border-emerald-200 space-y-3 animate-in fade-in">
              <div className="flex items-center gap-2 text-emerald-800 font-bold text-xs">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>✓ ACTION COMPLETED</span>
              </div>
              <p className="text-xs text-emerald-900 font-medium">
                {activeCommitment.executionResult}
              </p>
              <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
                <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-800 font-bold rounded-md">
                  ✓ Task updated in SQLite
                </span>
                <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-800 font-bold rounded-md">
                  ✓ Execution result recorded
                </span>
                <button
                  onClick={() => navigate('/tasks')}
                  className="text-emerald-700 hover:text-emerald-900 font-bold underline text-xs ml-auto"
                >
                  View in Tasks →
                </button>
              </div>
            </div>
          )}

          {/* Stage: Failed */}
          {activeCommitment.stage === 'failed' && (
            <div className="p-5 bg-amber-50 rounded-2xl border border-amber-200 space-y-3 animate-in fade-in">
              <div className="flex items-center gap-2 text-amber-800 font-bold text-xs">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                <span>⚠ ACTION FAILED</span>
              </div>
              <p className="text-xs text-amber-900 font-medium">
                Reason: {activeCommitment.errorReason || 'Execution could not be completed.'}
              </p>
              <div className="flex flex-wrap items-center gap-2 pt-1">
                {activeCommitment.commitment.executionType === 'laptop' && !officeKitStatus.connected && (
                  <button
                    onClick={() => navigate('/office-kit')}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-sm"
                  >
                    CONNECT LAPTOP
                  </button>
                )}
                <button
                  onClick={handleRetryExecute}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl shadow-sm"
                >
                  RETRY
                </button>
                <button
                  onClick={handleCancelExecute}
                  className="px-4 py-2 bg-white hover:bg-gray-50 border border-gray-300 text-gray-700 font-semibold text-xs rounded-xl"
                >
                  KEEP AS TASK
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Result Card: Task Automatically Created (When not active commitment) */}
      {!activeCommitment && latestTask && (
        <div className="bg-gradient-to-br from-indigo-50/80 via-white to-purple-50/50 rounded-2xl p-6 border-2 border-indigo-200 shadow-md space-y-4 animate-in fade-in slide-in-from-top-2">
          {/* Card Title & Badges */}
          <div className="flex items-center justify-between border-b border-indigo-100 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center shadow-sm">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <span className="text-[10px] uppercase tracking-wider font-bold text-indigo-700 block">
                  Source: Ambient AI
                </span>
                <h3 className="text-sm font-bold text-gray-900">Task automatically created</h3>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                Saved in SQLite
              </span>
              <button
                onClick={() => navigate('/tasks')}
                className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold flex items-center gap-0.5"
              >
                View in Tasks <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          </div>

          {/* Task Details Box */}
          <div className="p-4 bg-white rounded-xl border border-indigo-100 shadow-sm space-y-2">
            <p className="text-base font-bold text-gray-900">"{latestTask.title}"</p>
            {latestTask.description && (
              <p className="text-xs text-gray-600">{latestTask.description}</p>
            )}
            <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px]">
              <span className="px-2 py-0.5 bg-blue-50 text-blue-700 font-semibold rounded-md border border-blue-200">
                Priority: {latestTask.priority || 'MEDIUM'}
              </span>
              {latestTask.deadline && (
                <span className="px-2 py-0.5 bg-purple-50 text-purple-700 font-semibold rounded-md border border-purple-200 flex items-center gap-1">
                  <Clock className="w-3 h-3" /> Due: {new Date(latestTask.deadline).toLocaleString()}
                </span>
              )}
            </div>
          </div>

          {/* Transfer Notice if laptop not connected */}
          {!officeKitStatus.connected && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <WifiOff className="w-4 h-4 text-amber-600 flex-shrink-0" />
                <div>
                  <span className="font-bold">Laptop not connected. </span>
                  <span>Task is securely saved on phone. Connect laptop to enable instant transfer.</span>
                </div>
              </div>
              <button
                onClick={() => navigate('/office-kit')}
                className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl shadow-sm self-start sm:self-center transition-colors flex-shrink-0"
              >
                CONNECT LAPTOP
              </button>
            </div>
          )}

          {/* 3 Explicit Post-Creation Options */}
          <div className="space-y-2">
            <span className="text-xs font-bold text-gray-700 uppercase tracking-wider block">
              Options:
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {/* Option 1: 📱 Keep on Phone */}
              <button
                onClick={() => handleOptionKeepOnPhone(latestTask)}
                className={`p-3.5 rounded-xl border text-left flex flex-col justify-between transition-all ${
                  taskChoices[latestTask.id || latestTask.title] === 'phone'
                    ? 'bg-blue-600 text-white border-blue-600 shadow-md ring-2 ring-blue-300'
                    : 'bg-white hover:bg-blue-50 border-gray-200 text-gray-900'
                }`}
              >
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-xl">📱</span>
                  <span className="text-xs font-bold">1. Keep on Phone</span>
                </div>
                <span
                  className={`text-[11px] ${
                    taskChoices[latestTask.id || latestTask.title] === 'phone'
                      ? 'text-blue-100'
                      : 'text-gray-500'
                  }`}
                >
                  Stored in local SQLite DB
                </span>
              </button>

              {/* Option 2: 💻 Send to Laptop */}
              <button
                onClick={() => handleOptionSendToLaptop(latestTask)}
                disabled={transferLoading[latestTask.id || latestTask.title] || !officeKitStatus.connected}
                className={`p-3.5 rounded-xl border text-left flex flex-col justify-between transition-all ${
                  !officeKitStatus.connected
                    ? 'bg-gray-100 border-gray-200 text-gray-400 opacity-60 cursor-not-allowed'
                    : taskChoices[latestTask.id || latestTask.title] === 'laptop'
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-md ring-2 ring-indigo-300'
                    : 'bg-white hover:bg-indigo-50 border-gray-200 text-gray-900'
                }`}
              >
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-xl">💻</span>
                  <span className="text-xs font-bold">2. Send to Laptop</span>
                </div>
                <span
                  className={`text-[11px] ${
                    taskChoices[latestTask.id || latestTask.title] === 'laptop'
                      ? 'text-indigo-100'
                      : 'text-gray-500'
                  }`}
                >
                  {officeKitStatus.connected
                    ? `Transfer via Office Kit to ${officeKitStatus.laptop?.name || 'PC'}`
                    : 'Laptop not connected'}
                </span>
              </button>

              {/* Option 3: 📱💻 Both */}
              <button
                onClick={() => handleOptionSendToBoth(latestTask)}
                disabled={transferLoading[latestTask.id || latestTask.title] || !officeKitStatus.connected}
                className={`p-3.5 rounded-xl border text-left flex flex-col justify-between transition-all ${
                  !officeKitStatus.connected
                    ? 'bg-gray-100 border-gray-200 text-gray-400 opacity-60 cursor-not-allowed'
                    : taskChoices[latestTask.id || latestTask.title] === 'both'
                    ? 'bg-purple-600 text-white border-purple-600 shadow-md ring-2 ring-purple-300'
                    : 'bg-white hover:bg-purple-50 border-gray-200 text-gray-900'
                }`}
              >
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-xl">📱💻</span>
                  <span className="text-xs font-bold">3. Send to Both</span>
                </div>
                <span
                  className={`text-[11px] ${
                    taskChoices[latestTask.id || latestTask.title] === 'both'
                      ? 'text-purple-100'
                      : 'text-gray-500'
                  }`}
                >
                  {officeKitStatus.connected
                    ? 'Keep in SQLite + Transfer to PC'
                    : 'Laptop not connected'}
                </span>
              </button>
            </div>
          </div>

          {/* Transfer Result Feedback */}
          {transferStatus[latestTask.id || latestTask.title] && (
            <div className="p-3 bg-white rounded-xl border border-indigo-100 text-xs font-semibold text-indigo-900 flex items-center gap-2 animate-in fade-in">
              <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0" />
              <span>{transferStatus[latestTask.id || latestTask.title]}</span>
            </div>
          )}
        </div>
      )}

      {/* History of Ambient Created Tasks in this session */}
      {createdTasks.length > 1 && (
        <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-gray-900 flex items-center gap-2">
              <Layers className="w-4 h-4 text-indigo-600" />
              Ambient Session History ({createdTasks.length} tasks)
            </h2>
            <button
              onClick={() => navigate('/tasks')}
              className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold"
            >
              All Tasks →
            </button>
          </div>

          <div className="divide-y divide-gray-100">
            {createdTasks.slice(1).map((task) => (
              <div
                key={task.id}
                className="py-3 flex items-center justify-between gap-3 text-xs"
              >
                <div>
                  <span className="font-semibold text-gray-900 block">{task.title}</span>
                  <span className="text-[10px] text-gray-500">
                    Priority: {task.priority || 'MEDIUM'}
                  </span>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  SQLite Saved
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Architectural Notice Footer */}
      <div className="p-4 bg-gray-50 rounded-2xl border border-gray-200 flex items-start gap-3 text-xs text-gray-500">
        <ShieldCheck className="w-5 h-5 text-indigo-600 flex-shrink-0 mt-0.5" />
        <div>
          <span className="font-bold text-gray-700 block">Foreground Audio Architecture Notice</span>
          <p className="mt-0.5 leading-relaxed">
            Ambient AI operates in active browser foreground mode with explicit opt-in. All speech segments are processed through your verified Gemini pipeline and persisted directly to local SQLite database.
          </p>
        </div>
      </div>
    </div>
  )
}
