import React, { useState, useRef, useCallback, useEffect } from 'react'
import {
  Camera,
  Mic,
  MicOff,
  Type,
  Sparkles,
  CheckCircle,
  AlertCircle,
  Download,
  Copy,
  Laptop,
  FileSpreadsheet,
  FileText,
  ListTodo,
  StickyNote,
  Trash2,
  RefreshCw,
  ArrowRight,
  Zap,
  Radio,
  Video,
  VideoOff,
  Image as ImageIcon,
} from 'lucide-react'
import { apiClient } from '../services/api'
import { AIActionPipelineResult } from '@iqoo/shared'
import { useNavigate } from 'react-router-dom'

interface AIActionHubProps {
  onSuccess?: (result: AIActionPipelineResult) => void
  initialMode?: 'camera' | 'voice' | 'camera-voice' | 'text'
  compact?: boolean
}

export const AIActionHub: React.FC<AIActionHubProps> = ({
  onSuccess,
  initialMode = 'camera',
  compact = false,
}) => {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<'camera' | 'voice' | 'camera-voice' | 'text'>(initialMode)
  const [instruction, setInstruction] = useState('')
  const [imageBase64, setImageBase64] = useState<string | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [recording, setRecording] = useState(false)
  const [interimTranscript, setInterimTranscript] = useState('')
  const [loading, setLoading] = useState(false)
  const [autoExecute, setAutoExecute] = useState(true)
  const [result, setResult] = useState<AIActionPipelineResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  // Live Camera Viewfinder State
  const [isLiveCameraActive, setIsLiveCameraActive] = useState(false)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const cameraStreamRef = useRef<MediaStream | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const recognitionRef = useRef<any>(null)
  const mediaStreamRef = useRef<MediaStream | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])

  // Transcribe audio blob via backend if SpeechRecognition is blocked by browser
  const transcribeAudioBlob = async (blob: Blob) => {
    try {
      const reader = new FileReader()
      reader.onload = async (e) => {
        const base64 = e.target?.result as string
        if (!base64) return
        try {
          const res = await apiClient.processActionPipeline({
            image: base64,
            mimeType: blob.type || 'audio/webm',
            text: 'Transcribe this voice command, extract all details, and structure an action.',
            autoExecute: false,
          })
          if (res?.data?.extractedInfo?.summary || res?.data?.extractedInfo?.title) {
            const transcript = res.data.extractedInfo.summary || res.data.extractedInfo.title || ''
            setInstruction(transcript)
          }
          if (res?.data) {
            setResult(res.data)
            onSuccess?.(res.data)
          }
        } catch (err: any) {
          console.warn('Audio fallback transcription notice:', err)
        }
      }
      reader.readAsDataURL(blob)
    } catch (err) {
      console.warn('Audio reader error:', err)
    }
  }

  // Stop live camera viewfinder stream
  const stopLiveCamera = useCallback(() => {
    if (cameraStreamRef.current) {
      cameraStreamRef.current.getTracks().forEach((track) => track.stop())
      cameraStreamRef.current = null
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
    setIsLiveCameraActive(false)
  }, [])

  // Start live camera stream
  const startLiveCamera = async () => {
    setError(null)
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera access is not supported by your browser.')
      }

      let stream: MediaStream
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
        })
      } catch {
        stream = await navigator.mediaDevices.getUserMedia({ video: true })
      }

      cameraStreamRef.current = stream
      setIsLiveCameraActive(true)

      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          videoRef.current.play().catch((e) => console.warn('Video play error:', e))
        }
      }, 100)
    } catch (err: any) {
      console.error('Camera access error:', err)
      const isDenied = err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError'
      setError(
        isDenied
          ? 'Camera permission was denied. Please allow camera access in your browser.'
          : `Camera device error: ${err.message || 'Could not access camera device.'}`
      )
      setIsLiveCameraActive(false)
    }
  }

  // Capture still frame snapshot from live video stream
  const captureSnapshot = () => {
    if (!videoRef.current) return
    const video = videoRef.current
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth || 640
    canvas.height = video.videoHeight || 480
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
    const dataUrl = canvas.toDataURL('image/jpeg', 0.9)
    setImageBase64(dataUrl)
    setImagePreview(dataUrl)
    stopLiveCamera()
  }

  // Initialize Web Speech API for voice recording
  const initSpeechRecognition = useCallback(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SpeechRecognition) {
      return null
    }

    const recognition = new SpeechRecognition()
    recognition.continuous = false
    recognition.interimResults = true
    recognition.lang = 'en-US'

    recognition.onstart = () => {
      setRecording(true)
      setError(null)
    }

    recognition.onresult = (event: any) => {
      let interim = ''
      let final = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const text = event.results[i][0].transcript
        if (event.results[i].isFinal) {
          final += text + ' '
        } else {
          interim += text
        }
      }
      if (final) {
        setInstruction((prev) => (prev ? `${prev} ${final.trim()}` : final.trim()))
      }
      setInterimTranscript(interim)
    }

    recognition.onerror = (event: any) => {
      console.warn('SpeechRecognition error:', event.error)
      if (event.error === 'not-allowed') {
        console.info('SpeechRecognition cloud service blocked; using direct MediaRecorder audio capture.')
      } else if (event.error !== 'no-speech') {
        setError(`Microphone notice: ${event.error}`)
      }
    }

    recognition.onend = () => {
      setInterimTranscript('')
    }

    recognitionRef.current = recognition
    return recognition
  }, [])

  const toggleRecording = async () => {
    if (recording) {
      // Stop speech recognition
      try {
        recognitionRef.current?.stop()
      } catch {
        // ignore
      }

      // Stop media recorder
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop()
      }

      // Release media stream tracks
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop())
        mediaStreamRef.current = null
      }

      setRecording(false)
      return
    }

    setError(null)

    // 1. Explicitly request hardware microphone stream via getUserMedia
    let stream: MediaStream | null = null
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('getUserMedia is not supported on this browser.')
      }
      stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      mediaStreamRef.current = stream
    } catch (err: any) {
      console.error('Microphone access error:', err)
      const isDenied = err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError'
      setError(
        isDenied
          ? 'Microphone permission was denied. Please allow microphone access in your browser address bar.'
          : `Microphone device error: ${err.message || 'Could not access audio device.'}`
      )
      setRecording(false)
      return
    }

    setRecording(true)

    // 2. Start MediaRecorder as guaranteed audio stream capture
    try {
      if (typeof MediaRecorder !== 'undefined' && stream) {
        const recorder = new MediaRecorder(stream)
        audioChunksRef.current = []
        recorder.ondataavailable = (e) => {
          if (e.data && e.data.size > 0) {
            audioChunksRef.current.push(e.data)
          }
        }
        recorder.onstop = () => {
          if (audioChunksRef.current.length > 0) {
            const blob = new Blob(audioChunksRef.current, { type: recorder.mimeType || 'audio/webm' })
            setInstruction((prev) => {
              if (prev && prev.trim()) return prev // Already captured by SpeechRecognition
              transcribeAudioBlob(blob)
              return 'Processing voice command...'
            })
          }
        }
        mediaRecorderRef.current = recorder
        recorder.start()
      }
    } catch (recorderErr) {
      console.warn('MediaRecorder init error:', recorderErr)
    }

    // 3. Start SpeechRecognition for real-time live transcription
    const recognition = initSpeechRecognition()
    if (recognition) {
      try {
        recognition.start()
      } catch (recErr: any) {
        console.warn('SpeechRecognition.start() error:', recErr)
      }
    }
  }

  const handleImageFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      setError('Please select a valid image file.')
      return
    }
    setError(null)
    const reader = new FileReader()
    reader.onload = (e) => {
      const base64 = e.target?.result as string
      setImageBase64(base64)
      setImagePreview(base64)
      stopLiveCamera()
    }
    reader.readAsDataURL(file)
  }

  const handleProcess = async (overrideText?: string) => {
    const textToSubmit = overrideText !== undefined ? overrideText : instruction

    // Validation for Combined Camera + Voice Mode
    if (activeTab === 'camera-voice') {
      if (!imageBase64) {
        setError('Please capture or select an image first before processing.')
        return
      }
      if (!textToSubmit.trim()) {
        setError('Please provide a voice instruction (or speak) describing what to do with the image.')
        return
      }
    } else {
      if (!textToSubmit.trim() && !imageBase64) {
        setError('Please capture an image, speak, or type an instruction.')
        return
      }
    }

    if (recording) {
      recognitionRef.current?.stop()
      setRecording(false)
    }

    setLoading(true)
    setError(null)

    try {
      const response = await apiClient.processActionPipeline({
        text: textToSubmit.trim() || undefined,
        image: imageBase64 || undefined,
        autoExecute,
      })

      const data: AIActionPipelineResult = response.data
      setResult(data)
      onSuccess?.(data)
    } catch (err: any) {
      setError(
        err?.response?.data?.error ||
          err?.response?.data?.message ||
          err?.message ||
          'Failed to process AI action pipeline.'
      )
    } finally {
      setLoading(false)
    }
  }

  const handleExecutePending = async () => {
    if (!result || !result.action) return
    setLoading(true)
    setError(null)
    try {
      const res = await apiClient.executeAIActions([result.action])
      const execRes = res.data?.results?.[0]
      if (execRes?.success) {
        setResult((prev) =>
          prev
            ? {
                ...prev,
                executed: true,
                executionResult: execRes.result,
              }
            : null
        )
      } else {
        setError(execRes?.error || 'Action execution failed.')
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Execution error.')
    } finally {
      setLoading(false)
    }
  }

  const handleDownloadFile = (file: { name: string; content: string; type: string }) => {
    const blob = new Blob([file.content], { type: file.type || 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = file.name || 'export.txt'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const handleCopyContent = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const clearAll = () => {
    stopLiveCamera()
    setInstruction('')
    setImageBase64(null)
    setImagePreview(null)
    setResult(null)
    setError(null)
    setInterimTranscript('')
  }

  // Cleanup on unmount or tab change
  useEffect(() => {
    return () => {
      stopLiveCamera()
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop())
      }
      try {
        recognitionRef.current?.stop()
      } catch {
        // ignore
      }
    }
  }, [stopLiveCamera])

  const suggestions = [
    {
      label: '📄 Extract & Create Task',
      prompt: 'Extract the important information, vendor, amounts and due date and create a task',
    },
    {
      label: '📊 Extract to CSV',
      prompt: 'Extract this data and create a structured CSV spreadsheet',
    },
    {
      label: '📝 Executive Report',
      prompt: 'Summarize the important information and generate a formal Markdown report',
    },
    {
      label: '📌 Save as Note',
      prompt: 'Save this information as a structured quick note',
    },
    {
      label: '💻 Send to Laptop',
      prompt: 'Extract this content and send to laptop via Office Kit',
    },
  ]

  const getActionBadgeColor = (type: string) => {
    const t = type.toLowerCase()
    if (t.includes('task')) return 'bg-blue-100 text-blue-800 border-blue-200'
    if (t.includes('csv')) return 'bg-emerald-100 text-emerald-800 border-emerald-200'
    if (t.includes('report')) return 'bg-purple-100 text-purple-800 border-purple-200'
    if (t.includes('note')) return 'bg-amber-100 text-amber-800 border-amber-200'
    if (t.includes('laptop')) return 'bg-indigo-100 text-indigo-800 border-indigo-200'
    return 'bg-gray-100 text-gray-800 border-gray-200'
  }

  const getActionIcon = (type: string) => {
    const t = type.toLowerCase()
    if (t.includes('task')) return <ListTodo className="w-5 h-5 text-blue-600" />
    if (t.includes('csv')) return <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
    if (t.includes('report')) return <FileText className="w-5 h-5 text-purple-600" />
    if (t.includes('note')) return <StickyNote className="w-5 h-5 text-amber-600" />
    if (t.includes('laptop')) return <Laptop className="w-5 h-5 text-indigo-600" />
    return <Zap className="w-5 h-5 text-blue-600" />
  }

  return (
    <div className={`bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden ${compact ? 'p-3' : 'p-4 sm:p-6'}`}>
      {/* Header Banner */}
      <div className="flex items-center justify-between pb-4 border-b border-gray-100">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              Phone-First AI Action Engine
              <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 font-semibold border border-blue-200">
                Gemini 2.5 Flash
              </span>
            </h2>
            <p className="text-xs text-gray-500">Capture real-world info → Gemini AI → Instant digital work</p>
          </div>
        </div>

        {(imageBase64 || instruction || result) && (
          <button
            onClick={clearAll}
            className="text-xs text-gray-500 hover:text-red-600 flex items-center gap-1 px-2.5 py-1.5 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Reset
          </button>
        )}
      </div>

      {/* Input Channel Selector Tabs: Camera, Voice, Camera + Voice, Type */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 my-4 bg-gray-100/80 p-1.5 rounded-xl">
        <button
          onClick={() => {
            stopLiveCamera()
            setActiveTab('camera')
          }}
          className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-xs sm:text-sm font-semibold transition-all ${
            activeTab === 'camera'
              ? 'bg-white text-blue-600 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <Camera className="w-4 h-4" />
          <span>Camera</span>
        </button>

        <button
          onClick={() => {
            stopLiveCamera()
            setActiveTab('voice')
          }}
          className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-xs sm:text-sm font-semibold transition-all ${
            activeTab === 'voice'
              ? 'bg-white text-blue-600 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <Mic className={`w-4 h-4 ${recording && activeTab === 'voice' ? 'text-red-500 animate-pulse' : ''}`} />
          <span>Voice</span>
        </button>

        <button
          onClick={() => {
            setActiveTab('camera-voice')
          }}
          className={`flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-lg text-xs sm:text-sm font-bold transition-all ${
            activeTab === 'camera-voice'
              ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/20'
              : 'text-indigo-600 hover:bg-indigo-50/50'
          }`}
        >
          <div className="flex items-center gap-0.5">
            <Camera className="w-3.5 h-3.5" />
            <span>+</span>
            <Mic className="w-3.5 h-3.5" />
          </div>
          <span>Camera + Voice</span>
        </button>

        <button
          onClick={() => {
            stopLiveCamera()
            setActiveTab('text')
          }}
          className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-xs sm:text-sm font-semibold transition-all ${
            activeTab === 'text'
              ? 'bg-white text-blue-600 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <Type className="w-4 h-4" />
          <span>Type</span>
        </button>
      </div>

      {/* Hidden File Inputs */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) handleImageFile(file)
        }}
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) handleImageFile(file)
        }}
      />

      {/* Tab 1: Camera Only */}
      {activeTab === 'camera' && (
        <div className="space-y-3">
          {!imagePreview ? (
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => cameraInputRef.current?.click()}
                className="flex flex-col items-center justify-center gap-2 p-6 rounded-xl border-2 border-dashed border-blue-300 bg-blue-50/50 hover:bg-blue-50 transition-all text-blue-700 font-medium"
              >
                <div className="w-12 h-12 rounded-full bg-blue-600 text-white flex items-center justify-center shadow-md">
                  <Camera className="w-6 h-6" />
                </div>
                <span className="text-sm font-semibold">Snap Photo / Document</span>
                <span className="text-xs text-blue-500">Invoices, whiteboards, notes</span>
              </button>

              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex flex-col items-center justify-center gap-2 p-6 rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 hover:bg-gray-100 transition-all text-gray-700 font-medium"
              >
                <div className="w-12 h-12 rounded-full bg-gray-200 text-gray-700 flex items-center justify-center">
                  <FileText className="w-6 h-6" />
                </div>
                <span className="text-sm font-semibold">Upload Image File</span>
                <span className="text-xs text-gray-500">PNG, JPG, WebP</span>
              </button>
            </div>
          ) : (
            <div className="relative rounded-xl overflow-hidden border border-gray-200 bg-gray-900 group">
              <img
                src={imagePreview}
                alt="Captured visual item"
                className="w-full max-h-60 object-contain mx-auto"
              />
              <div className="absolute top-2 right-2 flex gap-2">
                <button
                  onClick={() => cameraInputRef.current?.click()}
                  className="px-2.5 py-1 bg-black/70 hover:bg-black text-white text-xs rounded-lg backdrop-blur-sm flex items-center gap-1"
                >
                  <Camera className="w-3.5 h-3.5" /> Retake
                </button>
                <button
                  onClick={() => {
                    setImageBase64(null)
                    setImagePreview(null)
                  }}
                  className="p-1 bg-red-600/90 hover:bg-red-600 text-white rounded-lg backdrop-blur-sm"
                  title="Remove image"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Voice Only */}
      {activeTab === 'voice' && (
        <div className="p-6 rounded-xl border border-gray-200 bg-gradient-to-b from-gray-50 to-white text-center space-y-4">
          <button
            onClick={toggleRecording}
            className={`w-20 h-20 rounded-full mx-auto flex items-center justify-center text-white transition-all transform hover:scale-105 shadow-lg ${
              recording
                ? 'bg-red-600 animate-pulse shadow-red-500/50 ring-4 ring-red-200'
                : 'bg-blue-600 shadow-blue-500/30 hover:bg-blue-700'
            }`}
          >
            <Mic className="w-8 h-8" />
          </button>
          <div>
            <p className="text-sm font-semibold text-gray-800">
              {recording ? 'Listening... Speak your command now' : 'Tap microphone to speak'}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              e.g. "Create a task to finish API documentation by Friday"
            </p>
          </div>

          {interimTranscript && (
            <div className="p-3 bg-blue-50 rounded-lg text-xs text-blue-800 italic animate-pulse">
              "{interimTranscript}"
            </div>
          )}
        </div>
      )}

      {/* Tab 3: COMBINED Camera + Voice Workflow */}
      {activeTab === 'camera-voice' && (
        <div className="space-y-4">
          {/* Subtitle / Description */}
          <div className="bg-gradient-to-r from-blue-50/80 to-indigo-50/80 p-3.5 rounded-xl border border-blue-100 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center shadow-sm flex-shrink-0">
              <Zap className="w-4 h-4" />
            </div>
            <div className="text-xs">
              <span className="font-bold text-blue-950 block">Combined Multimodal Workflow</span>
              <span className="text-blue-800">
                Capture an image (e.g. invoice, screen error, notes) AND give a natural spoken instruction.
              </span>
            </div>
          </div>

          {/* STEP 1: Camera Capture Section */}
          <div className="border border-gray-200 rounded-2xl p-4 bg-white space-y-3">
            <div className="flex items-center justify-between border-b border-gray-100 pb-2">
              <span className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-1.5">
                <Camera className="w-4 h-4 text-blue-600" />
                Step 1: Capture or Select Image
              </span>
              {imagePreview && (
                <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200 flex items-center gap-1">
                  <CheckCircle className="w-3 h-3" /> Image Ready
                </span>
              )}
            </div>

            {/* Live Camera Viewfinder Streaming */}
            {isLiveCameraActive ? (
              <div className="relative rounded-xl overflow-hidden bg-black aspect-video max-h-72 flex items-center justify-center">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />
                <div className="absolute bottom-3 left-0 right-0 flex items-center justify-center gap-3">
                  <button
                    onClick={captureSnapshot}
                    className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs sm:text-sm rounded-full shadow-lg flex items-center gap-2 transform active:scale-95 transition-all"
                  >
                    <Camera className="w-4 h-4" /> Capture Photo
                  </button>
                  <button
                    onClick={stopLiveCamera}
                    className="p-2.5 bg-black/60 hover:bg-black text-white rounded-full backdrop-blur-sm"
                    title="Close live camera"
                  >
                    <VideoOff className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ) : !imagePreview ? (
              /* No Image Captured Yet - Options to Capture */
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <button
                  onClick={startLiveCamera}
                  className="flex flex-col items-center justify-center gap-2 p-5 rounded-xl border-2 border-blue-300 bg-blue-50/60 hover:bg-blue-50 text-blue-800 transition-all font-semibold text-xs"
                >
                  <div className="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center shadow-md">
                    <Video className="w-5 h-5" />
                  </div>
                  <span>Open Live Camera</span>
                  <span className="text-[10px] text-blue-600 font-normal">Live viewfinder & capture</span>
                </button>

                <button
                  onClick={() => cameraInputRef.current?.click()}
                  className="flex flex-col items-center justify-center gap-2 p-5 rounded-xl border border-gray-200 bg-gray-50 hover:bg-gray-100 text-gray-800 transition-all font-semibold text-xs"
                >
                  <div className="w-10 h-10 rounded-full bg-gray-200 text-gray-700 flex items-center justify-center">
                    <Camera className="w-5 h-5" />
                  </div>
                  <span>Snap Phone Photo</span>
                  <span className="text-[10px] text-gray-500 font-normal">Native camera capture</span>
                </button>

                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex flex-col items-center justify-center gap-2 p-5 rounded-xl border border-gray-200 bg-gray-50 hover:bg-gray-100 text-gray-800 transition-all font-semibold text-xs"
                >
                  <div className="w-10 h-10 rounded-full bg-gray-200 text-gray-700 flex items-center justify-center">
                    <ImageIcon className="w-5 h-5" />
                  </div>
                  <span>Upload Image File</span>
                  <span className="text-[10px] text-gray-500 font-normal">PNG, JPG, WebP</span>
                </button>
              </div>
            ) : (
              /* Captured Image Preview */
              <div className="relative rounded-xl overflow-hidden border border-gray-200 bg-gray-900">
                <img
                  src={imagePreview}
                  alt="Captured input"
                  className="w-full max-h-56 object-contain mx-auto"
                />
                <div className="absolute top-2 right-2 flex gap-2">
                  <button
                    onClick={startLiveCamera}
                    className="px-2.5 py-1 bg-black/70 hover:bg-black text-white text-xs rounded-lg backdrop-blur-sm flex items-center gap-1"
                  >
                    <Video className="w-3.5 h-3.5" /> Live Camera
                  </button>
                  <button
                    onClick={() => cameraInputRef.current?.click()}
                    className="px-2.5 py-1 bg-black/70 hover:bg-black text-white text-xs rounded-lg backdrop-blur-sm flex items-center gap-1"
                  >
                    <Camera className="w-3.5 h-3.5" /> Retake
                  </button>
                  <button
                    onClick={() => {
                      setImageBase64(null)
                      setImagePreview(null)
                    }}
                    className="p-1 bg-red-600/90 hover:bg-red-600 text-white rounded-lg backdrop-blur-sm"
                    title="Remove image"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* STEP 2: Voice Instruction Section */}
          <div className="border border-gray-200 rounded-2xl p-4 bg-white space-y-3">
            <div className="flex items-center justify-between border-b border-gray-100 pb-2">
              <span className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-1.5">
                <Mic className="w-4 h-4 text-indigo-600" />
                Step 2: Spoken Voice Instruction
              </span>
              {instruction.trim() && (
                <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200 flex items-center gap-1">
                  <CheckCircle className="w-3 h-3" /> Voice Ready
                </span>
              )}
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-4 p-4 rounded-xl bg-gradient-to-r from-gray-50 to-indigo-50/40 border border-gray-200">
              {/* Microphone Toggle Button */}
              <button
                onClick={toggleRecording}
                className={`w-16 h-16 rounded-full flex-shrink-0 flex items-center justify-center text-white transition-all transform hover:scale-105 shadow-md ${
                  recording
                    ? 'bg-red-600 animate-pulse ring-4 ring-red-200 shadow-red-500/40'
                    : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-500/30'
                }`}
                title={recording ? 'Stop Recording' : 'Start Speaking'}
              >
                {recording ? <MicOff className="w-7 h-7" /> : <Mic className="w-7 h-7" />}
              </button>

              <div className="flex-1 text-center sm:text-left space-y-1">
                <div className="flex items-center justify-center sm:justify-start gap-2">
                  <span
                    className={`text-xs font-bold uppercase tracking-wider ${
                      recording ? 'text-red-600 animate-pulse' : 'text-gray-700'
                    }`}
                  >
                    {recording ? 'RECORDING... Speak your instruction now' : 'Press to Speak Voice Command'}
                  </span>
                </div>
                <p className="text-[11px] text-gray-500">
                  e.g. "Create a task to pay this invoice before due date" or "Extract error details to fix bug"
                </p>
              </div>
            </div>

            {/* Live Interim Speech Preview */}
            {interimTranscript && (
              <div className="p-3 bg-indigo-50 rounded-xl text-xs text-indigo-900 italic animate-pulse flex items-center gap-2">
                <Radio className="w-3.5 h-3.5 text-indigo-600 animate-spin" />
                <span>"{interimTranscript}"</span>
              </div>
            )}

            {/* Editable Voice Transcript Field */}
            <div className="relative">
              <textarea
                value={instruction}
                onChange={(e) => setInstruction(e.target.value)}
                placeholder="Spoken transcript will appear here (or you can edit/type your instruction)..."
                rows={2}
                className="w-full text-xs sm:text-sm p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none resize-none"
              />
            </div>
          </div>

          {/* STEP 3: Clear Visual Summary Box Before Processing */}
          <div className="border-2 border-indigo-200 bg-gradient-to-br from-indigo-50/50 via-white to-blue-50/30 rounded-2xl p-5 shadow-sm space-y-4">
            <h3 className="text-xs font-bold text-indigo-950 uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-indigo-600" />
              Visual Summary (Ready to Process)
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* Summary Item 1: Captured Image */}
              <div className="p-3 bg-white rounded-xl border border-indigo-100 flex items-center gap-3">
                <div className="w-12 h-12 rounded-lg bg-gray-100 border border-gray-200 overflow-hidden flex items-center justify-center flex-shrink-0">
                  {imagePreview ? (
                    <img src={imagePreview} alt="Thumbnail" className="w-full h-full object-cover" />
                  ) : (
                    <Camera className="w-5 h-5 text-gray-400" />
                  )}
                </div>
                <div className="overflow-hidden">
                  <span className="text-[10px] font-bold uppercase text-gray-500 block">
                    📷 Captured Image
                  </span>
                  <span className="text-xs font-semibold text-gray-800 truncate block">
                    {imagePreview ? 'Image captured & loaded' : 'No image captured yet'}
                  </span>
                </div>
              </div>

              {/* Summary Item 2: Voice Instruction */}
              <div className="p-3 bg-white rounded-xl border border-indigo-100 flex items-center gap-3">
                <div className="w-12 h-12 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center flex-shrink-0">
                  <Mic className={`w-5 h-5 ${instruction ? 'text-indigo-600' : 'text-gray-400'}`} />
                </div>
                <div className="overflow-hidden">
                  <span className="text-[10px] font-bold uppercase text-gray-500 block">
                    🎤 Voice Instruction
                  </span>
                  <span className="text-xs font-semibold text-gray-800 truncate block italic">
                    {instruction.trim() ? `"${instruction.trim()}"` : 'No instruction spoken yet'}
                  </span>
                </div>
              </div>
            </div>

            {/* Auto Execute Toggle & PROCESS Button */}
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-indigo-100">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={autoExecute}
                  onChange={(e) => setAutoExecute(e.target.checked)}
                  className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-gray-300"
                />
                <span className="text-xs font-medium text-gray-700">
                  Auto-execute task / action directly into SQLite
                </span>
              </label>

              <button
                onClick={() => handleProcess()}
                disabled={loading || !imageBase64 || !instruction.trim()}
                className="w-full sm:w-auto px-8 py-3 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 disabled:opacity-50 text-white text-xs sm:text-sm font-bold rounded-xl shadow-md shadow-indigo-500/20 transition-all transform active:scale-95 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Gemini is analyzing Image + Voice...</span>
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4" />
                    <span>PROCESS (Image + Voice)</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tab 4: Type Only (or Standard Bottom Form for Camera/Voice/Text) */}
      {activeTab !== 'camera-voice' && (
        <div className="mt-4 space-y-2">
          <div className="relative">
            <textarea
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              placeholder={
                imageBase64
                  ? 'Add instruction for this image (e.g., "Extract invoice items and create task" or "Create CSV")...'
                  : 'What would you like AI to do? (e.g., "Create task called Fix login bug with high priority")...'
              }
              rows={compact ? 2 : 3}
              className="w-full text-sm p-3 pr-10 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-none"
            />
            <button
              onClick={toggleRecording}
              className={`absolute bottom-3 right-3 p-1.5 rounded-lg transition-colors ${
                recording ? 'bg-red-100 text-red-600' : 'text-gray-400 hover:text-blue-600 hover:bg-gray-100'
              }`}
              title="Speech to text"
            >
              <Mic className={`w-4 h-4 ${recording ? 'animate-pulse text-red-600' : ''}`} />
            </button>
          </div>

          {/* Suggestion Chips */}
          <div className="flex flex-wrap gap-1.5 pt-1">
            {suggestions.map((s, idx) => (
              <button
                key={idx}
                onClick={() => {
                  setInstruction(s.prompt)
                  handleProcess(s.prompt)
                }}
                className="text-xs px-2.5 py-1 rounded-full bg-gray-100 hover:bg-blue-50 hover:text-blue-700 text-gray-700 border border-gray-200 transition-colors"
              >
                {s.label}
              </button>
            ))}
          </div>

          {/* Actions & Execution Settings */}
          <div className="mt-4 flex items-center justify-between pt-3 border-t border-gray-100">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={autoExecute}
                onChange={(e) => setAutoExecute(e.target.checked)}
                className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-gray-300"
              />
              <span className="text-xs font-medium text-gray-700">
                Auto-execute digital work directly
              </span>
            </label>

            <button
              onClick={() => handleProcess()}
              disabled={loading || (!instruction.trim() && !imageBase64)}
              className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 text-white text-xs sm:text-sm font-semibold rounded-xl shadow-md shadow-blue-500/20 transition-all transform active:scale-95"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>AI is understanding...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Execute AI Action</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Loading Overlay State */}
      {loading && (
        <div className="mt-4 p-4 rounded-xl bg-blue-50/80 border border-blue-100 flex items-center gap-3 animate-in fade-in">
          <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center animate-spin">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <p className="text-xs font-bold text-blue-900">Gemini AI is understanding input...</p>
            <p className="text-xs text-blue-700">Extracting structured intent and generating verified action</p>
          </div>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="mt-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-start gap-2">
          <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <span className="font-semibold">Pipeline Notice: </span>
            {error}
          </div>
        </div>
      )}

      {/* Result Display Card */}
      {result && !loading && (
        <div className="mt-5 space-y-4 pt-4 border-t-2 border-dashed border-gray-200 animate-in fade-in slide-in-from-bottom-2">
          {/* Status Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-emerald-600" />
              <h3 className="text-sm font-bold text-gray-900">
                {result.executed ? 'Digital Work Executed Successfully' : 'Structured Action Prepared'}
              </h3>
            </div>
            <span className="text-xs text-gray-400 font-mono">
              Provider: {result.provider}
            </span>
          </div>

          {/* Section 1: Extracted Information */}
          <div className="p-3.5 bg-gray-50 rounded-xl border border-gray-200 space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                [ Extracted Information ]
              </h4>
              {result.extractedInfo.confidence && (
                <span className="text-xs text-emerald-700 font-medium">
                  {Math.round(result.extractedInfo.confidence * 100)}% confidence
                </span>
              )}
            </div>

            <p className="text-sm font-semibold text-gray-900">
              {result.extractedInfo.title || 'Extracted Item'}
            </p>
            {result.extractedInfo.summary && (
              <p className="text-xs text-gray-600">{result.extractedInfo.summary}</p>
            )}

            {/* Extracted Key Fields Grid */}
            {result.extractedInfo.fields && Object.keys(result.extractedInfo.fields).length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 pt-1.5">
                {Object.entries(result.extractedInfo.fields).map(([k, v], idx) => (
                  <div key={idx} className="p-2 bg-white rounded-lg border border-gray-200 text-xs">
                    <span className="text-gray-500 block text-[10px] uppercase font-semibold">{k}</span>
                    <span className="font-bold text-gray-900">{String(v)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Section 2: Action Performed & Digital Work Result */}
          <div className="p-4 bg-gradient-to-br from-blue-50/50 to-indigo-50/30 rounded-xl border border-blue-100 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-blue-900 uppercase tracking-wider flex items-center gap-1.5">
                {getActionIcon(result.action.type)}
                [ Action: {result.action.type.toUpperCase()} ]
              </h4>
              <span
                className={`text-xs px-2.5 py-0.5 rounded-full font-bold border ${getActionBadgeColor(
                  result.action.type
                )}`}
              >
                {result.executed ? 'EXECUTED' : 'READY TO EXECUTE'}
              </span>
            </div>

            <p className="text-xs font-medium text-gray-800">
              {result.action.description}
            </p>

            {/* Specific Action Result UI */}
            {result.executed && result.executionResult && (() => {
              const exec: any = result.executionResult
              return (
                <div className="pt-2 border-t border-blue-100 space-y-2">
                  {/* 1. Created Task Result */}
                  {exec.title && (
                    <div className="p-3 bg-white rounded-lg border border-blue-200 flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-gray-900">
                            {exec.title}
                          </span>
                          {exec.priority && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded font-bold bg-blue-100 text-blue-800">
                              {exec.priority}
                            </span>
                          )}
                        </div>
                        {exec.description && (
                          <p className="text-xs text-gray-500 line-clamp-1 mt-0.5">
                            {exec.description}
                          </p>
                        )}
                      </div>
                      <button
                        onClick={() => navigate('/tasks')}
                        className="text-xs px-3 py-1.5 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-1"
                      >
                        View in Tasks <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}

                  {/* 2. Created CSV Result */}
                  {exec.file && exec.file.type === 'text/csv' && (
                    <div className="p-3 bg-white rounded-lg border border-emerald-200 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                          <span className="text-xs font-bold text-gray-900">
                            {exec.file.name}
                          </span>
                          <span className="text-[10px] text-gray-500">
                            ({exec.file.size} bytes)
                          </span>
                        </div>
                        <button
                          onClick={() => handleDownloadFile(exec.file)}
                          className="text-xs px-3 py-1 bg-emerald-600 text-white font-semibold rounded-lg hover:bg-emerald-700 transition-colors flex items-center gap-1"
                        >
                          <Download className="w-3.5 h-3.5" /> Download CSV
                        </button>
                      </div>
                      <pre className="text-[11px] p-2 bg-gray-50 rounded border border-gray-100 overflow-x-auto text-gray-700 font-mono">
                        {exec.file.content}
                      </pre>
                    </div>
                  )}

                  {/* 3. Created Report Result */}
                  {exec.file && exec.file.type === 'text/markdown' && (
                    <div className="p-3 bg-white rounded-lg border border-purple-200 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <FileText className="w-4 h-4 text-purple-600" />
                          <span className="text-xs font-bold text-gray-900">
                            {exec.file.name}
                          </span>
                        </div>
                        <div className="flex gap-1.5">
                          <button
                            onClick={() => handleCopyContent(exec.file.content)}
                            className="text-xs px-2.5 py-1 bg-gray-100 text-gray-700 font-semibold rounded-lg hover:bg-gray-200 transition-colors flex items-center gap-1"
                          >
                            <Copy className="w-3.5 h-3.5" />
                            {copied ? 'Copied!' : 'Copy'}
                          </button>
                          <button
                            onClick={() => handleDownloadFile(exec.file)}
                            className="text-xs px-2.5 py-1 bg-purple-600 text-white font-semibold rounded-lg hover:bg-purple-700 transition-colors flex items-center gap-1"
                          >
                            <Download className="w-3.5 h-3.5" /> Download .md
                          </button>
                        </div>
                      </div>
                      <div className="text-xs p-2.5 bg-gray-50 rounded border border-gray-100 text-gray-800 max-h-40 overflow-y-auto whitespace-pre-wrap">
                        {exec.file.content}
                      </div>
                    </div>
                  )}

                  {/* 4. Saved Note Result */}
                  {exec.title && !exec.priority && (
                    <div className="p-3 bg-white rounded-lg border border-amber-200 space-y-1">
                      <div className="flex items-center gap-2">
                        <StickyNote className="w-4 h-4 text-amber-600" />
                        <span className="text-xs font-bold text-gray-900">
                          {exec.title}
                        </span>
                      </div>
                      <p className="text-xs text-gray-600">{exec.content}</p>
                    </div>
                  )}

                  {/* 5. Office Kit Sync Result */}
                  {exec.officeKitSync && (
                    <div className="p-3 bg-white rounded-lg border border-indigo-200 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Laptop className="w-4 h-4 text-indigo-600" />
                        <div>
                          <span className="text-xs font-bold text-indigo-950 block">
                            Office Kit: Synced to {exec.officeKitSync.destination}
                          </span>
                          <span className="text-[10px] text-gray-500">
                            {new Date(exec.officeKitSync.timestamp).toLocaleTimeString()}
                          </span>
                        </div>
                      </div>
                      {exec.file && (
                        <button
                          onClick={() => handleDownloadFile(exec.file)}
                          className="text-xs px-3 py-1 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 transition-colors flex items-center gap-1"
                        >
                          <Download className="w-3.5 h-3.5" /> Save File
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )
            })()}

            {/* If NOT executed yet (preview mode) */}
            {!result.executed && (
              <button
                onClick={handleExecutePending}
                disabled={loading}
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-bold rounded-xl shadow-md transition-all flex items-center justify-center gap-2"
              >
                <CheckCircle className="w-4 h-4" />
                Confirm & Execute Digital Work Now
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
