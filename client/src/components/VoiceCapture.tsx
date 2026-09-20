import { useState, useRef } from "react";
import { Mic, StopCircle, Send, X } from "lucide-react";
import { apiClient } from "../services/api";

interface VoiceCaptureProps {
  onClose: () => void;
  onSuccess?: (result: any) => void;
}

export function VoiceCapture({ onClose, onSuccess }: VoiceCaptureProps) {
  const [recording, setRecording] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [loading, setLoading] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        chunksRef.current.push(e.data);
      };

      mediaRecorder.onstart = () => {
        setRecording(true);
      };

      mediaRecorder.onstop = async () => {
        setRecording(false);
        // Blob collected in chunksRef.current
        
        // For demo: convert to text (in real implementation, use speech-to-text API)
        // Simulating with a placeholder
        setTranscript(
          "I need to finish the project proposal by Friday and schedule a meeting with the team"
        );
      };

      mediaRecorder.start();
    } catch (error) {
      console.error("Failed to start recording:", error);
      alert("Microphone access denied");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && recording) {
      mediaRecorderRef.current.stop();
    }
  };

  const handleExtract = async () => {
    if (!transcript.trim()) return;

    setLoading(true);
    try {
      const result = await apiClient.post("/ai/extract/voice", {
        transcript,
      });
      onSuccess?.(result);
      onClose();
    } catch (error) {
      console.error("Failed to extract task:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-xl w-96 p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold">Record Voice Task</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <X size={20} />
          </button>
        </div>

        {/* Recording UI */}
        <div className="space-y-4">
          {/* Recording Button */}
          <button
            onClick={recording ? stopRecording : startRecording}
            className={`w-full py-4 rounded-full font-semibold transition flex items-center justify-center gap-2 ${
              recording
                ? "bg-red-500 hover:bg-red-600 text-white"
                : "bg-blue-500 hover:bg-blue-600 text-white"
            }`}
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

          {/* Transcript Display */}
          {transcript && (
            <div className="bg-gray-50 rounded-lg p-4 min-h-20">
              <p className="text-sm text-gray-600 font-medium mb-2">
                Transcribed Text:
              </p>
              <p className="text-gray-900">{transcript}</p>
            </div>
          )}

          {/* Edit Transcript */}
          {transcript && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Edit Transcript
              </label>
              <textarea
                value={transcript}
                onChange={(e) => setTranscript(e.target.value)}
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
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
            {transcript && (
              <button
                onClick={handleExtract}
                disabled={loading}
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <Send size={16} />
                {loading ? "Processing..." : "Extract Task"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
