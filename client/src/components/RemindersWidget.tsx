import { useState } from 'react'
import { X, Bell } from 'lucide-react'

interface RemindersProps {
  taskId: string
  reminders?: any[]
}

export function RemindersWidget({ taskId: _taskId, reminders = [] }: RemindersProps) {
  const [showForm, setShowForm] = useState(false)
  const [reminderTime, setReminderTime] = useState('')
  const [reminderType, setReminderType] = useState('BEFORE')

  const handleAddReminder = () => {
    if (!reminderTime) return
    // TODO: Call API to add reminder
    setReminderTime('')
    setShowForm(false)
  }

  const upcomingReminders = reminders.filter((r: any) => {
    return new Date(r.reminderTime) > new Date()
  })

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <div className="flex items-center gap-2 mb-3">
        <Bell size={20} className="text-blue-600" />
        <h3 className="font-semibold text-gray-900">Reminders</h3>
      </div>

      {upcomingReminders.length > 0 && (
        <div className="space-y-2 mb-4">
          {upcomingReminders.map((reminder: any, idx: number) => (
            <div
              key={idx}
              className="flex items-center justify-between p-2 bg-blue-50 rounded border border-blue-200"
            >
              <div className="text-sm">
                <p className="font-medium text-gray-900">
                  {new Date(reminder.reminderTime).toLocaleString()}
                </p>
                <p className="text-gray-600 text-xs">{reminder.type}</p>
              </div>
              <button className="text-gray-400 hover:text-gray-600">
                <X size={16} />
              </button>
            </div>
          ))}
        </div>
      )}

      {!showForm && (
        <button
          onClick={() => setShowForm(true)}
          className="w-full py-2 px-3 text-sm font-medium text-blue-600 border border-blue-300 rounded hover:bg-blue-50"
        >
          + Add Reminder
        </button>
      )}

      {showForm && (
        <div className="space-y-2 p-2 bg-gray-50 rounded border border-gray-200">
          <input
            type="datetime-local"
            value={reminderTime}
            onChange={(e) => setReminderTime(e.target.value)}
            className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
          />
          <select
            value={reminderType}
            onChange={(e) => setReminderType(e.target.value)}
            className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
          >
            <option value="BEFORE">Before deadline</option>
            <option value="NOTIFICATION">Notification</option>
            <option value="EMAIL">Email</option>
          </select>
          <div className="flex gap-2">
            <button
              onClick={() => setShowForm(false)}
              className="flex-1 py-1 text-sm border border-gray-300 rounded hover:bg-gray-100"
            >
              Cancel
            </button>
            <button
              onClick={handleAddReminder}
              className="flex-1 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Save
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
