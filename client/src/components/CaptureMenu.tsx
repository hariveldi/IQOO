import React, { useState, useCallback } from 'react'
import { Mic, Camera, FileText, Plus, X } from 'lucide-react'
import { AdvancedVoiceCapture } from './AdvancedVoiceCapture'
import { AdvancedImageCapture } from './AdvancedImageCapture'
import { TaskForm } from './TaskForm'

interface CaptureMenuProps {
  onTaskCreated?: () => void
}

export const CaptureMenu: React.FC<CaptureMenuProps> = ({ onTaskCreated }) => {
  const [isOpen, setIsOpen] = useState(false)
  const [showVoiceCapture, setShowVoiceCapture] = useState(false)
  const [showImageCapture, setShowImageCapture] = useState(false)
  const [showTaskForm, setShowTaskForm] = useState(false)

  const handleVoiceCapture = useCallback(() => {
    setShowVoiceCapture(true)
    setIsOpen(false)
  }, [])

  const handleImageCapture = useCallback(() => {
    setShowImageCapture(true)
    setIsOpen(false)
  }, [])

  const handleTextCapture = useCallback(() => {
    setShowTaskForm(true)
    setIsOpen(false)
  }, [])

  const handleSuccess = useCallback(() => {
    onTaskCreated?.()
  }, [onTaskCreated])

  return (
    <>
      {/* Floating Action Button Menu */}
      <div className="fixed bottom-24 right-4 z-40">
        {isOpen && (
          <div className="mb-4 flex flex-col gap-3 animate-in fade-in">
            {/* Voice Capture */}
            <button
              onClick={handleVoiceCapture}
              className="flex items-center justify-center w-14 h-14 bg-red-500 text-white rounded-full shadow-lg hover:bg-red-600 transition-all transform hover:scale-110"
              title="Record voice task"
            >
              <Mic className="w-6 h-6" />
            </button>

            {/* Image Capture */}
            <button
              onClick={handleImageCapture}
              className="flex items-center justify-center w-14 h-14 bg-green-500 text-white rounded-full shadow-lg hover:bg-green-600 transition-all transform hover:scale-110"
              title="Capture image"
            >
              <Camera className="w-6 h-6" />
            </button>

            {/* Text Capture */}
            <button
              onClick={handleTextCapture}
              className="flex items-center justify-center w-14 h-14 bg-purple-500 text-white rounded-full shadow-lg hover:bg-purple-600 transition-all transform hover:scale-110"
              title="Create text task"
            >
              <FileText className="w-6 h-6" />
            </button>
          </div>
        )}

        {/* Main FAB */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={`flex items-center justify-center w-16 h-16 bg-blue-600 text-white rounded-full shadow-lg hover:bg-blue-700 transition-all transform ${
            isOpen ? 'rotate-45' : 'hover:scale-110'
          }`}
        >
          {isOpen ? <X className="w-8 h-8" /> : <Plus className="w-8 h-8" />}
        </button>
      </div>

      {/* Modal Components - Use Advanced Versions */}
      {showVoiceCapture && (
        <AdvancedVoiceCapture
          onClose={() => setShowVoiceCapture(false)}
          onSuccess={handleSuccess}
        />
      )}

      {showImageCapture && (
        <AdvancedImageCapture
          onClose={() => setShowImageCapture(false)}
          onSuccess={handleSuccess}
        />
      )}

      {showTaskForm && (
        <TaskForm
          onClose={() => setShowTaskForm(false)}
          onSuccess={handleSuccess}
        />
      )}
    </>
  )
}
