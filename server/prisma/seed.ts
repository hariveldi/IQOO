import { prisma } from "../repositories/prisma";
import { logger } from "../config/logger";

async function seed() {
  try {
    // Create demo user
    const user = await prisma.user.upsert({
      where: { email: "demo@example.com" },
      update: {},
      create: {
        email: "demo@example.com",
        password: "$2b$10$Gm8pzr8xfP8m8xfP8m8xfOzDkPvKb9L9L9L9L9L9L9", // bcrypt hashed "password"
        name: "Demo User",
      },
    });

    logger.info("Created demo user:", user);

    // Create sample projects
    const webProject = await prisma.project.create({
      data: {
        userId: user.id,
        name: "Website Redesign",
        description: "Redesign company website",
        color: "#3B82F6",
      },
    });

    const mobileProject = await prisma.project.create({
      data: {
        userId: user.id,
        name: "Mobile App",
        description: "Build iOS and Android app",
        color: "#10B981",
      },
    });

    logger.info("Created sample projects");

    // Create sample tasks
    const task1 = await prisma.task.create({
      data: {
        userId: user.id,
        projectId: webProject.id,
        title: "Design homepage mockups",
        description: "Create high-fidelity mockups for the homepage",
        status: "TODO",
        priority: "HIGH",
        deadline: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3 days from now
        estimatedMinutes: 180,
        tags: ["design", "frontend"],
      },
    });

    const task2 = await prisma.task.create({
      data: {
        userId: user.id,
        projectId: webProject.id,
        title: "Implement responsive navbar",
        description: "Build navigation bar that works on all devices",
        status: "TODO",
        priority: "HIGH",
        deadline: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
        estimatedMinutes: 120,
        tags: ["frontend", "responsive"],
      },
    });

    const task3 = await prisma.task.create({
      data: {
        userId: user.id,
        projectId: mobileProject.id,
        title: "Setup React Native project",
        description: "Initialize React Native project with necessary dependencies",
        status: "IN_PROGRESS",
        priority: "CRITICAL",
        deadline: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000), // tomorrow
        estimatedMinutes: 90,
        tags: ["mobile", "setup"],
      },
    });

    logger.info("Created sample tasks");

    // Create task dependency
    await prisma.taskDependency.create({
      data: {
        fromTaskId: task1.id,
        toTaskId: task2.id,
      },
    });

    logger.info("Created task dependencies");

    // Create reminders
    await prisma.reminder.create({
      data: {
        userId: user.id,
        taskId: task3.id,
        reminderTime: new Date(Date.now() + 2 * 60 * 60 * 1000), // 2 hours from now
        type: "TIME",
        sent: false,
      },
    });

    logger.info("Database seeded successfully");
  } catch (error) {
    logger.error("Error seeding database:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

seed();
