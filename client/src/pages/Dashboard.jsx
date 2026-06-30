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
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Navbar */}
      <div className="bg-gray-900 border-b border-gray-800 px-6 py-4 flex items-center justify-between">
        <h1 className="text-xl font-bold text-white">Docly</h1>
        <button
          onClick={logout}
          className="text-gray-400 hover:text-white text-sm transition"
        >
          Logout
        </button>
      </div>

      {/* Main content */}
      <div className="max-w-4xl mx-auto px-6 py-10">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-2xl font-semibold">My Documents</h2>
          <button
            onClick={createDocument}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition"
          >
            + New Document
          </button>
        </div>

        {documents.length === 0 ? (
          <div className="text-center py-20 text-gray-600">
            <p className="text-lg">No documents yet</p>
            <p className="text-sm mt-1">Click "New Document" to get started</p>
          </div>
        ) : (
          <div className="grid gap-3">
            {documents.map((doc) => (
              <div
                key={doc.id}
                className="bg-gray-900 border border-gray-800 rounded-xl px-5 py-4 flex items-center justify-between hover:border-gray-700 transition cursor-pointer group"
              >
                <div onClick={() => navigate(`/editor/${doc.id}`)}>
                  <p className="font-medium text-white group-hover:text-blue-400 transition">
                    {doc.title}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    Last edited {new Date(doc.updatedAt).toLocaleDateString()}
                  </p>
                </div>
                <button
                  onClick={() => deleteDocument(doc.id)}
                  className="text-gray-600 hover:text-red-400 text-sm transition ml-4"
                >
                  Delete
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default Dashboard;