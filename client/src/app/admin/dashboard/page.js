'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import useAuth from '@/hooks/useAuth';
import {
  deleteNews,
  generateNews,
  getDrafts,
  publishNews,
  refreshTrending,
  refreshCategoryFeeds,
  createEditorial,
  createAuthor,
  getAuthors,
  getPublishedNews,
  updateNews,
  updateAuthor,
  getNewsById,
  triggerEpaperGeneration,
  getEpaperList,
  triggerBoltaHaiBharat,
} from '@/lib/api';

import RichTextEditor from '@/components/RichTextEditor';

const ARTICLE_CATEGORIES = [
  'Business', 'World', 'Politics', 'Technology', 'Sports', 
  'Entertainment', /* 'Celebrity', */ 'Bolta Hai Bharat', 'Editorial', 'General'
];

const DashboardPage = () => {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const [drafts, setDrafts] = useState([]);
  const [published, setPublished] = useState([]);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [generator, setGenerator] = useState({ topic: '', autoPublish: false });
  const [generateBusy, setGenerateBusy] = useState(false);
  const [generationNote, setGenerationNote] = useState('');
  const [editorial, setEditorial] = useState({ title: '', content: '', category: 'Editorial', imageUrl: '', authorId: '' });
  const [editorialBusy, setEditorialBusy] = useState(false);
  const [editorialNote, setEditorialNote] = useState('');

  // Author state
  const [authors, setAuthors] = useState([]);
  const [authorForm, setAuthorForm] = useState({ name: '', bio: '', photoUrl: '', email: '' });
  const [authorBusy, setAuthorBusy] = useState(false);
  const [authorNote, setAuthorNote] = useState('');

  // Editing state
  const [editingArticle, setEditingArticle] = useState(null);
  const [editForm, setEditForm] = useState({ category: '', title: '', summary: '', content: '', imageUrl: '' });
  const [editBusy, setEditBusy] = useState(false);

  // Author editing state
  const [editingAuthor, setEditingAuthor] = useState(null);
  const [authorEditForm, setAuthorEditForm] = useState({ name: '', bio: '', photoUrl: '', email: '' });
  const [authorEditBusy, setAuthorEditBusy] = useState(false);

  // Toast notification
  const [toast, setToast] = useState(null);
  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // ePaper generation modal + story picks
  const [epaperConfirm, setEpaperConfirm] = useState(false);
  const [headerStoryId, setHeaderStoryId] = useState(null);
  const [politicsPicks, setPoliticsPicks] = useState([]); // ids, order = pick order
  const [headlineFilter, setHeadlineFilter] = useState('');
  const [lastEpaper, setLastEpaper] = useState(null);

  const togglePoliticsPick = (id) => {
    setPoliticsPicks((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleGenerateEpaper = async () => {
    setEpaperConfirm(false);
    setBusy(true);
    setStatus('Generating ePaper…');
    try {
      const res = await triggerEpaperGeneration(null, true, headerStoryId, politicsPicks);
      console.log('[Admin] ePaper generation kicked off', res.data);
      const msg = res.data?.message || 'ePaper generation started';
      setStatus(msg);
      showToast(msg);
    } catch (err) {
      console.error('[Admin] ePaper generation request failed', err);
      const msg = `Failed: ${err.response?.data?.message || err.message}`;
      setStatus(msg);
      showToast(msg, 'error');
    } finally {
      setBusy(false);
    }
  };

  const loadData = async () => {
    try {
      const [draftsRes, publishedRes, authorsRes, epapersRes] = await Promise.all([
        getDrafts(),
        getPublishedNews(),
        getAuthors(),
        getEpaperList().catch(() => ({ data: [] }))
      ]);
      setDrafts(draftsRes.data);
      setPublished(publishedRes.data);
      setAuthors(authorsRes.data);
      setLastEpaper((epapersRes.data || [])[0] || null);
    } catch (err) {
      console.error("Failed to load dashboard data", err);
    }
  };

  useEffect(() => {
    if (!loading) {
      if (!user) router.push('/admin/login');
      else if (user.role !== 'admin') router.push('/');
      else {
        loadData();
      }
    }
  }, [user, loading]);

  const handleEditClick = async (article) => {
    let fullArticle = article;
    // If content is missing (common for published articles from the list fetch), fetch full detail
    if (!article.content && article._id) {
      try {
        const { data } = await getNewsById(article._id);
        fullArticle = data;
      } catch (err) {
        console.error("Failed to fetch full article content", err);
      }
    }

    setEditingArticle(fullArticle);
    setEditForm({ 
      category: fullArticle.category || 'General', 
      title: fullArticle.title || fullArticle.topic || '',
      summary: fullArticle.summary || '',
      content: fullArticle.content || '',
      imageUrl: fullArticle.imageUrl || ''
    });
  };

  const handleUpdateArticle = async (e) => {
    e.preventDefault();
    if (!editingArticle) return;
    setEditBusy(true);
    try {
      await updateNews(editingArticle._id, editForm);
      setEditingArticle(null);
      await loadData();
    } catch (err) {
      alert("Failed to update article");
    } finally {
      setEditBusy(false);
    }
  };

  const handleCreateAuthor = async (e) => {
    e.preventDefault();
    if (!authorForm.name.trim()) return;
    setAuthorBusy(true);
    setAuthorNote('');
    try {
      const { data } = await createAuthor(authorForm);
      setAuthorNote(`Created author: "${data.author.name}"`);
      setAuthorForm({ name: '', bio: '', photoUrl: '', email: '' });
      await loadData();
    } catch (err) {
      setAuthorNote(err.response?.data?.message || 'Failed to create author.');
    } finally {
      setAuthorBusy(false);
    }
  };

  const handleCreateEditorial = async (e) => {
    e.preventDefault();
    if (!editorial.title.trim() || !editorial.content.trim()) return;
    setEditorialBusy(true);
    setEditorialNote('');
    try {
      const { data } = await createEditorial(editorial);
      setEditorialNote(`Published: "${data.article.title}"`);
      setEditorial({ title: '', content: '', category: 'Editorial', imageUrl: '', authorId: '' });
      await loadData();
    } catch (err) {
      setEditorialNote(err.response?.data?.message || 'Failed to publish editorial.');
    } finally {
      setEditorialBusy(false);
    }
  };

  const handleGenerateNews = async (e) => {
    e.preventDefault();
    if (!generator.topic.trim()) return;

    setGenerateBusy(true);
    setGenerationNote('Contacting sources and Gemini…');

    try {
      const { data } = await generateNews(generator);
      setGenerationNote(`Generated: ${data.article.title || data.article.topic}`);
      setGenerator({ topic: '', autoPublish: false });
      await loadData();
    } catch (err) {
      setGenerationNote('Generation failed');
    } finally {
      setGenerateBusy(false);
    }
  };

  if (loading || !user || user.role !== 'admin') {
    return <p className="px-6 py-10">Validating admin session…</p>;
  }

  return (
    <main className="max-w-7xl mx-auto px-6 py-6">
      {/* TOAST NOTIFICATION */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-[200] px-5 py-3 rounded shadow-lg text-sm text-white transition-all ${toast.type === 'error' ? 'bg-red-600' : 'bg-gray-900'}`}>
          {toast.message}
        </div>
      )}

      {/* EPAPER GENERATION MODAL */}
      {epaperConfirm && (
        <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4">
          <div className="bg-white p-6 shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold mb-1">Generate ePaper</h3>
            <p className="text-xs text-gray-500 mb-5">
              Optionally pick the front-page headline and the Politics stories. Leave blank to let the system choose automatically. Generating overwrites today&apos;s edition.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Front-page headline */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold uppercase text-gray-400">Front-page headline</label>
                  {headerStoryId && (
                    <button onClick={() => setHeaderStoryId(null)} className="text-[11px] text-gray-500 underline">clear</button>
                  )}
                </div>
                <input
                  className="w-full border px-3 py-2 text-sm bg-white mb-2"
                  placeholder="Search published stories…"
                  value={headlineFilter}
                  onChange={(e) => setHeadlineFilter(e.target.value)}
                />
                <div className="border max-h-72 overflow-y-auto divide-y">
                  {published
                    .filter((a) => (a.title || a.topic || '').toLowerCase().includes(headlineFilter.toLowerCase()))
                    .map((a) => (
                      <label key={a._id} className="flex items-center gap-2 p-2 text-sm cursor-pointer hover:bg-gray-50">
                        <input
                          type="radio"
                          name="headline"
                          checked={headerStoryId === a._id}
                          onChange={() => setHeaderStoryId(a._id)}
                        />
                        {a.imageUrl && (
                          <img src={a.imageUrl} alt="" className="h-10 w-14 object-cover border rounded shrink-0" onError={(e) => { e.target.style.display = 'none'; }} />
                        )}
                        <span className="flex-1">
                          <span className="block leading-snug">{a.title || a.topic}</span>
                          <span className="text-[10px] uppercase text-gray-400">{a.category}</span>
                        </span>
                      </label>
                    ))}
                  {published.length === 0 && <p className="p-2 text-xs text-gray-400">No published stories.</p>}
                </div>
              </div>

              {/* Politics stories */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold uppercase text-gray-400">Politics stories ({politicsPicks.length} selected)</label>
                  {politicsPicks.length > 0 && (
                    <button onClick={() => setPoliticsPicks([])} className="text-[11px] text-gray-500 underline">clear</button>
                  )}
                </div>
                <p className="text-[11px] text-gray-400 mb-2">Order = pick order. First picked leads the Politics section.</p>
                <div className="border max-h-72 overflow-y-auto divide-y">
                  {published
                    .filter((a) => a.category === 'Politics')
                    .map((a) => {
                      const order = politicsPicks.indexOf(a._id);
                      return (
                        <label key={a._id} className="flex items-center gap-2 p-2 text-sm cursor-pointer hover:bg-gray-50">
                          <input
                            type="checkbox"
                            checked={order !== -1}
                            onChange={() => togglePoliticsPick(a._id)}
                          />
                          {order !== -1 && (
                            <span className="bg-gray-900 text-white text-[10px] w-5 h-5 flex items-center justify-center rounded-full shrink-0">{order + 1}</span>
                          )}
                          {a.imageUrl && (
                            <img src={a.imageUrl} alt="" className="h-10 w-14 object-cover border rounded shrink-0" onError={(e) => { e.target.style.display = 'none'; }} />
                          )}
                          <span className="flex-1 leading-snug">{a.title || a.topic}</span>
                        </label>
                      );
                    })}
                  {published.filter((a) => a.category === 'Politics').length === 0 && (
                    <p className="p-2 text-xs text-gray-400">No published Politics stories.</p>
                  )}
                </div>
              </div>
            </div>

            <div className="flex gap-3 justify-end mt-6">
              <button
                onClick={() => setEpaperConfirm(false)}
                className="border px-4 py-2 text-sm hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleGenerateEpaper}
                className="bg-gray-900 text-white px-4 py-2 text-sm hover:bg-gray-700"
              >
                Confirm &amp; Generate
              </button>
            </div>
          </div>
        </div>
      )}

      {/* HEADER */}
      <header className="border-b pb-4 mb-6">
        <h1 className="text-2xl font-semibold">Admin Studio</h1>
        <p className="text-sm text-gray-600 mt-1">
          Generate, review, and manage newsroom content.
        </p>

        <div className="flex gap-3 mt-4">
          <button
            onClick={async () => {
              setBusy(true);
              setStatus('Fetching trends…');
              await refreshTrending();
              await loadData();
              setBusy(false);
            }}
            className="border px-3 py-1 text-sm hover:bg-gray-50"
            disabled={busy}
          >
            Fetch trends
          </button>

          <button
            onClick={async () => {
              setBusy(true);
              setStatus('Refreshing sections…');
              await refreshCategoryFeeds();
              await loadData();
              setBusy(false);
            }}
            className="border px-3 py-1 text-sm hover:bg-gray-50"
            disabled={busy}
          >
            Refresh sections
          </button>

          <button
            onClick={() => { console.log('[Admin] Generate ePaper button clicked'); setEpaperConfirm(true); }}
            className="border px-3 py-1 text-sm hover:bg-gray-50"
            disabled={busy}
          >
            Generate ePaper
          </button>

          <button
            id="run-bolta-hai-bharat-btn"
            onClick={async () => {
              setBusy(true);
              setStatus('Running Bolta Hai Bharat pipeline\u2026');
              try {
                const res = await triggerBoltaHaiBharat();
                const msg = res.data?.message || 'Bolta Hai Bharat job started';
                setStatus(msg);
                showToast(msg);
              } catch (err) {
                const msg = `Failed: ${err.response?.data?.message || err.message}`;
                setStatus(msg);
                showToast(msg, 'error');
              } finally {
                setBusy(false);
              }
            }}
            className="border px-3 py-1 text-sm hover:bg-gray-50 border-orange-300 text-orange-700 hover:bg-orange-50"
            disabled={busy}
            title="Picks today\u2019s top trending article, runs pulse analysis, and auto-publishes to Bolta Hai Bharat"
          >
            Run Bolta Hai Bharat
          </button>

          <button
            onClick={logout}
            className="ml-auto border px-3 py-1 text-sm hover:bg-gray-50"
          >
            Logout
          </button>
        </div>

        {status && <p className="text-xs text-gray-500 mt-2">{status}</p>}
        {lastEpaper && (
          <p className="text-xs text-gray-500 mt-2">
            Last ePaper published: {new Date(lastEpaper.createdAt).toLocaleString()}
            {' '}(edition {new Date(lastEpaper.editionDate).toLocaleDateString()})
          </p>
        )}
      </header>

      {/* EDIT MODAL OVERLAY */}
      {editingArticle && (
        <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4">
          <div className="bg-white p-6 max-w-2xl w-full shadow-xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold mb-4">Edit Article</h3>
            <form onSubmit={handleUpdateArticle} className="space-y-4">
              <div>
                <label className="text-xs font-bold uppercase text-gray-400 mb-1 block">Title</label>
                <input 
                  className="w-full border px-3 py-2 text-sm bg-white"
                  value={editForm.title}
                  onChange={(e) => setEditForm({...editForm, title: e.target.value})}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold uppercase text-gray-400 mb-1 block">Category</label>
                  <select 
                    className="w-full border px-3 py-2 text-sm bg-white"
                    value={editForm.category}
                    onChange={(e) => setEditForm({...editForm, category: e.target.value})}
                  >
                    {ARTICLE_CATEGORIES.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold uppercase text-gray-400 mb-1 block">Image URL</label>
                  <div className="flex gap-2 items-center">
                    <input 
                      className="flex-1 border px-3 py-2 text-sm bg-white"
                      placeholder="https://..."
                      value={editForm.imageUrl}
                      onChange={(e) => setEditForm({...editForm, imageUrl: e.target.value})}
                    />
                    {editForm.imageUrl && (
                      <button
                        type="button"
                        onClick={() => setEditForm({...editForm, imageUrl: ''})}
                        className="shrink-0 border border-red-300 text-red-600 text-xs px-2 py-2 hover:bg-red-50 font-bold"
                        title="Remove image"
                      >
                        ✕ Remove
                      </button>
                    )}
                  </div>
                  {editForm.imageUrl && (
                    <div className="mt-2 relative inline-block">
                      <img
                        src={editForm.imageUrl}
                        alt="Preview"
                        className="h-24 w-auto max-w-full object-cover border rounded"
                        onError={(e) => { e.target.style.display = 'none'; }}
                      />
                      <p className="text-[10px] text-gray-400 mt-1">Current image preview</p>
                    </div>
                  )}
                </div>
              </div>
              <div>
                <label className="text-xs font-bold uppercase text-gray-400 mb-1 block">Summary</label>
                <textarea 
                  className="w-full border px-3 py-2 text-sm bg-white resize-y"
                  rows={3}
                  value={editForm.summary}
                  onChange={(e) => setEditForm({...editForm, summary: e.target.value})}
                />
              </div>
              <div>
                <label className="text-xs font-bold uppercase text-gray-400 mb-1 block">Content</label>
                <RichTextEditor 
                  value={editForm.content}
                  onChange={(val) => setEditForm({...editForm, content: val})}
                  placeholder="Edit article content..."
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button 
                  type="submit" 
                  disabled={editBusy}
                  className="flex-1 bg-[#1A56C4] text-white py-2 text-sm font-bold disabled:opacity-50"
                >
                  {editBusy ? 'Saving...' : 'Save Changes'}
                </button>
                <button 
                  type="button" 
                  onClick={() => setEditingArticle(null)}
                  className="flex-1 border py-2 text-sm"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* AUTHOR EDIT MODAL */}
      {editingAuthor && (
        <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4">
          <div className="bg-white p-6 max-w-md w-full shadow-xl">
            <h3 className="text-lg font-bold mb-4">Edit Author Profile</h3>
            <form 
              onSubmit={async (e) => {
                e.preventDefault();
                setAuthorEditBusy(true);
                try {
                  await updateAuthor(editingAuthor._id, authorEditForm);
                  setEditingAuthor(null);
                  await loadData();
                } catch (err) {
                  alert("Failed to update author");
                } finally {
                  setAuthorEditBusy(false);
                }
              }} 
              className="space-y-4"
            >
              <div>
                <label className="text-xs font-bold uppercase text-gray-400 mb-1 block">Name</label>
                <input 
                  className="w-full border px-3 py-2 text-sm bg-white"
                  value={authorEditForm.name}
                  onChange={(e) => setAuthorEditForm({...authorEditForm, name: e.target.value})}
                  required
                />
              </div>
              <div>
                <label className="text-xs font-bold uppercase text-gray-400 mb-1 block">Email</label>
                <input 
                  className="w-full border px-3 py-2 text-sm bg-white"
                  type="email"
                  value={authorEditForm.email}
                  onChange={(e) => setAuthorEditForm({...authorEditForm, email: e.target.value})}
                />
              </div>
              <div>
                <label className="text-xs font-bold uppercase text-gray-400 mb-1 block">Photo URL</label>
                <input 
                  className="w-full border px-3 py-2 text-sm bg-white"
                  value={authorEditForm.photoUrl}
                  onChange={(e) => setAuthorEditForm({...authorEditForm, photoUrl: e.target.value})}
                />
              </div>
              <div>
                <label className="text-xs font-bold uppercase text-gray-400 mb-1 block">Bio</label>
                <textarea 
                  className="w-full border px-3 py-2 text-sm bg-white resize-y"
                  rows={4}
                  value={authorEditForm.bio}
                  onChange={(e) => setAuthorEditForm({...authorEditForm, bio: e.target.value})}
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button 
                  type="submit" 
                  disabled={authorEditBusy}
                  className="flex-1 bg-[#1A56C4] text-white py-2 text-sm font-bold disabled:opacity-50"
                >
                  {authorEditBusy ? 'Saving...' : 'Save Changes'}
                </button>
                <button 
                  type="button" 
                  onClick={() => setEditingAuthor(null)}
                  className="flex-1 border py-2 text-sm"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CREATE AUTHOR */}
      <section className="border-b pb-6 mb-6">
        <h2 className="text-lg font-medium mb-1">Create author</h2>
        <p className="text-xs text-gray-500 mb-3">Add an author profile. Articles can then be attributed to this author.</p>

        <form onSubmit={handleCreateAuthor} className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input
              className="border px-3 py-2 text-sm"
              placeholder="Author name *"
              value={authorForm.name}
              onChange={(e) => setAuthorForm((p) => ({ ...p, name: e.target.value }))}
              required
            />
            <input
              className="border px-3 py-2 text-sm"
              placeholder="Email (optional)"
              type="email"
              value={authorForm.email}
              onChange={(e) => setAuthorForm((p) => ({ ...p, email: e.target.value }))}
            />
          </div>
          <input
            className="w-full border px-3 py-2 text-sm"
            placeholder="Photo URL (optional)"
            value={authorForm.photoUrl}
            onChange={(e) => setAuthorForm((p) => ({ ...p, photoUrl: e.target.value }))}
          />
          <textarea
            className="w-full border px-3 py-2 text-sm resize-y"
            rows={3}
            placeholder="Short bio (optional)"
            value={authorForm.bio}
            onChange={(e) => setAuthorForm((p) => ({ ...p, bio: e.target.value }))}
          />
          <div className="flex items-center gap-3">
            <button
              disabled={authorBusy || !authorForm.name.trim()}
              className="border px-4 py-2 text-sm hover:bg-gray-50 disabled:opacity-50"
            >
              {authorBusy ? 'Creating…' : 'Create author'}
            </button>
            {authorNote && <p className="text-xs text-gray-500">{authorNote}</p>}
          </div>
        </form>

        {/* Authors list */}
        {authors.length > 0 && (
          <div className="mt-4 border-t pt-3">
            <p className="text-xs font-medium text-gray-500 mb-2 uppercase tracking-widest">Existing Authors ({authors.length})</p>
            <div className="flex flex-wrap gap-3">
              {authors.map((a) => (
                <div key={a._id} className="flex items-center gap-2 bg-gray-50 border px-3 py-2 text-sm">
                  {a.photoUrl ? (
                    <img src={a.photoUrl} alt="" className="w-6 h-6 rounded-full object-cover" />
                  ) : (
                    <div className="w-6 h-6 rounded-full bg-[#1A56C4] flex items-center justify-center text-white text-[10px] font-bold">
                      {a.name?.charAt(0)?.toUpperCase()}
                    </div>
                  )}
                  <span>{a.name}</span>
                  <button 
                    onClick={() => {
                      setEditingAuthor(a);
                      setAuthorEditForm({
                        name: a.name || '',
                        bio: a.bio || '',
                        photoUrl: a.photoUrl || '',
                        email: a.email || ''
                      });
                    }}
                    className="ml-2 text-[10px] text-[#1A56C4] hover:underline font-bold uppercase"
                  >
                    Edit
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* GENERATOR */}
      <section className="border-b pb-6 mb-6">
        <h2 className="text-lg font-medium mb-2">Generate story</h2>
        <form onSubmit={handleGenerateNews} className="flex gap-3 items-center">
          <input
            className="flex-1 border px-3 py-2 text-sm"
            placeholder="Topic or keyword (e.g. RBI interest rates)"
            value={generator.topic}
            onChange={(e) =>
              setGenerator((p) => ({ ...p, topic: e.target.value }))
            }
          />
          <label className="text-xs flex items-center gap-1">
            <input
              type="checkbox"
              checked={generator.autoPublish}
              onChange={(e) =>
                setGenerator((p) => ({ ...p, autoPublish: e.target.checked }))
              }
            />
            Auto-publish
          </label>
          <button
            disabled={generateBusy}
            className="border px-4 py-2 text-sm hover:bg-gray-50"
          >
            {generateBusy ? 'Generating…' : 'Generate'}
          </button>
        </form>
        {generationNote && (
          <p className="text-xs text-gray-500 mt-2">{generationNote}</p>
        )}
      </section>

      {/* WRITE MANUAL ARTICLE */}
      <section className="border-b pb-6 mb-6">
        <h2 className="text-lg font-medium mb-1">Write manual article</h2>
        <p className="text-xs text-gray-500 mb-3">Manually authored articles published directly to the selected category.</p>
        <form onSubmit={handleCreateEditorial} className="space-y-3">
          <input
            className="w-full border px-3 py-2 text-sm"
            placeholder="Article title"
            value={editorial.title}
            onChange={(e) => setEditorial((p) => ({ ...p, title: e.target.value }))}
          />
          <div className="flex gap-3">
            <select
              className="flex-1 border px-3 py-2 text-sm bg-white"
              value={editorial.category}
              onChange={(e) => setEditorial((p) => ({ ...p, category: e.target.value }))}
            >
              {ARTICLE_CATEGORIES.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
            <input
              className="flex-[2] border px-3 py-2 text-sm"
              placeholder="Image URL (optional)"
              value={editorial.imageUrl}
              onChange={(e) => setEditorial((p) => ({ ...p, imageUrl: e.target.value }))}
            />
          </div>
          <select
            className="w-full border px-3 py-2 text-sm bg-white"
            value={editorial.authorId}
            onChange={(e) => setEditorial((p) => ({ ...p, authorId: e.target.value }))}
          >
            <option value="">— Author (optional) —</option>
            {authors.map((a) => (
              <option key={a._id} value={a._id}>{a.name}</option>
            ))}
          </select>
          <div className="space-y-1">
            <label className="text-xs font-bold uppercase text-gray-400 block">Content</label>
            <RichTextEditor
              value={editorial.content}
              onChange={(val) => setEditorial((p) => ({ ...p, content: val }))}
              placeholder="Write the full article content here…"
            />
          </div>
          <div className="flex items-center gap-3">
            <button
              disabled={editorialBusy || !editorial.title.trim() || !editorial.content.trim()}
              className="border px-4 py-2 text-sm hover:bg-gray-50 disabled:opacity-50"
            >
              {editorialBusy ? 'Publishing…' : 'Publish article'}
            </button>
            {editorialNote && <p className="text-xs text-gray-500">{editorialNote}</p>}
          </div>
        </form>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* DRAFT QUEUE */}
        <section>
          <h2 className="text-lg font-medium mb-4">Draft queue</h2>
          <div className="divide-y border-t">
            {drafts.map((item) => (
              <div key={item._id} className="py-4 flex justify-between items-start gap-4">
                <div className="flex-1">
                  <p className="text-[10px] font-bold uppercase text-[#1A56C4]">
                    {item.category || 'General'}
                  </p>
                  <h3 className="text-sm font-medium leading-tight">{item.title || item.topic}</h3>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button onClick={() => handleEditClick(item)} className="px-2 py-1 text-xs border hover:bg-gray-50">Edit</button>
                  <button onClick={() => publishNews(item._id).then(loadData)} className="px-2 py-1 text-xs bg-[#1A56C4] text-white">Publish</button>
                  <button onClick={() => deleteNews(item._id).then(loadData)} className="px-2 py-1 text-xs border text-red-600">Delete</button>
                </div>
              </div>
            ))}
            {drafts.length === 0 && <p className="text-sm text-gray-500 mt-4">No drafts available.</p>}
          </div>
        </section>

        {/* PUBLISHED ARTICLES */}
        <section>
          <h2 className="text-lg font-medium mb-4">Published articles</h2>
          <div className="divide-y border-t max-h-[600px] overflow-y-auto pr-2">
            {published.map((item) => (
              <div key={item._id} className="py-4 flex justify-between items-start gap-4">
                <div className="flex-1">
                  <p className="text-[10px] font-bold uppercase text-gray-400">
                    {item.category || 'General'}
                  </p>
                  <h3 className="text-sm font-medium leading-tight line-clamp-2">{item.title}</h3>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button onClick={() => handleEditClick(item)} className="px-2 py-1 text-xs border hover:bg-gray-50">Edit</button>
                  <button onClick={() => deleteNews(item._id).then(loadData)} className="px-2 py-1 text-xs border text-red-600">Delete</button>
                </div>
              </div>
            ))}
            {published.length === 0 && <p className="text-sm text-gray-500 mt-4">No articles published yet.</p>}
          </div>
        </section>
      </div>
    </main>
  );
};

export default DashboardPage;
