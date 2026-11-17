import React, { useState, useEffect } from 'react';
import {
  Plus,
  ArrowUp,
  ArrowDown,
  Edit2,
  Trash2,
  Eye,
  EyeOff,
  X,
  Save,
  AlertTriangle,
  Tag,
} from 'lucide-react';
import { Brand, Category } from '../../types';
import { dataService } from '../../services/dataService';
import { slugify } from '../../lib/utils';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { ImageUploader } from '../../components/admin/ImageUploader';
import { useToast } from '../../components/ui/Toast';
import { usePermissions } from '../../context/PermissionsContext';

export default function CategoriesList() {
  const { can, categoryScope } = usePermissions();
  const canCreateEdit = can('categories.create_edit');
  const canCreateNew = canCreateEdit && (!categoryScope || categoryScope.length === 0);
  const canReorder = can('categories.reorder');
  const canToggleVisibility = can('categories.toggle_visibility');
  const canDelete = can('categories.delete');

  const [categories, setCategories] = useState<Category[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [newBrandInputs, setNewBrandInputs] = useState<Record<string, string>>({});
  const [addingBrandCatId, setAddingBrandCatId] = useState<string | null>(null);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [formName, setFormName] = useState('');
  const [formSlug, setFormSlug] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formImages, setFormImages] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteErrorMsg, setDeleteErrorMsg] = useState<string | null>(null);

  const { success, error: toastError } = useToast();

  const loadCategories = async () => {
    setIsLoading(true);
    try {
      const [data, brandsData] = await Promise.all([
        dataService.getCategories(false),
        dataService.getBrands(),
      ]);
      setCategories(data);
      setBrands(brandsData);
    } catch (err) {
      console.error('Failed to load categories:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadCategories();
  }, []);

  const openCreateDialog = () => {
    if (!canCreateNew) return;
    setEditingCategory(null);
    setFormName('');
    setFormSlug('');
    setFormDesc('');
    setFormImages([]);
    setIsDialogOpen(true);
  };

  const openEditDialog = (cat: Category) => {
    if (!canCreateEdit) return;
    setEditingCategory(cat);
    setFormName(cat.name);
    setFormSlug(cat.slug);
    setFormDesc(cat.description || '');
    setFormImages(cat.image_url ? [cat.image_url] : []);
    setIsDialogOpen(true);
  };

  const handleNameChange = (val: string) => {
    setFormName(val);
    if (!editingCategory) {
      setFormSlug(slugify(val));
    }
  };

  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      toastError('Category name is required.');
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        name: formName.trim(),
        slug: formSlug.trim() || slugify(formName),
        description: formDesc.trim() || null,
        image_url: formImages[0] || null,
        sort_order: editingCategory ? editingCategory.sort_order : categories.length + 1,
        is_active: editingCategory ? editingCategory.is_active : true,
      };

      if (editingCategory) {
        await dataService.updateCategory(editingCategory.id, {
          name: payload.name,
          slug: payload.slug,
          description: payload.description,
          image_url: payload.image_url,
        });
        success('Category updated successfully.');
      } else {
        await dataService.createCategory(payload);
        success('New category added successfully.');
      }

      setIsDialogOpen(false);
      await loadCategories();
    } catch (err: any) {
      toastError(err.message || 'Failed to save category.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleActive = async (cat: Category) => {
    if (!canToggleVisibility) return;
    try {
      await dataService.updateCategory(cat.id, { is_active: !cat.is_active });
      setCategories(prev =>
        prev.map(c => (c.id === cat.id ? { ...c, is_active: !cat.is_active } : c))
      );
      success(`Category ${!cat.is_active ? 'activated' : 'hidden'}.`);
    } catch (err: any) {
      toastError(err.message || 'Failed to update status.');
    }
  };

  const handleMove = async (index: number, direction: 'up' | 'down') => {
    if (!canReorder) return;
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= categories.length) return;

    const copy = [...categories];
    const temp = copy[index];
    copy[index] = copy[targetIndex];
    copy[targetIndex] = temp;

    try {
      setCategories(copy);
      await dataService.reorderCategories(copy.map(c => c.id));
      success('Category order updated.');
    } catch (err: any) {
      toastError(err.message || 'Failed to reorder categories.');
      await loadCategories();
    }
  };

  const handleTriggerDelete = (cat: Category) => {
    if (!canDelete) return;
    setDeleteTarget(cat);
    setDeleteErrorMsg(null);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await dataService.deleteCategory(deleteTarget.id);
      setCategories(prev => prev.filter(c => c.id !== deleteTarget.id));
      setBrands(prev => prev.filter(b => b.category_id !== deleteTarget.id));
      success(`Deleted "${deleteTarget.name}".`);
      setDeleteDialogOpen(false);
      setDeleteTarget(null);
    } catch (err: any) {
      setDeleteErrorMsg(err.message || 'Cannot delete category containing products.');
    }
  };

  const handleAddBrand = async (categoryId: string, e: React.FormEvent) => {
    e.preventDefault();
    const name = (newBrandInputs[categoryId] || '').trim();
    if (!name || !canCreateEdit) return;
    setAddingBrandCatId(categoryId);
    try {
      const created = await dataService.createBrand({ category_id: categoryId, name });
      setBrands(prev => [...prev, created]);
      setNewBrandInputs(prev => ({ ...prev, [categoryId]: '' }));
      success(`Added brand "${created.name}".`);
    } catch (err: any) {
      toastError(err?.message || 'Failed to add brand.');
    } finally {
      setAddingBrandCatId(null);
    }
  };

  const handleDeleteBrand = async (brand: Brand) => {
    if (!canDelete && !canCreateEdit) return;
    try {
      await dataService.deleteBrand(brand.id);
      setBrands(prev => prev.filter(b => b.id !== brand.id));
      success(`Deleted brand "${brand.name}".`);
    } catch (err: any) {
      toastError(err?.message || 'Failed to delete brand.');
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 font-heading">
            Categories &amp; Brand Sub-Categories
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Reorder product categories, manage brand sub-categories under each category, and control catalogue visibility.
          </p>
        </div>

        {canCreateNew && (
          <Button
            type="button"
            variant="primary"
            size="md"
            onClick={openCreateDialog}
            className="gap-2 font-bold shadow-xs self-start sm:self-auto shrink-0 whitespace-nowrap"
          >
            <Plus className="w-4 h-4 text-[#F5A623] shrink-0" />
            <span>Add Category</span>
          </Button>
        )}
      </div>

      {/* Categories List */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs divide-y divide-slate-100 overflow-hidden">
        {isLoading ? (
          <div className="p-8 space-y-4">
            {[1, 2, 3].map(n => (
              <div key={n} className="h-16 bg-slate-100 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : categories.length === 0 ? (
          <div className="p-12 text-center text-slate-500 text-sm">
            No categories available in your scope.
          </div>
        ) : (
          categories.map((cat, idx) => {
            const catBrands = brands.filter(b => b.category_id === cat.id);
            return (
              <div
                key={cat.id}
                className="p-4 sm:p-5 space-y-3 hover:bg-slate-50/40 transition-colors"
              >
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    {canReorder && (
                      <div className="flex flex-col gap-1 shrink-0">
                        <button
                          type="button"
                          disabled={idx === 0}
                          onClick={() => handleMove(idx, 'up')}
                          aria-label={`Move ${cat.name} up`}
                          className="p-1 text-slate-400 hover:text-[#187004] hover:bg-slate-100 rounded disabled:opacity-20"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          disabled={idx === categories.length - 1}
                          onClick={() => handleMove(idx, 'down')}
                          aria-label={`Move ${cat.name} down`}
                          className="p-1 text-slate-400 hover:text-[#187004] hover:bg-slate-100 rounded disabled:opacity-20"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}

                    {cat.image_url && (
                      <img
                        src={cat.image_url}
                        alt={cat.name}
                        className="w-12 h-12 rounded-xl object-cover border border-slate-200 bg-slate-100 shrink-0"
                      />
                    )}

                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 font-heading text-base truncate">
                          {cat.name}
                        </span>
                        <span className="text-xs font-mono text-slate-400">/{cat.slug}</span>
                        {!cat.is_active && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-500">
                            Hidden
                          </span>
                        )}
                      </div>
                      {cat.description && (
                        <p className="text-xs text-slate-500 line-clamp-1 mt-0.5">
                          {cat.description}
                        </p>
                      )}
                    </div>
                  </div>

                  {(canToggleVisibility || canCreateEdit || canDelete) && (
                    <div className="flex items-center gap-2 self-end sm:self-auto">
                      {canToggleVisibility && (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => handleToggleActive(cat)}
                          className="text-xs py-1"
                        >
                          {cat.is_active ? (
                            <>
                              <EyeOff className="w-3.5 h-3.5 mr-1 text-slate-400" /> Hide
                            </>
                          ) : (
                            <>
                              <Eye className="w-3.5 h-3.5 mr-1 text-emerald-600" /> Show
                            </>
                          )}
                        </Button>
                      )}
                      {canCreateEdit && (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => openEditDialog(cat)}
                          className="text-xs py-1"
                        >
                          <Edit2 className="w-3.5 h-3.5 mr-1" /> Edit
                        </Button>
                      )}
                      {canDelete && (
                        <button
                          type="button"
                          onClick={() => handleTriggerDelete(cat)}
                          aria-label={`Delete category ${cat.name}`}
                          className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* Brand Sub-Categories List & Add Brand Control */}
                <div className="sm:pl-8 pt-2 border-t border-slate-100/80 flex flex-col gap-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-slate-400 mr-1">
                      <Tag className="w-3 h-3 text-[#187004]" />
                      Brands (Sub-Categories):
                    </span>
                    {catBrands.length === 0 ? (
                      <span className="text-xs text-slate-400 italic">No brands added yet</span>
                    ) : (
                      catBrands.map(brand => (
                        <span
                          key={brand.id}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50/70 border border-emerald-200/70 text-xs font-semibold text-slate-800"
                        >
                          <span>{brand.name}</span>
                          {(canDelete || canCreateEdit) && (
                            <button
                              type="button"
                              onClick={() => handleDeleteBrand(brand)}
                              aria-label={`Delete brand ${brand.name} from ${cat.name}`}
                              title={`Remove ${brand.name}`}
                              className="text-slate-400 hover:text-red-600 transition-colors cursor-pointer"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          )}
                        </span>
                      ))
                    )}
                  </div>

                  {canCreateEdit && (
                    <form
                      onSubmit={e => handleAddBrand(cat.id, e)}
                      className="flex items-center gap-2 max-w-sm pt-1"
                    >
                      <input
                        type="text"
                        value={newBrandInputs[cat.id] || ''}
                        onChange={e =>
                          setNewBrandInputs(prev => ({ ...prev, [cat.id]: e.target.value }))
                        }
                        placeholder={`Add brand under ${cat.name}...`}
                        aria-label={`New brand name for ${cat.name}`}
                        className="flex-1 min-h-[34px] px-3 py-1 rounded-lg border border-slate-300 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-[#187004]"
                      />
                      <Button
                        type="submit"
                        size="sm"
                        variant="outline"
                        isLoading={addingBrandCatId === cat.id}
                        disabled={!(newBrandInputs[cat.id] || '').trim()}
                        className="text-xs h-[34px] px-3 gap-1 shrink-0"
                      >
                        <Plus className="w-3.5 h-3.5 text-[#187004]" />
                        <span>Add Brand</span>
                      </Button>
                    </form>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Add / Edit Category Dialog Modal */}
      {isDialogOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in"
        >
          <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900 font-heading">
                {editingCategory ? 'Edit Category' : 'Add New Category'}
              </h3>
              <button
                type="button"
                onClick={() => setIsDialogOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveCategory} className="p-6 space-y-4">
              <Input
                label="Category Name *"
                placeholder="e.g. Solar Panels"
                value={formName}
                onChange={e => handleNameChange(e.target.value)}
              />

              <Input
                label="Slug *"
                placeholder="e.g. solar-panels"
                value={formSlug}
                onChange={e => setFormSlug(e.target.value)}
              />

              <div>
                <label className="block text-xs font-semibold text-slate-700 tracking-wide mb-1.5">
                  Description
                </label>
                <textarea
                  rows={2}
                  placeholder="Overview of products in this category..."
                  value={formDesc}
                  onChange={e => setFormDesc(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#187004]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 tracking-wide mb-1.5">
                  Category Banner Image (Optional)
                </label>
                <ImageUploader
                  images={formImages}
                  onChange={setFormImages}
                  maxImages={1}
                />
              </div>

              <div className="mt-6 flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <Button
                  type="button"
                  variant="outline"
                  size="md"
                  onClick={() => setIsDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="md"
                  isLoading={isSaving}
                  className="font-bold shadow-xs min-w-[120px]"
                >
                  <Save className="w-4 h-4 mr-1.5" />
                  <span>{editingCategory ? 'Save Changes' : 'Create Category'}</span>
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Category Confirmation Dialog */}
      {deleteDialogOpen && deleteTarget && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in"
        >
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden p-6 space-y-4">
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-full bg-red-50 text-red-600 shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900 font-heading">
                  Delete "{deleteTarget.name}"?
                </h3>
                <p className="mt-1 text-sm text-slate-600">
                  Are you sure you want to delete this category? If there are products assigned to this category, deletion will be safely blocked.
                </p>
              </div>
            </div>

            {deleteErrorMsg && (
              <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs font-bold text-red-700">
                {deleteErrorMsg}
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-3">
              <Button
                type="button"
                variant="outline"
                size="md"
                onClick={() => setDeleteDialogOpen(false)}
              >
                Close
              </Button>
              {!deleteErrorMsg && (
                <Button
                  type="button"
                  variant="danger"
                  size="md"
                  onClick={handleConfirmDelete}
                >
                  Confirm Delete
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
