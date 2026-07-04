# Docly — Client

React + Vite frontend with Tailwind CSS, TipTap rich text, and Socket.io.

---

## Structure

```
client/src/
├── api/
│   └── axios.js              # Axios instance with base URL + JWT interceptor
├── components/
│   └── ProtectedRoute.jsx    # Redirects to /login if no token in localStorage
├── hooks/
│   └── useOnlineStatus.js    # Reactive online/offline detection via window events
├── pages/
│   ├── Login.jsx             # Login form
│   ├── Signup.jsx            # Signup form
│   ├── Dashboard.jsx         # Document list (owned + shared)
│   └── Editor.jsx            # Rich text editor with all collaborative features
├── utils/
│   └── offlineStorage.js     # localStorage helpers for offline edits
├── App.jsx                   # React Router setup
└── main.jsx                  # Entry point
```

---

## Pages

### Login / Signup
- Controlled form inputs with `useState`
- On success: store JWT in `localStorage`, navigate to `/dashboard`
- On failure: show error message

### Dashboard
- Fetches `GET /api/documents` on mount via `useEffect`
- Response shape: `{ owned: [...], shared: [...] }`
- "New Document" creates a doc and navigates to its editor
- "Shared with me" section appears only when shared docs exist

### Editor
The most complex component. Responsibilities:

1. **Load document** — fetch from API on mount, set TipTap content
2. **Rich text** — TipTap with StarterKit, Underline, Highlight, TextAlign extensions
3. **Auto-save** — debounced 1s after typing stops, sends PUT with `baseVersion`
4. **Real-time** — joins Socket.io room on load, broadcasts edits, receives remote updates
5. **Offline** — detects connection loss, saves to localStorage, syncs on reconnect
6. **Conflict resolution** — shows side-by-side UI if 409 returned on sync
7. **Sharing** — Share button opens modal to invite by email, list/revoke access

---

## Key Patterns

### Axios interceptor
```js
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});
```
Every API call automatically attaches the JWT — no manual header setting anywhere.

### ProtectedRoute
```jsx
function ProtectedRoute({ children }) {
  const token = localStorage.getItem('token');
  if (!token) return <Navigate to="/login" />;
  return children;
}
```
Frontend-only protection. Real security lives on the server — this just improves UX.

### isRemoteUpdate ref
```js
const isRemoteUpdate = useRef(false);
```
A ref (not state) that suppresses TipTap's `onUpdate` callback during programmatic content changes (initial load, Socket.io updates, conflict resolution). Without this, every `editor.commands.setContent()` call would trigger a save, causing false 409 conflicts on every page load.

### Debouncing with stale closure prevention
```js
debounceTimer.current = setTimeout(() => {
  syncToServer(newTitle, newContent, baseVersion);
}, 1000);
```
Values passed as explicit parameters — not read from state inside the callback — to avoid stale closure bugs where the timeout captures outdated state from the render cycle it was created in.

### Offline storage key format
```
docly_offline_<documentId>
```
Stored as: `{ title, content, baseVersion }`. The `baseVersion` is critical — it's what the server uses to detect if a conflict occurred while the user was offline.

---

## TipTap Content Format

TipTap stores content as a JSON document tree, not plain text:

```json
{
  "type": "doc",
  "content": [
    {
      "type": "paragraph",
      "content": [
        { "type": "text", "text": "Hello ", "marks": [{ "type": "bold" }] },
        { "type": "text", "text": "world" }
      ]
    }
  ]
}
```

This JSON is stringified and stored in the `content` column in Postgres. On load, it's parsed back and passed to `editor.commands.setContent()`. The `extractPlainText()` helper recursively walks this tree to produce readable text for the conflict resolution UI.

---

## Scripts

```bash
npm run dev      # Vite development server (http://localhost:5173)
npm run build    # Production build to dist/
npm run preview  # Preview production build locally
```
