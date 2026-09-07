import { useState, useRef } from "react";
import { Camera, Upload, Send, X } from "lucide-react";
import { apiClient } from "../services/api";

interface ImageCaptureProps {
  onClose: () => void;
  onSuccess?: (result: any) => void;
}

export function ImageCapture({ onClose, onSuccess }: ImageCaptureProps) {
  const [imageBase64, setImageBase64] = useState("");
  const [imageType, setImageType] = useState("IMAGE");
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [useCamera, setUseCamera] = useState(false);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      setImageBase64(base64);
      setUseCamera(false);
    };
    reader.readAsDataURL(file);
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setUseCamera(true);
      }
    } catch (error) {
      console.error("Failed to access camera:", error);
      alert("Camera access denied");
    }
  };

  const takePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const context = canvasRef.current.getContext("2d");
      if (context) {
        context.drawImage(videoRef.current, 0, 0);
        const base64 = canvasRef.current.toDataURL("image/jpeg");
        setImageBase64(base64);
        setUseCamera(false);

        // Stop camera stream
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach((track) => track.stop());
      }
    }
  };

  const handleExtract = async () => {
    if (!imageBase64) return;

    setLoading(true);
    try {
      const result = await apiClient.post("/ai/extract/image", {
        imageBase64,
        imageType,
      });
      onSuccess?.(result);
      onClose();
    } catch (error) {
      console.error("Failed to extract from image:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-xl w-96 p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold">Capture Image</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <X size={20} />
          </button>
        </div>

        <div className="space-y-4">
          {/* Image Type Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Image Type
            </label>
            <select
              value={imageType}
              onChange={(e) => setImageType(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="IMAGE">General Image</option>
              <option value="WHITEBOARD">Whiteboard/Notes</option>
              <option value="DOCUMENT">Document</option>
              <option value="SCREENSHOT">Screenshot</option>
            </select>
          </div>

          {/* Camera or File Upload */}
          {!imageBase64 && (
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={startCamera}
                className="flex flex-col items-center justify-center gap-2 p-4 border-2 border-dashed border-blue-300 rounded-lg hover:bg-blue-50"
              >
                <Camera size={24} className="text-blue-600" />
                <span className="text-sm font-medium">Take Photo</span>
              </button>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex flex-col items-center justify-center gap-2 p-4 border-2 border-dashed border-green-300 rounded-lg hover:bg-green-50"
              >
                <Upload size={24} className="text-green-600" />
                <span className="text-sm font-medium">Upload</span>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileSelect}
                className="hidden"
              />
            </div>
          )}

          {/* Camera Feed */}
          {useCamera && (
            <div className="space-y-2">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                className="w-full rounded-lg bg-black"
              />
              <canvas ref={canvasRef} className="hidden" />
              <button
                onClick={takePhoto}
                className="w-full py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Take Photo
              </button>
            </div>
          )}

          {/* Image Preview */}
          {imageBase64 && !useCamera && (
            <div className="space-y-2">
              <img
                src={imageBase64}
                alt="Captured"
                className="w-full rounded-lg max-h-64 object-cover"
              />
              <button
                onClick={() => setImageBase64("")}
                className="w-full py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Retake
              </button>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2 pt-4">
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
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <Send size={16} />
                {loading ? "Processing..." : "Extract"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
