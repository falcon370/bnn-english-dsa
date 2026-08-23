'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import useAuth from '@/hooks/useAuth';
import Link from 'next/link';

const RegisterPage = () => {
  const router = useRouter();
  const { register } = useAuth();
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [role, setRole] = useState('user');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      await register({ ...form, role });
      router.push('/');
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-[70vh] flex items-start justify-center px-4 pt-24">
      <section className="w-full max-w-sm">
        {/* HEADER */}
          <header className="mb-6 border-b pb-4">
          <h1 className="text-2xl font-black uppercase tracking-tight" style={{ fontFamily: 'Georgia, serif' }}>Join BNN</h1>
          <p className="text-[10px] font-black uppercase tracking-widest text-[#1A56C4] mt-1">
            Become a part of the narrative
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
          {/* Role selection removed: admins cannot be registered via public endpoint */}

          <div>
            <label className="block text-[11px] font-black uppercase tracking-widest text-gray-400 mb-1">Full name</label>
            <input
              value={form.name}
              onChange={(e) =>
                setForm((p) => ({ ...p, name: e.target.value }))
              }
              className="w-full border px-3 py-2 text-sm focus:outline-none"
              required
              disabled={loading}
            />
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
              disabled={loading}
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
              disabled={loading}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#1A56C4] text-white py-3 text-[11px] font-black uppercase tracking-widest hover:bg-[#1248A8] transition-colors disabled:opacity-50 mt-4"
          >
            {loading ? 'Creating account…' : 'Create account'}
          </button>
        </form>

        {/* FOOTER */}
        <footer className="mt-8 pt-4 border-t border-gray-100 flex flex-col gap-3 text-sm">
          <p className="text-gray-500 font-medium">
            Already have an account?{' '}
            <Link href="/admin/login" className="text-[#1A56C4] font-black uppercase tracking-widest hover:underline ml-1">
              Sign in
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

export default RegisterPage;


