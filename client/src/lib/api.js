import axios from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:5000';

export const api = axios.create({
  baseURL: `${API_BASE_URL}/api`,
});

export const setAuthHeader = (token) => {
  if (token) {
    api.defaults.headers.common.Authorization = `Bearer ${token}`;
  } else {
    delete api.defaults.headers.common.Authorization;
  }
};

export const getPublishedNews = () => api.get('/news');
export const getCategoryNews = (category, page = 1, limit = 15) =>
  api.get('/news', { params: { category, page, limit } });
export const searchNews = (q, page = 1, limit = 15) =>
  api.get('/news', { params: { q, page, limit } });
export const getNewsById = (id) => api.get(`/news/${id}`);
export const getTrendingNews = () => api.get('/trending');
export const getTrendingStatus = () => api.get('/trending/status');
export const refreshTrending = () => api.post('/trending/refresh');
export const refreshCategoryFeeds = () => api.post('/trending/refresh-categories');
export const getDrafts = () => api.get('/news/drafts');
export const publishNews = (id) => api.patch(`/news/${id}/publish`);
export const deleteNews = (id) => api.delete(`/news/${id}`);
export const addComment = (id, text) => api.post(`/news/${id}/comments`, { text });
export const deleteComment = (newsId, commentId) => api.delete(`/news/${newsId}/comments/${commentId}`);
export const generateNews = (payload) => api.post('/news/generate', payload);
export const createEditorial = (payload) => api.post('/news/editorial', payload);
export const login = (payload) => api.post('/auth/login', payload);
export const register = (payload) => api.post('/auth/register', payload);
export const fetchProfile = () => api.get('/auth/me');
export const updateProfile = (payload) => api.put('/auth/me', payload);

export const updateNews = (id, payload) => api.patch(`/news/${id}`, payload);
export const getReactedNews = () => api.get('/news/my-reactions');
export const toggleReaction = (id, type) => api.post(`/news/${id}/react`, { type });

// Fact Check endpoints
export const checkHeadline = (headline) => api.post('/factcheck/check', { headline });
export const getStoryFactCheck = (newsId) => api.get(`/factcheck/story/${newsId}`);

// Author endpoints
export const createAuthor = (payload) => api.post('/authors', payload);
export const getAuthors = () => api.get('/authors');
export const getAuthorById = (id) => api.get(`/authors/${id}`);
export const updateAuthor = (id, payload) => api.patch(`/authors/${id}`, payload);

// Bolta Hai Bharat — manual trigger from admin dashboard
export const triggerBoltaHaiBharat = () =>
  api.post('/trending/bolta-hai-bharat-manual');


// Sentiment / Pulse Analyzer endpoints
export const getSentimentData = (articleId) => api.get(`/sentiment/data/${articleId}`);
export const getSentimentDashboardUrl = (slug) => `${API_BASE_URL}/api/sentiment/dashboard/${slug}`;

// E-paper endpoints
export const getEpaperList = () => api.get('/epaper');
export const getEpaperById = (id) => api.get(`/epaper/${id}`);
export const downloadEpaper = (id) => `${API_BASE_URL}/api/epaper/${id}/download`;
export const triggerEpaperGeneration = (editionDate = null, force = true, headerStoryId = null, politicsStoryIds = []) => {
  console.log('[ePaper] Trigger requested', { editionDate, force, headerStoryId, politicsStoryIds });
  return api.post('/epaper/trigger', { editionDate, force, headerStoryId, politicsStoryIds })
    .then((res) => {
      console.log('[ePaper] Trigger accepted', res.data);
      return res;
    })
    .catch((err) => {
      console.error('[ePaper] Trigger failed', err.response?.status, err.response?.data || err.message);
      throw err;
    });
};
