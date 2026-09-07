import { useState, useEffect } from 'react'
import { Play, Pause, RotateCcw, X } from 'lucide-react'
import { apiClient } from '../services/api'

interface FocusSessionModalProps {
  taskId: string
  taskTitle: string
  onClose: () => void
}

export function FocusSessionModal({
  taskId,
  taskTitle,
  onClose,
}: FocusSessionModalProps) {
  const [elapsed, setElapsed] = useState(0)
  const [isRunning, setIsRunning] = useState(false)
  const [sessionCompleted, setSessionCompleted] = useState(false)

  useEffect(() => {
    if (!isRunning) return

    const interval = setInterval(() => {
      setElapsed((prev) => prev + 1)
    }, 1000)

    return () => clearInterval(interval)
  }, [isRunning])

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60

    if (hours > 0) {
      return `${hours.toString().padStart(2, '0')}:${minutes
        .toString()
        .padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
    }
    return `${minutes.toString().padStart(2, '0')}:${secs
      .toString()
      .padStart(2, '0')}`
  }

  const handleSave = async () => {
    try {
      await apiClient.completeTask(taskId, Math.round(elapsed / 60))
      setSessionCompleted(true)
    } catch (error) {
      console.error('Failed to save session:', error)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-xl w-96 p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Focus Session</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded"
          >
            <X size={20} />
          </button>
        </div>

        {/* Task Title */}
        <div className="mb-6 p-3 bg-blue-50 rounded-lg border border-blue-200">
          <p className="text-sm text-blue-600 font-medium mb-1">Working on</p>
          <p className="text-gray-900 font-semibold line-clamp-2">{taskTitle}</p>
        </div>

        {/* Timer Display */}
        <div className="text-center mb-8">
          <div className="text-6xl font-bold text-gray-900 font-mono mb-2">
            {formatTime(elapsed)}
          </div>
          <p className="text-gray-600 text-sm">
            {Math.round(elapsed / 60)} minutes
          </p>
        </div>

        {/* Session Completed Message */}
        {sessionCompleted && (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-sm text-green-700 font-medium">
              ✓ Session saved! Task marked as complete.
            </p>
          </div>
        )}

        {/* Controls */}
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setIsRunning(!isRunning)}
            className={`flex-1 py-3 rounded-lg font-semibold flex items-center justify-center gap-2 transition ${
              isRunning
                ? 'bg-red-100 text-red-700 hover:bg-red-200'
                : 'bg-green-100 text-green-700 hover:bg-green-200'
            }`}
          >
            {isRunning ? (
              <>
                <Pause size={20} /> Pause
              </>
            ) : (
              <>
                <Play size={20} /> Resume
              </>
            )}
          </button>
          <button
            onClick={() => setElapsed(0)}
            className="px-4 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
          >
            <RotateCcw size={20} />
          </button>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2 border-t border-gray-200 pt-4">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Discard
          </button>
          <button
            onClick={handleSave}
            disabled={elapsed === 0 || sessionCompleted}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            Save & Complete
          </button>
        </div>
      </div>
    </div>
  )
}
