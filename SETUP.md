# iQOO AI Productivity Platform — Quick Start Guide

## Prerequisites

Before you start, make sure you have the following installed:
- **Node.js** 18 or higher (download from https://nodejs.org/)
- **npm** or **yarn** (comes with Node.js)
- **PostgreSQL** 14 or higher (download from https://www.postgresql.org/)
- **Git** (download from https://git-scm.com/)

## Step 1: Set up PostgreSQL Database

### On Windows:
1. Download and install PostgreSQL from https://www.postgresql.org/download/windows/
2. During installation, remember the password you set for the `postgres` user
3. Start PostgreSQL (it's usually a service that runs automatically)
4. Open pgAdmin (comes with PostgreSQL) or use command line

### Create a database:
```bash
# Using psql (PostgreSQL command line)
psql -U postgres

# Then in psql:
CREATE DATABASE iqoo_productivity;
\q  # to exit
```

## Step 2: Clone and Install Dependencies

```bash
cd d:\Downloads\react\my-react-app\IQOO

# Install all dependencies (client, server, and shared)
npm install
```

This will install dependencies for all workspaces (client, server, and shared).

## Step 3: Configure Environment Variables

1. Copy the `.env.example` file to `.env`:
```bash
copy .env.example .env
```

2. Edit `.env` and update the database connection:
```
DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@localhost:5432/iqoo_productivity"
```

Replace `YOUR_PASSWORD` with the password you set during PostgreSQL installation.

### Enable real OpenAI reasoning (optional)

The application runs in deterministic local mode until an OpenAI key is configured. To enable the real provider, edit the server environment file and set:

```env
AI_PROVIDER=openai
AI_MODEL=gpt-4o-mini
OPENAI_API_KEY=your-openai-api-key
```

Keep `OPENAI_API_KEY` on the server only; do not add it to the client environment or commit it to Git. Restart the backend after changing these values, then check `GET /api/ai/status`. A successful configuration reports `provider: "openai"`, `isRealAI: true`, and `isFallback: false`.

Without a key, the app automatically uses the deterministic local provider and reports that status honestly.

## Step 4: Set up the Database

```bash
cd server

# Run migrations to create tables
npx prisma migrate dev --name init

# Seed sample data
npx prisma db seed

cd ..
```

This will create all necessary tables and populate some demo data.

## Step 5: Start Development Servers

From the root directory:

```bash
npm run dev
```

This will start both the backend and frontend servers:
- **Backend**: http://localhost:3001
- **Frontend**: http://localhost:5173

## Step 6: Access the Application

Open your browser and navigate to: **http://localhost:5173**

### Demo Login Credentials:
- **Email**: demo@example.com
- **Password**: password

## Troubleshooting

### PostgreSQL Connection Error
If you get a connection error:
1. Make sure PostgreSQL is running
2. Check that the DATABASE_URL in `.env` is correct
3. Verify the password is correct

### Port Already in Use
If port 3001 or 5173 is already in use:
1. Edit `server/src/config/index.ts` to change SERVER_PORT
2. Edit `client/vite.config.ts` to change the port

### Module Not Found Errors
```bash
# Clear node_modules and reinstall
rm -r node_modules
npm install
```

## Common Commands

```bash
# Development
npm run dev                 # Start both frontend and backend

# Building
npm run build              # Build for production

# Database
npx prisma studio         # Open database GUI
npx prisma db seed        # Reseed database

# Frontend only
cd client
npm run dev

# Backend only
cd server
npm run dev
```

## Project Structure

```
IQOO/
├── client/                 # React frontend
│   ├── src/
│   │   ├── components/     # Reusable React components
│   │   ├── pages/          # Page components
│   │   ├── services/       # API client
│   │   ├── store/          # Zustand state management
│   │   ├── types/          # TypeScript types
│   │   └── App.tsx
│   └── index.html
│
├── server/                 # Express backend
│   ├── src/
│   │   ├── routes/         # API routes
│   │   ├── controllers/    # Request handlers
│   │   ├── services/       # Business logic
│   │   ├── repositories/   # Database access
│   │   ├── middleware/     # Auth, error handling
│   │   ├── ai/             # AI abstraction layer
│   │   └── server.ts
│   └── prisma/
│       ├── schema.prisma   # Database schema
│       └── seed.ts         # Demo data
│
├── shared/                 # Shared types and schemas
│   └── src/
│       ├── types.ts        # TypeScript types
│       └── schemas.ts      # Zod validation schemas
│
└── README.md
```

## Next Steps

1. **Explore the Home Page** - See your tasks and AI recommendations
2. **Create a Task** - Use the + button to capture voice, image, or text
3. **Check the Inbox** - Review captured items before converting to tasks
4. **View Projects** - Organize tasks into projects
5. **Try the AI Assistant** - Ask it to help prioritize your work

## Documentation

- API Documentation: See `server/API.md`
- Frontend Components: See `client/src/components/README.md`
- Database Schema: See `server/prisma/schema.prisma`

## Support

For issues or questions:
1. Check the main README.md
2. Review the code comments
3. Check the TypeScript types for guidance

Happy productivity! 🚀
