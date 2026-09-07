# iQOO AI Productivity Platform

An intelligent, mobile-first productivity system that captures unstructured information from the user's real world through the phone, understands it using AI, converts it into actionable work, prioritizes and schedules that work, and helps the user execute it.

Built for iQOO Hackathon 2026 — AI Productivity track.

## Core Philosophy

**"Capture anything. Understand everything. Turn information into action."**

## Features

### Phase 1: Foundation
- User authentication with JWT
- Core task management
- Project workspace
- Mobile-first UI with Tailwind CSS

### Phase 2: Core Productivity
- Task CRUD operations
- Project management
- Action Inbox for captured items
- Task prioritization
- Task dependencies

### Phase 3: AI Integration
- Voice-to-task extraction
- Camera/image processing
- Document intelligence
- Structured AI output validation

### Phase 4: Intelligence
- AI-powered daily planner
- Automatic task rescheduling
- "What should I do now?" recommendations
- Personal work memory with search

### Phase 5: Mobile Features
- Camera capture
- Voice recording
- Mobile-optimized interface
- Context-aware capabilities

### Phase 6: Office Kit Integration
- Cross-device workflows
- Phone-to-laptop task transfer

### Phase 7: Analytics & Polish
- Productivity analytics
- Focus mode
- Animations and loading states
- Demo data

## Tech Stack

### Frontend
- **React** 18 with TypeScript
- **Vite** for fast development
- **Tailwind CSS** for styling
- **React Router** for navigation
- **TanStack Query** for data management
- **React Hook Form** for forms
- **Zod** for validation
- **Lucide React** for icons
- **Recharts** for analytics

### Backend
- **Node.js** with Express.js
- **TypeScript** for type safety
- **PostgreSQL** for data persistence
- **Prisma ORM** for database access
- **JWT** for authentication
- **bcrypt** for password hashing
- **Helmet** for security headers
- **CORS** and rate limiting

### Shared
- TypeScript types and schemas
- Validation schemas with Zod

## Project Structure

```
.
├── client/              # React frontend
│   ├── src/
│   │   ├── components/  # Reusable React components
│   │   ├── pages/       # Page components
│   │   ├── services/    # API client services
│   │   ├── hooks/       # Custom React hooks
│   │   ├── types/       # TypeScript types
│   │   ├── utils/       # Utility functions
│   │   ├── styles/      # Global styles
│   │   └── App.tsx
│   ├── index.html
│   ├── vite.config.ts
│   └── package.json
│
├── server/              # Express backend
│   ├── src/
│   │   ├── config/      # Configuration
│   │   ├── routes/      # API routes
│   │   ├── controllers/ # Request handlers
│   │   ├── services/    # Business logic
│   │   ├── repositories/# Database access
│   │   ├── middleware/  # Express middleware
│   │   ├── validators/  # Input validation
│   │   ├── ai/          # AI abstraction layer
│   │   ├── productivity/# Productivity engine
│   │   ├── utils/       # Utility functions
│   │   ├── types/       # TypeScript types
│   │   ├── jobs/        # Background jobs
│   │   ├── app.ts
│   │   └── server.ts
│   ├── prisma/
│   │   ├── schema.prisma# Database schema
│   │   └── seed.ts      # Seed data
│   └── package.json
│
├── shared/              # Shared code
│   ├── src/
│   │   ├── types/       # Shared types
│   │   └── schemas/     # Zod validation schemas
│   └── package.json
│
├── package.json         # Monorepo root
├── .env.example         # Environment template
└── README.md
```

## Getting Started

### Prerequisites
- Node.js 18+
- npm or yarn
- PostgreSQL 14+
- Git

### Installation

