'use client';

import React, { useRef, useEffect, useState, useCallback } from 'react';

/* ---------- COLOUR PALETTES ---------- */

const TEXT_COLORS = [
  { label: 'Default',    value: '#000000' },
  { label: 'Dark Blue',  value: '#1A56C4' },
  { label: 'Red',        value: '#dc2626' },
  { label: 'Orange',     value: '#ea580c' },
  { label: 'Amber',      value: '#d97706' },
  { label: 'Green',      value: '#16a34a' },
  { label: 'Teal',       value: '#0d9488' },
  { label: 'Purple',     value: '#7c3aed' },
  { label: 'Pink',       value: '#db2777' },
  { label: 'Gray',       value: '#6b7280' },
  { label: 'White',      value: '#ffffff' },
];

const HIGHLIGHT_COLORS = [
  { label: 'None',        value: 'transparent' },
  { label: 'Yellow',      value: '#fef08a' },
  { label: 'Lime',        value: '#bbf7d0' },
  { label: 'Sky',         value: '#bae6fd' },
  { label: 'Pink',        value: '#fbcfe8' },
  { label: 'Orange',      value: '#fed7aa' },
  { label: 'Purple',      value: '#e9d5ff' },
  { label: 'Light Gray',  value: '#f3f4f6' },
];

/* ---------- COLOR PICKER DROPDOWN ---------- */

