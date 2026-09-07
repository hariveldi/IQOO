import { TaskPriority } from "@iqoo/shared";

interface TaskScoreFactors {
  deadline?: Date;
  priority: TaskPriority;
  estimatedMinutes?: number;
  isOverdue: boolean;
  hasDependencies: boolean;
  isBlocked: boolean;
}

export const calculateTaskPriority = (
  factors: TaskScoreFactors
): {
  priority: TaskPriority;
  score: number;
} => {
  let score = 0;

  // Deadline proximity (0-30 points)
  if (factors.deadline) {
    const now = new Date();
    const daysUntilDeadline =
      (factors.deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);

    if (daysUntilDeadline < 0) {
      score += 30; // Overdue
    } else if (daysUntilDeadline === 0) {
      score += 28; // Today
    } else if (daysUntilDeadline <= 1) {
      score += 25; // Tomorrow
    } else if (daysUntilDeadline <= 3) {
      score += 18; // Within 3 days
    } else if (daysUntilDeadline <= 7) {
      score += 10; // Within a week
    } else {
      score += 5; // More than a week
    }
  }

  // Base priority (0-25 points)
  switch (factors.priority) {
    case TaskPriority.CRITICAL:
      score += 25;
      break;
    case TaskPriority.HIGH:
      score += 18;
      break;
    case TaskPriority.MEDIUM:
      score += 10;
      break;
    case TaskPriority.LOW:
      score += 3;
      break;
  }

  // Effort estimate (0-15 points) - smaller tasks get bonus
  if (factors.estimatedMinutes) {
    if (factors.estimatedMinutes <= 15) {
      score += 15; // Quick wins
    } else if (factors.estimatedMinutes <= 30) {
      score += 12;
    } else if (factors.estimatedMinutes <= 60) {
      score += 8;
    } else {
      score += 4; // Large tasks penalized slightly
    }
  }

  // Overdue status (0-15 points)
  if (factors.isOverdue) {
    score += 15;
  }

  // Dependencies (+10 for blocking, -5 for blocked)
  if (factors.hasDependencies && !factors.isBlocked) {
    score += 10; // Tasks others depend on
  }
  if (factors.isBlocked) {
    score -= 5; // Blocked tasks get penalized
  }

  // Determine final priority based on score
  let finalPriority: TaskPriority;
  if (score >= 60) {
    finalPriority = TaskPriority.CRITICAL;
  } else if (score >= 40) {
    finalPriority = TaskPriority.HIGH;
  } else if (score >= 20) {
    finalPriority = TaskPriority.MEDIUM;
  } else {
    finalPriority = TaskPriority.LOW;
  }

  return {
    priority: finalPriority,
    score: Math.min(score, 100),
  };
};

export const sortTasksByPriority = (
  tasks: Array<{ priority: TaskPriority; deadline?: Date; isOverdue: boolean }>
): Array<{ priority: TaskPriority; deadline?: Date; isOverdue: boolean }> => {
  const priorityOrder = {
    [TaskPriority.CRITICAL]: 0,
    [TaskPriority.HIGH]: 1,
    [TaskPriority.MEDIUM]: 2,
    [TaskPriority.LOW]: 3,
  };

  return tasks.sort((a, b) => {
    if (a.isOverdue && !b.isOverdue) return -1;
    if (!a.isOverdue && b.isOverdue) return 1;

    const priorityDiff =
      priorityOrder[a.priority] - priorityOrder[b.priority];
    if (priorityDiff !== 0) return priorityDiff;

    if (a.deadline && b.deadline) {
      return a.deadline.getTime() - b.deadline.getTime();
    }

    return 0;
  });
};
