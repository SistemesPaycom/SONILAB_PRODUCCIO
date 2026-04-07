
import React from 'react';

export const Folder: React.FC<{ className?: string; size?: number }> = ({ className = 'w-6 h-6', size = 24 }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={className} width={size} height={size} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
  </svg>
);

export const Library: React.FC<{ className?: string; size?: number }> = ({ className = 'w-6 h-6', size = 24 }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={className} width={size} height={size} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M8 14v3m4-3v3m4-3v3M3 21h18M3 10h18M3 7l9-4 9 4M4 10h16v11H4V10z" />
  </svg>
);

export const Trash: React.FC<{ className?: string; size?: number }> = ({ className = 'w-6 h-6', size = 24 }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={className} width={size} height={size} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
  </svg>
);

export const FolderPlus: React.FC<{ className?: string; size?: number }> = ({ className = 'w-6 h-6', size = 24 }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z"></path><line x1="12" x2="12" y1="10" y2="16"></line><line x1="9" x2="15" y1="13" y2="13"></line>
  </svg>
);

export const Upload: React.FC<{ className?: string; size?: number }> = ({ className = 'w-6 h-6', size = 24 }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={className} width={size} height={size} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v6m3-3H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

export const Download: React.FC<{ className?: string; size?: number }> = ({ className = 'w-6 h-6', size = 24 }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={className} width={size} height={size} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
  </svg>
);

export const FilePdf: React.FC<{ className?: string; size?: number }> = ({ className = 'w-6 h-6', size = 24 }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={className} width={size} height={size} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M7 21h10a2 2 0 0 0 2-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 9h1M9 13h6m-6 4h6" />
  </svg>
);

export const Restore: React.FC<{ className?: string; size?: number }> = ({ className = 'w-6 h-6', size = 24 }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} width={size} height={size} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h10a8 8 0 018 8v2M3 10l5-5m-5 5l5 5" />
    </svg>
);

export const Bell: React.FC<{ className?: string; size?: number }> = ({ className = 'w-6 h-6', size = 24 }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={className} width={size} height={size} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
  </svg>
);

export const Languages: React.FC<{ className?: string; size?: number }> = ({ className = 'w-6 h-6', size = 24 }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={className} width={size} height={size} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 11.37 9.19 15.383 6 18.242M6.412 9a11.666 11.666 0 011.082-2.5m0 0H1.958" />
  </svg>
);

export const ChevronDown: React.FC<{ className?: string; size?: number }> = ({ className = 'w-4 h-4', size = 16 }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={className} width={size} height={size} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
  </svg>
);

export const ArrowLeft: React.FC<{ className?: string; size?: number }> = ({ className = 'w-6 h-6', size = 24 }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} width={size} height={size} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
    </svg>
);

export const Check: React.FC<{ className?: string; size?: number }> = ({ className = 'w-3 h-3', size = 12 }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} width={size} height={size} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
);

export const ScriptEditorIcon: React.FC<{ className?: string; size?: number }> = ({ className = 'w-6 h-6', size = 24 }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={className} width={size} height={size} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
  </svg>
);

export const ScriptReaderIcon: React.FC<{ className?: string; size?: number }> = ({ className = 'w-6 h-6', size = 24 }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={className} width={size} height={size} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
  </svg>
);

export const ScriptAdjustIcon: React.FC<{ className?: string; size?: number }> = ({ className = 'w-6 h-6', size = 24 }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={className} width={size} height={size} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8v2m0-2a2 2 0 100 4m0-4a2 2 0 110 4m12-4v2m0-2a2 2 0 100 4m0-4a2 2 0 110 4M6 12v-2m0 2a2 2 0 100 4m0-4a2 2 0 110 4m6-4v-2m0 2a2 2 0 100 4m0-4a2 2 0 110 4m6-4v-2m0 2a2 2 0 100 4m0-4a2 2 0 110 4" />
  </svg>
);

export const VideoEditorIcon: React.FC<{ className?: string; size?: number }> = ({ className = 'w-6 h-6', size = 24 }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={className} width={size} height={size} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M14 10.5v3l2.25-1.5L14 10.5z" />
  </svg>
);

