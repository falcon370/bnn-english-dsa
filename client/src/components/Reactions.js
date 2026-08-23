'use client';

import { useState } from 'react';
import useAuth from '@/hooks/useAuth';
import { toggleReaction } from '@/lib/api';

const EMOJIS = {
  like: '👍',
  love: '❤️',
  haha: '😂',
  wow: '😲',
  sad: '😢',
  angry: '😡'
};

const Reactions = ({ storyId, initialReactions = [] }) => {
  const { user } = useAuth();
  const [reactions, setReactions] = useState(initialReactions);
  const [busy, setBusy] = useState(false);

  const counts = reactions.reduce((acc, r) => {
    acc[r.type] = (acc[r.type] || 0) + 1;
    return acc;
  }, {});

  const myReaction = user ? reactions.find(r => r.user === user.id || r.user?._id === user.id)?.type : null;

  const handleToggle = async (type) => {
    if (!user) {
      alert('Please login to react to stories.');
      return;
    }
    if (busy) return;
    
    setBusy(true);
    try {
      const { data } = await toggleReaction(storyId, type);
      setReactions(data.reactions);
    } catch (err) {
      console.error('Failed to react:', err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-wrap gap-4 items-center py-6 border-y border-blue-50 my-8">
      <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 w-full mb-2">
        How do you feel about this story?
      </p>
      <div className="flex flex-wrap gap-2">
        {Object.entries(EMOJIS).map(([type, emoji]) => {
          const count = counts[type] || 0;
          const isActive = myReaction === type;

          return (
            <button
              key={type}
              onClick={() => handleToggle(type)}
              disabled={busy}
              className={`flex items-center gap-2 px-4 py-2 rounded-full border transition-all ${
                isActive 
                  ? 'bg-blue-50 border-[#1A56C4] text-[#1A56C4] scale-105 shadow-sm' 
                  : 'bg-white border-blue-100 hover:border-blue-300 text-gray-400 hover:bg-blue-50/50'
              }`}
            >
              <span className="text-xl">{emoji}</span>
              {count > 0 && <span className="text-xs font-black">{count}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default Reactions;
