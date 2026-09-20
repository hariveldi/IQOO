import { useEffect, useState } from 'react';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

export default function TaskBlockersInfo({ taskId, authToken }: { taskId: string, authToken?: string }) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!taskId) return;
    setLoading(true);
    setError(null);
    setData(null);
    axios.get(`${API_URL}/tasks/${taskId}/blockers`, {
      headers: authToken ? { Authorization: `Bearer ${authToken}` } : undefined,
      withCredentials: true,
    })
      .then(res => {
        setData(res.data.data);
      })
      .catch((e) => {
        setError(e?.response?.data?.error || 'Could not load dependency info.');
      })
      .finally(() => setLoading(false));
  }, [taskId, authToken]);

  if (!taskId) return null;
  if (loading) return <div className="my-2 text-sm text-gray-500">Loading dependencies...</div>;
  if (error) return <div className="my-2 text-sm text-red-500">{error}</div>;
  if (!data) return null;

  const { blocking = [], blockedBy = [] } = data;
  const unfinishedBlockers = blockedBy.filter((t: any) => t.status !== 'COMPLETED');
  const finishedBlockers = blockedBy.filter((t: any) => t.status === 'COMPLETED');
  const unfinishedBlocking = blocking.filter((t: any) => t.status !== 'COMPLETED');

  return (
    <div className="my-2">
      {unfinishedBlockers.length > 0 && (
        <div className="flex items-center gap-2 text-yellow-800 bg-yellow-100 border border-yellow-400 px-2 py-1 rounded mb-1">
          <span role="img" aria-label="Blocked">⚠</span>
          <span>
            Blocked by {unfinishedBlockers.length} task{unfinishedBlockers.length>1?'s':''}: {unfinishedBlockers.map((t: any) => t.title).join(', ')}
          </span>
        </div>
      )}
      {finishedBlockers.length > 0 && (
        <div className="flex items-center gap-2 text-green-800 bg-green-100 border border-green-300 px-2 py-1 rounded mb-1">
          <span>✓</span>
          <span>
            Completed dependencies: {finishedBlockers.map((t: any) => t.title).join(', ')}
          </span>
        </div>
      )}
      {unfinishedBlocking.length > 0 && (
        <div className="flex items-center gap-2 text-blue-800 bg-blue-50 border border-blue-200 px-2 py-1 rounded mb-1">
          <span>🔗</span>
          <span>
            Blocking {unfinishedBlocking.length} task{unfinishedBlocking.length>1?'s':''}: {unfinishedBlocking.map((t: any) => t.title).join(', ')}
          </span>
        </div>
      )}
      {unfinishedBlockers.length === 0 && unfinishedBlocking.length === 0 && finishedBlockers.length === 0 && (
        <div className="text-xs text-gray-400">No dependencies.</div>
      )}
    </div>
  );
}
