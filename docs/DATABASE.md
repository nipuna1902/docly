# Data model and migrations

PostgreSQL is accessed through Prisma 7 and the `@prisma/adapter-pg` driver adapter. The schema is the authoritative model: [`server/prisma/schema.prisma`](../server/prisma/schema.prisma).

```text
User 1 ───── owns ───── * Document
User 1 ── * DocumentShare * ── 1 Document
```

## Tables

### `User`

| Column | Type / constraint | Purpose |
|---|---|---|
| `id` | integer, primary key, auto-increment | Stable user ID embedded in JWTs |
| `email` | text, unique | Login and share lookup identifier |
| `passwordHash` | text | bcrypt hash; never returned by the API |
| `createdAt` | timestamp | Account creation time |

### `Document`

| Column | Type / constraint | Purpose |
|---|---|---|
| `id` | integer, primary key, auto-increment | Document identifier and socket room name |
| `title` | text, default `Untitled Document` | Display title |
| `content` | text, default empty | Usually stringified TipTap JSON |
| `version` | integer, default `1` | Optimistic-concurrency token |
| `createdAt` / `updatedAt` | timestamp | Creation and Prisma-managed update times |
| `ownerId` | required foreign key to `User` | Owner of the document |

The `Document.ownerId` foreign key uses Prisma's default `onDelete: Restrict`; a user with owned documents cannot be deleted without handling those documents first.

### `DocumentShare`

| Column | Type / constraint | Purpose |
|---|---|---|
| `id` | integer, primary key, auto-increment | Share row identifier |
| `documentId` | foreign key, cascade delete | Shared document |
| `userId` | foreign key, cascade delete | Recipient |
| `permission` | text, default `edit` | Stored permission label; not enforced by code |
| `createdAt` | timestamp | Grant time |

The compound unique key `(documentId, userId)` prevents duplicate invitations. Deleting a document or recipient deletes related shares.

## Version semantics

Every successful PUT sets `version = version + 1` in the database. The route first reads the row and compares `baseVersion`, then performs the update. This detects ordinary stale client saves but is not a single compare-and-swap database operation: two simultaneous requests that both read version N may both pass before either writes. A future hardening step is an `updateMany` constrained by both ID and version, followed by conflict handling when its count is zero.

An atomic shape would conceptually be:

```text
UPDATE "Document"
SET title = ?, content = ?, version = version + 1
WHERE id = ? AND version = ?;
```

If the affected-row count is zero, fetch the current document and return a 409. This turns the version check and write into one database decision. It still would not merge concurrent prose; it would reliably detect the losing write.

## Migration history

| Migration | Change |
|---|---|
| `20260623181716_init` | Created `Document` without ownership or version |
| `20260627164704_add_user_model` | Created `User` and added required document owner |
| `20260630180014_add_document_version` | Added version field |
| `20260704123015_add_document_sharing` | Created share relation and uniqueness constraint |

Use `npx prisma migrate dev --name <description>` during local schema development, commit the generated SQL, and use `npx prisma migrate deploy` in deployment. Do not edit an applied migration; create a new one instead.

## Redis data (not durable)

Redis stores JSON values for 60 seconds under `documents:user:<userId>` and `document:<documentId>:user:<userId>`. It also carries Socket.IO adapter pub/sub traffic. Redis loss causes cache misses and disrupted multi-instance relay, but must not be treated as a loss of persisted documents.
