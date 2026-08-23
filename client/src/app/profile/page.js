'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import useAuth from '@/hooks/useAuth';
import { updateProfile, fetchProfile, getReactedNews } from '@/lib/api';
import Link from 'next/link';
import { makeStorySlug } from '@/lib/slug';

export default function ProfilePage() {
  const { user, loading, setUser } = useAuth();
  const router = useRouter();
  
  const [formData, setFormData] = useState({
    name: '',
    password: '',
    confirmPassword: '',
  });
  
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [reactedStories, setReactedStories] = useState([]);
  const [storiesLoading, setStoriesLoading] = useState(true);

  useEffect(() => {
    if (user) {
      getReactedNews()
        .then(res => setReactedStories(res.data))
        .catch(err => console.error('Failed to fetch reacted news', err))
        .finally(() => setStoriesLoading(false));
    }
  }, [user]);

  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.push('/auth/login');
      } else {
        setFormData((prev) => ({ ...prev, name: user.name }));
      }
    }
  }, [user, loading, router]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage({ type: '', text: '' });

    if (formData.password && formData.password !== formData.confirmPassword) {
      return setMessage({ type: 'error', text: 'Passwords do not match' });
    }

    setBusy(true);
    try {
      const payload = { name: formData.name };
      if (formData.password) payload.password = formData.password;

      const { data } = await updateProfile(payload);
      
      // Update local storage/context user info
      const updatedUser = { ...user, name: data.user.name };
      localStorage.setItem('user', JSON.stringify(updatedUser));
      if (setUser) setUser(updatedUser);

      setMessage({ type: 'success', text: 'Profile updated successfully!' });
      setFormData((prev) => ({ ...prev, password: '', confirmPassword: '' }));
    } catch (err) {
      setMessage({ 
        type: 'error', 
        text: err.response?.data?.message || 'Failed to update profile' 
      });
    } finally {
      setBusy(false);
    }
  };

  if (loading || !user) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-4 border-[#1A56C4] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <main className="max-w-2xl mx-auto px-6 py-12">
      <div className="bg-white border-t-4 border-[#1A56C4] shadow-sm p-8">
        <h1 className="text-2xl font-black uppercase tracking-tight mb-2" style={{ fontFamily: 'Georgia, serif' }}>
          User Profile
        </h1>
        <p className="text-sm text-gray-500 mb-8 uppercase tracking-widest font-bold">
          Manage your account settings
        </p>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">
              Email Address
            </label>
            <input
              type="email"
              value={user.email}
              disabled
              className="w-full border-b border-gray-200 py-2 text-gray-400 cursor-not-allowed focus:outline-none"
            />
            <p className="text-[10px] text-gray-400 mt-1 italic">Email cannot be changed</p>
          </div>

          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-gray-700 mb-2">
              Display Name *
            </label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full border-b border-gray-200 py-2 focus:border-[#1A56C4] transition-colors outline-none"
            />
          </div>

          <div className="pt-4">
            <h3 className="text-xs font-black uppercase tracking-widest text-[#1A56C4] mb-4">
              Change Password
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-gray-700 mb-2">
                  New Password
                </label>
                <input
                  type="password"
                  placeholder="Leave blank to keep current"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full border-b border-gray-200 py-2 focus:border-[#1A56C4] transition-colors outline-none"
                />
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-gray-700 mb-2">
                  Confirm Password
                </label>
                <input
                  type="password"
                  value={formData.confirmPassword}
                  onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                  className="w-full border-b border-gray-200 py-2 focus:border-[#1A56C4] transition-colors outline-none"
                />
              </div>
            </div>
          </div>

          {message.text && (
            <div className={`p-4 text-xs font-bold uppercase tracking-widest ${
              message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
            }`}>
              {message.text}
            </div>
          )}

          <div className="pt-6 border-t border-gray-100 flex items-center justify-between">
            <button
              type="submit"
              disabled={busy}
              className="bg-[#1A56C4] text-white px-8 py-3 text-[11px] font-black uppercase tracking-widest hover:bg-[#1248A8] transition-colors disabled:opacity-50"
            >
              {busy ? 'Saving Changes...' : 'Update Profile'}
            </button>
            <button
              type="button"
              onClick={() => router.back()}
              className="text-[10px] font-black uppercase tracking-widest text-gray-400 hover:text-gray-600 transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>

      {/* REACTED STORIES */}
      <div className="mt-8 bg-white border-t-4 border-gray-400 shadow-sm p-8">
        <h2 className="text-xl font-black uppercase tracking-tight mb-6" style={{ fontFamily: 'Georgia, serif' }}>
          My Reacted Articles
        </h2>
        
        {storiesLoading ? (
          <p className="text-xs text-gray-400 uppercase tracking-widest animate-pulse">Loading history...</p>
        ) : reactedStories.length > 0 ? (
          <div className="divide-y divide-gray-100">
            {reactedStories.map(story => (
              <Link 
                key={story._id} 
                href={makeStorySlug(story)}
                className="py-4 flex gap-4 group hover:bg-blue-50/30 transition-colors"
              >
                {story.imageUrl && (
                  <img 
                    src={story.imageUrl} 
                    className="w-20 h-20 object-cover bg-gray-50 shrink-0" 
                    alt="" 
                  />
                )}
                <div>
                  <p className="text-[9px] font-black uppercase tracking-widest text-[#1A56C4] mb-1">
                    {story.category}
                  </p>
                  <h3 className="text-sm font-black group-hover:text-[#1A56C4] transition-colors leading-tight">
                    {story.title}
                  </h3>
                  <p className="text-xs text-gray-500 line-clamp-2 mt-2 leading-relaxed">
                    {story.summary}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-400 italic">You haven&apos;t reacted to any articles yet.</p>
        )}
      </div>
    </main>
  );
}
