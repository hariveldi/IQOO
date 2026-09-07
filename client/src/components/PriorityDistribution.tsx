interface PriorityDistributionProps {
  tasks: any[];
}

export function PriorityDistribution({ tasks }: PriorityDistributionProps) {
  const distribution = {
    CRITICAL: tasks.filter(t => t.priority === 'CRITICAL').length,
    HIGH: tasks.filter(t => t.priority === 'HIGH').length,
    MEDIUM: tasks.filter(t => t.priority === 'MEDIUM').length,
    LOW: tasks.filter(t => t.priority === 'LOW').length,
  };

  const total = tasks.length || 1;

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <h3 className="font-semibold text-gray-900 mb-4">Priority Distribution</h3>
      <div className="space-y-3">
        {Object.entries(distribution).map(([priority, count]) => {
          const percentage = Math.round((count / total) * 100);
          const colors = {
            CRITICAL: 'bg-red-500',
            HIGH: 'bg-orange-500',
            MEDIUM: 'bg-yellow-500',
            LOW: 'bg-green-500',
          };
          return (
            <div key={priority}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium text-gray-700">{priority}</span>
                <span className="text-sm text-gray-600">{count}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className={`${colors[priority as keyof typeof colors]} h-2 rounded-full transition-all`}
                  style={{ width: `${percentage}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
