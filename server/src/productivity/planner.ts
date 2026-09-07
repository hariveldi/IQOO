import { Task, ScheduleBlock, DailyPlan } from "@iqoo/shared";

interface ScheduleInput {
  tasks: Task[];
  availableHours: number;
  workStartTime: Date;
  preferredBreakInterval: number; // minutes
  breakDuration: number; // minutes
}

export const generateDailyPlan = (input: ScheduleInput): ScheduleBlock[] => {
  const blocks: ScheduleBlock[] = [];

  // Sort tasks by priority and deadline
  const sortedTasks = input.tasks
    .filter((t) => t.status !== "COMPLETED" && t.status !== "CANCELLED")
    .sort((a, b) => {
      // Critical tasks first
      if (a.priority === "CRITICAL" && b.priority !== "CRITICAL") return -1;
      if (a.priority !== "CRITICAL" && b.priority === "CRITICAL") return 1;

      // Then by deadline
      if (a.deadline && b.deadline) {
        return a.deadline.getTime() - b.deadline.getTime();
      }
      if (a.deadline) return -1;
      if (b.deadline) return 1;

      return 0;
    });

  let currentTime = new Date(input.workStartTime);
  const availableMinutes = input.availableHours * 60;
  let totalMinutesUsed = 0;

  for (const task of sortedTasks) {
    const estimatedMinutes = task.estimatedMinutes || 30;

    // Check if task would exceed available time
    if (totalMinutesUsed + estimatedMinutes > availableMinutes) {
      // Try to fit it if it's critical
      if (task.priority === "CRITICAL") {
        // Extend the day or skip other low-priority tasks
        // For now, we'll include it anyway
      } else {
        break; // Skip tasks that don't fit
      }
    }

    // Add break if needed
    if (blocks.length > 0 && totalMinutesUsed > 0) {
      if (totalMinutesUsed % input.preferredBreakInterval < estimatedMinutes) {
        const breakBlock: ScheduleBlock = {
          startTime: new Date(currentTime),
          endTime: new Date(
            currentTime.getTime() + input.breakDuration * 60 * 1000
          ),
          taskId: "break",
          reason: "Scheduled break",
        };
        blocks.push(breakBlock);
        currentTime = new Date(
          currentTime.getTime() + input.breakDuration * 60 * 1000
        );
        totalMinutesUsed += input.breakDuration;
      }
    }

    // Add task block
    const taskBlock: ScheduleBlock = {
      startTime: new Date(currentTime),
      endTime: new Date(currentTime.getTime() + estimatedMinutes * 60 * 1000),
      taskId: task.id,
      task: task,
      reason: `${task.priority} priority task${task.deadline ? ` due ${task.deadline.toLocaleDateString()}` : ""}`,
    };
    blocks.push(taskBlock);

    currentTime = new Date(currentTime.getTime() + estimatedMinutes * 60 * 1000);
    totalMinutesUsed += estimatedMinutes;
  }

  return blocks;
};

export const rescheduleRemainingTasks = (
  currentPlan: DailyPlan,
  completedTaskId: string,
  actualDuration: number,
  tasks: Task[]
): ScheduleBlock[] => {
  // Find how much time was saved/lost
  const originalBlock = currentPlan.blocks.find(
    (b) => b.taskId === completedTaskId
  );
  if (!originalBlock) return currentPlan.blocks;

  const timeSaved =
    originalBlock.endTime.getTime() - originalBlock.startTime.getTime() -
    actualDuration * 60 * 1000;

  // Get remaining tasks
  const remainingTasks = tasks.filter(
    (t) =>
      t.status !== "COMPLETED" &&
      t.status !== "CANCELLED" &&
      !currentPlan.blocks.some(
        (b) => b.taskId === t.id && b.taskId !== completedTaskId
      )
  );

  // If time was saved, we can fit more tasks
  // If time was lost, we need to reschedule some tasks to next day
  // For now, simple reschedule: remove the completed task and re-add remaining

  const blocks = currentPlan.blocks.filter((b) => b.taskId !== completedTaskId);

  return blocks;
};
