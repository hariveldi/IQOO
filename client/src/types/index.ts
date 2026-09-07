export interface Task {
  id: string
  userId: string
  title: string
  description?: string
  status: 'TODO' | 'IN_PROGRESS' | 'BLOCKED' | 'COMPLETED' | 'CANCELLED'
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'
  deadline?: string
  estimatedMinutes?: number
  actualMinutes?: number
  projectId?: string
  tags: string[]
  dependencies: string[]
  createdAt: string
  updatedAt: string
}

export interface Project {
  id: string
  userId: string
  name: string
  description?: string
  color?: string
  createdAt: string
  updatedAt: string
}

export interface ActionInboxItem {
  id: string
  userId: string
  type: string
  source: string
  rawContent: string
  extractedData: Record<string, any>
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'CONVERTED'
  convertedTaskId?: string
  createdAt: string
  updatedAt: string
}
