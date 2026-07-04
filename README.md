# Docly

A full-stack real-time collaborative document editor — built to learn and demonstrate the PERN stack end to end.

Think Google Docs, but with one feature Google Docs doesn't have: **conflict-aware offline editing** that surfaces both versions side-by-side when you reconnect, rather than silently overwriting one.

---

## Stack

| Layer | Technology |
|---|---|
| Frontend | React + Vite + Tailwind CSS |
| Rich Text | TipTap (ProseMirror-based) |
| Routing | React Router v6 |
| HTTP Client | Axios with JWT interceptor |
| Backend | Node.js + Express + TypeScript |
| Database | PostgreSQL via Prisma ORM |
| Real-time | Socket.io + Redis adapter |
| Cache | Redis (cache-aside pattern) |
| Auth | JWT + bcrypt |
| Infrastructure | Docker Compose |

---

## Features

- **Auth** — signup, login, JWT-protected routes, bcrypt password hashing
- **Documents** — create, edit, delete, auto-save with debouncing
- **Rich text** — bold, italic, underline, headings, lists, code blocks, alignment, highlight
- **Real-time collaboration** — multiple users editing the same document live via Socket.io rooms
- **Offline editing** — edits saved to localStorage when disconnected, auto-synced on reconnect
- **Conflict detection** — version-based 409 detection; side-by-side resolution UI when offline edits conflict with server changes
- **Document sharing** — invite collaborators by email, revoke access, shared docs appear in dashboard
- **Redis caching** — document reads cached with 60s TTL, invalidated on write
- **Docker** — entire stack (Postgres + Redis + Node) runs with a single `docker-compose up`

---

## Project Structure

```
docly/
├── client/          # React frontend (Vite)
├── server/          # Express backend (TypeScript)
└── docker-compose.yml
```

---

## Running Locally

### Option A — Docker (recommended, runs everything)

```bash
docker-compose up --build
```

Then open `http://localhost:5173` after starting the client separately:

```bash
cd client && npm run dev
```

### Option B — Manual

**Prerequisites:** Node 20+, PostgreSQL, Redis

1. Start Redis:
```bash
docker run -d -p 6379:6379 redis:7-alpine
```

2. Set up the database:
```bash
# Create a Postgres database named 'docly'
psql -U postgres -c "CREATE DATABASE docly;"
```

3. Configure environment:
```bash
# server/.env
DATABASE_URL="postgresql://postgres:yourpassword@localhost:5432/docly?schema=public"
JWT_SECRET="your-secret-key"
REDIS_URL="redis://localhost:6379"
```

4. Run migrations and start the server:
```bash
cd server
npm install
npx prisma migrate deploy
npm run dev
```

5. Start the client:
```bash
cd client
npm install
npm run dev
```

---

## Key Engineering Decisions

See [DECISIONS.md](./DECISIONS.md) for in-depth reasoning behind major technical choices and how complex problems were solved.
