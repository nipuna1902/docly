import { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import Highlight from '@tiptap/extension-highlight';
import api from '../api/axios.js';
import useOnlineStatus from '../hooks/useOnlineStatus.js';
import { saveOfflineEdit, getOfflineEdit, clearOfflineEdit } from '../utils/offlineStorage.js';

const socket = io(import.meta.env.VITE_SOCKET_URL);

function extractPlainText(content) {
  if (!content) return '';
  if (typeof content === 'string') {
    try {
      content = JSON.parse(content);
    } catch {
      return content;
    }
  }
  if (content.type === 'text') return content.text || '';
  if (content.content) {
    return content.content.map(extractPlainText).join('');
  }
  return '';
}

function MenuBar({ editor }) {
  if (!editor) return null;

  const btn = (action, label, isActive = false) => (
    <button
      onClick={action}
      className={`px-2 py-1 rounded text-sm font-medium transition
        ${isActive
          ? 'bg-blue-600 text-white'
          : 'text-gray-400 hover:text-white hover:bg-gray-700'
        }`}
    >
      {label}
    </button>
  );

  return (
    <div className="flex flex-wrap items-center gap-1 px-4 py-2 border-b border-gray-800 bg-gray-900">
      {btn(() => editor.chain().focus().toggleBold().run(), 'B', editor.isActive('bold'))}
      {btn(() => editor.chain().focus().toggleItalic().run(), 'I', editor.isActive('italic'))}
      {btn(() => editor.chain().focus().toggleUnderline().run(), 'U', editor.isActive('underline'))}
      {btn(() => editor.chain().focus().toggleStrike().run(), 'S', editor.isActive('strike'))}
      {btn(() => editor.chain().focus().toggleHighlight().run(), 'H', editor.isActive('highlight'))}
      <div className="w-px h-5 bg-gray-700 mx-1" />
      {btn(() => editor.chain().focus().toggleHeading({ level: 1 }).run(), 'H1', editor.isActive('heading', { level: 1 }))}
      {btn(() => editor.chain().focus().toggleHeading({ level: 2 }).run(), 'H2', editor.isActive('heading', { level: 2 }))}
      {btn(() => editor.chain().focus().toggleHeading({ level: 3 }).run(), 'H3', editor.isActive('heading', { level: 3 }))}
      <div className="w-px h-5 bg-gray-700 mx-1" />
      {btn(() => editor.chain().focus().toggleBulletList().run(), '• List', editor.isActive('bulletList'))}
      {btn(() => editor.chain().focus().toggleOrderedList().run(), '1. List', editor.isActive('orderedList'))}
      {btn(() => editor.chain().focus().toggleBlockquote().run(), '" Quote', editor.isActive('blockquote'))}
      {btn(() => editor.chain().focus().toggleCodeBlock().run(), '</> Code', editor.isActive('codeBlock'))}
      <div className="w-px h-5 bg-gray-700 mx-1" />
      {btn(() => editor.chain().focus().setTextAlign('left').run(), '⬅', editor.isActive({ textAlign: 'left' }))}
      {btn(() => editor.chain().focus().setTextAlign('center').run(), '⬛', editor.isActive({ textAlign: 'center' }))}
      {btn(() => editor.chain().focus().setTextAlign('right').run(), '➡', editor.isActive({ textAlign: 'right' }))}
      <div className="w-px h-5 bg-gray-700 mx-1" />
      {btn(() => editor.chain().focus().undo().run(), '↩ Undo')}
      {btn(() => editor.chain().focus().redo().run(), '↪ Redo')}
    </div>
  );
}

function Editor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isOnline = useOnlineStatus();

  const [title, setTitle] = useState('');
  const [baseVersion, setBaseVersion] = useState(null);
  const [saveStatus, setSaveStatus] = useState('All changes saved');
  const [conflict, setConflict] = useState(null);
  const [docData, setDocData] = useState(null);
  const [isDataLoaded, setIsDataLoaded] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareEmail, setShareEmail] = useState('');
  const [shareStatus, setShareStatus] = useState('');
  const [shares, setShares] = useState([]);

  const debounceTimer = useRef(null);
  const isRemoteUpdate = useRef(false);
  const hasMounted = useRef(false);

  const loadShares = useCallback(async () => {
    try {
      const res = await api.get(`/shares/${id}`);
      setShares(res.data);
    } catch {
      // shares endpoint only works for owners, silently fail for shared users
    }
  }, [id]);

  const shareDocument = async () => {
    if (!shareEmail) return;
    try {
      await api.post(`/shares/${id}`, { email: shareEmail });
      setShareEmail('');
      setShareStatus(`Shared with ${shareEmail}`);
      loadShares();
    } catch (err) {
      setShareStatus(err.response?.data?.error || 'Failed to share');
    }
  };

  const revokeAccess = async (userId) => {
    await api.delete(`/shares/${id}/${userId}`);
    loadShares();
  };

  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      Highlight,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
    ],
    content: '',
  });

  const syncToServer = useCallback(async (newTitle, newContent, version, isOfflineSync = false) => {
    if (version === null || version === undefined) return;
    setSaveStatus('Saving...');
    try {
      const contentStr = typeof newContent === 'string'
        ? newContent
        : JSON.stringify(newContent);
      const res = await api.put(`/documents/${id}`, {
        title: newTitle,
        content: contentStr,
        baseVersion: version,
      });
      clearOfflineEdit(id);
      setBaseVersion(res.data.version);
      setSaveStatus('All changes saved');
    } catch (err) {
      if (err.response?.status === 409) {
        if (isOfflineSync) {
          setConflict({
            localTitle: newTitle,
            localContent: newContent,
            serverTitle: err.response.data.serverTitle,
            serverContent: err.response.data.serverContent,
            serverVersion: err.response.data.serverVersion,
          });
          setSaveStatus('Conflict detected');
        } else {
          setBaseVersion(err.response.data.serverVersion);
          syncToServer(newTitle, newContent, err.response.data.serverVersion, false);
        }
      } else {
        setSaveStatus('Sync failed');
      }
    }
  }, [id]);

  const broadcastAndDebounce = useCallback((newTitle, newContent) => {
    socket.emit('edit-document', { documentId: id, title: newTitle, content: newContent });

    if (!isOnline) {
      saveOfflineEdit(id, { title: newTitle, content: newContent, baseVersion });
      setSaveStatus('Offline — changes saved locally');
      return;
    }

    setSaveStatus('Unsaved changes...');
    clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      syncToServer(newTitle, newContent, baseVersion, false);
    }, 1000);
  }, [id, isOnline, baseVersion, syncToServer]);

  useEffect(() => {
    setDocData(null);
    setIsDataLoaded(false);
    api.get(`/documents/${id}`).then((res) => {
      const offline = getOfflineEdit(id);
      if (offline) {
        setTitle(offline.title);
        setBaseVersion(offline.baseVersion);
        setDocData(offline);
        setSaveStatus('Unsynced offline changes');
      } else {
        setTitle(res.data.title);
        setBaseVersion(res.data.version);
        setDocData(res.data);
      }
      setIsDataLoaded(true);
    });

    socket.emit('join-document', id);
    loadShares();
  }, [id, loadShares]);

  useEffect(() => {
    if (!editor || !isDataLoaded || !docData) return;
    isRemoteUpdate.current = true;
    const content = docData.content;
    if (content) {
      try {
        const parsed = typeof content === 'string' ? JSON.parse(content) : content;
        editor.commands.setContent(parsed);
      } catch {
        editor.commands.setContent(content);
      }
    }
    setTimeout(() => { isRemoteUpdate.current = false; }, 100);
  }, [editor, isDataLoaded, docData]);

  useEffect(() => {
    if (!editor) return;

    const handleDocumentUpdated = ({ title: newTitle, content: newContent }) => {
      isRemoteUpdate.current = true;
      setTitle(newTitle);
      try {
        const parsed = typeof newContent === 'string' ? JSON.parse(newContent) : newContent;
        editor.commands.setContent(parsed);
      } catch {
        editor.commands.setContent(newContent);
      }
      setTimeout(() => { isRemoteUpdate.current = false; }, 100);
    };

    socket.on('document-updated', handleDocumentUpdated);
    return () => socket.off('document-updated', handleDocumentUpdated);
  }, [editor]);

  useEffect(() => {
    if (!editor) return;
    const handleUpdate = () => {
      if (isRemoteUpdate.current) return;
      const json = editor.getJSON();
      broadcastAndDebounce(title, json);
    };
    editor.on('update', handleUpdate);
    return () => editor.off('update', handleUpdate);
  }, [editor, title, broadcastAndDebounce]);

  useEffect(() => {
    if (!hasMounted.current) {
      hasMounted.current = true;
      return;
    }
    if (isOnline) {
      const offline = getOfflineEdit(id);
      if (offline) syncToServer(offline.title, offline.content, offline.baseVersion, true);
    }
  }, [isOnline, id, syncToServer]);

  const handleTitleChange = (e) => {
    const newTitle = e.target.value;
    setTitle(newTitle);
    const content = editor?.getJSON();
    broadcastAndDebounce(newTitle, content);
  };

  const resolveConflict = (keepLocal) => {
    if (keepLocal) {
      syncToServer(conflict.localTitle, conflict.localContent, conflict.serverVersion, true);
    } else {
      isRemoteUpdate.current = true;
      setTitle(conflict.serverTitle);
      try {
        const parsed = typeof conflict.serverContent === 'string'
          ? JSON.parse(conflict.serverContent)
          : conflict.serverContent;
        editor?.commands.setContent(parsed);
      } catch {
        editor?.commands.setContent(conflict.serverContent);
      }
      setTimeout(() => { isRemoteUpdate.current = false; }, 100);
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
              <p className="font-medium mb-2">{conflict.localTitle}</p>
              <p className="text-sm text-gray-400 whitespace-pre-wrap overflow-y-auto max-h-48 scrollbar-hide">
                {extractPlainText(conflict.localContent)}
              </p>
            </div>
            <div className="bg-gray-800 rounded-lg p-4">
              <p className="text-xs text-gray-500 mb-2 uppercase tracking-wide">Server version</p>
              <p className="font-medium mb-2">{conflict.serverTitle}</p>
              <p className="text-sm text-gray-400 whitespace-pre-wrap overflow-y-auto max-h-48 scrollbar-hide">
                {extractPlainText(conflict.serverContent)}
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
    <div className="h-screen bg-gray-950 text-white flex flex-col overflow-hidden">
      {/* Share Modal */}
      {showShareModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Share Document</h3>
              <button
                onClick={() => { setShowShareModal(false); setShareStatus(''); }}
                className="text-gray-500 hover:text-white transition"
              >
                ✕
              </button>
            </div>
            <div className="flex gap-2 mb-3">
              <input
                type="email"
                placeholder="Enter email address"
                value={shareEmail}
                onChange={(e) => setShareEmail(e.target.value)}
                className="flex-1 bg-gray-800 text-white placeholder-gray-500 px-3 py-2 rounded-lg border border-gray-700 focus:outline-none focus:border-blue-500 text-sm"
              />
              <button
                onClick={shareDocument}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition"
              >
                Share
              </button>
            </div>
            {shareStatus && (
              <p className="text-sm text-gray-400 mb-3">{shareStatus}</p>
            )}
            {shares.length > 0 && (
              <div className="border-t border-gray-800 pt-3">
                <p className="text-xs text-gray-500 mb-2 uppercase tracking-wide">People with access</p>
                {shares.map((share) => (
                  <div key={share.id} className="flex items-center justify-between py-2">
                    <span className="text-sm text-gray-300">{share.user.email}</span>
                    <button
                      onClick={() => revokeAccess(share.userId)}
                      className="text-xs text-red-400 hover:text-red-300 transition"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Navbar */}
      <div className="bg-gray-900 border-b border-gray-800 px-6 py-3 flex items-center justify-between flex-shrink-0">
        <button
          onClick={() => navigate('/dashboard')}
          className="text-gray-400 hover:text-white text-sm transition"
        >
          ← Back
        </button>
        <Link to="/" className="ml-4 text-sm font-semibold text-white transition hover:text-blue-400">
          Docly
        </Link>
        <div className="flex items-center gap-3">
          {!isOnline && (
            <span className="text-xs bg-yellow-500/10 text-yellow-400 px-2 py-1 rounded-full border border-yellow-500/30">
              Offline
            </span>
          )}
          <span className="text-xs text-gray-500">{saveStatus}</span>
          <button
            onClick={() => { setShowShareModal(true); loadShares(); }}
            className="text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 px-3 py-1 rounded-lg border border-gray-700 transition"
          >
            Share
          </button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex-shrink-0">
        <MenuBar editor={editor} />
      </div>

      {/* Editor area */}
      <div className="flex-1 bg-gray-950 py-10 px-4 overflow-y-auto scrollbar-hide">
        <div className="max-w-3xl mx-auto bg-gray-900 border border-gray-800 rounded-xl shadow-2xl px-12 py-16 min-h-[calc(100vh-200px)]">
          <input
            type="text"
            value={title}
            onChange={handleTitleChange}
            placeholder="Untitled Document"
            className="bg-transparent text-3xl font-bold text-white placeholder-gray-700 outline-none mb-8 w-full border-b border-gray-800 pb-6"
          />
          <EditorContent
            editor={editor}
            className="prose prose-invert max-w-none focus:outline-none"
          />
        </div>
      </div>
    </div>
  );
}

export default Editor;
