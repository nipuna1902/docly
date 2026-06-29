//redirects to login if no token
// It checks if a token exists in localStorage — if yes, renders the child component (Dashboard or Editor); if no, redirects to /login. This is frontend route protection.
import { Navigate } from 'react-router-dom';

function ProtectedRoute({ children }) {
  const token = localStorage.getItem('token');

  if (!token) {
    return <Navigate to="/login" />;
  }

  return children;
}

export default ProtectedRoute;