import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api/axios.js';

function Editor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [saveStatus, setSaveStatus] = useState('All changes saved');
  const debounceTimer = useRef(null);

  useEffect(() => {
    api.get(`/documents/${id}`).then((res) => {
      setTitle(res.data.title);
      setContent(res.data.content);
    });
  }, [id]);

  const save = async (newTitle, newContent) => {
    setSaveStatus('Saving...');
    await api.put(`/documents/${id}`, { title: newTitle, content: newContent });
    setSaveStatus('All changes saved');
  };

  const handleTitleChange = (e) => {
    const newTitle = e.target.value;
    setTitle(newTitle);
    triggerDebounce(newTitle, content);
  };

  const handleContentChange = (e) => {
    const newContent = e.target.value;
    setContent(newContent);
    triggerDebounce(title, newContent);
  };

  const triggerDebounce = (newTitle, newContent) => {
    setSaveStatus('Unsaved changes...');
    clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      save(newTitle, newContent);
    }, 1000);
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col">
      {/* Toolbar */}
      <div className="bg-gray-900 border-b border-gray-800 px-6 py-3 flex items-center justify-between">
        <button
          onClick={() => navigate('/dashboard')}
          className="text-gray-400 hover:text-white text-sm transition"
        >
          ← Back
        </button>
        <span className="text-xs text-gray-500">{saveStatus}</span>
      </div>

      {/* Editor area */}
      <div className="max-w-3xl mx-auto w-full px-6 py-10 flex flex-col flex-1">
        <input
          type="text"
          value={title}
          onChange={handleTitleChange}
          placeholder="Untitled Document"
          className="bg-transparent text-3xl font-bold text-white placeholder-gray-700 outline-none mb-6 w-full"
        />
        <textarea
          value={content}
          onChange={handleContentChange}
          placeholder="Start writing..."
          className="bg-transparent text-gray-300 placeholder-gray-700 outline-none resize-none flex-1 text-base leading-relaxed w-full"
        />
      </div>
    </div>
  );
}

export default Editor;