const ColorPicker = ({ colors, onSelect, activeColor, icon, title }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={ref} className="relative" title={title}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="p-2 hover:bg-gray-200 rounded transition-colors flex flex-col items-center gap-0.5"
        title={title}
      >
        <span className="text-xs font-bold leading-none">{icon}</span>
        {/* Color indicator bar under the icon */}
        <span
          className="block w-4 h-1 rounded-full border border-gray-300"
          style={{
            backgroundColor:
              activeColor === 'transparent' ? 'transparent' : activeColor,
          }}
        />
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 z-50 bg-white border border-gray-200 rounded-lg shadow-xl p-2 flex flex-wrap gap-1.5 w-44">
          {colors.map((c) => (
            <button
              key={c.value}
              type="button"
              title={c.label}
              onClick={() => {
                onSelect(c.value);
                setOpen(false);
              }}
              className="w-6 h-6 rounded border border-gray-300 hover:scale-110 transition-transform"
              style={{
                backgroundColor:
                  c.value === 'transparent' ? 'white' : c.value,
                backgroundImage:
                  c.value === 'transparent'
                    ? 'repeating-linear-gradient(45deg, #ccc 0, #ccc 2px, white 0, white 6px)'
                    : 'none',
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
};

/* ---------- MAIN EDITOR ---------- */

const RichTextEditor = ({ value, onChange, placeholder }) => {
  const editorRef = useRef(null);
  const [isMounted, setIsMounted] = useState(false);
  const [activeTextColor, setActiveTextColor] = useState('#000000');
  const [activeHighlight, setActiveHighlight] = useState('transparent');

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Sync value to innerHTML when value changes or component first mounts
  useEffect(() => {
    if (editorRef.current && value !== editorRef.current.innerHTML) {
      editorRef.current.innerHTML = value || '';
    }
  }, [value, isMounted]);

  const handleInput = () => {
    if (editorRef.current) {
      const content = editorRef.current.innerHTML;
      if (content !== value) {
        onChange(content);
      }
    }
  };

  const execCommand = (command, val = null) => {
    editorRef.current?.focus();
    document.execCommand(command, false, val);
    handleInput();
  };

  const applyTextColor = useCallback((color) => {
    setActiveTextColor(color);
    editorRef.current?.focus();
    document.execCommand('foreColor', false, color);
    handleInput();
  }, []); // eslint-disable-line

  const applyHighlight = useCallback((color) => {
    setActiveHighlight(color);
    editorRef.current?.focus();
    if (color === 'transparent') {
      document.execCommand('hiliteColor', false, 'transparent');
    } else {
      document.execCommand('hiliteColor', false, color);
    }
    handleInput();
  }, []); // eslint-disable-line

  if (!isMounted) {
    return (
      <div className="min-h-[300px] border border-gray-200 rounded-md bg-gray-50 animate-pulse" />
    );
  }

  return (
    <div className="border border-gray-200 rounded-md overflow-visible flex flex-col bg-white">
      {/* Toolbar */}
      <div className="bg-gray-50 border-b border-gray-200 p-2 flex flex-wrap gap-1 sticky top-0 z-10">

        {/* Bold / Italic / Underline */}
        <button
          type="button"
          onClick={() => execCommand('bold')}
          className="p-2 hover:bg-gray-200 rounded transition-colors"
          title="Bold"
        >
          <span className="font-bold text-sm">B</span>
        </button>
        <button
          type="button"
          onClick={() => execCommand('italic')}
          className="p-2 hover:bg-gray-200 rounded transition-colors"
          title="Italic"
        >
          <span className="italic text-sm">I</span>
        </button>
        <button
          type="button"
          onClick={() => execCommand('underline')}
          className="p-2 hover:bg-gray-200 rounded transition-colors"
          title="Underline"
        >
          <span className="underline text-sm">U</span>
        </button>
        <button
          type="button"
          onClick={() => execCommand('strikeThrough')}
          className="p-2 hover:bg-gray-200 rounded transition-colors"
          title="Strikethrough"
        >
          <span className="line-through text-sm">S</span>
        </button>

        <div className="w-[1px] h-6 bg-gray-300 mx-1 self-center" />

        {/* ── TEXT COLOR ── */}
        <ColorPicker
          colors={TEXT_COLORS}
          onSelect={applyTextColor}
          activeColor={activeTextColor}
          icon="A"
          title="Text Color"
        />

        {/* ── HIGHLIGHT COLOR ── */}
        <ColorPicker
          colors={HIGHLIGHT_COLORS}
          onSelect={applyHighlight}
          activeColor={activeHighlight}
          icon={
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M15.5 2.1L18.4 5 6.7 16.7l-4 1 1-4L15.5 2.1zm0 0" />
              <rect x="3" y="20" width="18" height="2" rx="1" />
            </svg>
          }
          title="Highlight Color"
        />

        <div className="w-[1px] h-6 bg-gray-300 mx-1 self-center" />

        {/* Font Size */}
        <select
          onChange={(e) => execCommand('fontSize', e.target.value)}
          className="bg-white border border-gray-300 text-xs rounded px-2 py-1 outline-none hover:border-gray-400 transition-colors"
          defaultValue="3"
          title="Font Size"
        >
          <option value="1">Small</option>
          <option value="3">Normal</option>
          <option value="5">Large</option>
          <option value="7">Huge</option>
        </select>

        {/* Font Family */}
        <select
          onChange={(e) => execCommand('fontName', e.target.value)}
          className="bg-white border border-gray-300 text-xs rounded px-2 py-1 outline-none hover:border-gray-400 transition-colors"
          defaultValue="Arial"
          title="Font Family"
        >
          <option value="Arial">Sans Serif</option>
          <option value="Georgia">Serif</option>
          <option value="Courier New">Monospace</option>
        </select>

        <div className="w-[1px] h-6 bg-gray-300 mx-1 self-center" />

        {/* Alignment */}
        <button
          type="button"
          onClick={() => execCommand('justifyLeft')}
          className="p-2 hover:bg-gray-200 rounded transition-colors"
          title="Align Left"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h10M4 18h16" />
          </svg>
        </button>
        <button
          type="button"
          onClick={() => execCommand('justifyCenter')}
          className="p-2 hover:bg-gray-200 rounded transition-colors"
          title="Align Center"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M7 12h10M4 18h16" />
          </svg>
        </button>
        <button
          type="button"
          onClick={() => execCommand('justifyRight')}
          className="p-2 hover:bg-gray-200 rounded transition-colors"
          title="Align Right"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M10 12h10M4 18h16" />
          </svg>
        </button>

        <div className="w-[1px] h-6 bg-gray-300 mx-1 self-center" />

        {/* Lists */}
        <button
          type="button"
          onClick={() => execCommand('insertUnorderedList')}
          className="p-2 hover:bg-gray-200 rounded transition-colors"
          title="Bullet List"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16M4 6h.01M4 12h.01M4 18h.01" />
          </svg>
        </button>
        <button
          type="button"
          onClick={() => execCommand('insertOrderedList')}
          className="p-2 hover:bg-gray-200 rounded transition-colors"
          title="Numbered List"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 6h13M7 12h13M7 18h13M3 6h.01M3 12h.01M3 18h.01" />
          </svg>
        </button>

        <div className="w-[1px] h-6 bg-gray-300 mx-1 self-center" />

        {/* Insert Image */}
        <button
          type="button"
          onClick={() => {
            const url = window.prompt('Enter image URL:');
            if (url) {
              execCommand('insertImage', url);
            }
          }}
          className="p-2 hover:bg-gray-200 rounded transition-colors"
          title="Insert Image"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </button>

        {/* Clear Formatting */}
        <button
          type="button"
          onClick={() => {
            execCommand('removeFormat');
            setActiveTextColor('#000000');
            setActiveHighlight('transparent');
          }}
          className="p-2 hover:bg-gray-200 rounded transition-colors"
          title="Clear Formatting"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Editor Area */}
      <div
        ref={editorRef}
        contentEditable
        onInput={handleInput}
        onBlur={handleInput}
        className="p-4 min-h-[300px] outline-none prose prose-sm max-w-none focus:ring-0"
        style={{ fontFamily: 'inherit' }}
        placeholder={placeholder}
      />

      <style jsx>{`
        [contenteditable]:empty:before {
          content: attr(placeholder);
          color: #9ca3af;
          pointer-events: none;
          display: block;
        }
      `}</style>
    </div>
  );
};

export default RichTextEditor;
