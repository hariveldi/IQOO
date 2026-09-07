import React from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '../services/api'
import { InboxItemCard } from '../components/InboxItemCard'

export default function InboxPage() {
  const queryClient = useQueryClient()
  const { data: inboxData, isLoading, refetch } = useQuery({
    queryKey: ['inbox'],
    queryFn: () => apiClient.getInbox(),
  })

  const items = inboxData?.data?.items || []

  const handleStatusChange = () => {
    refetch()
    queryClient.invalidateQueries({ queryKey: ['tasks'] })
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading inbox...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full max-w-2xl mx-auto p-4 pb-24 md:pb-4">
      <h1 className="text-3xl font-bold text-gray-900 mb-2">Action Inbox</h1>
      <p className="text-gray-600 mb-6">
        {items.length > 0 ? `${items.length} pending item${items.length > 1 ? 's' : ''}` : 'No pending items'}
      </p>

      {items.length > 0 ? (
        <div className="space-y-4">
          {/* Filter by Status */}
          <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
            {['PENDING', 'ACCEPTED', 'REJECTED', 'CONVERTED'].map((status) => {
              const count = items.filter((item: any) => item.status === status).length
              return (
                <button
                  key={status}
                  className="px-4 py-2 text-sm font-medium rounded-full border border-gray-300 hover:border-blue-600 hover:text-blue-600 whitespace-nowrap"
                >
                  {status} ({count})
                </button>
              )
            })}
          </div>

          {/* Grouped by Status */}
          {['PENDING', 'ACCEPTED', 'REJECTED', 'CONVERTED'].map((status) => {
            const statusItems = items.filter((item: any) => item.status === status)
            if (statusItems.length === 0) return null

            return (
              <div key={status} className="mb-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-3 capitalize">
                  {status === 'CONVERTED' ? 'Converted to Tasks' : status}
                </h2>
                <div className="space-y-3">
                  {statusItems.map((item: any) => (
                    <InboxItemCard
                      key={item.id}
                      item={item}
                      onStatusChange={handleStatusChange}
                    />
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="text-center py-16 bg-gradient-to-b from-blue-50 to-white rounded-lg border border-blue-200">
          <div className="mb-4">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-4">
              <span className="text-2xl">✓</span>
            </div>
          </div>
          <p className="text-gray-900 font-semibold text-lg mb-2">Inbox is clear!</p>
          <p className="text-gray-600">All your captured items have been processed.</p>
          <p className="text-gray-500 text-sm mt-4">Use the + button to capture new tasks via voice, image, or text.</p>
        </div>
      )}
    </div>
  )
}
