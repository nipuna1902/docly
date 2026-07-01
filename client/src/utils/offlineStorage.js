const KEY_PREFIX = 'docly_offline_';

export function saveOfflineEdit(documentId, data) {
  localStorage.setItem(`${KEY_PREFIX}${documentId}`, JSON.stringify(data));
}

export function getOfflineEdit(documentId) {
  const raw = localStorage.getItem(`${KEY_PREFIX}${documentId}`);
  return raw ? JSON.parse(raw) : null;
}

export function clearOfflineEdit(documentId) {
  localStorage.removeItem(`${KEY_PREFIX}${documentId}`);
}