import React, { useState, useRef, useEffect } from 'react';
import {
  Image as ImageIcon,
  Upload,
  FolderOpen,
  Sparkles,
  Link as LinkIcon,
  X,
  Check,
  Trash2,
  ExternalLink,
  Shield,
  Swords,
  Gem,
  Package,
  User,
  RefreshCw,
  Search,
} from 'lucide-react';
import {
  GLYPH_DEFINITIONS,
  GENERIC_PORTRAITS,
  GlyphStyle,
  getGlyphUrl,
} from '../../data/glyphs';

export interface ImageFileBrowserProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  targetType: 'profile' | 'portrait' | 'item';
  itemName?: string;
  currentImageUrl?: string;
  onSelectImage: (imageUrl: string) => void;
  characterExistingImages?: string[];
  glyphStyle?: GlyphStyle;
}

const STORAGE_LIBRARY_KEY = 'pf1e_image_library_v1';

export const ImageFileBrowserModal: React.FC<ImageFileBrowserProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  targetType,
  itemName,
  currentImageUrl = '',
  onSelectImage,
  characterExistingImages = [],
  glyphStyle = '01-flat-enamel',
}) => {
  // Navigation tabs: 'upload' | 'presets' | 'library' | 'url'
  const [activeTab, setActiveTab] = useState<'upload' | 'presets' | 'library' | 'url'>('presets');

  // Selected image candidate
  const [selectedUrl, setSelectedUrl] = useState<string>(currentImageUrl);
  const [urlInput, setUrlInput] = useState<string>(currentImageUrl);

  // Local preset subcategory filter
  const [presetCategory, setPresetCategory] = useState<'all' | 'portraits' | 'glyphs'>(
    targetType === 'item' ? 'glyphs' : 'all'
  );

  // Search filter
  const [searchQuery, setSearchQuery] = useState('');

  // Drag-and-drop state
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // File metadata for uploaded preview
  const [uploadedFileMeta, setUploadedFileMeta] = useState<{
    name: string;
    sizeKb: number;
    dimensions?: string;
  } | null>(null);

  // Stored image library
  const [library, setLibrary] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_LIBRARY_KEY);
      if (saved) return JSON.parse(saved);
    } catch {
      // Fallback
    }
    return [];
  });

  // Sync selectedUrl when modal opens with new currentImageUrl
  useEffect(() => {
    if (isOpen) {
      setSelectedUrl(currentImageUrl || '');
      setUrlInput(currentImageUrl || '');
    }
  }, [isOpen, currentImageUrl]);

  // Combine library with characterExistingImages
  const allLibraryImages = Array.from(
    new Set([
      ...library,
      ...characterExistingImages.filter((img) => img && img.trim().length > 0),
    ])
  );

  const saveToLibrary = (dataUrl: string) => {
    if (!dataUrl || dataUrl.trim().length === 0) return;
    setLibrary((prev) => {
      const next = [dataUrl, ...prev.filter((item) => item !== dataUrl)].slice(0, 30);
      try {
        localStorage.setItem(STORAGE_LIBRARY_KEY, JSON.stringify(next));
      } catch {
        // storage quota
      }
      return next;
    });
  };

  const removeFromLibrary = (urlToRemove: string) => {
    setLibrary((prev) => {
      const next = prev.filter((item) => item !== urlToRemove);
      try {
        localStorage.setItem(STORAGE_LIBRARY_KEY, JSON.stringify(next));
      } catch {
        // storage quota
      }
      return next;
    });
  };

  // Handle file reading from input or drag-and-drop
  const handleFileProcess = (file: File) => {
    if (!file.type.startsWith('image/')) {
      alert('Please select a valid image file (PNG, JPG, WEBP, GIF, SVG).');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      if (result) {
        setSelectedUrl(result);
        setUrlInput('');

        // Measure dimensions
        const img = new Image();
        img.onload = () => {
          setUploadedFileMeta({
            name: file.name,
            sizeKb: Math.round(file.size / 1024),
            dimensions: `${img.naturalWidth} × ${img.naturalHeight}px`,
          });
        };
        img.src = result;

        // Auto save to workspace library
        saveToLibrary(result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFileProcess(file);
  };

  const handleApply = () => {
    onSelectImage(selectedUrl);
    if (selectedUrl) saveToLibrary(selectedUrl);
    onClose();
  };

  const handleClear = () => {
    setSelectedUrl('');
    setUrlInput('');
    onSelectImage('');
    onClose();
  };

  if (!isOpen) return null;

  // Flattened preset list based on active filter (7 Interchangeable Glyphs + 4 Generic Portraits)
  const getFilteredPresets = () => {
    const activeSet = glyphStyle === 'none' ? '01-flat-enamel' : glyphStyle;
    const glyphPresets = GLYPH_DEFINITIONS.map((g) => ({
      id: g.id,
      name: g.name,
      category: `Glyph (${g.category})`,
      url: getGlyphUrl(g.id, activeSet, '01-flat-enamel') || `/character-sheet-icons/01-flat-enamel/${g.filename}`,
    }));

    let list: Array<{ id: string; name: string; category: string; url: string }> = [];

    if (presetCategory === 'all') {
      list = [...glyphPresets, ...GENERIC_PORTRAITS];
    } else if (presetCategory === 'portraits') {
      list = [...GENERIC_PORTRAITS];
    } else if (presetCategory === 'glyphs') {
      list = [...glyphPresets];
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (item) => item.name.toLowerCase().includes(q) || item.category.toLowerCase().includes(q)
      );
    }

    return list;
  };

  const presetsToDisplay = getFilteredPresets();

  const modalHeaderTitle =
    title ||
    (targetType === 'profile'
      ? 'Character Profile Picture Browser'
      : targetType === 'portrait'
      ? 'Character Portrait Browser'
      : `Item Image Browser: ${itemName || 'Gear'}`);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md select-none animate-in fade-in duration-150">
      <div className="w-full max-w-3xl bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        {/* Top Header */}
        <div className="px-6 py-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400">
              {targetType === 'item' ? (
                <Package className="w-5 h-5" />
              ) : (
                <User className="w-5 h-5" />
              )}
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100 font-serif flex items-center gap-2">
                <span>{modalHeaderTitle}</span>
              </h2>
              <p className="text-xs text-slate-400">
                {subtitle ||
                  (targetType === 'item'
                    ? 'Upload local image files, choose from fantasy item icons, or paste a link.'
                    : 'Upload your character portrait from your computer, choose from fantasy presets, or link an image.')}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="px-6 pt-3 pb-2 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-1.5 bg-slate-900 p-1 rounded-xl border border-slate-800 text-xs">
            <button
              onClick={() => setActiveTab('upload')}
              className={`px-3 py-1.5 rounded-lg font-medium flex items-center gap-1.5 transition-colors ${
                activeTab === 'upload'
                  ? 'bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/30 shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Browse Local File</span>
            </button>
            <button
              onClick={() => setActiveTab('presets')}
              className={`px-3 py-1.5 rounded-lg font-medium flex items-center gap-1.5 transition-colors ${
                activeTab === 'presets'
                  ? 'bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30 shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Preset Gallery</span>
            </button>
            <button
              onClick={() => setActiveTab('library')}
              className={`px-3 py-1.5 rounded-lg font-medium flex items-center gap-1.5 transition-colors ${
                activeTab === 'library'
                  ? 'bg-purple-500/20 text-purple-300 font-bold border border-purple-500/30 shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <FolderOpen className="w-3.5 h-3.5" />
              <span>Workspace Library ({allLibraryImages.length})</span>
            </button>
            <button
              onClick={() => setActiveTab('url')}
              className={`px-3 py-1.5 rounded-lg font-medium flex items-center gap-1.5 transition-colors ${
                activeTab === 'url'
                  ? 'bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30 shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <LinkIcon className="w-3.5 h-3.5" />
              <span>Direct URL</span>
            </button>
          </div>

          {/* Quick Active Preview Pill */}
          {selectedUrl && (
            <div className="flex items-center gap-2 text-xs font-mono text-slate-300">
              <span className="opacity-60 hidden sm:inline">Active Choice:</span>
              <div className="w-6 h-6 rounded-md overflow-hidden border border-cyan-500/50 bg-black/60 shrink-0">
                <img src={selectedUrl} alt="Selected" className="w-full h-full object-cover" />
              </div>
            </div>
          )}
        </div>

        {/* Tab Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* TAB 1: BROWSE LOCAL FILES (UPLOAD) */}
          {activeTab === 'upload' && (
            <div className="space-y-4">
              {/* Drag and Drop Zone */}
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-all ${
                  isDragging
                    ? 'border-cyan-400 bg-cyan-950/40 scale-[0.99]'
                    : 'border-slate-700 bg-slate-950/50 hover:border-cyan-500/60 hover:bg-slate-950/80'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleFileProcess(f);
                  }}
                  className="hidden"
                />

                <div className="w-14 h-14 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 mb-3 group-hover:scale-110 transition-transform">
                  <Upload className="w-7 h-7" />
                </div>

                <h3 className="font-bold text-slate-200 text-sm mb-1">
                  Click to browse or drag &amp; drop an image here
                </h3>
                <p className="text-xs text-slate-400 max-w-sm">
                  PNG, JPG, WebP, GIF, or SVG from your local disk. Stored safely inside your sheet and workspace.
                </p>

                <div className="mt-4 px-3 py-1 rounded-full bg-slate-900 border border-slate-700 text-slate-300 text-xs font-mono">
                  Browse My Computer
                </div>
              </div>

              {/* Uploaded File Details / Active Preview */}
              {selectedUrl && (
                <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center gap-4">
                  <div
                    className={`rounded-xl overflow-hidden border border-cyan-500/40 bg-black/60 shrink-0 ${
                      targetType === 'profile'
                        ? 'w-20 h-20 rounded-full'
                        : 'w-20 h-20 rounded-xl'
                    }`}
                  >
                    <img
                      src={selectedUrl}
                      alt="Preview"
                      className="w-full h-full object-cover"
                    />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-bold text-xs text-cyan-300 truncate font-mono">
                        {uploadedFileMeta?.name || 'Selected Image Source'}
                      </span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-400 border border-cyan-800 font-mono">
                        Ready to Apply
                      </span>
                    </div>

                    <div className="text-[11px] text-slate-400 space-y-0.5 font-mono">
                      {uploadedFileMeta?.dimensions && (
                        <div>Dimensions: {uploadedFileMeta.dimensions}</div>
                      )}
                      {uploadedFileMeta?.sizeKb && (
                        <div>File Size: {uploadedFileMeta.sizeKb} KB</div>
                      )}
                      <div className="text-slate-500 text-[10px] truncate max-w-md">
                        {selectedUrl.startsWith('data:') ? 'Stored as Data URL' : selectedUrl}
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      setSelectedUrl('');
                      setUploadedFileMeta(null);
                    }}
                    className="p-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-rose-400 border border-slate-800 transition-colors"
                    title="Remove preview"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: PRESET FANTASY GALLERY */}
          {activeTab === 'presets' && (
            <div className="space-y-4">
              {/* Category selector & Search bar */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                <div className="flex items-center gap-1 overflow-x-auto pb-1 text-xs">
                  {[
                    { id: 'all', label: 'All (Glyphs & Portraits)' },
                    { id: 'glyphs', label: '7 Action/Item Glyphs' },
                    { id: 'portraits', label: '4 Generic Portraits' },
                  ].map((cat) => (
                    <button
                      key={cat.id}
                      onClick={() => setPresetCategory(cat.id as any)}
                      className={`px-2.5 py-1 rounded-lg whitespace-nowrap transition-colors ${
                        presetCategory === cat.id
                          ? 'bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30'
                          : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
                      }`}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>

                <div className="relative shrink-0 sm:w-48">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search presets..."
                    className="w-full pl-8 pr-3 py-1 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500/60"
                  />
                </div>
              </div>

              {/* Grid of Presets */}
              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-3">
                {presetsToDisplay.map((item) => {
                  const isSelected = selectedUrl === item.url;
                  return (
                    <div
                      key={item.id}
                      onClick={() => {
                        setSelectedUrl(item.url);
                        setUrlInput(item.url);
                      }}
                      className={`group relative rounded-xl overflow-hidden border p-1.5 cursor-pointer transition-all ${
                        isSelected
                          ? 'border-amber-400 bg-amber-500/10 ring-2 ring-amber-400/40 shadow-lg scale-102'
                          : 'border-slate-800 bg-slate-950/60 hover:border-slate-700 hover:bg-slate-950'
                      }`}
                    >
                      <div className="w-full aspect-square rounded-lg overflow-hidden bg-black/60 relative">
                        <img
                          src={item.url}
                          alt={item.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                          loading="lazy"
                        />
                        {isSelected && (
                          <div className="absolute top-1 right-1 w-5 h-5 rounded-full bg-amber-500 text-slate-950 flex items-center justify-center shadow-md">
                            <Check className="w-3.5 h-3.5 stroke-[3]" />
                          </div>
                        )}
                      </div>

                      <div className="pt-1.5 px-0.5">
                        <div className="font-semibold text-xs text-slate-200 truncate group-hover:text-amber-300">
                          {item.name}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono flex items-center justify-between">
                          <span>{item.category}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {presetsToDisplay.length === 0 && (
                <div className="py-8 text-center text-xs text-slate-500">
                  No presets found matching "{searchQuery}".
                </div>
              )}
            </div>
          )}

          {/* TAB 3: WORKSPACE LIBRARY & RECENTS */}
          {activeTab === 'library' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>
                  Showing all images previously uploaded or linked in this character sheet:
                </span>
                {allLibraryImages.length > 0 && (
                  <span className="font-mono text-cyan-400">
                    {allLibraryImages.length} image{allLibraryImages.length > 1 ? 's' : ''} stored
                  </span>
                )}
              </div>

              {allLibraryImages.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-3">
                  {allLibraryImages.map((imgUrl, idx) => {
                    const isSelected = selectedUrl === imgUrl;
                    return (
                      <div
                        key={idx}
                        className={`group relative rounded-xl overflow-hidden border p-1.5 transition-all ${
                          isSelected
                            ? 'border-purple-400 bg-purple-500/10 ring-2 ring-purple-400/40 shadow-lg scale-102'
                            : 'border-slate-800 bg-slate-950/60 hover:border-slate-700 hover:bg-slate-950'
                        }`}
                      >
                        <div
                          onClick={() => {
                            setSelectedUrl(imgUrl);
                            setUrlInput(imgUrl);
                          }}
                          className="w-full aspect-square rounded-lg overflow-hidden bg-black/60 relative cursor-pointer"
                        >
                          <img
                            src={imgUrl}
                            alt={`Library item ${idx}`}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                          />
                          {isSelected && (
                            <div className="absolute top-1 right-1 w-5 h-5 rounded-full bg-purple-500 text-white flex items-center justify-center shadow-md">
                              <Check className="w-3.5 h-3.5 stroke-[3]" />
                            </div>
                          )}
                        </div>

                        <div className="pt-1.5 flex items-center justify-between gap-1 text-[10px] font-mono text-slate-400">
                          <span className="truncate">
                            {imgUrl.startsWith('data:') ? 'Custom Upload' : 'Web Asset'}
                          </span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              removeFromLibrary(imgUrl);
                            }}
                            className="p-1 rounded text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                            title="Remove from recents"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="border border-dashed border-slate-800 rounded-2xl p-8 text-center space-y-2">
                  <FolderOpen className="w-8 h-8 text-slate-600 mx-auto" />
                  <div className="text-xs text-slate-400">
                    No images saved in your workspace library yet.
                  </div>
                  <button
                    onClick={() => setActiveTab('upload')}
                    className="text-xs text-cyan-400 hover:underline font-mono"
                  >
                    Upload an image from your computer &rarr;
                  </button>
                </div>
              )}
            </div>
          )}

          {/* TAB 4: DIRECT URL */}
          {activeTab === 'url' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-mono font-semibold text-slate-300 mb-1.5">
                  Paste Direct Web Image URL:
                </label>
                <div className="flex gap-2">
                  <input
                    type="url"
                    value={urlInput}
                    onChange={(e) => {
                      setUrlInput(e.target.value);
                      setSelectedUrl(e.target.value);
                    }}
                    placeholder="https://example.com/character-portrait.png"
                    className="flex-1 px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                  />
                  <button
                    onClick={() => {
                      if (urlInput.trim()) {
                        setSelectedUrl(urlInput.trim());
                        saveToLibrary(urlInput.trim());
                      }
                    }}
                    className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-300 text-xs font-mono font-semibold transition-colors shrink-0"
                  >
                    Test &amp; Preview
                  </button>
                </div>
              </div>

              {selectedUrl && (
                <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center gap-4">
                  <div className="w-24 h-24 rounded-xl overflow-hidden border border-emerald-500/40 bg-black/60 shrink-0">
                    <img
                      src={selectedUrl}
                      alt="URL Preview"
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src =
                          'https://images.unsplash.com/photo-1590736969955-71cc94801759?auto=format&fit=crop&w=200&q=80';
                      }}
                    />
                  </div>
                  <div className="flex-1 min-w-0 text-xs space-y-1">
                    <div className="font-bold text-emerald-400 font-mono">
                      Image URL Loaded Successfully
                    </div>
                    <div className="text-slate-400 text-[11px] font-mono break-all line-clamp-2">
                      {selectedUrl}
                    </div>
                    <div className="text-[10px] text-slate-500">
                      Click "Apply Image" below to save this to your sheet.
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Bottom Action Bar */}
        <div className="px-6 py-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between shrink-0">
          <div>
            {currentImageUrl && (
              <button
                onClick={handleClear}
                className="px-3 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 text-xs font-medium flex items-center gap-1.5 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Remove Current Picture</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleApply}
              disabled={!selectedUrl}
              className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-40 disabled:hover:bg-amber-500 text-slate-950 text-xs font-bold font-mono flex items-center gap-1.5 shadow-lg transition-all"
            >
              <Check className="w-4 h-4 stroke-[2.5]" />
              <span>Apply Image</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
