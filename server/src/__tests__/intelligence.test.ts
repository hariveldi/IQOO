import { describe, it, expect } from 'vitest'
import { calculateTaskPriority, calculateDeadlineRisk } from '../productivity/prioritizer'
import { LocalAIProvider } from '../ai/provider'
import { TaskPriority } from '@iqoo/shared'

describe('Productivity Intelligence Engine', () => {
  describe('calculateDeadlineRisk', () => {
    it('should assign CRITICAL or HIGH risk for overdue tasks', () => {
      const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000)
      const risk = calculateDeadlineRisk({
        deadline: pastDate,
        estimatedMinutes: 60,
        unfinishedDependencies: 1,
      })

      expect(risk.riskLevel).toMatch(/HIGH|CRITICAL/)
      expect(risk.score).toBeGreaterThan(50)
      expect(risk.explanation).toContain('passed')
    })

    it('should assign LOW risk for tasks in distant future without blockers', () => {
      const futureDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      const risk = calculateDeadlineRisk({
        deadline: futureDate,
        estimatedMinutes: 30,
        unfinishedDependencies: 0,
      })

      expect(risk.riskLevel).toBe('LOW')
      expect(risk.score).toBeLessThan(40)
    })

    it('should increase risk when unfinished dependencies block the task', () => {
      const futureDate = new Date(Date.now() + 48 * 60 * 60 * 1000)
      const riskWithNoBlockers = calculateDeadlineRisk({
        deadline: futureDate,
        estimatedMinutes: 60,
        unfinishedDependencies: 0,
      })

      const riskWithBlockers = calculateDeadlineRisk({
        deadline: futureDate,
        estimatedMinutes: 60,
        unfinishedDependencies: 3,
      })

      expect(riskWithBlockers.score).toBeGreaterThan(riskWithNoBlockers.score)
    })
  })

  describe('calculateTaskPriority', () => {
    it('should elevate score for critical tasks with quick win duration', () => {
      const res = calculateTaskPriority({
        priority: TaskPriority.CRITICAL,
        estimatedMinutes: 15,
        isOverdue: false,
        hasDependencies: true,
        isBlocked: false,
      })

      expect(res.score).toBeGreaterThan(40)
    })

    it('should penalize score when task is blocked', () => {
      const base = calculateTaskPriority({
        priority: TaskPriority.HIGH,
        estimatedMinutes: 30,
        isOverdue: false,
        hasDependencies: false,
        isBlocked: false,
      })

      const blocked = calculateTaskPriority({
        priority: TaskPriority.HIGH,
        estimatedMinutes: 30,
        isOverdue: false,
        hasDependencies: false,
        isBlocked: true,
      })

      expect(blocked.score).toBeLessThan(base.score)
    })
  })

  describe('LocalAIProvider Deterministic Reasoning', () => {
    const provider = new LocalAIProvider()

    it('should break down tasks into actionable subtasks with durations', async () => {
      const result = await provider.breakdownTask('Launch marketing landing page', 'Prepare copy, design hero, set up analytics')
      
      expect(result.subtasks).toBeDefined()
      expect(result.subtasks.length).toBeGreaterThan(0)
      expect(result.subtasks[0].title).toBeDefined()
      expect(result.subtasks[0].estimatedMinutes).toBeGreaterThan(0)
    })

    it('should estimate duration based on task complexity keyword heuristics', async () => {
      const simpleEstimate = await provider.estimateDuration('Fix typo in header')
      const complexEstimate = await provider.estimateDuration('Refactor database architecture and migrate user records')

      expect(simpleEstimate.estimatedMinutes).toBeGreaterThan(0)
      expect(complexEstimate.estimatedMinutes).toBeGreaterThanOrEqual(simpleEstimate.estimatedMinutes)
      expect(complexEstimate.confidence).toBeGreaterThan(0)
    })

    it('should generate project reviews with health status and bottlenecks', async () => {
      const review = await provider.generateProjectReview('proj-123', 'Mobile App', [
        { title: 'API Integration', status: 'TODO', priority: 'URGENT', estimatedMinutes: 60 },
        { title: 'UI Polish', status: 'COMPLETED', priority: 'LOW', estimatedMinutes: 30 }
      ])

      expect(['ON_TRACK', 'AT_RISK', 'CRITICAL', 'HEALTHY', 'BLOCKED']).toContain(review.healthStatus)
      expect(review.recommendations).toBeInstanceOf(Array)
      expect(review.recommendations.length).toBeGreaterThan(0)
    })

    it('should generate daily briefing with prioritized sequence', async () => {
      const briefing = await provider.generateDailyBriefing({
        tasks: [
          { id: '1', title: 'Critical Server Patch', priority: 'CRITICAL', status: 'TODO' },
          { id: '2', title: 'Write tests', priority: 'MEDIUM', status: 'TODO' }
        ],
        availableHours: 8
      })

      expect(briefing.greeting).toBeDefined()
      expect(briefing.summary).toBeDefined()
      expect(briefing.totalTasksToday).toBe(2)
      expect(briefing.topAction).toBeDefined()
      expect(briefing.suggestedSchedule).toBeInstanceOf(Array)
    })

    it('should generate weekly review retrospective with productivity tier', async () => {
      const weekly = await provider.generateWeeklyReview({
        completedTasks: [{ title: 'Design System', actualMinutes: 120 }],
        pendingTasks: [{ title: 'Deploy to Prod', priority: 'HIGH' }],
        totalTimeLogged: 120
      })

      expect(weekly.summary).toBeDefined()
      expect(weekly.actionableChanges).toBeInstanceOf(Array)
      expect(weekly.actionableChanges.length).toBeGreaterThan(0)
      expect(weekly.productivityScore).toBeGreaterThanOrEqual(0)
    })
  })
})