export const SubtitlesIcon: React.FC<{ className?: string; size?: number }> = ({ className = 'w-6 h-6', size = 24 }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} width={size} height={size} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75h9" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 15.75H4.5a2.25 2.25 0 01-2.25-2.25V6.75A2.25 2.25 0 014.5 4.5h10.5a2.25 2.25 0 012.25 2.25v6.75a2.25 2.25 0 01-2.25 2.25z" />
    </svg>
  );

export const Settings: React.FC<{ className?: string; size?: number }> = ({ className = 'w-6 h-6', size = 24 }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} width={size} height={size} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
);

export const SearchIcon: React.FC<{ className?: string; size?: number }> = ({ className = 'w-6 h-6', size = 24 }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} width={size} height={size} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z"/></svg>
);
export const Close: React.FC<{ className?: string; size?: number }> = ({ className = 'w-6 h-6', size = 24 }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} width={size} height={size} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
);
export const Pencil: React.FC<{ className?: string; size?: number }> = ({ className = 'w-6 h-6', size = 24 }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} width={size} height={size} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="m18 2.1-13.3 13.3-2.1 6.4 6.4-2.1L22.3 6.3c.6-.6.6-1.5 0-2.1l-4.2-4.2c-.6-.6-1.5-.6-2.1 0Z"/><path strokeLinecap="round" strokeLinejoin="round" d="m14.5 6.5 6 6"/></svg>
);
export const Highlighter: React.FC<{ className?: string; size?: number }> = ({ className = 'w-6 h-6', size = 24 }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} width={size} height={size} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12.5 2.5a2.1 2.1 0 0 1 3 3L6 20l-4 1 1-4Z"/><path strokeLinecap="round" strokeLinejoin="round" d="m13.5 6.5 5 5"/><path strokeLinecap="round" strokeLinejoin="round" d="M22 14a4 4 0 1 1-8 0c0-2.2 1.8-4 4-4s4 1.8 4 4"/></svg>
);
export const TextHighlighter: React.FC<{ className?: string; size?: number }> = ({ className = 'w-6 h-6', size = 24 }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} width={size} height={size} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 5h9"/><path strokeLinecap="round" strokeLinejoin="round" d="M7 19h9"/><path strokeLinecap="round" strokeLinejoin="round" d="M21.3 16.7a2.4 2.4 0 0 0-3.4 0L7 17l-4 4 4-4 10.3-10.3a2.4 2.4 0 0 1 3.4 0Z"/></svg>
);
export const Type: React.FC<{ className?: string; size?: number }> = ({ className = 'w-6 h-6', size = 24 }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} width={size} height={size} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 7V4h16v3"/><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16"/><path strokeLinecap="round" strokeLinejoin="round" d="M8 20h8"/></svg>
);
export const Eraser: React.FC<{ className?: string; size?: number }> = ({ className = 'w-6 h-6', size = 24 }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} width={size} height={size} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21H7Z"/><path strokeLinecap="round" strokeLinejoin="round" d="M22 2 11 13"/></svg>
);
export const Plus: React.FC<{ className?: string; size?: number; }> = ({ className, size=24 }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M5 12h14"></path><path d="M12 5v14"></path></svg>
);
export const Minus: React.FC<{ className?: string; size?: number; }> = ({ className, size=24 }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M5 12h14"></path></svg>
);
export const Hash: React.FC<{ className?: string; size?: number }> = ({ className = 'w-6 h-6', size = 24 }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} width={size} height={size} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 9h16"/><path strokeLinecap="round" strokeLinejoin="round" d="M4 15h16"/><path strokeLinecap="round" strokeLinejoin="round" d="M10 3 8 21"/><path strokeLinecap="round" strokeLinejoin="round" d="m16 3-2 18"/></svg>
);
export const AlignLeft: React.FC<{ className?: string; size?: number }> = ({ className = 'w-6 h-6', size = 24 }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} width={size} height={size} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 6h18M3 12h12M3 18h18"/></svg>
);
export const AlignCenter: React.FC<{ className?: string; size?: number }> = ({ className = 'w-6 h-6', size = 24 }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} width={size} height={size} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 6h18M6 12h12M3 18h18"/></svg>
);
export const AlignRight: React.FC<{ className?: string; size?: number }> = ({ className = 'w-6 h-6', size = 24 }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} width={size} height={size} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 6h18M9 12h12M3 18h18"/></svg>
);
export const Bold: React.FC<{ className?: string; size?: number }> = ({ className = 'w-6 h-6', size = 24 }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} width={size} height={size} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 4h8a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"/><path strokeLinecap="round" strokeLinejoin="round" d="M6 12h9a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"/></svg>
);
export const Italic: React.FC<{ className?: string; size?: number }> = ({ className = 'w-6 h-6', size = 24 }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} width={size} height={size} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M7 20 17 4M7 4h10M7 20h10"/></svg>
);
export const Underline: React.FC<{ className?: string; size?: number }> = ({ className = 'w-6 h-6', size = 24 }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} width={size} height={size} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 4v7a6 6 0 0 0 12 0V4"/><path strokeLinecap="round" strokeLinejoin="round" d="M4 20h16"/></svg>
);

