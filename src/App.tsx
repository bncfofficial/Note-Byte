import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { 
  Plus, 
  Search, 
  Trash2, 
  Pin, 
  PinOff, 
  Palette, 
  Check, 
  X, 
  Moon, 
  Sun, 
  Edit3, 
  Clock,
  Bell,
  BellOff,
  AlertCircle,
  Filter,
  RotateCcw,
  RotateCw,
  ChevronDown,
  Calendar,
  Layers,
  FileStack,
  Save,
  Tag,
  Image as ImageIcon,
  Copy,
  ClipboardPaste,
  CheckCircle2,
  Loader2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface Note {
  id: string;
  title: string;
  content: string;
  color: string;
  isPinned: boolean;
  createdAt: number;
  updatedAt: number;
  reminderAt?: number;
  reminderNotified?: boolean;
  tags: string[];
}

interface Template {
  id: string;
  name: string;
  title: string;
  content: string;
  color: string;
  isPinned: boolean;
  tags: string[];
}

interface Toast {
  id: string;
  message: string;
  type: 'info' | 'success' | 'warning';
}

const COLORS = [
  { name: 'Default', value: 'bg-white dark:bg-slate-900' },
  { name: 'Blue', value: 'bg-blue-500 text-white' },
  { name: 'Red', value: 'bg-red-500 text-white' },
  { name: 'Orange', value: 'bg-orange-500 text-white' },
  { name: 'Yellow', value: 'bg-yellow-500 text-black' },
  { name: 'Green', value: 'bg-green-500 text-white' },
  { name: 'Purple', value: 'bg-purple-500 text-white' },
  { name: 'Pink', value: 'bg-pink-500 text-white' },
];

export default function App() {
  const [notes, setNotes] = useState<Note[]>(() => {
    const saved = localStorage.getItem('notebyte-notes');
    return saved ? JSON.parse(saved) : [];
  });
  const [templates, setTemplates] = useState<Template[]>(() => {
    const saved = localStorage.getItem('notebyte-templates');
    return saved ? JSON.parse(saved) : [];
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem('notebyte-theme');
    return saved === 'dark' || (!saved && window.matchMedia('(prefers-color-scheme: dark)').matches);
  });
  
  const [view, setView] = useState<'grid' | 'editor'>('grid');
  const [showWelcome, setShowWelcome] = useState(true);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const [noteToDelete, setNoteToDelete] = useState<string | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);

  // Editor State
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [newColor, setNewColor] = useState(COLORS[0].value);
  const [newIsPinned, setNewIsPinned] = useState(false);
  const [newReminderAt, setNewReminderAt] = useState<string>('');
  const [newTags, setNewTags] = useState<string[]>([]);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [tagInput, setTagInput] = useState('');

  // Undo/Redo State
  const [history, setHistory] = useState<{title: string, content: string}[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [isSavingTemplate, setIsSavingTemplate] = useState(false);
  const isInternalUpdate = useRef(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowWelcome(false);
    }, 2500);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    localStorage.setItem('notebyte-notes', JSON.stringify(notes));
  }, [notes]);

  useEffect(() => {
    localStorage.setItem('notebyte-templates', JSON.stringify(templates));
  }, [templates]);

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('notebyte-theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('notebyte-theme', 'light');
    }
  }, [isDarkMode]);

  // Undo/Redo Logic
  useEffect(() => {
    if (view === 'editor') {
      if (isInternalUpdate.current) {
        isInternalUpdate.current = false;
        return;
      }

      const timer = setTimeout(() => {
        const current = { title: newTitle, content: newContent };
        const last = history[historyIndex];
        
        if (!last || last.title !== current.title || last.content !== current.content) {
          const newHistory = history.slice(0, historyIndex + 1);
          newHistory.push(current);
          // Limit history size
          if (newHistory.length > 50) newHistory.shift();
          setHistory(newHistory);
          setHistoryIndex(newHistory.length - 1);
        }
      }, 500);

      return () => clearTimeout(timer);
    }
  }, [newTitle, newContent, view]);

  // Autosave Logic
  useEffect(() => {
    if (view === 'editor') {
      const timer = setTimeout(() => {
        if (!newTitle.trim() && !newContent.trim()) return;
        
        setSaveStatus('saving');
        const now = Date.now();
        const reminderTimestamp = newReminderAt ? new Date(newReminderAt).getTime() : undefined;

        setNotes(prev => {
          if (editingNote) {
            return prev.map(n => 
              n.id === editingNote.id 
                ? { 
                    ...n, 
                    title: newTitle, 
                    content: newContent, 
                    color: newColor, 
                    isPinned: newIsPinned, 
                    updatedAt: now,
                    reminderAt: reminderTimestamp,
                    tags: newTags
                  }
                : n
            );
          } else {
            // If it's a new note, we don't necessarily want to create it in the list yet
            // unless we want full real-time autosave for new drafts too.
            // For now, let's just mark as saved in the UI.
            return prev;
          }
        });

        setTimeout(() => setSaveStatus('saved'), 500);
        setTimeout(() => setSaveStatus('idle'), 3000);
      }, 2000);

      return () => clearTimeout(timer);
    }
  }, [newTitle, newContent, newColor, newIsPinned, newReminderAt, newTags, view, editingNote]);

  const undo = () => {
    if (historyIndex > 0) {
      isInternalUpdate.current = true;
      const prev = history[historyIndex - 1];
      setNewTitle(prev.title);
      setNewContent(prev.content);
      setHistoryIndex(historyIndex - 1);
    }
  };

  const redo = () => {
    if (historyIndex < history.length - 1) {
      isInternalUpdate.current = true;
      const next = history[historyIndex + 1];
      setNewTitle(next.title);
      setNewContent(next.content);
      setHistoryIndex(historyIndex + 1);
    }
  };

  const addToast = useCallback((message: string, type: Toast['type'] = 'info') => {
    const id = crypto.randomUUID();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 5000);
  }, []);

  // Reminder checker
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setNotes(prevNotes => {
        let changed = false;
        const updatedNotes = prevNotes.map(note => {
          if (note.reminderAt && !note.reminderNotified && note.reminderAt <= now) {
            addToast(`Reminder: ${note.title || 'Untitled Note'}`, 'warning');
            changed = true;
            return { ...note, reminderNotified: true };
          }
          return note;
        });
        return changed ? updatedNotes : prevNotes;
      });
    }, 10000);

    return () => clearInterval(interval);
  }, [addToast]);

  const filteredNotes = useMemo(() => {
    const query = searchQuery.toLowerCase();
    const filtered = notes.filter(
      note => 
        note.title.toLowerCase().includes(query) || 
        note.content.toLowerCase().includes(query) ||
        (note.tags && note.tags.some(tag => tag.toLowerCase().includes(query)))
    );

    return filtered.sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      return b.updatedAt - a.updatedAt;
    });
  }, [notes, searchQuery]);

  const handleSaveNote = () => {
    if (!newTitle.trim() && !newContent.trim()) {
      setView('grid');
      return;
    }

    const now = Date.now();
    const reminderTimestamp = newReminderAt ? new Date(newReminderAt).getTime() : undefined;

    if (editingNote) {
      setNotes(prev => prev.map(n => 
        n.id === editingNote.id 
          ? { 
              ...n, 
              title: newTitle, 
              content: newContent, 
              color: newColor, 
              isPinned: newIsPinned, 
              updatedAt: now,
              reminderAt: reminderTimestamp,
              reminderNotified: reminderTimestamp && reminderTimestamp > now ? false : n.reminderNotified,
              tags: newTags
            }
          : n
      ));
      addToast('Note updated successfully', 'success');
    } else {
      const newNote: Note = {
        id: crypto.randomUUID(),
        title: newTitle,
        content: newContent,
        color: newColor,
        isPinned: newIsPinned,
        createdAt: now,
        updatedAt: now,
        reminderAt: reminderTimestamp,
        reminderNotified: false,
        tags: newTags
      };
      setNotes(prev => [newNote, ...prev]);
      addToast('New note created!', 'success');
    }
    setView('grid');
    setEditingNote(null);
  };

  const handleSaveTemplate = () => {
    if (!templateName.trim()) {
      addToast('Please enter a template name', 'warning');
      return;
    }

    const newTemplate: Template = {
      id: crypto.randomUUID(),
      name: templateName,
      title: newTitle,
      content: newContent,
      color: newColor,
      isPinned: newIsPinned,
      tags: newTags
    };

    setTemplates(prev => [newTemplate, ...prev]);
    setIsSavingTemplate(false);
    setTemplateName('');
    addToast('Template saved successfully', 'success');
  };

  const applyTemplate = (template: Template) => {
    isInternalUpdate.current = true;
    setNewTitle(template.title);
    setNewContent(template.content);
    setNewColor(template.color);
    setNewIsPinned(template.isPinned);
    setNewTags(template.tags || []);
    setHistory([{ title: template.title, content: template.content }]);
    setHistoryIndex(0);
    setIsTemplateModalOpen(false);
    addToast(`Template "${template.name}" applied`, 'info');
  };

  const deleteTemplate = (id: string) => {
    setTemplates(prev => prev.filter(t => t.id !== id));
    addToast('Template deleted', 'info');
  };

  const openEditor = (note?: Note) => {
    if (note) {
      setEditingNote(note);
      setNewTitle(note.title);
      setNewContent(note.content);
      setNewColor(note.color);
      setNewIsPinned(note.isPinned);
      setNewReminderAt(note.reminderAt ? new Date(note.reminderAt).toISOString().slice(0, 16) : '');
      setNewTags(note.tags || []);
      setHistory([{ title: note.title, content: note.content }]);
      setHistoryIndex(0);
    } else {
      setEditingNote(null);
      setNewTitle('');
      setNewContent('');
      setNewColor(COLORS[0].value);
      setNewIsPinned(false);
      setNewReminderAt('');
      setNewTags([]);
      setHistory([{ title: '', content: '' }]);
      setHistoryIndex(0);
    }
    setView('editor');
    setSaveStatus('idle');
  };

  const deleteNote = (id: string) => {
    setNotes(prev => prev.filter(n => n.id !== id));
    setNoteToDelete(null);
    addToast('Note deleted', 'info');
  };

  const togglePin = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setNotes(prev => prev.map(n => 
      n.id === id ? { ...n, isPinned: !n.isPinned, updatedAt: Date.now() } : n
    ));
  };

  const formatDate = (timestamp: number) => {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(new Date(timestamp));
  };

  return (
    <div className="min-h-screen transition-colors duration-300 bg-slate-50 dark:bg-black font-sans selection:bg-brand-100 selection:text-brand-700">
      {/* Welcome Screen */}
      <AnimatePresence>
        {showWelcome && (
          <motion.div
            initial={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 1.1, filter: 'blur(20px)' }}
            transition={{ duration: 0.8, ease: [0.4, 0, 0.2, 1] }}
            className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-white dark:bg-black"
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.2, duration: 0.5 }}
              className="flex flex-col items-center gap-6"
            >
              <div className="w-24 h-24 bg-brand-500 rounded-[32px] flex items-center justify-center shadow-2xl shadow-brand-500/30">
                <Edit3 className="text-white w-12 h-12" />
              </div>
              <div className="text-center">
                <h1 className="text-4xl font-black tracking-tighter text-slate-900 dark:text-white mb-2">
                  Note<span className="text-brand-500">Byte</span>
                </h1>
                <p className="text-slate-400 font-medium tracking-wide uppercase text-[10px]">Your thoughts, organized.</p>
              </div>
            </motion.div>
            
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.5 }}
              className="absolute bottom-12 flex items-center gap-2"
            >
              <div className="w-1.5 h-1.5 bg-brand-500 rounded-full animate-bounce" />
              <div className="w-1.5 h-1.5 bg-brand-500 rounded-full animate-bounce [animation-delay:0.2s]" />
              <div className="w-1.5 h-1.5 bg-brand-500 rounded-full animate-bounce [animation-delay:0.4s]" />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Toast Notifications */}
      <div className="fixed top-24 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
        <AnimatePresence>
          {toasts.map(toast => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, x: 50, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 20, scale: 0.9 }}
              className={`pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-2xl shadow-2xl border ${
                toast.type === 'success' ? 'bg-emerald-500 text-white border-emerald-400' :
                toast.type === 'warning' ? 'bg-amber-500 text-white border-amber-400' :
                'bg-slate-900 text-white border-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:border-slate-200'
              }`}
            >
              {toast.type === 'warning' ? <Bell className="w-5 h-5 animate-bounce" /> : <Check className="w-5 h-5" />}
              <span className="font-semibold text-sm">{toast.message}</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <AnimatePresence mode="wait">
        {view === 'grid' ? (
          <motion.div
            key="grid"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col min-h-screen"
          >
            {/* Header */}
            <header className="sticky top-0 z-30 bg-white/80 dark:bg-black/80 backdrop-blur-2xl border-b border-slate-200 dark:border-slate-800/50 px-4 py-4 md:px-8">
              <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
                    Note<span className="text-brand-500">Byte</span>
                  </h1>
                </div>

                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => setIsSearchOpen(!isSearchOpen)}
                    className={`p-2.5 rounded-2xl transition-all ${isSearchOpen ? 'bg-brand-500 text-white shadow-lg shadow-brand-500/30' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'}`}
                  >
                    <Search className="w-5 h-5" />
                  </button>
                  <button 
                    onClick={() => setIsDarkMode(!isDarkMode)}
                    className="p-2.5 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                    aria-label="Toggle theme"
                  >
                    {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              {/* Animated Search Bar */}
              <AnimatePresence>
                {isSearchOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="max-w-7xl mx-auto pt-4 pb-2">
                      <div className="relative group">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-brand-500 transition-colors" />
                        <input 
                          type="text"
                          placeholder="Search your thoughts..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="w-full bg-slate-100 dark:bg-slate-800 border-none rounded-2xl py-3.5 pl-12 pr-4 focus:ring-2 focus:ring-brand-500/50 transition-all text-slate-900 dark:text-slate-100 font-medium"
                          autoFocus
                        />
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Animated Search Bar */}
            </header>

            <main className="max-w-7xl mx-auto px-4 py-8 md:px-8 flex-1 w-full">
              {/* Notes Grid */}
              {filteredNotes.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 auto-rows-min">
                  <AnimatePresence mode="popLayout">
                    {filteredNotes.map((note) => (
                      <motion.div
                        key={note.id}
                        layout
                        initial={{ opacity: 0, y: 20, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
                        whileHover={{ y: -4, transition: { duration: 0.2 } }}
                        onClick={() => openEditor(note)}
                        className={`group relative p-6 rounded-[32px] border border-slate-200 dark:border-slate-800/50 shadow-sm hover:shadow-xl transition-all cursor-pointer flex flex-col min-h-[240px] ${note.color} ${note.color !== 'bg-white dark:bg-slate-900' ? 'text-white' : ''}`}
                      >
                        <div className="flex justify-between items-start mb-4">
                          <h3 className={`font-bold text-lg line-clamp-2 leading-tight ${note.color === 'bg-white dark:bg-slate-900' ? 'text-slate-900 dark:text-slate-100' : 'text-white'}`}>
                            {note.title || "Untitled Note"}
                          </h3>
                          <div className="flex items-center gap-1">
                            {note.reminderAt && (
                              <div className={`p-1.5 rounded-xl ${note.reminderNotified ? 'text-slate-400' : 'text-amber-500 bg-amber-100/50 dark:bg-amber-900/40'}`}>
                                <Bell className={`w-4 h-4 ${!note.reminderNotified && 'animate-pulse'}`} />
                              </div>
                            )}
                            <button 
                              onClick={(e) => togglePin(e, note.id)}
                              className={`p-1.5 rounded-xl transition-colors ${note.isPinned ? 'text-brand-600 bg-brand-100/50 dark:bg-brand-900/40' : 'text-slate-400 hover:bg-slate-200/50 dark:hover:bg-slate-800/50'}`}
                            >
                              {note.isPinned ? <Pin className="w-4 h-4 fill-current" /> : <PinOff className="w-4 h-4" />}
                            </button>
                          </div>
                        </div>

                        {note.tags && note.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1 mb-3">
                            {note.tags.map(tag => (
                              <span key={tag} className={`px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-wider ${note.color === 'bg-white dark:bg-slate-900' ? 'bg-slate-100 dark:bg-slate-800 text-slate-500' : 'bg-white/20 text-white'}`}>
                                #{tag}
                              </span>
                            ))}
                          </div>
                        )}
                        
                        <p className={`text-sm line-clamp-6 flex-1 whitespace-pre-wrap leading-relaxed ${note.color === 'bg-white dark:bg-slate-900' ? 'text-slate-600 dark:text-slate-400' : 'text-white/80'}`}>
                          {note.content || "No content..."}
                        </p>

                        <div className={`mt-6 pt-4 border-t flex items-center justify-between ${note.color === 'bg-white dark:bg-slate-900' ? 'border-slate-900/5 dark:border-white/5' : 'border-white/20'}`}>
                          <div className="flex flex-col gap-1">
                            <div className={`flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest ${note.color === 'bg-white dark:bg-slate-900' ? 'text-slate-400' : 'text-white/60'}`}>
                              <Clock className="w-3 h-3" />
                              {formatDate(note.updatedAt)}
                            </div>
                            {note.reminderAt && (
                              <div className={`flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest ${note.reminderNotified ? 'text-slate-400' : (note.color === 'bg-white dark:bg-slate-900' ? 'text-amber-600 dark:text-amber-400' : 'text-white')}`}>
                                <Bell className="w-3 h-3" />
                                {formatDate(note.reminderAt)}
                              </div>
                            )}
                          </div>
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              setNoteToDelete(note.id);
                            }}
                            className={`p-2 rounded-xl transition-all opacity-0 group-hover:opacity-100 ${note.color === 'bg-white dark:bg-slate-900' ? 'text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20' : 'text-white/60 hover:text-white hover:bg-white/20'}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-24 text-center">
                  <div className="w-24 h-24 bg-slate-100 dark:bg-slate-900 rounded-[40px] flex items-center justify-center mb-6">
                    <Layers className="w-12 h-12 text-slate-300 dark:text-slate-700" />
                  </div>
                  <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
                    {searchQuery ? "No matching notes" : "Your space is empty"}
                  </h3>
                  <p className="text-slate-500 dark:text-slate-400 max-w-xs mx-auto">
                    {searchQuery 
                      ? "Try adjusting your search query to find what you're looking for." 
                      : "Start capturing your ideas and organizing your life with NoteByte."}
                  </p>
                  {searchQuery ? (
                    <button 
                      onClick={() => setSearchQuery('')}
                      className="mt-8 text-brand-600 font-bold hover:underline"
                    >
                      Clear search
                    </button>
                  ) : (
                    <button 
                      onClick={() => openEditor()}
                      className="mt-8 bg-brand-500 hover:bg-brand-600 text-white px-8 py-4 rounded-2xl font-bold shadow-xl shadow-brand-500/30 transition-all active:scale-95"
                    >
                      Create First Note
                    </button>
                  )}
                </div>
              )}
            </main>

            {/* Bottom Floating Plus Button */}
            <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-40">
              <motion.button 
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => openEditor()}
                className="flex items-center justify-center w-16 h-16 bg-brand-500 text-white rounded-full shadow-2xl shadow-brand-500/40 transition-all"
              >
                <Plus className="w-8 h-8" />
              </motion.button>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="editor"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={`fixed inset-0 z-50 flex flex-col transition-colors duration-500 ${newColor}`}
          >
            {/* Editor Header */}
            <header className="px-2 sm:px-6 py-3 sm:py-4 border-b border-black/5 dark:border-white/5 flex items-center justify-between backdrop-blur-xl sticky top-0 z-10">
              <div className="flex items-center gap-1 sm:gap-2">
                <button 
                  onClick={() => setView('grid')}
                  className="p-1.5 sm:p-2 rounded-2xl hover:bg-black/5 dark:hover:bg-white/5 text-slate-600 dark:text-slate-300 transition-all"
                >
                  <X className="w-5 h-5 sm:w-6 sm:h-6" />
                </button>

                <div className="flex items-center gap-0.5 sm:gap-2 bg-black/5 dark:bg-white/5 p-0.5 sm:p-1 rounded-2xl">
                  <button 
                    onClick={undo}
                    disabled={historyIndex <= 0}
                    className="p-1.5 sm:p-2 rounded-xl disabled:opacity-30 hover:bg-black/5 dark:hover:bg-white/5 text-slate-600 dark:text-slate-300 transition-all"
                    title="Undo (Ctrl+Z)"
                  >
                    <RotateCcw className="w-4 h-4 sm:w-5 sm:h-5" />
                  </button>
                  <button 
                    onClick={redo}
                    disabled={historyIndex >= history.length - 1}
                    className="p-1.5 sm:p-2 rounded-xl disabled:opacity-30 hover:bg-black/5 dark:hover:bg-white/5 text-slate-600 dark:text-slate-300 transition-all"
                    title="Redo (Ctrl+Y)"
                  >
                    <RotateCw className="w-4 h-4 sm:w-5 sm:h-5" />
                  </button>

                  <div className="h-6 sm:h-8 w-px bg-black/10 dark:bg-white/10 mx-0.5 sm:mx-1" />

                  <button 
                    onClick={() => setIsTemplateModalOpen(true)}
                    className="p-1.5 sm:p-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 text-slate-600 dark:text-slate-300 transition-all flex items-center gap-1 sm:gap-2"
                    title="Use Template"
                  >
                    <FileStack className="w-4 h-4 sm:w-5 sm:h-5" />
                    <span className="hidden lg:inline text-xs sm:text-sm font-bold">Templates</span>
                  </button>
                </div>

                <div className="flex items-center gap-1 sm:gap-2 ml-1 sm:ml-4">
                  {saveStatus === 'saving' && (
                    <div className="flex items-center gap-1 text-[8px] sm:text-[10px] font-black uppercase tracking-widest text-slate-500 animate-pulse">
                      <Loader2 className="w-2.5 h-2.5 sm:w-3 sm:h-3 animate-spin" />
                      <span className="hidden xs:inline">Saving...</span>
                    </div>
                  )}
                  {saveStatus === 'saved' && (
                    <div className="flex items-center gap-1 text-[8px] sm:text-[10px] font-black uppercase tracking-widest text-emerald-500">
                      <CheckCircle2 className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                      <span className="hidden xs:inline">Saved</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-1 sm:gap-3">
                <div className="hidden md:flex items-center gap-2 bg-black/5 dark:bg-white/5 px-4 py-2 rounded-2xl">
                  <Calendar className="w-4 h-4 text-slate-400" />
                  <input 
                    type="datetime-local"
                    value={newReminderAt}
                    onChange={(e) => setNewReminderAt(e.target.value)}
                    className="bg-transparent border-none p-0 text-sm font-bold focus:ring-0 text-slate-700 dark:text-slate-200 cursor-pointer"
                  />
                  {newReminderAt && (
                    <button 
                      onClick={() => setNewReminderAt('')}
                      className="p-1 hover:bg-red-500 hover:text-white rounded-full transition-colors text-slate-400"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>

                <button 
                  onClick={() => setNewIsPinned(!newIsPinned)}
                  className={`p-1.5 sm:p-2.5 rounded-2xl transition-all ${newIsPinned ? 'bg-brand-500 text-white shadow-lg shadow-brand-500/30' : 'bg-black/5 dark:bg-white/5 text-slate-400 hover:text-slate-600'}`}
                >
                  {newIsPinned ? <Pin className="w-4 h-4 sm:w-5 sm:h-5 fill-current" /> : <PinOff className="w-4 h-4 sm:w-5 sm:h-5" />}
                </button>

                <button 
                  onClick={handleSaveNote}
                  className="bg-brand-500 hover:bg-brand-600 text-white px-3 sm:px-6 py-2 sm:py-2.5 rounded-2xl font-bold shadow-lg shadow-brand-500/30 transition-all active:scale-95 flex items-center gap-1 sm:gap-2"
                >
                  <Check className="w-4 h-4 sm:w-5 sm:h-5" />
                  <span className="hidden sm:inline">Done</span>
                </button>
              </div>
            </header>

            {/* Editor Content */}
            <div className="flex-1 overflow-y-auto p-6 md:p-16 max-w-4xl mx-auto w-full space-y-8">
              <div className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  {newTags.map(tag => (
                    <span key={tag} className="flex items-center gap-1 px-3 py-1 bg-black/5 dark:bg-white/5 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300">
                      #{tag}
                      <button onClick={() => setNewTags(prev => prev.filter(t => t !== tag))}>
                        <X className="w-3 h-3 hover:text-red-500" />
                      </button>
                    </span>
                  ))}
                  <div className="relative flex items-center">
                    <Tag className="absolute left-3 w-3.5 h-3.5 text-slate-400" />
                    <input 
                      type="text"
                      placeholder="Add tag..."
                      value={tagInput}
                      onChange={(e) => setTagInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && tagInput.trim()) {
                          if (!newTags.includes(tagInput.trim())) {
                            setNewTags(prev => [...prev, tagInput.trim()]);
                          }
                          setTagInput('');
                        }
                      }}
                      className="bg-black/5 dark:bg-white/5 border-none rounded-xl py-1 pl-9 pr-3 text-xs font-bold focus:ring-1 focus:ring-brand-500/50 w-32"
                    />
                  </div>
                </div>

                <input 
                  type="text"
                  placeholder="Note Title"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full bg-transparent border-none p-0 text-4xl md:text-6xl font-black focus:ring-0 placeholder:text-slate-300 dark:placeholder:text-slate-700 text-slate-900 dark:text-slate-100 tracking-tight"
                  autoFocus
                />
              </div>
              
              <div className="flex items-center gap-2 mb-4">
                <button 
                  onClick={() => {
                    const fullText = `${newTitle}\n\n${newContent}`;
                    navigator.clipboard.writeText(fullText);
                    addToast('Note copied to clipboard', 'success');
                  }}
                  className="p-2.5 bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 rounded-xl text-slate-600 dark:text-slate-300 transition-all flex items-center gap-2"
                  title="Copy Note"
                >
                  <Copy className="w-4 h-4" />
                  <span className="text-[10px] font-black uppercase tracking-widest">Copy</span>
                </button>
                <button 
                  onClick={async () => {
                    try {
                      const text = await navigator.clipboard.readText();
                      setNewContent(prev => prev + (prev ? '\n' : '') + text);
                      addToast('Content pasted', 'info');
                    } catch (err) {
                      addToast('Use Ctrl+V to paste', 'warning');
                    }
                  }}
                  className="p-2.5 bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 rounded-xl text-slate-600 dark:text-slate-300 transition-all flex items-center gap-2"
                  title="Paste from clipboard"
                >
                  <ClipboardPaste className="w-4 h-4" />
                  <span className="text-[10px] font-black uppercase tracking-widest">Paste</span>
                </button>
              </div>

              <textarea 
                placeholder="Write your thoughts here..."
                value={newContent}
                onChange={(e) => setNewContent(e.target.value)}
                className="w-full bg-transparent border-none p-0 text-xl md:text-2xl focus:ring-0 placeholder:text-slate-300 dark:placeholder:text-slate-700 text-slate-700 dark:text-slate-300 min-h-[50vh] resize-none leading-relaxed font-medium"
              />
            </div>

          </motion.div>
        )}
      </AnimatePresence>

      {/* Template Selection Modal */}
      <AnimatePresence>
        {isTemplateModalOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsTemplateModalOpen(false)}
              className="absolute inset-0 bg-slate-950/80 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative bg-white dark:bg-slate-900 w-full max-w-2xl rounded-[40px] p-8 shadow-2xl flex flex-col max-h-[80vh]"
            >
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h3 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">Templates</h3>
                  <p className="text-slate-500 dark:text-slate-400">Select a template to apply to your note</p>
                </div>
                <button 
                  onClick={() => setIsTemplateModalOpen(false)}
                  className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
                >
                  <X className="w-6 h-6 text-slate-400" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto pr-2 space-y-4">
                {templates.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {templates.map((template) => (
                      <div 
                        key={template.id}
                        className={`group relative p-5 rounded-3xl border border-slate-200 dark:border-slate-800/50 hover:shadow-lg transition-all cursor-pointer ${template.color}`}
                        onClick={() => applyTemplate(template)}
                      >
                        <div className="flex justify-between items-start mb-2">
                          <h4 className="font-bold text-slate-900 dark:text-white line-clamp-1">{template.name}</h4>
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteTemplate(template.id);
                            }}
                            className="p-1.5 text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 italic">
                          {template.title || "No title"} • {template.content.slice(0, 30)}...
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <FileStack className="w-16 h-16 text-slate-200 dark:text-slate-800 mb-4" />
                    <p className="text-slate-500 dark:text-slate-400">No templates saved yet.</p>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Save Template Modal */}
      <AnimatePresence>
        {isSavingTemplate && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSavingTemplate(false)}
              className="absolute inset-0 bg-slate-950/80 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative bg-white dark:bg-slate-900 w-full max-w-md rounded-[40px] p-10 shadow-2xl"
            >
              <h3 className="text-3xl font-black text-slate-900 dark:text-white mb-2 tracking-tight">Save Template</h3>
              <p className="text-slate-500 dark:text-slate-400 mb-8 leading-relaxed">
                Give your template a name to recognize it later.
              </p>
              
              <input 
                type="text"
                placeholder="Template Name (e.g., Meeting Notes)"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                className="w-full bg-slate-100 dark:bg-slate-800 border-none rounded-2xl py-4 px-6 mb-8 focus:ring-2 focus:ring-brand-500/50 transition-all text-slate-900 dark:text-slate-100 font-bold"
                autoFocus
              />

              <div className="flex gap-4">
                <button 
                  onClick={() => setIsSavingTemplate(false)}
                  className="flex-1 px-6 py-4 rounded-2xl font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleSaveTemplate}
                  className="flex-1 px-6 py-4 rounded-2xl font-bold bg-brand-500 hover:bg-brand-600 text-white shadow-xl shadow-brand-500/30 transition-all active:scale-95"
                >
                  Save
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {noteToDelete && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setNoteToDelete(null)}
              className="absolute inset-0 bg-slate-950/80 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative bg-white dark:bg-slate-900 w-full max-w-md rounded-[40px] p-10 shadow-2xl text-center"
            >
              <div className="w-24 h-24 bg-red-50 dark:bg-red-900/20 rounded-[40px] flex items-center justify-center mx-auto mb-8">
                <Trash2 className="w-12 h-12 text-red-500" />
              </div>
              <h3 className="text-3xl font-black text-slate-900 dark:text-white mb-3 tracking-tight">Delete Note?</h3>
              <p className="text-slate-500 dark:text-slate-400 mb-10 leading-relaxed">
                This action is permanent and cannot be reversed. Are you sure you want to delete this note?
              </p>
              <div className="flex gap-4">
                <button 
                  onClick={() => setNoteToDelete(null)}
                  className="flex-1 px-6 py-4 rounded-2xl font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
                >
                  Cancel
                </button>
                <button 
                  onClick={() => deleteNote(noteToDelete)}
                  className="flex-1 px-6 py-4 rounded-2xl font-bold bg-red-500 hover:bg-red-600 text-white shadow-xl shadow-red-500/30 transition-all active:scale-95"
                >
                  Delete
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
