import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api/axios.js';

function Dashboard({ preview = false }) {
  const [ownedDocs, setOwnedDocs] = useState([]);
  const [sharedDocs, setSharedDocs] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    if (preview) {
      setOwnedDocs([
        { id: 'sample-brief', title: 'Project brief', updatedAt: new Date() },
        { id: 'sample-notes', title: 'Meeting notes', updatedAt: new Date() },
      ]);
      return;
    }
    api.get('/documents').then((res) => {
      setOwnedDocs(res.data.owned || []);
      setSharedDocs(res.data.shared || []);
    });
  }, [preview]);

  const createDocument = async () => {
    if (preview) return;
    const res = await api.post('/documents', {});
    navigate(`/editor/${res.data.id}`);
  };

  const deleteDocument = async (id) => {
    if (preview) return;
    await api.delete(`/documents/${id}`);
    setOwnedDocs(ownedDocs.filter((doc) => doc.id !== id));
  };

  const logout = () => {
    if (preview) {
      navigate('/');
      return;
    }
    localStorage.removeItem('token');
    navigate('/login');
  };

  const DocCard = ({ doc, showDelete }) => (
    <div
      key={doc.id}
      className={`bg-gray-900 border border-gray-800 rounded-xl px-5 py-4 flex items-center justify-between hover:border-gray-700 transition group ${preview ? '' : 'cursor-pointer'}`}
    >
      <div onClick={() => !preview && navigate(`/editor/${doc.id}`)}>
        <p className="font-medium text-white group-hover:text-blue-400 transition">
          {doc.title}
        </p>
        <p className="text-xs text-gray-500 mt-1">
          Last edited {new Date(doc.updatedAt).toLocaleDateString()}
        </p>
      </div>
      {showDelete && (
        <button
          onClick={() => deleteDocument(doc.id)}
          className="text-gray-600 hover:text-red-400 text-sm transition ml-4"
        >
          Delete
        </button>
      )}
    </div>
  );

  return (
    <div className="h-screen bg-gray-950 text-white flex flex-col overflow-hidden">
      <div className="bg-gray-900 border-b border-gray-800 px-6 py-4 flex items-center justify-between flex-shrink-0">
        <Link to="/" className="text-xl font-bold text-white transition hover:text-blue-400">Docly</Link>
        <button
          onClick={logout}
          className="text-gray-400 hover:text-white text-sm transition"
        >
          {preview ? 'View landing page' : 'Logout'}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-hide">
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

          {ownedDocs.length === 0 ? (
            <div className="text-center py-12 text-gray-600">
              <p className="text-lg">No documents yet</p>
              <p className="text-sm mt-1">Click "New Document" to get started</p>
            </div>
          ) : (
            <div className="grid gap-3 mb-10">
              {ownedDocs.map((doc) => (
                <DocCard key={doc.id} doc={doc} showDelete={true} />
              ))}
            </div>
          )}

          {sharedDocs.length > 0 && (
            <>
              <h2 className="text-2xl font-semibold mb-6">Shared with me</h2>
              <div className="grid gap-3">
                {sharedDocs.map((doc) => (
                  <DocCard key={doc.id} doc={doc} showDelete={false} />
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
