import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios.js';

function Dashboard() {
  const [documents, setDocuments] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    api.get('/documents').then((res) => setDocuments(res.data));
  }, []);

  const createDocument = async () => {
    const res = await api.post('/documents', {});
    navigate(`/editor/${res.data.id}`);
  };

  const deleteDocument = async (id) => {
    await api.delete(`/documents/${id}`);
    setDocuments(documents.filter((doc) => doc.id !== id));
  };

  const logout = () => {
    localStorage.removeItem('token');
    navigate('/login');
  };

  return (
    <div>
      <div>
        <h1>My Documents</h1>
        <button onClick={logout}>Logout</button>
      </div>
      <button onClick={createDocument}>New Document</button>
      <ul>
        {documents.map((doc) => (
          <li key={doc.id}>
            <span onClick={() => navigate(`/editor/${doc.id}`)}>
              {doc.title}
            </span>
            <button onClick={() => deleteDocument(doc.id)}>Delete</button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default Dashboard;