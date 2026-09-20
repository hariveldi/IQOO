import { useState, useRef, useCallback } from 'react'
import { Mic, StopCircle, Send, X, AlertCircle } from 'lucide-react'
import { apiClient } from '../services/api'

interface AdvancedVoiceCaptureProps {
  onClose: () => void
  onSuccess?: (result: any) => void
}

export function AdvancedVoiceCapture({
  onClose,
  onSuccess,
}: AdvancedVoiceCaptureProps) {
  const [recording, setRecording] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const recognitionRef = useRef<any>(null)
  const [isSupported, setIsSupported] = useState(true)

  // Initialize Web Speech API
  const initSpeechRecognition = useCallback(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SpeechRecognition) {
      setIsSupported(false)
      setError('Speech recognition not supported in your browser')
      return false
    }

    const recognition = new SpeechRecognition()

    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = 'en-US'

    let interimTranscript = ''

    recognition.onstart = () => {
      setRecording(true)
      setError('')
    }

    recognition.onresult = (event: any) => {
      interimTranscript = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcriptSegment = event.results[i][0].transcript
        if (event.results[i].isFinal) {
          setTranscript((prev) => prev + ' ' + transcriptSegment)
        } else {
          interimTranscript += transcriptSegment
        }
      }
    }

    recognition.onerror = (event: any) => {
      setError(`Error: ${event.error}`)
      setRecording(false)
    }

    recognition.onend = () => {
      setRecording(false)
    }

    recognitionRef.current = recognition
    return true
  }, [])

  const startRecording = () => {
    if (initSpeechRecognition()) {
      recognitionRef.current?.start()
    }
  }

  const stopRecording = () => {
    recognitionRef.current?.stop()
    setRecording(false)
  }

  const clearTranscript = () => {
    setTranscript('')
    setError('')
  }

  const handleExtract = async () => {
    if (!transcript.trim()) return

    setLoading(true)
    try {
      const result = await apiClient.extractFromVoice(transcript)
      onSuccess?.(result)
      onClose()
    } catch (err) {
      setError('Failed to extract task from voice')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-xl w-96 p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold">Voice to Task</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <X size={20} />
          </button>
        </div>

        {!isSupported && (
          <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg flex gap-2">
            <AlertCircle size={20} className="text-yellow-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-yellow-800">
              Web Speech API not supported in your browser. Try Chrome, Safari, or Edge.
            </p>
          </div>
        )}

        <div className="space-y-4">
          {/* Recording Button */}
          <button
            onClick={recording ? stopRecording : startRecording}
            disabled={!isSupported}
            className={`w-full py-4 rounded-full font-semibold transition flex items-center justify-center gap-2 ${
              recording
                ? 'bg-red-500 hover:bg-red-600 text-white'
                : 'bg-blue-600 hover:bg-blue-700 text-white'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {recording ? (
              <>
                <StopCircle size={20} /> Stop Recording
              </>
            ) : (
              <>
                <Mic size={20} /> Start Recording
              </>
            )}
          </button>

          {/* Recording Status */}
          {recording && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
              <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
              <span className="text-sm font-medium text-red-700">Listening...</span>
            </div>
          )}

          {/* Error Display */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {/* Transcript Display */}
          {transcript && (
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                Transcribed Text
              </label>
              <div className="bg-gray-50 rounded-lg p-3 border border-gray-300 min-h-24 max-h-32 overflow-y-auto">
                <p className="text-gray-900 text-sm">{transcript}</p>
              </div>
              <button
                onClick={clearTranscript}
                className="text-sm text-gray-600 hover:text-gray-900 font-medium"
              >
                Clear
              </button>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2 pt-4 border-t border-gray-200">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            {transcript && (
              <button
                onClick={handleExtract}
                disabled={loading}
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <Send size={16} />
                {loading ? 'Processing...' : 'Extract Task'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
