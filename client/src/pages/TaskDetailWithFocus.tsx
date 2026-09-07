import { useParams, useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { Play } from 'lucide-react'
import { FocusSessionModal } from '../components/FocusSessionModal'
import { TaskDetailPage } from './TaskDetail'

/**
 * Wrapper page that shows task detail with focus session button
 */
export default function TaskDetailWithFocusPage() {
  const { id } = useParams()
  const [showFocusSession, setShowFocusSession] = useState(false)
  const [taskData, setTaskData] = useState<any>(null)

  return (
    <>
      <div className="w-full">
        {/* Inject focus button into task detail */}
        <TaskDetailPage showFocusButton={true} onFocusClick={() => setShowFocusSession(true)} onTaskLoad={setTaskData} />
      </div>

      {showFocusSession && taskData && (
        <FocusSessionModal
          taskId={taskData.id}
          taskTitle={taskData.title}
          onClose={() => setShowFocusSession(false)}
        />
      )}
    </>
  )
}
