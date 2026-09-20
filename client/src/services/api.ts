import axios, { AxiosInstance } from 'axios'

const configuredApiUrl = import.meta.env.VITE_API_URL?.trim().replace(/\/+$/, '')
const API_BASE_URL = configuredApiUrl
  ? configuredApiUrl.endsWith('/api')
    ? configuredApiUrl
    : `${configuredApiUrl}/api`
  : 'http://localhost:3001/api'

class ApiClient {
  private client: AxiosInstance
  private token: string | null = null

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      headers: {
        'Content-Type': 'application/json',
      },
    })

    // Load token from localStorage
    this.token = localStorage.getItem('accessToken')
    if (this.token) {
      this.client.defaults.headers.common['Authorization'] = `Bearer ${this.token}`
    }

    // Request interceptor
    this.client.interceptors.request.use((config) => {
      if (this.token) {
        config.headers.Authorization = `Bearer ${this.token}`
      }
      return config
    })

    // Response interceptor for token refresh
    this.client.interceptors.response.use(
      (response) => response,
      async (error) => {
        const originalRequest = error.config
        const isAuthRequest = originalRequest?.url?.startsWith('/auth/')
        if (error.response?.status === 401 && !isAuthRequest && !originalRequest._retry) {
          originalRequest._retry = true
          try {
            const refreshToken = localStorage.getItem('refreshToken')
            if (refreshToken) {
              const response = await axios.post(`${API_BASE_URL}/auth/refresh`, {
                refreshToken,
              })
              this.setToken(response.data.data.accessToken, response.data.data.refreshToken)
              return this.client(originalRequest)
            }
          } catch (refreshError) {
            this.logout()
            window.location.href = '/login'
          }
        }
        return Promise.reject(error)
      }
    )
  }

  setToken(accessToken: string, refreshToken: string) {
    this.token = accessToken
    localStorage.setItem('accessToken', accessToken)
    localStorage.setItem('refreshToken', refreshToken)
    this.client.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`
  }

  logout() {
    this.token = null
    localStorage.removeItem('accessToken')
    localStorage.removeItem('refreshToken')
    delete this.client.defaults.headers.common['Authorization']
  }

  // Auth endpoints
  async register(email: string, password: string, name: string) {
    this.logout()
    const response = await this.client.post('/auth/register', {
      email,
      password,
      name,
    })
    return response.data
  }

  async login(email: string, password: string) {
    this.logout()
    const response = await this.client.post('/auth/login', {
      email,
      password,
    })
    return response.data
  }

  async getProfile() {
    const response = await this.client.get('/auth/profile')
    return response.data
  }

  // Task endpoints
  async getTasks(projectId?: string, status?: string) {
    const response = await this.client.get('/tasks', {
      params: { projectId, status },
    })
    return response.data
  }

  async getTask(id: string) {
    const response = await this.client.get(`/tasks/${id}`)
    return response.data
  }

  async createTask(data: any) {
    const response = await this.client.post('/tasks', data)
    return response.data
  }

  async updateTask(id: string, data: any) {
    const response = await this.client.patch(`/tasks/${id}`, data)
    return response.data
  }

  async deleteTask(id: string) {
    const response = await this.client.delete(`/tasks/${id}`)
    return response.data
  }

  async completeTask(id: string, actualMinutes?: number) {
    const response = await this.client.post(`/tasks/${id}/complete`, {
      actualMinutes,
    })
    return response.data
  }

  // Project endpoints
  async getProjects() {
    const response = await this.client.get('/projects')
    return response.data
  }

  async getProject(id: string) {
    const response = await this.client.get(`/projects/${id}`)
    return response.data
  }

  async createProject(data: any) {
    const response = await this.client.post('/projects', data)
    return response.data
  }

  async updateProject(id: string, data: any) {
    const response = await this.client.patch(`/projects/${id}`, data)
    return response.data
  }

  async deleteProject(id: string) {
    const response = await this.client.delete(`/projects/${id}`)
    return response.data
  }

  async getProjectProgress(id: string) {
    const response = await this.client.get(`/projects/${id}/progress`)
    return response.data
  }

  // Action Inbox endpoints
  async getInbox() {
    const response = await this.client.get('/inbox')
    return response.data
  }

  async captureVoice(transcript: string) {
    const response = await this.client.post('/inbox/voice', {
      transcript,
    })
    return response.data
  }

  async captureImage(imageBase64: string, imageType: string) {
    const response = await this.client.post('/inbox/image', {
      imageBase64,
      imageType,
    })
    return response.data
  }

  async acceptInboxItem(id: string) {
    const response = await this.client.post(`/inbox/${id}/accept`)
    return response.data
  }

  async rejectInboxItem(id: string) {
    const response = await this.client.post(`/inbox/${id}/reject`)
    return response.data
  }

  async convertToTask(id: string, taskData: any) {
    const response = await this.client.post(`/inbox/${id}/convert`, taskData)
    return response.data
  }

  // Generic HTTP methods
  async get<T = any>(url: string, config?: any): Promise<{ data: T }> {
    const response = await this.client.get(url, config)
    return response.data
  }

  async post<T = any>(url: string, data?: any, config?: any): Promise<{ data: T }> {
    const response = await this.client.post(url, data, config)
    return response.data
  }

  async patch<T = any>(url: string, data?: any, config?: any): Promise<{ data: T }> {
    const response = await this.client.patch(url, data, config)
    return response.data
  }

  async delete<T = any>(url: string, config?: any): Promise<{ data: T }> {
    const response = await this.client.delete(url, config)
    return response.data
  }

  // Dependency endpoints
  async getDependencies(taskId: string) {
    const response = await this.client.get(`/tasks/${taskId}/blockers`)
    return response.data
  }

  async createDependency(taskId: string, dependsOnTaskId: string) {
    const response = await this.client.post('/tasks/dependencies', {
      fromTaskId: dependsOnTaskId,
      toTaskId: taskId,
    })
    return response.data
  }

  async deleteDependency(taskId: string, dependsOnTaskId: string) {
    const response = await this.client.delete('/tasks/dependencies', {
      data: { fromTaskId: dependsOnTaskId, toTaskId: taskId },
    })
    return response.data
  }

  // AI endpoints
  async getAIStatus() {
    const response = await this.client.get('/ai/status')
    return response.data
  }

  async getAIInsights() {
    const response = await this.client.get('/ai/insights')
    return response.data
  }

  async executeAIActions(actions: any[]) {
    const response = await this.client.post('/ai/execute-actions', { actions })
    return response.data
  }

  async extractFromVoice(transcript: string) {
    const response = await this.client.post('/ai/extract/voice', { transcript })
    return response.data
  }

  async extractFromImage(imageBase64: string, imageType?: string) {
    const response = await this.client.post('/ai/extract/image', {
      imageBase64,
      imageType,
    })
    return response.data
  }

  async extractFromDocument(documentContent: string, fileName: string) {
    const response = await this.client.post('/ai/extract/document', {
      documentContent,
      fileName,
    })
    return response.data
  }

  async getDailyBriefing() {
    const response = await this.client.get('/ai/daily-briefing')
    return response.data
  }

  async getWeeklyReview() {
    const response = await this.client.get('/ai/weekly-review')
    return response.data
  }

  async breakdownTask(title: string, description?: string) {
    const response = await this.client.post('/ai/breakdown', { title, description })
    return response.data
  }

  async estimateDuration(title: string, description?: string) {
    const response = await this.client.post('/ai/estimate', { title, description })
    return response.data
  }

  async getProjectReview(projectId: string, name?: string, tasks?: any[]) {
    const response = await this.client.post(`/ai/project-review/${projectId}`, { name, tasks })
    return response.data
  }

  async getRecommendation() {
    const response = await this.client.get('/ai/recommendation')
    return response.data
  }

  async chat(message: string, context?: any) {
    const response = await this.client.post('/ai/chat', {
      message,
      context,
    })
    return response.data
  }

  // Planner endpoints
  async generateDailyPlan(date?: Date, availableHoursPerDay?: number) {
    const response = await this.client.post('/planner/daily', {
      date,
      availableHoursPerDay,
    })
    return response.data
  }

  async getDailyPlan(date?: Date) {
    const response = await this.client.get('/planner/daily', {
      params: { date },
    })
    return response.data
  }

  async rescheduleAfterCompletion(
    taskId: string,
    actualMinutes: number,
    date?: Date
  ) {
    const response = await this.client.post('/planner/reschedule', {
      taskId,
      actualMinutes,
      date,
    })
    return response.data
  }

  async getWeeklyPlan(startDate?: Date) {
    const response = await this.client.get('/planner/weekly', {
      params: { startDate },
    })
    return response.data
  }
}

export const apiClient = new ApiClient()
