# Security notes

This is a code-based assessment of the current repository, not a security certification. The application is suitable for local learning/development only until the following issues are addressed.

## Highest-priority issues

| Issue | Evidence | Risk | Recommended remediation |
|---|---|---|---|
| Socket.IO is unauthenticated and un-authorized | `join-document` accepts any ID in `server/index.ts` | A connected untrusted client can join guessed rooms and inject/receive transient edit events | Send JWT in Socket.IO auth, verify it in middleware, and check owner/share access before joining or broadcasting. |
| Weak development secret is committed in Compose | `docker-compose.yml` provides a fixed `JWT_SECRET` | Anyone knowing the secret can forge tokens in an environment that reuses it | Inject a unique secret through deployment secret management; remove fallback production secrets. |
| CORS is initially permissive | `app.use(cors())` runs before origin-restricted CORS | Cross-origin browser access may be allowed more broadly than intended | Configure CORS once, before routes, with explicit origins, methods, and credentials policy. |
| No input validation or rate limiting | Route handlers consume bodies and IDs directly | Invalid inputs may cause 500s; auth endpoints are susceptible to brute-force abuse | Add schema validation, length limits, parameter parsing, and rate limiting. |
| JWT has no revocation strategy | Stateless seven-day tokens | A stolen token remains usable until expiry | Use short-lived access tokens plus refresh/revocation storage, or an allow/deny list appropriate to the product. |

## Important correctness/privacy concerns

- Browser `localStorage` is accessible to same-origin JavaScript. An XSS bug could steal JWTs and offline content. Prefer an XSS defense program and consider secure HTTP-only cookies for sessions.
- Redis document caches are invalidated only for the acting user. Other users can receive stale data for up to 60 seconds after writes, shares, or revocations.
- The documented optimistic concurrency check is read-then-update rather than a conditional database update, so simultaneous requests can still race.
- Share permissions are stored but every share effectively has edit access. Either implement permission enforcement or remove unsupported permission claims.
- There is no audit log, account deletion flow, content encryption policy, backup/restore process, or security headers configuration.

## Baseline production hardening

Use HTTPS; secure cookies if adopted; strict CSP/security headers; constrained CORS; secrets management; least-privilege database and Redis credentials; request-size limits; validation; rate limits; dependency scanning; logging without credentials/content; monitoring; backups; and an incident/revocation procedure. Re-test authorization for both REST and sockets after every collaboration change.

## Security design notes

**Why is frontend route protection insufficient?** A user can modify browser JavaScript or call the API directly. `ProtectedRoute` only hides UI routes; Express authorization tied to a verified identity is the actual control.

**Why does JWT verification alone not authorize a request?** Verification establishes who signed in. Authorization still has to compare that `userId` with the document owner or `DocumentShare` relation for every protected resource.

**What would secure socket collaboration look like?** Pass a token in the Socket.IO handshake, verify it with `io.use`, attach `userId` to `socket.data`, and query owner/share access before `socket.join(documentId)`. Repeat the access check for any event whose payload names a document, and disconnect/revoke rooms when access changes.

**Why mention XSS with localStorage?** JavaScript running in the same origin can read localStorage. If injected script executes, it can exfiltrate the bearer token; HTTP-only cookies reduce that specific theft path but require CSRF design.
