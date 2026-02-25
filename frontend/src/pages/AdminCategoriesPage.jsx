// src/pages/AdminCategoriesPage.jsx
import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  fetchAdminCategories, createCategory, updateCategory,
  deleteCategory, signCategoryImageUpload,
} from '../api/admin';
import { AdminTopBar } from './AdminProductsPage';

function slugify(name) {
  return name.toLowerCase().replace(/[^a-z0-9\s-]/g, '').trim().replace(/\s+/g, '-');
}

const inputCls = "px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition";

// ── Shared image upload field ─────────────────────────────────
// Shows file picker + progress, or URL text input, with a toggle.
function ImageField({ imageUrl, setImageUrl, label = 'Image' }) {
  const [mode, setMode] = useState(imageUrl ? 'url' : 'file');
  const [file, setFile] = useState(null);
  const [progress, setProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const fileRef = useRef(null);

  async function handleFileChange(e) {
    const f = e.target.files[0];
    if (!f) return;
    setFile(f);
    setUploadError(null);
    setProgress(0);
    setUploading(true);

    try {
      const { signedUrl, publicUrl } = await signCategoryImageUpload({
        filename: f.name,
        contentType: f.type,
      });

      await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('PUT', signedUrl);
        xhr.setRequestHeader('Content-Type', f.type);
        xhr.upload.onprogress = (ev) => {
          if (ev.lengthComputable) setProgress(Math.round((ev.loaded / ev.total) * 100));
        };
        xhr.onload = () => (xhr.status === 200 ? resolve() : reject(new Error(`Upload failed: ${xhr.status}`)));
        xhr.onerror = () => reject(new Error('Upload network error'));
        xhr.send(f);
      });

      setImageUrl(publicUrl);
      setProgress(100);
    } catch (err) {
      setUploadError(err.message);
      setFile(null);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
          {label} <span className="normal-case font-normal text-slate-400">(optional)</span>
        </label>
        <div className="flex gap-1 bg-slate-100 p-0.5 rounded-lg">
          {['file', 'url'].map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => { setMode(m); setFile(null); setProgress(0); setUploadError(null); }}
              className={`px-2.5 py-0.5 rounded-md text-xs font-semibold transition-colors ${
                mode === m ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {m === 'file' ? 'Upload' : 'URL'}
            </button>
          ))}
        </div>
      </div>

      {mode === 'file' ? (
        <div>
          <div
            onClick={() => !uploading && fileRef.current?.click()}
            className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl border-2 border-dashed text-sm cursor-pointer transition-colors ${
              uploading
                ? 'border-indigo-200 bg-indigo-50 cursor-not-allowed'
                : 'border-slate-200 hover:border-indigo-300 hover:bg-slate-50'
            }`}
          >
            {uploading ? (
              <>
                <div className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin flex-shrink-0" />
                <span className="text-slate-600">Uploading… {progress}%</span>
              </>
            ) : imageUrl && !file ? (
              <>
                <img src={imageUrl} alt="" className="w-8 h-8 rounded-lg object-cover flex-shrink-0" />
                <span className="text-slate-500 truncate text-xs">Image uploaded — click to replace</span>
              </>
            ) : file ? (
              <>
                <svg className="w-4 h-4 text-green-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-slate-600 text-xs truncate">{file.name}</span>
              </>
            ) : (
              <>
                <svg className="w-4 h-4 text-slate-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                    d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
                <span className="text-slate-400">Click to upload PNG, JPG, WebP</span>
              </>
            )}
          </div>
          {progress > 0 && progress < 100 && (
            <div className="mt-1 h-1 bg-slate-100 rounded-full overflow-hidden">
              <div className="h-full bg-indigo-500 transition-all" style={{ width: `${progress}%` }} />
            </div>
          )}
          {uploadError && <p className="text-xs text-red-600 mt-1">{uploadError}</p>}
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            onChange={handleFileChange}
            className="hidden"
          />
        </div>
      ) : (
        <input
          value={imageUrl}
          onChange={(e) => setImageUrl(e.target.value)}
          placeholder="https://…"
          className={inputCls}
        />
      )}
    </div>
  );
}

// ── Inline edit row ───────────────────────────────────────────
function EditRow({ cat, onSave, onCancel }) {
  const [name, setName] = useState(cat.name);
  const [slug, setSlug] = useState(cat.slug);
  const [imageUrl, setImageUrl] = useState(cat.image_url || '');
  const [sortOrder, setSortOrder] = useState(String(cat.sort_order));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const updated = await updateCategory(cat.id, {
        name: name.trim(),
        slug: slug.trim(),
        image_url: imageUrl.trim() || null,
        sort_order: parseInt(sortOrder) || 0,
      });
      onSave(updated);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <tr className="bg-indigo-50 align-top">
      <td className="px-4 py-3">
        <input
          value={name}
          onChange={(e) => { setName(e.target.value); setSlug(slugify(e.target.value)); }}
          className={`${inputCls} w-full`}
          placeholder="Category name"
          required
        />
      </td>
      <td className="px-4 py-3">
        <input
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
          className={`${inputCls} w-full font-mono text-xs`}
          placeholder="category-slug"
        />
      </td>
      <td className="px-4 py-3">
        <input
          type="number"
          value={sortOrder}
          onChange={(e) => setSortOrder(e.target.value)}
          className={`${inputCls} w-20`}
          min={0}
        />
      </td>
      <td className="px-4 py-3" colSpan={2}>
        <ImageField imageUrl={imageUrl} setImageUrl={setImageUrl} label="Image" />
        {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
      </td>
      <td className="px-4 py-3">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <button
            type="submit"
            disabled={saving || !name.trim()}
            className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white text-xs font-semibold rounded-lg transition-colors"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="px-3 py-1.5 bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-semibold rounded-lg transition-colors"
          >
            Cancel
          </button>
        </form>
      </td>
    </tr>
  );
}

