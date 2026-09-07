import { useState, useRef } from 'react'
import { Upload, X, AlertCircle, Loader } from 'lucide-react'
import { apiClient } from '../services/api'

declare global {
  interface Window {
    Tesseract?: any
  }
}

interface AdvancedImageCaptureProps {
  onClose: () => void
  onSuccess?: (result: any) => void
}

export function AdvancedImageCapture({
  onClose,
  onSuccess,
}: AdvancedImageCaptureProps) {
  const [imageBase64, setImageBase64] = useState('')
  const [imageType, setImageType] = useState('IMAGE')
  const [loading, setLoading] = useState(false)
  const [extracting, setExtracting] = useState(false)
  const [ocrText, setOcrText] = useState('')
  const [error, setError] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError('Please select a valid image file')
      return
    }

    setLoading(true)
    setError('')

    const reader = new FileReader()
    reader.onload = async (event) => {
      const base64 = event.target?.result as string
      setImageBase64(base64)

      // Optional: Auto-run OCR on image load
      if (imageType === 'DOCUMENT' || imageType === 'WHITEBOARD') {
        await extractOCR(base64)
      }
    }
    reader.onerror = () => {
      setError('Failed to read file')
    }
    reader.onloadend = () => {
      setLoading(false)
    }

    reader.readAsDataURL(file)
  }

  const extractOCR = async (imageData: string) => {
    setExtracting(true)
    setError('')

    try {
      // Load Tesseract.js from CDN if not already loaded
      if (!window.Tesseract) {
        const script = document.createElement('script')
        script.src =
          'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js'
        script.onload = async () => {
          await runOCR(imageData)
        }
        script.onerror = () => {
          setError('Failed to load OCR library')
          setExtracting(false)
        }
        document.head.appendChild(script)
      } else {
        await runOCR(imageData)
      }
    } catch (err) {
      setError('OCR extraction failed')
      console.error(err)
      setExtracting(false)
    }
  }

  const runOCR = async (imageData: string) => {
    try {
      const {
        data: { text },
      } = await window.Tesseract.recognize(imageData, 'eng', {
        logger: (m: any) => {
          if (m.status === 'recognizing') {
            // Update progress if needed
          }
        },
      })

      setOcrText(text)
      setExtracting(false)
    } catch (err) {
      setError('Failed to extract text from image')
      console.error(err)
      setExtracting(false)
    }
  }

  const handleExtract = async () => {
    if (!imageBase64) return

    setLoading(true)
    setError('')

    try {
      const result = await apiClient.extractFromImage(imageBase64, imageType)
      onSuccess?.(result)
      onClose()
    } catch (err) {
      setError('Failed to process image')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-xl w-96 max-h-[90vh] overflow-y-auto p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6 sticky top-0 bg-white">
          <h2 className="text-xl font-semibold">Capture & Extract</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <X size={20} />
          </button>
        </div>

        <div className="space-y-4">
          {/* Image Type Selector */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Image Type
            </label>
            <select
              value={imageType}
              onChange={(e) => {
                setImageType(e.target.value)
                setOcrText('')
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="IMAGE">General Image</option>
              <option value="WHITEBOARD">Whiteboard/Notes</option>
              <option value="DOCUMENT">Document</option>
              <option value="SCREENSHOT">Screenshot</option>
            </select>
          </div>

          {/* Error Display */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex gap-2">
              <AlertCircle size={16} className="text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {/* File Upload */}
          {!imageBase64 && (
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={loading}
              className="w-full p-8 border-2 border-dashed border-blue-300 rounded-lg hover:bg-blue-50 transition disabled:opacity-50"
            >
              <Upload className="w-8 h-8 text-blue-600 mx-auto mb-2" />
              <p className="text-sm font-medium text-blue-700">
                Click to upload image
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Supports JPG, PNG, WebP
              </p>
            </button>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            className="hidden"
          />

          {/* Image Preview */}
          {imageBase64 && (
            <div className="space-y-3">
              <img
                src={imageBase64}
                alt="Captured"
                className="w-full rounded-lg max-h-48 object-cover border border-gray-200"
              />
              <button
                onClick={() => {
                  setImageBase64('')
                  setOcrText('')
                }}
                className="w-full py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Change Image
              </button>
            </div>
          )}

          {/* OCR Extract Button */}
          {imageBase64 &&
            !ocrText &&
            (imageType === 'DOCUMENT' || imageType === 'WHITEBOARD') && (
              <button
                onClick={() => extractOCR(imageBase64)}
                disabled={extracting}
                className="w-full py-2 px-4 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {extracting && <Loader size={16} className="animate-spin" />}
                {extracting ? 'Extracting text...' : 'Extract Text (OCR)'}
              </button>
            )}

          {/* OCR Text Display */}
          {ocrText && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Extracted Text
              </label>
              <div className="bg-gray-50 rounded-lg p-3 border border-gray-300 max-h-32 overflow-y-auto">
                <p className="text-sm text-gray-900">{ocrText}</p>
              </div>
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
            {imageBase64 && (
              <button
                onClick={handleExtract}
                disabled={loading}
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
              >
                {loading ? 'Processing...' : 'Create Task'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
