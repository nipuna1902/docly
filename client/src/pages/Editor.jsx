import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import api from '../api/axios.js';
import useOnlineStatus from '../hooks/useOnlineStatus.js';
import { saveOfflineEdit, getOfflineEdit, clearOfflineEdit } from '../utils/offlineStorage.js';

const socket = io('http://localhost:5000');

function Editor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isOnline = useOnlineStatus();

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [baseVersion, setBaseVersion] = useState(null);
  const [saveStatus, setSaveStatus] = useState('All changes saved');
  const [conflict, setConflict] = useState(null);

  const debounceTimer = useRef(null);

  // Load the document on mount
  useEffect(() => {
    api.get(`/documents/${id}`).then((res) => {
      const offline = getOfflineEdit(id);
      if (offline) {
        // We have unsynced offline edits for this doc — restore them instead of server data
        setTitle(offline.title);
        setContent(offline.content);
        setBaseVersion(offline.baseVersion);
        setSaveStatus('Unsynced offline changes');
      } else {
        setTitle(res.data.title);
        setContent(res.data.content);
        setBaseVersion(res.data.version);
      }
    });

    socket.emit('join-document', id);
    socket.on('document-updated', ({ title: newTitle, content: newContent }) => {
      setTitle(newTitle);
      setContent(newContent);
    });

    return () => socket.off('document-updated');
  }, [id]);

  // Attempt to sync automatically the moment we come back online
  useEffect(() => {
    if (isOnline) {
      const offline = getOfflineEdit(id);
      if (offline) {
        syncToServer(offline.title, offline.content, offline.baseVersion);
      }
    }
  }, [isOnline]);

  const syncToServer = async (newTitle, newContent, version) => {
    setSaveStatus('Syncing...');
    try {
      const res = await api.put(`/documents/${id}`, {
        title: newTitle,
        content: newContent,
        baseVersion: version,
      });
      clearOfflineEdit(id);
      setBaseVersion(res.data.version);
      setSaveStatus('All changes saved');
    } catch (err) {
      if (err.response?.status === 409) {
        setConflict({
          localTitle: newTitle,
          localContent: newContent,
          serverTitle: err.response.data.serverTitle,
          serverContent: err.response.data.serverContent,
          serverVersion: err.response.data.serverVersion,
        });
        setSaveStatus('Conflict detected');
      } else {
        setSaveStatus('Sync failed');
      }
    }
  };

  const handleChange = (newTitle, newContent) => {
    setTitle(newTitle);
    setContent(newContent);

    if (!isOnline) {
      // Can't reach the server — store locally and let the user keep working
      saveOfflineEdit(id, { title: newTitle, content: newContent, baseVersion });
      setSaveStatus('Offline — changes saved locally');
      return;
    }

    socket.emit('edit-document', { documentId: id, title: newTitle, content: newContent });
    setSaveStatus('Unsaved changes...');
    clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      syncToServer(newTitle, newContent, baseVersion);
    }, 1000);
  };

  const resolveConflict = (keepLocal) => {
    if (keepLocal) {
      syncToServer(conflict.localTitle, conflict.localContent, conflict.serverVersion);
    } else {
      setTitle(conflict.serverTitle);
      setContent(conflict.serverContent);
      setBaseVersion(conflict.serverVersion);
      clearOfflineEdit(id);
      setSaveStatus('All changes saved');
    }
    setConflict(null);
  };

  if (conflict) {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center p-6">
        <div className="bg-gray-900 border border-yellow-600/40 rounded-2xl p-8 max-w-2xl w-full">
          <h2 className="text-xl font-bold text-yellow-400 mb-2">Sync Conflict</h2>
          <p className="text-gray-400 text-sm mb-6">
            This document was changed elsewhere while you were offline. Choose which version to keep.
          </p>
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="bg-gray-800 rounded-lg p-4">
              <p className="text-xs text-gray-500 mb-2 uppercase tracking-wide">Your offline version</p>
              <p className="font-medium mb-1">{conflict.localTitle}</p>
              <p className="text-sm text-gray-400 whitespace-pre-wrap overflow-y-auto max-h-48 scrollbar-hide">
                {conflict.localContent}
              </p>
            </div>
            <div className="bg-gray-800 rounded-lg p-4">
              <p className="text-xs text-gray-500 mb-2 uppercase tracking-wide">Server version</p>
              <p className="font-medium mb-1">{conflict.serverTitle}</p>
              <p className="text-sm text-gray-400 whitespace-pre-wrap overflow-y-auto max-h-48 scrollbar-hide">
                {conflict.serverContent}
              </p>
            </div>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => resolveConflict(true)}
              className="flex-1 bg-blue-600 hover:bg-blue-700 py-2 rounded-lg font-medium transition"
            >
              Keep my version
            </button>
            <button
              onClick={() => resolveConflict(false)}
              className="flex-1 bg-gray-700 hover:bg-gray-600 py-2 rounded-lg font-medium transition"
            >
              Keep server version
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col">
      <div className="bg-gray-900 border-b border-gray-800 px-6 py-3 flex items-center justify-between">
        <button onClick={() => navigate('/dashboard')} className="text-gray-400 hover:text-white text-sm transition">
          ← Back
        </button>
        <div className="flex items-center gap-3">
          {!isOnline && (
            <span className="text-xs bg-yellow-500/10 text-yellow-400 px-2 py-1 rounded-full border border-yellow-500/30">
              Offline
            </span>
          )}
          <span className="text-xs text-gray-500">{saveStatus}</span>
        </div>
      </div>

      <div className="max-w-3xl mx-auto w-full px-6 py-10 flex flex-col flex-1">
        <input
          type="text"
          value={title}
          onChange={(e) => handleChange(e.target.value, content)}
          placeholder="Untitled Document"
          className="bg-transparent text-3xl font-bold text-white placeholder-gray-700 outline-none mb-6 w-full"
        />
        <textarea
          value={content}
          onChange={(e) => handleChange(title, e.target.value)}
          placeholder="Start writing..."
          className="bg-transparent text-gray-300 placeholder-gray-700 outline-none resize-none flex-1 text-base leading-relaxed w-full scrollbar-hide"
        />
      </div>
    </div>
  );
}

export default Editor;