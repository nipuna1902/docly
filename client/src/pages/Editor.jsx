import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api/axios.js';

function Editor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get(`/documents/${id}`).then((res) => {
      setTitle(res.data.title);
      setContent(res.data.content);
    });
  }, [id]);

  const save = async () => {
    setSaving(true);
    await api.put(`/documents/${id}`, { title, content });
    setSaving(false);
  };

  return (
    <div>
      <div>
        <button onClick={() => navigate('/dashboard')}>← Back</button>
        <button onClick={save}>{saving ? 'Saving...' : 'Save'}</button>
      </div>
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Document title"
      />
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Start typing..."
        rows={20}
        style={{ width: '100%' }}
      />
    </div>
  );
}

export default Editor;