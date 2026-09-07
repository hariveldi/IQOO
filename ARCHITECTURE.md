## Architecture Overview

This document explains the architecture of the iQOO AI Productivity Platform.

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────┐
│                  Client Layer (React)                   │
│  - Mobile-first UI with Tailwind CSS                    │
│  - TanStack Query for data management                   │
│  - Zustand for state management                         │
│  - React Router for navigation                          │
└─────────────────────────────────────────────────────────┘
                          ↕ (HTTP/REST API)
┌─────────────────────────────────────────────────────────┐
│              API Layer (Express + TypeScript)            │
│  - JWT authentication                                   │
│  - Request validation with Zod                          │
│  - Rate limiting and security                           │
│  - Error handling                                       │
└─────────────────────────────────────────────────────────┘
                          ↕
┌─────────────────────────────────────────────────────────┐
│            Business Logic Layer (Services)              │
│  - TaskService - Task management                        │
│  - ProjectService - Project management                  │
│  - ActionInboxService - Capture pipeline                │
│  - AIService - AI integration                           │
│  - Productivity Engine - Prioritization & Planning      │
└─────────────────────────────────────────────────────────┘
                          ↕
┌─────────────────────────────────────────────────────────┐
│         Data Access Layer (Repositories)                │
│  - TaskRepository                                       │
│  - ProjectRepository                                    │
│  - UserRepository                                       │
│  - ActionInboxRepository                                │
└─────────────────────────────────────────────────────────┘
                          ↕