1. **Clone the repository**
   ```bash
   git clone <repo-url>
   cd iqoo-ai-productivity-platform
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Set up the database**
   ```bash
   cd server
   npx prisma migrate dev
   npx prisma db seed
   cd ..
   ```

5. **Start development servers**
   ```bash
   npm run dev
   ```

   This will run:
   - Backend on http://localhost:3001
   - Frontend on http://localhost:5173

### Running Tests

```bash
npm test
```

### Building for Production

```bash
npm run build
npm start
```

## Architecture

### Frontend Architecture
- Component-based React with TypeScript
- Mobile-first responsive design using Tailwind CSS
- TanStack Query for efficient state management and API caching
- React Router for navigation
- Zod for runtime validation

### Backend Architecture
- Modular Express application
- Separation of concerns: routes → controllers → services → repositories
- Centralized error handling and logging
- JWT-based authentication with refresh tokens
- Prisma ORM for type-safe database access
- AI provider abstraction for model flexibility

### Database Design
- Normalized PostgreSQL schema
- Tables: User, Project, Task, TaskDependency, Note, Document, ActionInboxItem, Meeting, Reminder, FocusSession, ProductivityEvent, etc.
- Proper indexing for query performance
- Cascading delete rules

## API Documentation

### Authentication
- `POST /api/auth/register` - Create account
- `POST /api/auth/login` - Login
- `POST /api/auth/refresh` - Refresh token
- `POST /api/auth/logout` - Logout

### Tasks
- `GET /api/tasks` - List tasks
- `POST /api/tasks` - Create task
- `GET /api/tasks/:id` - Get task details
- `PATCH /api/tasks/:id` - Update task
- `DELETE /api/tasks/:id` - Delete task

### Projects
- `GET /api/projects` - List projects
- `POST /api/projects` - Create project
- `GET /api/projects/:id` - Get project
- `PATCH /api/projects/:id` - Update project

### Capture
- `POST /api/capture/voice` - Process voice input
- `POST /api/capture/image` - Process image input
- `POST /api/capture/document` - Process document

### AI
- `POST /api/ai/extract` - Extract structured data
- `POST /api/ai/prioritize` - Calculate priorities
- `POST /api/ai/plan` - Generate daily plan
- `POST /api/ai/reschedule` - Reschedule tasks
- `POST /api/ai/assistant` - Chat with AI assistant

### Analytics
- `GET /api/analytics/dashboard` - Get analytics data

## Mobile-First Design

The application is optimized for mobile devices first:
- Responsive design from 360px width
- Touch-friendly interface
- Bottom navigation on mobile
- Floating action button for quick capture
- Native mobile patterns

## Security

- Password hashing with bcrypt
- JWT-based authentication
- Refresh token rotation
- Input validation with Zod
- SQL injection protection via Prisma
- File upload validation
- CORS configuration
- Helmet security headers
- Rate limiting

## Performance

- Lazy loading of components
- Pagination for large datasets
- Image compression before upload
- Database query optimization
- Caching with TanStack Query
- Optimistic updates

## AI Architecture

- Provider abstraction for model flexibility
- Structured output validation
- Support for local/open-source models (Llama, Qwen, Gemma, Phi)
- Cloud fallback options (OpenAI, Anthropic)
- Hallucination control with structured schemas
- Clear distinction between facts and AI suggestions

## Development Guidelines

- Write meaningful, self-documenting code
- Use TypeScript strictly (no `any`)
- Keep components small and reusable
- Centralize business logic in services
- Test critical functionality
- Follow conventional commits
- Maintain clear Git history

## Debugging

### Frontend
- React DevTools
- Network tab in browser DevTools
- Vite debug logs

### Backend
- Structured logging
- Debug via VS Code debugger
- Prisma Studio: `npx prisma studio`

## Deployment

The application is designed to be deployed with:
- Frontend: Vercel, Netlify, or static hosting
- Backend: AWS, Heroku, DigitalOcean, or any Node.js hosting
- Database: Managed PostgreSQL service

## Demo Scenarios

1. **Voice → Task**: Speak a task and AI extracts structured information
2. **Camera → Whiteboard**: Capture whiteboard, extract tasks and assignments
3. **Document → Summary**: Upload PDF/DOC, get summary and action items
4. **AI Prioritization**: System calculates task priority intelligently
5. **Daily Planner**: AI generates optimized daily schedule
6. **"What should I do now?"**: Get AI recommendation for next task
7. **Phone ↔ Laptop**: Cross-device workflow with iQOO Office Kit

## Contributing

1. Create a feature branch
2. Make changes following the guidelines
3. Write tests for critical paths
4. Submit pull request

## License

MIT

## Contact

Built for iQOO Hackathon 2026
