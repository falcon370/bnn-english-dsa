'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import Link from 'next/link';
import { useAuthContext } from '@/context/AuthContext';

const AdminLoginPage = () => {
  const router = useRouter();
  const { user, loading, login } = useAuthContext();
  const [form, setForm] = useState({ email: '', password: '' });
  const [role, setRole] = useState('user');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Redirect to dashboard if already signed in as admin
  useEffect(() => {
    if (!loading && user) {
      if (user.role === 'admin') router.replace('/admin/dashboard');
      else router.replace('/');
    }
  }, [user, loading, router]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');

    try {
      const loggedUser = await login(form);
      if (role === 'admin') {
        if (loggedUser.role !== 'admin') {
          setError('Admin access required.');
          return;
        }
        router.push('/admin/dashboard');
      } else {
        router.push('/');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid credentials.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <main className="min-h-[70vh] flex items-center justify-center"><p className="text-gray-500 text-sm">Loading…</p></main>;
  }

  return (
    <main className="min-h-[70vh] flex items-start justify-center px-4 pt-24">
      <section className="w-full max-w-sm">
        {/* HEADER */}
        <header className="mb-6 border-b pb-4">
          <h1 className="text-2xl font-semibold">Sign In</h1>
          <p className="text-sm text-gray-600 mt-1">
            Bharat News Narratives
          </p>
        </header>

        {/* ERROR */}
        {error && (
          <div className="border border-red-200 bg-red-50 text-sm text-red-700 px-3 py-2 mb-4">
            {error}
          </div>
        )}

        {/* FORM */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-[11px] font-black uppercase tracking-widest text-gray-400 mb-1">Role</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full border px-3 py-2 text-sm bg-white focus:outline-none"
              disabled={submitting}
            >
              <option value="user">Reader</option>
              <option value="admin">Administrator</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-black uppercase tracking-widest text-gray-400 mb-1">Email</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) =>
                setForm((p) => ({ ...p, email: e.target.value }))
              }
              className="w-full border px-3 py-2 text-sm focus:outline-none"
              required
              disabled={submitting}
            />
          </div>

          <div>
            <label className="block text-[11px] font-black uppercase tracking-widest text-gray-400 mb-1">Password</label>
            <input
              type="password"
              value={form.password}
              onChange={(e) =>
                setForm((p) => ({ ...p, password: e.target.value }))
              }
              className="w-full border px-3 py-2 text-sm focus:outline-none"
              required
              disabled={submitting}
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-[#1A56C4] text-white py-3 text-[11px] font-black uppercase tracking-widest hover:bg-[#1248A8] transition-colors disabled:opacity-50 mt-4"
          >
            {submitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        {/* FOOTER */}
        <footer className="mt-8 pt-4 border-t border-gray-100 flex flex-col gap-3 text-sm">
          <p className="text-gray-500 font-medium">
            Don&apos;t have an account?{' '}
            <Link href="/auth/register" className="text-[#1A56C4] font-black uppercase tracking-widest hover:underline ml-1">
              Sign up
            </Link>
          </p>
          <Link href="/" className="text-gray-600 hover:underline flex items-center gap-1">
            ← Back to Home
          </Link>
        </footer>
      </section>
    </main>
  );
};

export default AdminLoginPage;

