import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CreateTaskSchema } from "@iqoo/shared";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "../services/api";
import { X, Calendar, Clock } from "lucide-react";
import { useState } from "react";

interface TaskFormProps {
  onClose: () => void;
  onSuccess?: () => void;
  projectId?: string;
  initialData?: any;
}

export function TaskForm({
  onClose,
  onSuccess,
  projectId,
  initialData,
}: TaskFormProps) {
  const [loading, setLoading] = useState(false);
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(CreateTaskSchema),
    defaultValues: {
      title: initialData?.title || "",
      description: initialData?.description || "",
      priority: initialData?.priority || "MEDIUM",
      deadline: initialData?.deadline || "",
      estimatedMinutes: initialData?.estimatedMinutes || 30,
      projectId: projectId || initialData?.projectId || "",
      tags: initialData?.tags || [],
    },
  });

  const { data: projects } = useQuery({
    queryKey: ["projects"],
    queryFn: () => apiClient.getProjects(),
  });

  const onSubmit = async (data: any) => {
    setLoading(true);
    try {
      if (initialData?.id) {
        await apiClient.updateTask(initialData.id, data);
      } else {
        await apiClient.createTask(data);
      }
      onSuccess?.();
      onClose();
    } catch (error) {
      console.error("Failed to save task:", error);
    } finally {
      setLoading(false);
    }
  };

  const deadline = watch("deadline");

  const getPriorityColor = (p: string) => {
    switch (p) {
      case "CRITICAL":
        return "bg-red-100 text-red-700";
      case "HIGH":
        return "bg-orange-100 text-orange-700";
      case "MEDIUM":
        return "bg-yellow-100 text-yellow-700";
      case "LOW":
        return "bg-green-100 text-green-700";
      default:
        return "bg-gray-100 text-gray-700";
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end z-50">
      <div className="w-full bg-white rounded-t-2xl shadow-xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-4 py-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">
            {initialData?.id ? "Edit Task" : "Create New Task"}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="p-4 space-y-4">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Task Title
            </label>
            <input
              {...register("title")}
              type="text"
              placeholder="What needs to be done?"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {errors.title && (
              <p className="text-red-500 text-sm mt-1">
                {String(errors.title.message || "Invalid title")}
              </p>
            )}
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea
              {...register("description")}
              placeholder="Add more details..."
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          {/* Priority */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Priority
            </label>
            <div className="flex gap-2">
              {["LOW", "MEDIUM", "HIGH", "CRITICAL"].map((p) => (
                <label key={p} className="flex items-center cursor-pointer">
                  <input
                    {...register("priority")}
                    type="radio"
                    value={p}
                    className="mr-2"
                  />
                  <span
                    className={`px-3 py-1 rounded text-sm font-medium ${getPriorityColor(p)}`}
                  >
                    {p}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Deadline */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-2">
              <Calendar size={16} /> Deadline
            </label>
            <input
              {...register("deadline")}
              type="datetime-local"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {deadline && (
              <p className="text-sm text-gray-500 mt-1">
                Due: {new Date(deadline).toLocaleDateString()}
              </p>
            )}
          </div>

          {/* Estimated Time */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-2">
              <Clock size={16} /> Estimated Time
            </label>
            <input
              {...register("estimatedMinutes", { valueAsNumber: true })}
              type="number"
              min="5"
              step="5"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-sm text-gray-500 mt-1">Minutes</p>
          </div>

          {/* Project */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Project
            </label>
            <select
              {...register("projectId")}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">No Project</option>
              {projects?.map((p: any) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          {/* Tags */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Tags
            </label>
            <input
              {...register("tags")}
              type="text"
              placeholder="Add tags (comma-separated)"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-sm text-gray-500 mt-1">Separate with commas</p>
          </div>

          {/* Submit Button */}
          <div className="flex gap-2 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? "Saving..." : "Save Task"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
