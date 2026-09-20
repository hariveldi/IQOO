import { Check, X, Plus } from "lucide-react";
import { useState } from "react";
import { apiClient } from "../services/api";

interface InboxItemCardProps {
  item: any;
  onStatusChange?: () => void;
}

export function InboxItemCard({ item, onStatusChange }: InboxItemCardProps) {
  const [loading, setLoading] = useState(false);
  const [conversionLoading, setConversionLoading] = useState(false);

  const handleAccept = async () => {
    setLoading(true);
    try {
      await apiClient.acceptInboxItem(item.id);
      onStatusChange?.();
    } catch (error) {
      console.error("Failed to accept item:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async () => {
    setLoading(true);
    try {
      await apiClient.rejectInboxItem(item.id);
      onStatusChange?.();
    } catch (error) {
      console.error("Failed to reject item:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleConvert = async () => {
    setConversionLoading(true);
    try {
      const extractedData = item.extractedData || {};
      const taskData = {
        title: extractedData.title || "New Task",
        description: extractedData.description || "",
        priority: extractedData.priority || "MEDIUM",
        deadline: extractedData.deadline,
        estimatedMinutes: extractedData.estimatedMinutes || 30,
      };

      await apiClient.convertToTask(item.id, taskData);
      onStatusChange?.();
    } catch (error) {
      console.error("Failed to convert item:", error);
    } finally {
      setConversionLoading(false);
    }
  };

  const getTypeBadgeColor = (type: string) => {
    switch (type) {
      case "VOICE":
        return "bg-blue-100 text-blue-700";
      case "IMAGE":
        return "bg-green-100 text-green-700";
      case "DOCUMENT":
        return "bg-purple-100 text-purple-700";
      case "TEXT":
        return "bg-yellow-100 text-yellow-700";
      default:
        return "bg-gray-100 text-gray-700";
    }
  };

  const getSourceBadgeColor = (source: string) => {
    switch (source) {
      case "WHITEBOARD":
        return "bg-pink-100 text-pink-700";
      case "MEETING":
        return "bg-indigo-100 text-indigo-700";
      case "SCREENSHOT":
        return "bg-orange-100 text-orange-700";
      default:
        return "bg-gray-100 text-gray-700";
    }
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case "PENDING":
        return "bg-yellow-50 border-yellow-200";
      case "ACCEPTED":
        return "bg-green-50 border-green-200";
      case "REJECTED":
        return "bg-red-50 border-red-200";
      case "CONVERTED":
        return "bg-blue-50 border-blue-200";
      default:
        return "bg-gray-50 border-gray-200";
    }
  };

  const extractedData = item.extractedData || {};
  const createdDate = new Date(item.createdAt).toLocaleDateString();

  return (
    <div
      className={`border-2 rounded-lg p-4 ${getStatusBadgeColor(item.status)}`}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex gap-2 flex-wrap">
          <span className={`px-3 py-1 rounded-full text-xs font-medium ${getTypeBadgeColor(item.type)}`}>
            {item.type}
          </span>
          {item.source && (
            <span className={`px-3 py-1 rounded-full text-xs font-medium ${getSourceBadgeColor(item.source)}`}>
              {item.source}
            </span>
          )}
        </div>
        <span className="text-xs text-gray-500">{createdDate}</span>
      </div>

      {/* Raw Content Preview */}
      <div className="bg-white rounded p-2 mb-3 max-h-24 overflow-hidden">
        <p className="text-sm text-gray-700 line-clamp-4">
          {item.rawContent || "No content"}
        </p>
      </div>

      {/* Extracted Data */}
      {extractedData.title && (
        <div className="space-y-2 mb-3 p-2 bg-white rounded border border-gray-200">
          {extractedData.title && (
            <div>
              <p className="text-xs font-medium text-gray-600">Title</p>
              <p className="text-sm font-semibold text-gray-900">
                {extractedData.title}
              </p>
            </div>
          )}
          {extractedData.description && (
            <div>
              <p className="text-xs font-medium text-gray-600">Description</p>
              <p className="text-sm text-gray-700">{extractedData.description}</p>
            </div>
          )}
          {extractedData.priority && (
            <div className="flex items-center gap-2">
              <p className="text-xs font-medium text-gray-600">Priority:</p>
              <span className="text-xs font-semibold text-gray-900">
                {extractedData.priority}
              </span>
            </div>
          )}
          {extractedData.deadline && (
            <div className="flex items-center gap-2">
              <p className="text-xs font-medium text-gray-600">Deadline:</p>
              <span className="text-xs font-semibold text-gray-900">
                {new Date(extractedData.deadline).toLocaleDateString()}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Confidence Score */}
      {extractedData.confidence && (
        <div className="mb-3 px-2">
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs font-medium text-gray-600">Extraction Confidence</p>
            <span className="text-xs font-semibold text-gray-900">
              {Math.round(extractedData.confidence * 100)}%
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-1.5">
            <div
              className="bg-green-500 h-1.5 rounded-full"
              style={{ width: `${extractedData.confidence * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2 pt-3 border-t border-gray-200">
        {item.status === "PENDING" ? (
          <>
            <button
              onClick={handleReject}
              disabled={loading}
              className="flex-1 flex items-center justify-center gap-1 px-3 py-2 text-red-700 border border-red-300 rounded hover:bg-red-50 disabled:opacity-50 text-sm font-medium"
            >
              <X size={16} /> Reject
            </button>
            <button
              onClick={handleAccept}
              disabled={loading}
              className="flex-1 flex items-center justify-center gap-1 px-3 py-2 text-green-700 border border-green-300 rounded hover:bg-green-50 disabled:opacity-50 text-sm font-medium"
            >
              <Check size={16} /> Accept
            </button>
            <button
              onClick={handleConvert}
              disabled={conversionLoading}
              className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 text-sm font-medium"
            >
              <Plus size={16} /> Convert
            </button>
          </>
        ) : item.status === "ACCEPTED" ? (
          <div className="w-full px-3 py-2 bg-green-100 text-green-700 rounded text-center text-sm font-medium">
            ✓ Accepted
          </div>
        ) : item.status === "REJECTED" ? (
          <div className="w-full px-3 py-2 bg-red-100 text-red-700 rounded text-center text-sm font-medium">
            ✗ Rejected
          </div>
        ) : (
          <div className="w-full px-3 py-2 bg-blue-100 text-blue-700 rounded text-center text-sm font-medium">
            ✓ Converted to Task
          </div>
        )}
      </div>
    </div>
  );
}