┌─────────────────────────────────────────────────────────┐
│           Database Layer (PostgreSQL)                   │
│  - User, Project, Task, TaskDependency                  │
│  - ActionInboxItem, Reminder, Document                  │
│  - Meeting, FocusSession, DailyPlan                     │
└─────────────────────────────────────────────────────────┘
```

### Frontend Architecture

#### Components
- **CaptureMenu** - Floating action button for quick capture
- **BottomNavigation** - Mobile navigation with 6 main areas
- **TaskCard** - Reusable task display component

#### Pages
- **Home** - Dashboard with AI recommendations and priority tasks
- **Tasks** - Task list with filtering and search
- **Projects** - Project workspace management
- **Inbox** - Action inbox for reviewing captured items
- **AI** - AI assistant chat interface
- **Profile** - User account management
- **Login/Register** - Authentication pages

#### State Management
- **useAuthStore** - User authentication state (Zustand)
- **useTaskStore** - Tasks and selected task state (Zustand)
- **useQuery** - Server data caching (TanStack Query)

### Backend Architecture

#### Routes Layer
- `/api/auth` - Authentication routes
- `/api/tasks` - Task CRUD operations
- `/api/projects` - Project CRUD operations
- `/api/inbox` - Action inbox capture and management

#### Controllers Layer
- **AuthController** - Handle auth endpoints
- **TaskController** - Handle task endpoints
- **ProjectController** - Handle project endpoints
- **ActionInboxController** - Handle capture endpoints

#### Services Layer
- **AuthService** - User authentication
- **TaskService** - Task business logic
- **ProjectService** - Project business logic
- **ActionInboxService** - Capture pipeline
- **AIService** - AI provider abstraction

#### Repositories Layer
- Direct database access using Prisma ORM
- One repository per entity (User, Task, Project, etc.)
- Encapsulates all database queries

#### Middleware
- **auth.ts** - JWT authentication and token generation
- **errorHandler.ts** - Centralized error handling

#### AI Abstraction
- **AIProvider** - Interface for AI providers
- **LocalAIProvider** - Local/development implementation
- **AIProviderFactory** - Factory pattern for provider creation

This allows switching between:
- OpenAI
- Anthropic (Claude)
- Local models (Llama, Qwen, Gemma)
- Ollama

#### Productivity Engine
- **prioritizer.ts** - Task priority calculation
- **planner.ts** - Daily schedule generation and rescheduling

### Data Flow

#### Capture Flow (Voice → Task)
1. User clicks microphone button in CaptureMenu
2. Audio recorded and transcribed
3. Transcript sent to `/api/inbox/voice`
4. ActionInboxController receives request
5. AIService extracts structured data using AIProvider
6. ActionInboxItem created in database
7. User sees extracted data in Inbox
8. User can accept/reject/modify extracted data
9. User converts to Task which creates Task entity

#### Task Prioritization Flow
1. User views tasks or requests priority calculation
2. TaskService calls calculateTaskPriority from prioritizer
3. Algorithm considers:
   - Deadline proximity
   - Priority level
   - Estimated effort
   - Overdue status
   - Dependencies
4. Updated priority score returned and displayed

#### Daily Planning Flow
1. User requests daily plan
2. TaskService retrieves all user tasks
3. PlannerService generates optimal schedule
4. Considers:
   - Task priorities
   - Deadlines
   - Dependencies
   - Available hours
   - Break intervals
5. Schedule blocks returned with time estimates

### Security Architecture

#### Authentication
- JWT tokens for stateless auth
- Refresh token rotation strategy
- Access token expiry (15 minutes)
- Refresh token expiry (7 days)

#### Authorization
- Middleware checks user ID matches resource owner
- Repositories filter by userId
- Controllers verify authentication before processing

#### Input Validation
- Zod schemas validate all inputs
- Type-safe validation before database operations
- Centralized error responses

#### Data Protection
- Password hashing with bcrypt
- No sensitive data in logs
- CORS configuration
- Helmet security headers
- Rate limiting

### Database Schema

#### Core Entities
- **User** - User accounts and authentication
- **Project** - Workspace/project grouping
- **Task** - Individual tasks with full metadata
- **TaskDependency** - Task relationships (self-referential M2M)

#### Capture Pipeline
- **ActionInboxItem** - Captured items awaiting review
- **Document** - Uploaded documents with extracted content
- **DocumentChunk** - Document content for search

#### Productivity
- **DailyPlan** - Generated daily schedules
- **FocusSession** - Time tracking for tasks
- **Reminder** - Task reminders

#### Other
- **Meeting** - Meeting records with transcripts
- **Note** - Notes within projects
- **AIInteraction** - AI API usage logging
- **ProductivityEvent** - Productivity tracking events

### Deployment Considerations

#### Frontend
- Build with `npm run build`
- Deploy to: Vercel, Netlify, AWS S3 + CloudFront
- Environment variables in `.env`

#### Backend
- Build with `npm run build`
- Deploy to: Heroku, AWS Lambda, DigitalOcean, Railway
- Run migrations before deployment
- Environment variables as secrets

#### Database
- Use managed PostgreSQL service
- Daily backups recommended
- Connection pooling for production

### Performance Optimizations

#### Frontend
- Code splitting with React.lazy()
- Pagination for large lists
- Debounced search
- Image compression before upload
- Local caching with TanStack Query

#### Backend
- Database indexes on frequently queried fields
- Prisma query optimization
- Connection pooling
- Request rate limiting

#### Database
- Normalized schema to prevent duplication
- Foreign key constraints
- Indexed search columns
- Cascade delete rules

### Monitoring & Logging

#### Frontend
- Console errors captured
- Network error logging
- User action tracking

#### Backend
- Winston structured logging
- Request/response logging
- Error stack traces
- Performance metrics

### Extensibility

The architecture is designed to be extended:

#### Adding New AI Providers
1. Implement AIProvider interface
2. Add to AIProviderFactory
3. Update configuration

#### Adding New Capture Types
1. Create capture endpoint in router
2. Implement handler in ActionInboxController
3. Add extraction method to AIService

#### Adding New Features
1. Create feature in Services layer
2. Add controller endpoints
3. Add routes
4. Implement UI components

### Testing Strategy

#### Unit Tests
- Service business logic
- Utility functions
- Priority calculations

#### Integration Tests
- API endpoint flows
- Database transactions
- Authentication flows

#### E2E Tests
- Capture voice → task flow
- Create task → view in dashboard
- Login → view tasks → logout

---

For detailed API documentation, see the API routes files.
For component documentation, see individual component files.
