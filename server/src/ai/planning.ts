import { Task, DailyPlan } from "@iqoo/shared";
import { calculateTaskPriority } from "../productivity/prioritizer";

interface SchedulingOptions {
  workStartTime?: Date;
  workEndTime?: Date;
  breakInterval?: number; // minutes
  breakDuration?: number; // minutes
  availableHoursPerDay?: number;
  includeBufferTime?: boolean;
}

/**
 * Advanced planning service
 * Generates optimal daily schedules considering priorities, deadlines, and dependencies
 */
export class PlanningService {
  /**
   * Generate optimal daily schedule
   */
  generateDailySchedule(
    tasks: Task[],
    options: SchedulingOptions = {}
  ): ScheduleBlock[] {
    const {
      workStartTime = new Date(),
      breakInterval = 90,
      breakDuration = 15,
      availableHoursPerDay = 8,
    } = options;

    // Filter and sort tasks
    const activeTasks = tasks.filter(
      (t) => t.status !== "COMPLETED" && t.status !== "CANCELLED"
    );

    // Calculate priority scores for each task
    const scoredTasks = activeTasks.map((task) => ({
      task,
      score: calculateTaskPriority({
        deadline: task.deadline ? new Date(task.deadline) : undefined,
        priority: task.priority,
        estimatedMinutes: task.estimatedMinutes,
        isOverdue:
          task.deadline && new Date(task.deadline) < new Date() ? true : false,
        hasDependencies: false, // Would need dependency info
        isBlocked: false,
      }).score,
    }));

    // Sort by score (highest first)
    scoredTasks.sort((a, b) => b.score - a.score);

    const blocks: ScheduleBlock[] = [];
    let currentTime = new Date(workStartTime);
    const dayEndTime = new Date(
      currentTime.getTime() + availableHoursPerDay * 60 * 60 * 1000
    );
    let minutesUsed = 0;
    const availableMinutes = availableHoursPerDay * 60;

    for (const { task } of scoredTasks) {
      if (currentTime >= dayEndTime) break;

      const estimatedMinutes = task.estimatedMinutes || 30;

      // Check if we need a break
      if (minutesUsed > 0 && minutesUsed % breakInterval === 0) {
        const breakEndTime = new Date(
          currentTime.getTime() + breakDuration * 60 * 1000
        );
        blocks.push({
          startTime: currentTime,
          endTime: breakEndTime,
          taskId: "BREAK",
          reason: "Scheduled break",
        });
        currentTime = breakEndTime;
        minutesUsed += breakDuration;
      }

      // Check if task fits
      if (minutesUsed + estimatedMinutes > availableMinutes) {
        // Critical tasks always fit
        if (task.priority !== "CRITICAL") {
          continue;
        }
      }

      const blockEndTime = new Date(
        currentTime.getTime() + estimatedMinutes * 60 * 1000
      );

      blocks.push({
        startTime: currentTime,
        endTime: blockEndTime,
        taskId: task.id,
        task: task,
        reason: this.getScheduleReason(task),
      });

      currentTime = blockEndTime;
      minutesUsed += estimatedMinutes;
    }

    return blocks;
  }

  /**
   * Reschedule remaining tasks after task completion
   */
  rescheduleAfterCompletion(
    dailyPlan: DailyPlan,
    completedTaskId: string,
    actualDuration: number, // minutes
    _remainingTasks?: Task[]
  ): ScheduleBlock[] {
    // Find the completed block
    const completedBlock = (dailyPlan.blocks as any[]).find(
      (b: ScheduleBlock) => b.taskId === completedTaskId
    );

    if (!completedBlock) return dailyPlan.blocks as ScheduleBlock[];

    // Calculate time saved/lost
    const plannedDuration =
      (completedBlock.endTime.getTime() - completedBlock.startTime.getTime()) /
      (1000 * 60);
    const timeDifference = plannedDuration - actualDuration;

    // Remove completed task from blocks
    const remainingBlocks = (dailyPlan.blocks as any[]).filter(
      (b: ScheduleBlock) => b.taskId !== completedTaskId
    );

    // Rebuild schedule with extra time
    if (timeDifference > 0) {
      // Time saved - redistribute to other tasks
      // For now, just return remaining blocks as-is
      // Could implement compression logic here
    }

    return remainingBlocks as ScheduleBlock[];
  }

  /**
   * Get reason for scheduling a task
   */
  private getScheduleReason(task: Task): string {
    const reasons: string[] = [];

    if (task.priority === "CRITICAL") {
      reasons.push("Critical priority");
    } else if (task.priority === "HIGH") {
      reasons.push("High priority");
    }

    if (task.deadline) {
      const daysUntilDeadline =
        (new Date(task.deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
      if (daysUntilDeadline < 0) {
        reasons.push("OVERDUE");
      } else if (daysUntilDeadline <= 1) {
        reasons.push("Due today/tomorrow");
      } else if (daysUntilDeadline <= 3) {
        reasons.push("Due soon");
      }
    }

    return reasons.length > 0 ? reasons.join(", ") : "Scheduled task";
  }
}

export interface ScheduleBlock {
  startTime: Date;
  endTime: Date;
  taskId: string;
  task?: Task;
  reason?: string;
}
