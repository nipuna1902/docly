# Docly — Server

Express + TypeScript backend with PostgreSQL, Redis, and Socket.io.

---

## Structure

```
server/
├── index.ts                  # Entry point — Express, Socket.io, Redis setup
├── middleware/
│   └── auth.ts               # JWT verification middleware
├── routes/
│   ├── auth.ts               # POST /api/auth/signup, /login
│   ├── documents.ts          # CRUD for documents + Redis caching
│   └── shares.ts             # Document sharing by email
├── prisma/
│   ├── schema.prisma         # Database models
│   ├── client.ts             # Prisma client singleton
│   └── migrations/           # SQL migration history
├── generated/prisma/         # Auto-generated Prisma client (never edit)
├── Dockerfile                # Production container definition
├── tsconfig.json             # Dev TypeScript config (noEmit: true)
└── tsconfig.build.json       # Production build config (noEmit: false)
```

---

## API Routes

### Auth
| Method | Route | Description |
|---|---|---|
| POST | `/api/auth/signup` | Create account, returns JWT |
| POST | `/api/auth/login` | Login, returns JWT |

### Documents (all require `Authorization: Bearer <token>`)
| Method | Route | Description |
|---|---|---|
| GET | `/api/documents` | List owned + shared documents |
| GET | `/api/documents/:id` | Get one document |
| POST | `/api/documents` | Create document |
| PUT | `/api/documents/:id` | Update with conflict detection |
| DELETE | `/api/documents/:id` | Delete document |

### Shares (owner only)
| Method | Route | Description |
|---|---|---|
| POST | `/api/shares/:documentId` | Share with user by email |
| GET | `/api/shares/:documentId` | List people with access |
| DELETE | `/api/shares/:documentId/:userId` | Revoke access |

---

## Database Schema

```prisma
model User {
  id              Int             @id @default(autoincrement())
  email           String          @unique
  passwordHash    String
  createdAt       DateTime        @default(now())
  documents       Document[]
  sharedDocuments DocumentShare[]
}

model Document {
  id        Int             @id @default(autoincrement())
  title     String          @default("Untitled Document")
  content   String          @default("")
  version   Int             @default(1)      // for conflict detection
  createdAt DateTime        @default(now())
  updatedAt DateTime        @updatedAt
  ownerId   Int
  owner     User            @relation(...)
  shares    DocumentShare[]
}

model DocumentShare {
  id         Int      @id @default(autoincrement())
  documentId Int
  userId     Int
  permission String   @default("edit")
  @@unique([documentId, userId])             // prevents duplicate shares
}
```

---

## Auth Flow

1. Client sends `{ email, password }` to `/api/auth/login`
2. Server fetches user by email, runs `bcrypt.compare(password, passwordHash)`
3. On match, signs `jwt.sign({ userId }, JWT_SECRET, { expiresIn: '7d' })`
4. Client stores token in `localStorage`, attaches it as `Authorization: Bearer <token>` on every subsequent request
5. `authenticate` middleware verifies the token and attaches `req.userId` before the route handler runs

---

## Conflict Detection

The PUT `/api/documents/:id` route accepts an optional `baseVersion` field:

```
Client sends: { title, content, baseVersion: 7 }
Server checks: is document.version still 7?
  - Yes → save, increment version to 8, return updated doc
  - No  → return 409 { serverVersion, serverTitle, serverContent }
```

If no `baseVersion` is sent (normal online auto-save), the check is skipped for backward compatibility.

---

## Socket.io Events

| Event | Direction | Payload | Description |
|---|---|---|---|
| `join-document` | client → server | `documentId` | Join a document room |
| `edit-document` | client → server | `{ documentId, title, content }` | Broadcast edit to room |
| `document-updated` | server → client | `{ title, content }` | Receive edit from another user |

---

## Scripts

```bash
npm run dev      # ts-node development server
npm run build    # compile TypeScript to dist/
npm run start    # run compiled dist/index.js (production)
```
