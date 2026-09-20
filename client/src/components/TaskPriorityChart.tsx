import { Task } from '../types';
import { TrendingUp } from 'lucide-react';

interface TaskPriorityProps {
  tasks: Task[];
  className?: string;
}

export function TaskPriorityChart({ tasks, className = '' }: TaskPriorityProps) {
  const highPriority = tasks.filter(t => t.priority === 'CRITICAL' || t.priority === 'HIGH');
  const mediumPriority = tasks.filter(t => t.priority === 'MEDIUM');
  const lowPriority = tasks.filter(t => t.priority === 'LOW');

  return (
    <div className={`bg-white rounded-lg border border-gray-200 p-4 ${className}`}>
      <div className="flex items-center gap-2 mb-4">
        <TrendingUp size={20} className="text-blue-600" />
        <h3 className="font-semibold text-gray-900">Tasks by Priority</h3>
      </div>
      
      <div className="space-y-3">
        {highPriority.length > 0 && (
          <div className="flex items-center gap-3 p-2 bg-red-50 rounded border border-red-100">
            <div className="w-3 h-3 bg-red-500 rounded-full"></div>
            <span className="text-sm font-medium text-gray-900">Critical/High</span>
            <span className="ml-auto text-sm font-semibold text-red-600">{highPriority.length}</span>
          </div>
        )}
        
        {mediumPriority.length > 0 && (
          <div className="flex items-center gap-3 p-2 bg-yellow-50 rounded border border-yellow-100">
            <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
            <span className="text-sm font-medium text-gray-900">Medium</span>
            <span className="ml-auto text-sm font-semibold text-yellow-600">{mediumPriority.length}</span>
          </div>
        )}
        
        {lowPriority.length > 0 && (
          <div className="flex items-center gap-3 p-2 bg-green-50 rounded border border-green-100">
            <div className="w-3 h-3 bg-green-500 rounded-full"></div>
            <span className="text-sm font-medium text-gray-900">Low</span>
            <span className="ml-auto text-sm font-semibold text-green-600">{lowPriority.length}</span>
          </div>
        )}
      </div>
    </div>
  );
}