// ── Page ──────────────────────────────────────────────────────
export default function AdminCategoriesPage() {
  const navigate = useNavigate();
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // new category form
  const [newName, setNewName] = useState('');
  const [newSlug, setNewSlug] = useState('');
  const [newImageUrl, setNewImageUrl] = useState('');
  const [newSortOrder, setNewSortOrder] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState(null);

  // editing / deleting
  const [editingId, setEditingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const handleLogout = () => {
    sessionStorage.removeItem('admin_token');
    navigate('/admin', { replace: true });
  };

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchAdminCategories();
      setCategories(data);
    } catch (err) {
      if (err.status === 401) { sessionStorage.removeItem('admin_token'); navigate('/admin', { replace: true }); }
      else setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    if (!sessionStorage.getItem('admin_token')) { navigate('/admin', { replace: true }); return; }
    load();
  }, [load, navigate]);

  async function handleCreate(e) {
    e.preventDefault();
    if (!newName.trim()) return;
    setCreating(true);
    setCreateError(null);
    try {
      const cat = await createCategory({
        name: newName.trim(),
        slug: newSlug.trim() || slugify(newName),
        image_url: newImageUrl.trim() || null,
        sort_order: parseInt(newSortOrder) || 0,
      });
      setCategories((prev) => [...prev, cat].sort((a, b) => a.sort_order - b.sort_order));
      setNewName('');
      setNewSlug('');
      setNewImageUrl('');
      setNewSortOrder('');
    } catch (err) {
      setCreateError(err.message);
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(id) {
    setDeleting(true);
    try {
      await deleteCategory(id);
      setCategories((prev) => prev.filter((c) => c.id !== id));
      setDeletingId(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setDeleting(false);
    }
  }

  function handleEditSave(updated) {
    setCategories((prev) =>
      prev.map((c) => (c.id === updated.id ? updated : c))
        .sort((a, b) => a.sort_order - b.sort_order)
    );
    setEditingId(null);
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <AdminTopBar onLogout={handleLogout} />

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-10 space-y-8">
        <h1 className="text-2xl font-bold text-slate-900">Categories</h1>

        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">{error}</div>
        )}

        {/* ── Category table ── */}
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left">
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Name</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Slug</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Order</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide" colSpan={2}>Image</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  [...Array(4)].map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      {[...Array(6)].map((__, j) => (
                        <td key={j} className="px-4 py-3">
                          <div className="h-4 bg-slate-100 rounded" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : categories.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-slate-400 text-sm">
                      No categories yet. Add one below.
                    </td>
                  </tr>
                ) : (
                  categories.map((cat) =>
                    editingId === cat.id ? (
                      <EditRow
                        key={cat.id}
                        cat={cat}
                        onSave={handleEditSave}
                        onCancel={() => setEditingId(null)}
                      />
                    ) : (
                      <tr key={cat.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3 font-medium text-slate-800">{cat.name}</td>
                        <td className="px-4 py-3 font-mono text-xs text-slate-500">{cat.slug}</td>
                        <td className="px-4 py-3 text-slate-500">{cat.sort_order}</td>
                        <td className="px-4 py-3">
                          {cat.image_url ? (
                            <img
                              src={cat.image_url}
                              alt={cat.name}
                              className="w-10 h-10 rounded-lg object-cover border border-slate-100"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center">
                              <svg className="w-4 h-4 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              </svg>
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 max-w-[160px]">
                          <span className="text-xs text-slate-400 truncate block">
                            {cat.image_url || <span className="italic">No image</span>}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {deletingId === cat.id ? (
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-red-600 font-medium">Delete?</span>
                              <button
                                onClick={() => handleDelete(cat.id)}
                                disabled={deleting}
                                className="px-2.5 py-1 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-lg transition-colors"
                              >
                                {deleting ? '…' : 'Yes'}
                              </button>
                              <button
                                onClick={() => setDeletingId(null)}
                                className="px-2.5 py-1 bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-semibold rounded-lg transition-colors"
                              >
                                No
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => setEditingId(cat.id)}
                                className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-colors"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => setDeletingId(cat.id)}
                                className="px-2.5 py-1 bg-red-50 hover:bg-red-100 text-red-600 text-xs font-semibold rounded-lg transition-colors"
                              >
                                Delete
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    )
                  )
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── Add new category ── */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <h2 className="text-base font-bold text-slate-900 mb-4">Add category</h2>
          <form onSubmit={handleCreate} className="flex flex-col gap-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Name *</label>
                <input
                  value={newName}
                  onChange={(e) => { setNewName(e.target.value); setNewSlug(slugify(e.target.value)); }}
                  placeholder="e.g. Hoodies"
                  required
                  className={inputCls}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Slug</label>
                <input
                  value={newSlug}
                  onChange={(e) => setNewSlug(e.target.value)}
                  placeholder="hoodies"
                  className={`${inputCls} font-mono text-xs`}
                />
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <ImageField imageUrl={newImageUrl} setImageUrl={setNewImageUrl} label="Category image" />
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Sort order</label>
                <input
                  type="number"
                  value={newSortOrder}
                  onChange={(e) => setNewSortOrder(e.target.value)}
                  placeholder="0"
                  min={0}
                  className={`${inputCls} w-28`}
                />
              </div>
            </div>

            {createError && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{createError}</p>
            )}
            <div>
              <button
                type="submit"
                disabled={creating || !newName.trim()}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white font-semibold rounded-xl text-sm transition-colors"
              >
                {creating ? 'Adding…' : 'Add category'}
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}
