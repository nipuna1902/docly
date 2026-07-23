import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api/axios.js';

function Landing({ authMode }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const isSignup = authMode === 'signup';

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    try {
      const res = await api.post(isSignup ? '/auth/signup' : '/auth/login', { email, password });
      localStorage.setItem('token', res.data.token);
      navigate('/dashboard');
    } catch {
      setError(isSignup ? 'Signup failed. Email may already be in use.' : 'Invalid email or password');
    }
  };

  return (
    <main className="min-h-screen bg-gray-950 text-white">
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-4 py-5 sm:px-5">
        <Link to="/" className="text-xl font-bold tracking-tight">Docly</Link>
        <div className="flex items-center gap-5 text-sm">
          <Link to="/login" className="text-gray-400 transition hover:text-white">Sign in</Link>
          <Link to="/signup" className="rounded-lg bg-blue-600 px-4 py-2 font-medium transition hover:bg-blue-700">Get started</Link>
        </div>
      </nav>

      <section className="mx-auto max-w-7xl px-4 pb-16 pt-14 sm:px-5 lg:pt-24">
        <div className="mx-auto max-w-2xl text-center">
          <p className="mb-5 text-sm font-medium text-blue-400">A simpler space for your work</p>
          <h1 className="text-4xl font-bold tracking-tight sm:text-6xl">
            Write together, without the clutter.
          </h1>
          <p className="mt-6 text-base leading-7 text-gray-400 sm:text-lg">
            Docly is a focused collaborative workspace for notes, drafts, and documents that move with your team.
          </p>
          <div className="mt-9 flex justify-center gap-3">
            <Link to="/signup" className="rounded-lg bg-blue-600 px-5 py-3 text-sm font-semibold transition hover:bg-blue-700">Start writing free</Link>
            <Link to="/login" className="rounded-lg border border-gray-700 px-5 py-3 text-sm font-semibold text-gray-300 transition hover:border-gray-600 hover:text-white">Sign in</Link>
          </div>
        </div>

      </section>

      {authMode && (
        <div className="fixed inset-0 z-10 flex items-center justify-center bg-gray-950/45 px-5 py-8 backdrop-blur-md">
          <div className="relative w-full max-w-md rounded-2xl border border-gray-700 bg-gray-900 p-8 shadow-2xl shadow-black/50">
            <Link to="/" aria-label="Close" className="absolute right-5 top-4 text-xl text-gray-500 transition hover:text-white">×</Link>
            <h2 className="text-2xl font-bold">{isSignup ? 'Create your account' : 'Welcome back'}</h2>
            <p className="mt-2 text-sm text-gray-400">{isSignup ? 'Start writing with Docly today.' : 'Sign in to continue to your documents.'}</p>
            {error && <p className="mt-5 rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">{error}</p>}
            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <input type="email" required placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-3 text-white placeholder:text-gray-500 outline-none transition focus:border-blue-500" />
              <input type="password" required placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-3 text-white placeholder:text-gray-500 outline-none transition focus:border-blue-500" />
              <button type="submit" className="w-full rounded-lg bg-blue-600 py-3 text-sm font-semibold transition hover:bg-blue-700">{isSignup ? 'Create account' : 'Sign in'}</button>
            </form>
            <p className="mt-6 text-center text-sm text-gray-500">
              {isSignup ? 'Already have an account? ' : "Don't have an account? "}
              <Link to={isSignup ? '/login' : '/signup'} className="text-blue-400 transition hover:text-blue-300">{isSignup ? 'Sign in' : 'Sign up'}</Link>
            </p>
          </div>
        </div>
      )}
    </main>
  );
}

export default Landing;