export const ArrowUp: React.FC<{ className?: string; size?: number }> = ({ className = 'w-6 h-6', size = 24 }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} width={size} height={size} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
    </svg>
);

export const ArrowDown: React.FC<{ className?: string; size?: number }> = ({ className = 'w-6 h-6', size = 24 }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} width={size} height={size} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
    </svg>
);

export const EyeIcon: React.FC<{ className?: string; size?: number }> = ({ className = 'w-6 h-6', size = 24 }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"></path>
        <circle cx="12" cy="12" r="3"></circle>
    </svg>
);

export const EyeOffIcon: React.FC<{ className?: string; size?: number }> = ({ className = 'w-6 h-6', size = 24 }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"></path>
        <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"></path>
        <path d="M6.61 6.61A13.52 13.52 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"></path>
        <line x1="2" x2="22" y1="2" y2="22"></line>
    </svg>
);

export const LockIcon: React.FC<{ className?: string; size?: number }> = ({ className = 'w-6 h-6', size = 24 }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <rect width="18" height="11" x="3" y="11" rx="2" ry="2"></rect>
        <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
    </svg>
);

export const UnlockIcon: React.FC<{ className?: string; size?: number }> = ({ className = 'w-6 h-6', size = 24 }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <rect width="18" height="11" x="3" y="11" rx="2" ry="2"></rect>
        <path d="M7 11V7a5 5 0 0 1 9.9-1"></path>
    </svg>
);

export const Trash2: React.FC<{ className?: string; size?: number }> = ({ className = 'w-6 h-6', size = 24 }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <path d="M3 6h18"></path>
        <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path>
        <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path>
        <line x1="10" x2="10" y1="11" y2="17"></line>
        <line x1="14" x2="14" y1="11" y2="17"></line>
    </svg>
);

export const Shield: React.FC<{ className?: string; size?: number }> = ({ className = 'w-6 h-6', size = 24 }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
    </svg>
);

export const TipexIcon: React.FC<{ className?: string; size?: number }> = ({ className = 'w-6 h-6', size = 24 }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} width={size} height={size} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M17 21v-8H7v8" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M7 3v5h8" />
    </svg>
);

export const WriteInTipexIcon: React.FC<{ className?: string; size?: number }> = ({ className = 'w-6 h-6', size = 24 }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} width={size} height={size} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
  </svg>
);

export const EarIcon: React.FC<{ className?: string; size?: number }> = ({ className = 'w-6 h-6', size = 24 }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M16 14.5a2.5 2.5 0 0 1-5 0C11 13 9 12 8 10c-1.1-2.22 0-5.18 2-6.5 2-1.32 4.9-.96 6.5 1 1.6 1.96 1.5 5-1 6.5-2.5 1.5-2.5 5.5 0 5.5"></path>
    <path d="M14.5 17.5c-2.32 1-4.5 1-4.5-1"></path>
  </svg>
);

export const Pin: React.FC<{ className?: string; size?: number }> = ({ className = 'w-6 h-6', size = 24 }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={className} width={size} height={size} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M16 12V4h1a1 1 0 100-2H7a1 1 0 100 2h1v8l-3 3v2h5.586l.707 4.707L12 22l.707-2.293L13.414 17H19v-2l-3-3z" />
  </svg>
);

export const Film: React.FC<{ className?: string; size?: number }> = ({ className = 'w-6 h-6', size = 24 }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={className} width={size} height={size} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v16a1 1 0 01-1 1H4a1 1 0 01-1-1V4zm0 4h18M3 12h18M3 16h18M7 4v16M17 4v16" />
  </svg>
);
