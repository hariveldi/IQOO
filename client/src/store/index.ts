import { create } from 'zustand'

interface User {
  id: string
  email: string
  name: string
  avatar?: string
}

interface AuthState {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  setUser: (user: User | null) => void
  setIsLoading: (loading: boolean) => void
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: false,
  setUser: (user) => set({ user, isAuthenticated: !!user }),
  setIsLoading: (isLoading) => set({ isLoading }),
}))

interface Task {
  id: string
  title: string
  description?: string
  status: 'TODO' | 'IN_PROGRESS' | 'BLOCKED' | 'COMPLETED' | 'CANCELLED'
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'
  deadline?: string
  estimatedMinutes?: number
  projectId?: string
  tags: string[]
}

interface TaskState {
  tasks: Task[]
  selectedTaskId: string | null
  setTasks: (tasks: Task[]) => void
  addTask: (task: Task) => void
  updateTask: (task: Task) => void
  removeTask: (id: string) => void
  setSelectedTaskId: (id: string | null) => void
}

export const useTaskStore = create<TaskState>((set) => ({
  tasks: [],
  selectedTaskId: null,
  setTasks: (tasks) => set({ tasks }),
  addTask: (task) => set((state) => ({ tasks: [...state.tasks, task] })),
  updateTask: (task) => set((state) => ({
    tasks: state.tasks.map((t) => t.id === task.id ? task : t),
  })),
  removeTask: (id) => set((state) => ({
    tasks: state.tasks.filter((t) => t.id !== id),
  })),
  setSelectedTaskId: (id) => set({ selectedTaskId: id }),
}))
