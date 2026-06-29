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
    await api.put(`/documents/${id}`, {
      title: newTitle,
      content: newContent
    });
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
    <div>
      <div>
        <button onClick={() => navigate('/dashboard')}>← Back</button>
        <span>{saveStatus}</span>
      </div>
      <input
        type="text"
        value={title}
        onChange={handleTitleChange}
        placeholder="Document title"
      />
      <textarea
        value={content}
        onChange={handleContentChange}
        placeholder="Start typing..."
        rows={20}
        style={{ width: '100%' }}
      />
    </div>
  );
}

export default Editor;