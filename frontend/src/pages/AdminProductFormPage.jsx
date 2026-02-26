// src/pages/AdminProductFormPage.jsx
// Used for both /admin/products/new and /admin/products/:id
import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  fetchAdminProduct, createProduct, updateProduct,
  bulkCreateVariants, deleteVariant, updateVariantStock,
  addProductImage, deleteProductImage, signProductImageUpload,
} from '../api/admin';
import { fetchCategories } from '../api/products';
import { AdminTopBar } from './AdminProductsPage';

const SIZE_OPTIONS = ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL'];
const ANGLE_OPTIONS = ['front', 'back', 'side', 'detail'];

function formatPrice(cents) {
  return (cents / 100).toFixed(2);
}

function slugify(name) {
  return name.toLowerCase().replace(/[^a-z0-9\s-]/g, '').trim().replace(/\s+/g, '-');
}

// ── Section card ──────────────────────────────────────────────
function Section({ title, subtitle, children }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6 flex flex-col gap-5">
      <div>
        <h2 className="text-base font-bold text-slate-900">{title}</h2>
        {subtitle && <p className="text-sm text-slate-500 mt-0.5">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

// ── Field ─────────────────────────────────────────────────────
function Field({ label, children }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">{label}</label>
      {children}
    </div>
  );
}

const inputCls = "px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition";

// ── Page ──────────────────────────────────────────────────────
export default function AdminProductFormPage() {
  const { t } = useTranslation();
  const { id } = useParams(); // undefined for /new
  const navigate = useNavigate();
  const isNew = !id;

  // Basic info state
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [categories, setCategories] = useState([]);
  const [savedProduct, setSavedProduct] = useState(null); // set after save
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Variants state
  const [variants, setVariants] = useState([]);
  const [pendingColors, setPendingColors] = useState([]); // [{name, hex}]
  const [newColorName, setNewColorName] = useState('');
  const [newColorHex, setNewColorHex] = useState('#000000');
  const [selectedSizes, setSelectedSizes] = useState(['S', 'M', 'L', 'XL']);
  const [variantPrice, setVariantPrice] = useState('');
  const [skuPrefix, setSkuPrefix] = useState('');
  const [generatingVariants, setGeneratingVariants] = useState(false);
  const [variantError, setVariantError] = useState(null);

  // Images state
  const [images, setImages] = useState([]);
  const [imageMode, setImageMode] = useState('file'); // 'file' | 'url'
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [newImageUrl, setNewImageUrl] = useState('');
  const [newImageColor, setNewImageColor] = useState('');
  const [newImageAngle, setNewImageAngle] = useState('front');
  const [addingImage, setAddingImage] = useState(false);
  const [imageError, setImageError] = useState(null);

  const productId = savedProduct?.id || (isNew ? null : id);

  // Distinct color names from existing variants
  const existingColors = [...new Set(variants.map((v) => v.color_name))];

  const handleLogout = () => {
    sessionStorage.removeItem('admin_token');
    navigate('/admin', { replace: true });
  };

  const handle401 = useCallback((err) => {
    if (err.status === 401) {
      sessionStorage.removeItem('admin_token');
      navigate('/admin', { replace: true });
      return true;
    }
    return false;
  }, [navigate]);

  // Load categories
  useEffect(() => {
    fetchCategories().then(setCategories).catch(() => {});
  }, []);

  // Load existing product for edit
  useEffect(() => {
    if (!sessionStorage.getItem('admin_token')) { navigate('/admin', { replace: true }); return; }
    if (!isNew && id) {
      fetchAdminProduct(id)
        .then(({ product, variants: v, images: img }) => {
          setName(product.name);
          setSlug(product.slug);
          setDescription(product.description || '');
          setCategoryId(product.category_id || '');
          setSavedProduct(product);
          setVariants(v || []);
          setImages(img || []);
        })
        .catch((err) => { if (!handle401(err)) setSaveError(err.message); });
    }
  }, [id, isNew, navigate, handle401]);

  // Auto-generate slug from name (only for new products)
  useEffect(() => {
    if (isNew && name && !savedProduct) {
      setSlug(slugify(name));
    }
  }, [name, isNew, savedProduct]);

  // ── Save basic info ───────────────────────────────────────
  const handleSave = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    setSaveError(null);
    setSaveSuccess(false);

    try {
      let result;
      if (isNew && !savedProduct) {
        result = await createProduct({ name: name.trim(), slug: slug.trim(), description: description.trim() || null, category_id: categoryId || null });
        setSavedProduct(result);
        window.history.replaceState(null, '', `/admin/products/${result.id}`);
      } else {
        result = await updateProduct(productId, { name: name.trim(), slug: slug.trim(), description: description.trim() || null, category_id: categoryId || null });
        setSavedProduct(result);
      }
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2500);
    } catch (err) {
      if (!handle401(err)) setSaveError(err.message);
    } finally {
      setSaving(false);
    }
  };

  // ── Add color to pending list ─────────────────────────────
  const handleAddColor = () => {
    if (!newColorName.trim()) return;
    if (pendingColors.some((c) => c.name.toLowerCase() === newColorName.trim().toLowerCase())) return;
    setPendingColors((prev) => [...prev, { name: newColorName.trim(), hex: newColorHex }]);
    setNewColorName('');
    setNewColorHex('#000000');
  };

  // ── Generate variants ─────────────────────────────────────
  const handleGenerateVariants = async () => {
    if (!pendingColors.length || !selectedSizes.length || !variantPrice) {
      setVariantError(t('admin.productForm.variantError'));
      return;
    }
    setGeneratingVariants(true);
    setVariantError(null);

    try {
      const price_cents = Math.round(parseFloat(variantPrice) * 100);
      const { variants: newVariants } = await bulkCreateVariants(productId, {
        colors: pendingColors,
        sizes: selectedSizes,
        price_cents,
        sku_prefix: skuPrefix.trim() || undefined,
      });
      setVariants((prev) => {
        const existingIds = new Set(prev.map((v) => v.id));
        return [...prev, ...(newVariants || []).filter((v) => !existingIds.has(v.id))];
      });
      setPendingColors([]);
      setVariantPrice('');
      setSkuPrefix('');
    } catch (err) {
      if (!handle401(err)) setVariantError(err.message);
    } finally {
      setGeneratingVariants(false);
    }
  };

  // ── Delete variant ────────────────────────────────────────
  const handleDeleteVariant = async (variantId) => {
    try {
      await deleteVariant(productId, variantId);
      setVariants((prev) => prev.filter((v) => v.id !== variantId));
    } catch (err) {
      if (!handle401(err)) setVariantError(err.message);
    }
  };

  // ── Update variant stock ──────────────────────────────────
  const handleUpdateVariantStock = async (variantId, stockValue) => {
    const stock = stockValue === '' ? null : parseInt(stockValue, 10);
    try {
      const updated = await updateVariantStock(productId, variantId, stock);
      setVariants((prev) => prev.map((v) => v.id === variantId ? { ...v, stock: updated.stock } : v));
    } catch (err) {
      if (!handle401(err)) setVariantError(err.message);
    }
  };

  // ── Add image ─────────────────────────────────────────────
  const handleAddImage = async () => {
    if (imageMode === 'url' && !newImageUrl.trim()) return;
    if (imageMode === 'file' && !selectedFile) return;
    setAddingImage(true);
    setImageError(null);
    setUploadProgress(0);

    try {
      let finalUrl = newImageUrl.trim();

      if (imageMode === 'file') {
        const { signedUrl, publicUrl } = await signProductImageUpload({
          productId,
          filename: selectedFile.name,
          contentType: selectedFile.type,
        });

        await new Promise((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.open('PUT', signedUrl);
          xhr.setRequestHeader('Content-Type', selectedFile.type);
          xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) setUploadProgress(Math.round((e.loaded / e.total) * 100));
          };
          xhr.onload = () => (xhr.status === 200 ? resolve() : reject(new Error(`Upload failed: ${xhr.status}`)));
          xhr.onerror = () => reject(new Error('Upload network error'));
          xhr.send(selectedFile);
        });

        finalUrl = publicUrl;
      }

      const img = await addProductImage(productId, {
        url: finalUrl,
        color_name: newImageColor || null,
        angle: newImageAngle,
        sort_order: images.length,
      });
      setImages((prev) => [...prev, img]);
      setNewImageUrl('');
      setNewImageColor('');
      setNewImageAngle('front');
      setSelectedFile(null);
      setUploadProgress(0);
    } catch (err) {
      if (!handle401(err)) setImageError(err.message);
    } finally {
      setAddingImage(false);
    }
  };

  // ── Delete image ──────────────────────────────────────────
  const handleDeleteImage = async (imageId) => {
    try {
      await deleteProductImage(productId, imageId);
      setImages((prev) => prev.filter((img) => img.id !== imageId));
    } catch (err) {
      if (!handle401(err)) setImageError(err.message);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <AdminTopBar onLogout={handleLogout} />

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8 flex flex-col gap-6">
        {/* Back + Title */}
        <div>
          <Link
            to="/admin/products"
            className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-indigo-600 font-medium transition-colors mb-4"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            {t('admin.products.heading')}
          </Link>
          <h1 className="text-2xl font-bold text-slate-900">
            {isNew && !savedProduct ? t('admin.productForm.headingNew') : name || t('admin.productForm.headingEdit')}
          </h1>
        </div>

        {/* ── Section 1: Basic Info ── */}
        <Section title={t('admin.productForm.sections.basicInfo')}>
          <form onSubmit={handleSave} className="flex flex-col gap-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label={t('admin.productForm.fields.productName')}>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Gildan Budget Unisex T-Shirt"
                  required
                  className={inputCls}
                />
              </Field>
              <Field label={t('admin.productForm.fields.slug')}>
                <input
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  placeholder="gildan-budget-unisex-tshirt"
                  className={`${inputCls} font-mono text-xs`}
                />
              </Field>
            </div>
            <Field label={t('admin.productForm.fields.description')}>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                placeholder="Short product description shown on the product page…"
                className={`${inputCls} resize-none`}
              />
            </Field>
            <Field label={t('admin.productForm.fields.category')}>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className={inputCls}
              >
                <option value="">{t('admin.productForm.fields.categoryNone')}</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
            </Field>

            {saveError && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{saveError}</p>
            )}

            <div className="flex items-center gap-3">
              <button
                type="submit"
                disabled={saving || !name.trim()}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white font-semibold rounded-xl text-sm transition-colors"
              >
                {saving
                  ? t('admin.productForm.saving')
                  : savedProduct
                  ? t('admin.productForm.saveChanges')
                  : t('admin.productForm.createProduct')}
              </button>
              {saveSuccess && (
                <span className="text-sm text-green-600 font-medium flex items-center gap-1">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  {t('admin.productForm.saved')}
                </span>
              )}
            </div>
          </form>
        </Section>

        {/* ── Section 2: Variants ── (only after product saved) */}
        {productId && (
          <Section
            title={t('admin.productForm.sections.variants')}
            subtitle={t('admin.productForm.sections.variantsSub')}
          >
            {/* Color builder */}
            <div className="flex flex-col gap-3">
              <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">{t('admin.productForm.fields.colorsToAdd')}</p>

              {/* Pending color pills */}
              {pendingColors.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {pendingColors.map((c) => (
                    <span
                      key={c.name}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-medium"
                    >
                      <span className="w-3 h-3 rounded-full border border-slate-300" style={{ backgroundColor: c.hex }} />
                      {c.name}
                      <button
                        onClick={() => setPendingColors((prev) => prev.filter((x) => x.name !== c.name))}
                        className="text-slate-400 hover:text-red-500 ml-0.5"
                      >
                        ✕
                      </button>
                    </span>
                  ))}
                </div>
              )}

              {/* Add color input */}
              <div className="flex items-center gap-2 flex-wrap">
                <input
                  value={newColorName}
                  onChange={(e) => setNewColorName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddColor())}
                  placeholder="Color name, e.g. Navy"
                  className={`${inputCls} flex-1 min-w-32`}
                />
                <input
                  type="color"
                  value={newColorHex}
                  onChange={(e) => setNewColorHex(e.target.value)}
                  className="w-10 h-10 rounded-lg border border-slate-200 cursor-pointer p-0.5"
                  title="Pick hex color"
                />
                <button
                  type="button"
                  onClick={handleAddColor}
                  disabled={!newColorName.trim()}
                  className="px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-sm transition-colors disabled:opacity-40"
                >
                  {t('admin.productForm.fields.addColor')}
                </button>
              </div>
            </div>

            {/* Size checkboxes */}
            <div className="flex flex-col gap-2">
              <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">{t('admin.productForm.fields.sizes')}</p>
              <div className="flex flex-wrap gap-2">
                {SIZE_OPTIONS.map((size) => (
                  <label key={size} className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedSizes.includes(size)}
                      onChange={(e) =>
                        setSelectedSizes((prev) =>
                          e.target.checked ? [...prev, size] : prev.filter((s) => s !== size)
                        )
                      }
                      className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-400"
                    />
                    <span className="text-sm text-slate-700 font-medium">{size}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Price + SKU prefix */}
            <div className="flex flex-wrap gap-4">
              <Field label={t('admin.productForm.fields.price')}>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={variantPrice}
                  onChange={(e) => setVariantPrice(e.target.value)}
                  placeholder="12.99"
                  className={`${inputCls} w-36`}
                />
              </Field>
              <Field label={t('admin.productForm.fields.skuPrefix')}>
                <input
                  value={skuPrefix}
                  onChange={(e) => setSkuPrefix(e.target.value.toUpperCase())}
                  placeholder="GBT"
                  className={`${inputCls} w-36 font-mono`}
                />
              </Field>
            </div>

            {variantError && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{variantError}</p>
            )}

            {/* Checklist of what's still needed */}
            {(!pendingColors.length || !selectedSizes.length || !variantPrice) && (
              <div className="flex flex-col gap-1 text-xs text-slate-500">
                <p className="font-semibold text-slate-600 mb-0.5">{t('admin.productForm.checklist.heading')}</p>
                <span className={pendingColors.length ? 'text-green-600' : ''}>
                  {pendingColors.length ? '✓' : '○'} {t('admin.productForm.checklist.addColor')}
                </span>
                <span className={selectedSizes.length ? 'text-green-600' : ''}>
                  {selectedSizes.length ? '✓' : '○'} {t('admin.productForm.checklist.addSize')}
                </span>
                <span className={variantPrice ? 'text-green-600' : ''}>
                  {variantPrice ? '✓' : '○'} {t('admin.productForm.checklist.addPrice')}
                </span>
              </div>
            )}

            <button
              type="button"
              onClick={handleGenerateVariants}
              disabled={generatingVariants || !pendingColors.length || !selectedSizes.length || !variantPrice}
              className="self-start px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 disabled:cursor-not-allowed text-white font-semibold rounded-xl text-sm transition-colors"
            >
              {generatingVariants
                ? t('admin.productForm.fields.generating')
                : t('admin.productForm.fields.generateVariantsLabel', { count: pendingColors.length * selectedSizes.length || 0 })}
            </button>

            {/* Existing variants table */}
            {variants.length > 0 && (
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">{t('admin.productForm.variantTable.color')}</th>
                      <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">{t('admin.productForm.variantTable.size')}</th>
                      <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">{t('admin.productForm.variantTable.price')}</th>
                      <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">{t('admin.productForm.variantTable.sku')}</th>
                      <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide" title="Leave blank for unlimited stock">{t('admin.productForm.variantTable.stock')}</th>
                      <th className="px-4 py-2.5" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {variants.map((v) => (
                      <tr key={v.id} className="hover:bg-slate-50">
                        <td className="px-4 py-2.5">
                          <span className="inline-flex items-center gap-1.5 text-sm">
                            <span className="w-3.5 h-3.5 rounded-full border border-slate-200 flex-shrink-0" style={{ backgroundColor: v.color_hex }} />
                            {v.color_name}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-slate-700">{v.size}</td>
                        <td className="px-4 py-2.5 text-slate-700">${formatPrice(v.price_cents)}</td>
                        <td className="px-4 py-2.5 text-slate-400 font-mono text-xs">{v.sku}</td>
                        <td className="px-4 py-2.5">
                          <input
                            type="number"
                            min="0"
                            step="1"
                            defaultValue={v.stock ?? ''}
                            placeholder="∞"
                            onBlur={(e) => handleUpdateVariantStock(v.id, e.target.value)}
                            className="w-20 px-2 py-1 text-sm rounded-lg border border-slate-200 text-slate-700 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-transparent"
                          />
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <button
                            onClick={() => handleDeleteVariant(v.id)}
                            className="text-slate-300 hover:text-red-500 transition-colors"
                            title={t('admin.productForm.deleteVariant')}
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Section>
        )}

        {/* ── Section 3: Images ── (only after product saved) */}
        {productId && (
          <Section
            title={t('admin.productForm.sections.images')}
            subtitle={t('admin.productForm.sections.imagesSub')}
          >
            {/* Mode toggle */}
            <div className="flex gap-1 bg-slate-100 rounded-lg p-1 w-fit">
              {[
                { value: 'file', label: t('admin.productForm.fields.uploadFile') },
                { value: 'url', label: t('admin.productForm.fields.urlMode') },
              ].map((m) => (
                <button
                  key={m.value}
                  type="button"
                  onClick={() => {
                    setImageMode(m.value);
                    setSelectedFile(null);
                    setNewImageUrl('');
                    setUploadProgress(0);
                  }}
                  className={`px-3.5 py-1.5 rounded-md text-sm font-semibold transition-colors ${
                    imageMode === m.value
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>

            {/* Add image row */}
            <div className="flex flex-wrap gap-3 items-end">
              {imageMode === 'file' ? (
                <Field label={t('admin.productForm.fields.imageFile')}>
                  <label className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl border border-slate-200 border-dashed cursor-pointer hover:border-indigo-400 hover:bg-indigo-50/40 transition-colors min-w-64 bg-slate-50">
                    <svg className="w-4 h-4 text-slate-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                    </svg>
                    <span className="text-sm text-slate-500 truncate max-w-[200px]">
                      {selectedFile ? selectedFile.name : t('admin.productForm.fields.chooseImage')}
                    </span>
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/gif"
                      className="sr-only"
                      onChange={(e) => { setSelectedFile(e.target.files[0] || null); setUploadProgress(0); }}
                    />
                  </label>
                  {uploadProgress > 0 && uploadProgress < 100 && (
                    <div className="mt-1.5 w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                      <div
                        className="bg-indigo-500 h-full rounded-full transition-all duration-150"
                        style={{ width: `${uploadProgress}%` }}
                      />
                    </div>
                  )}
                </Field>
              ) : (
                <Field label={t('admin.productForm.fields.imageUrl')}>
                  <input
                    value={newImageUrl}
                    onChange={(e) => setNewImageUrl(e.target.value)}
                    placeholder="https://..."
                    className={`${inputCls} min-w-64`}
                  />
                </Field>
              )}
              <Field label={t('admin.productForm.fields.imageColorLabel')}>
                <select
                  value={newImageColor}
                  onChange={(e) => setNewImageColor(e.target.value)}
                  className={`${inputCls}`}
                >
                  <option value="">{t('admin.productForm.fields.allColors')}</option>
                  {existingColors.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </Field>
              <Field label={t('admin.productForm.fields.imageAngle')}>
                <select
                  value={newImageAngle}
                  onChange={(e) => setNewImageAngle(e.target.value)}
                  className={inputCls}
                >
                  {ANGLE_OPTIONS.map((a) => (
                    <option key={a} value={a}>{a}</option>
                  ))}
                </select>
              </Field>
              <button
                type="button"
                onClick={handleAddImage}
                disabled={addingImage || (imageMode === 'url' ? !newImageUrl.trim() : !selectedFile)}
                className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white font-semibold rounded-xl text-sm transition-colors"
              >
                {addingImage
                  ? (imageMode === 'file' && uploadProgress > 0 && uploadProgress < 100
                      ? `${uploadProgress}%`
                      : t('admin.productForm.uploading'))
                  : t('admin.productForm.fields.addImage')}
              </button>
            </div>

            {imageError && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{imageError}</p>
            )}

            {/* Existing images table */}
            {images.length > 0 && (
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">{t('admin.productForm.imageTable.preview')}</th>
                      <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">{t('admin.productForm.imageTable.color')}</th>
                      <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">{t('admin.productForm.imageTable.angle')}</th>
                      <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">{t('admin.productForm.imageTable.url')}</th>
                      <th className="px-4 py-2.5" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {images.map((img) => (
                      <tr key={img.id} className="hover:bg-slate-50">
                        <td className="px-4 py-2.5">
                          <img
                            src={img.url}
                            alt=""
                            className="w-10 h-12 object-cover rounded-lg bg-slate-100"
                            onError={(e) => { e.target.style.display = 'none'; }}
                          />
                        </td>
                        <td className="px-4 py-2.5 text-slate-700">{img.color_name || <span className="text-slate-400">{t('admin.productForm.fields.allColors')}</span>}</td>
                        <td className="px-4 py-2.5 capitalize text-slate-700">{img.angle}</td>
                        <td className="px-4 py-2.5 text-slate-400 text-xs font-mono max-w-xs truncate">
                          <a href={img.url} target="_blank" rel="noopener noreferrer" className="hover:text-indigo-600 hover:underline">
                            {img.url}
                          </a>
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <button
                            onClick={() => handleDeleteImage(img.id)}
                            className="text-slate-300 hover:text-red-500 transition-colors"
                            title={t('common.delete')}
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Section>
        )}

        {/* Bottom done button */}
        {productId && (
          <div className="flex justify-end">
            <Link
              to="/admin/products"
              className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-sm transition-colors"
            >
              {t('admin.productForm.done')}
            </Link>
          </div>
        )}
      </main>
    </div>
  );
}
