import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Loader2,
  RefreshCw,
  SkipForward,
  Sparkles,
  Upload,
  X,
} from 'lucide-react';
import { AdminProduct, Brand, Category } from '../../types';
import {
  BULK_IMPORT_LOW_STOCK_THRESHOLD,
  BulkImportExecutionResult,
  BulkImportProgress,
  DuplicateStrategy,
  RawBulkImportRow,
  ValidatedBulkImportRow,
  executeBulkProductImport,
  generateBulkErrorReportCsv,
  generateBulkProductTemplateCsv,
  parseBulkProductFile,
  validateBulkImportRows,
} from '../../lib/bulkImport';
import { downloadCsvFile } from '../../lib/csvParser';
import { formatNaira } from '../../lib/utils';
import { dataService } from '../../services/dataService';
import { Button } from '../ui/Button';
import { StockBadge } from '../ui/Badge';
import { useToast } from '../ui/Toast';

export interface BulkImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportComplete: () => Promise<void> | void;
  categories: Category[];
  brands: Brand[];
  existingProducts: AdminProduct[];
  allowedCategoryIds?: Set<string> | null;
}

type PreviewFilter = 'all' | 'valid' | 'warning' | 'error' | 'skip';

export function BulkImportModal({
  isOpen,
  onClose,
  onImportComplete,
  categories,
  brands,
  existingProducts,
  allowedCategoryIds = null,
}: BulkImportModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { success, error: toastError } = useToast();

  const [dragActive, setDragActive] = useState(false);
  const [fileName, setFileName] = useState<string>('');
  const [parseError, setParseError] = useState<string | null>(null);
  const [rawRows, setRawRows] = useState<RawBulkImportRow[] | null>(null);

  const [duplicateStrategy, setDuplicateStrategy] = useState<DuplicateStrategy>('skip');
  const [autoCreateMissingBrands, setAutoCreateMissingBrands] = useState<boolean>(false);
  const [previewFilter, setPreviewFilter] = useState<PreviewFilter>('all');

  const [isImporting, setIsImporting] = useState(false);
  const [progress, setProgress] = useState<BulkImportProgress | null>(null);
  const [executionResult, setExecutionResult] = useState<BulkImportExecutionResult | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isImporting) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isImporting, onClose]);

  const validation = useMemo(() => {
    if (!rawRows) return null;
    return validateBulkImportRows(rawRows, {
      categories,
      brands,
      existingProducts,
      duplicateStrategy,
      autoCreateMissingBrands,
      lowStockThreshold: BULK_IMPORT_LOW_STOCK_THRESHOLD,
      allowedCategoryIds,
    });
  }, [
    rawRows,
    categories,
    brands,
    existingProducts,
    duplicateStrategy,
    autoCreateMissingBrands,
    allowedCategoryIds,
  ]);

  const filteredPreviewRows = useMemo(() => {
    if (!validation) return [];
    if (previewFilter === 'all') return validation.rows;
    if (previewFilter === 'skip') {
      return validation.rows.filter(r => r.action === 'skip');
    }
    if (previewFilter === 'error') {
      return validation.rows.filter(r => r.severity === 'error');
    }
    return validation.rows.filter(r => r.severity === previewFilter && r.action !== 'skip');
  }, [validation, previewFilter]);

  if (!isOpen) return null;

  const resetAll = () => {
    setFileName('');
    setParseError(null);
    setRawRows(null);
    setPreviewFilter('all');
    setProgress(null);
    setExecutionResult(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleCloseModal = () => {
    if (isImporting) return;
    resetAll();
    onClose();
  };

  const handleFileSelected = async (file: File | undefined) => {
    if (!file) return;
    setParseError(null);
    setExecutionResult(null);
    setProgress(null);
    setPreviewFilter('all');

    try {
      const parsed = await parseBulkProductFile(file);
      setFileName(file.name);
      setRawRows(parsed);
    } catch (err: any) {
      setFileName(file.name);
      setRawRows(null);
      setParseError(err?.message || 'Unable to parse spreadsheet file.');
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleStartImport = async () => {
    if (!validation || validation.importableCount === 0 || isImporting) return;

    setIsImporting(true);
    setProgress({
      completed: 0,
      total: validation.importableCount,
      currentProductName: 'Preparing import...',
    });

    try {
      const result = await executeBulkProductImport(validation, {
        autoCreateMissingBrands,
        createBrand: input => dataService.createBrand(input),
        createProduct: data => dataService.createProduct(data),
        updateProduct: (id, updates) => dataService.updateProduct(id, updates),
        uploadProductImage: file => dataService.uploadProductImage(file),
        onProgress: p => setProgress(p),
      });

      setExecutionResult(result);
      await onImportComplete();

      if (result.failed === 0) {
        success(
          `Bulk import complete: ${result.created} created, ${result.updated} updated, ${result.skipped} skipped.`
        );
      } else {
        toastError(
          `Import finished with ${result.failed} failed row(s). Download the error report for details.`
        );
      }
    } catch (err: any) {
      toastError(err?.message || 'Bulk import failed unexpectedly.');
    } finally {
      setIsImporting(false);
    }
  };

  const handleDownloadErrorReport = () => {
    if (!executionResult || executionResult.reportEntries.length === 0) return;
    const csv = generateBulkErrorReportCsv(executionResult.reportEntries);
    downloadCsvFile('bulk-import-error-report.csv', csv);
  };

  const progressPct =
    progress && progress.total > 0
      ? Math.min(100, Math.round((progress.completed / progress.total) * 100))
      : 0;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="bulk-import-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/60 backdrop-blur-xs"
      onClick={handleCloseModal}
    >
      <div
        className="w-full max-w-5xl max-h-[92vh] bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-4 sm:px-6 py-4 border-b border-slate-200 flex items-start justify-between gap-3 bg-slate-50/70 shrink-0">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-[#187004] text-white flex items-center justify-center shrink-0">
              <FileSpreadsheet className="w-5 h-5 text-[#F5A623]" />
            </div>
            <div className="min-w-0">
              <h2
                id="bulk-import-modal-title"
                className="text-lg sm:text-xl font-extrabold text-slate-900 font-heading truncate"
              >
                Bulk Product Import
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Upload a CSV or Excel (.xlsx) spreadsheet to validate, preview, compress images, and import products in bulk.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                downloadCsvFile('bulk-products-template.csv', generateBulkProductTemplateCsv())
              }
              className="hidden sm:inline-flex gap-1.5 text-xs bg-white"
            >
              <Download className="w-3.5 h-3.5 text-[#187004]" />
              <span>Template</span>
            </Button>
            <button
              type="button"
              disabled={isImporting}
              onClick={handleCloseModal}
              aria-label="Close bulk import modal"
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors disabled:opacity-40 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
          <input
            ref={fileInputRef}
            id="bulk-import-file-input"
            type="file"
            accept=".csv,text/csv,.xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
            onChange={e => handleFileSelected(e.target.files?.[0])}
            className="hidden"
            aria-label="Choose CSV or Excel file for bulk product import"
          />

          {/* Step 1: Dropzone when no file loaded OR if parsing failed */}
          {(!rawRows || parseError) && !executionResult && (
            <div className="space-y-4">
              <div
                onDragOver={e => {
                  e.preventDefault();
                  setDragActive(true);
                }}
                onDragLeave={() => setDragActive(false)}
                onDrop={e => {
                  e.preventDefault();
                  setDragActive(false);
                  handleFileSelected(e.dataTransfer.files?.[0]);
                }}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-6 sm:p-10 text-center transition-all cursor-pointer ${
                  dragActive
                    ? 'border-[#F5A623] bg-amber-50/50'
                    : 'border-slate-300 hover:border-[#187004] bg-slate-50/60 hover:bg-white'
                }`}
              >
                <div className="flex flex-col items-center space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-white border border-slate-200 shadow-xs flex items-center justify-center text-[#187004]">
                    <Upload className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-sm sm:text-base font-bold text-slate-900">
                      Click to choose a CSV or Excel (.xlsx) file, or drag and drop it here
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      Supports UTF-8 CSV (quoted fields, commas, line breaks) and .xlsx/.xls spreadsheets. Header casing and spaces are matched automatically.
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={e => {
                      e.stopPropagation();
                      fileInputRef.current?.click();
                    }}
                    className="bg-white text-xs font-bold"
                  >
                    Select Spreadsheet File
                  </Button>
                </div>
              </div>

              {parseError && (
                <div
                  role="alert"
                  className="p-4 rounded-xl bg-red-50 border border-red-200 flex items-start gap-3 text-xs sm:text-sm text-red-800"
                >
                  <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold">Could not parse "{fileName}"</p>
                    <p className="mt-0.5">{parseError}</p>
                  </div>
                </div>
              )}

              <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 text-xs text-slate-600 space-y-1.5">
                <p className="font-bold text-slate-800">Expected Columns:</p>
                <p className="font-mono text-[11px] text-slate-700 leading-relaxed break-words">
                  category*, brand, name*, sku, slug, short_description, trade_price*, moq*, stock_quantity*, stock_status, active, featured, featured_image_url*, other_image_urls, specs
                </p>
              </div>
            </div>
          )}

          {/* Step 2: Validation Options, Stats & Preview Table */}
          {validation && !executionResult && (
            <div className="space-y-4">
              {/* Loaded File Bar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                <div className="flex items-center gap-2.5 min-w-0">
                  <FileSpreadsheet className="w-4 h-4 text-[#187004] shrink-0" />
                  <span className="text-xs sm:text-sm font-bold text-slate-900 truncate">
                    {fileName}
                  </span>
                  <span className="text-xs text-slate-500 shrink-0">
                    ({validation.rows.length} row{validation.rows.length === 1 ? '' : 's'})
                  </span>
                </div>

                {!isImporting && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    className="gap-1.5 text-xs bg-white self-start sm:self-auto"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Upload Different File</span>
                  </Button>
                )}
              </div>

              {/* Duplicate Handling + Auto-Create Missing Brands Controls */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                {/* Duplicate Handling */}
                <div className="p-3.5 rounded-xl border border-slate-200 bg-white space-y-2">
                  <p className="text-xs font-bold text-slate-800">
                    Duplicate Product Handling <span className="font-normal text-slate-500">(matched by SKU first, then slug)</span>
                  </p>
                  <div className="flex flex-wrap gap-3">
                    <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                      <input
                        type="radio"
                        name="duplicateStrategy"
                        value="skip"
                        disabled={isImporting}
                        checked={duplicateStrategy === 'skip'}
                        onChange={() => setDuplicateStrategy('skip')}
                        className="text-[#187004] focus:ring-[#187004]"
                      />
                      <span>Skip existing products</span>
                    </label>
                    <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                      <input
                        type="radio"
                        name="duplicateStrategy"
                        value="update"
                        disabled={isImporting}
                        checked={duplicateStrategy === 'update'}
                        onChange={() => setDuplicateStrategy('update')}
                        className="text-[#187004] focus:ring-[#187004]"
                      />
                      <span>Update existing products</span>
                    </label>
                  </div>
                </div>

                {/* Auto-Create Missing Brands */}
                <div
                  className={`p-3.5 rounded-xl border space-y-1.5 ${
                    validation.missingBrands.length > 0
                      ? 'border-amber-200 bg-amber-50/50'
                      : 'border-slate-200 bg-white'
                  }`}
                >
                  <label className="inline-flex items-start gap-2.5 text-xs font-bold text-slate-800 cursor-pointer">
                    <input
                      type="checkbox"
                      disabled={isImporting}
                      checked={autoCreateMissingBrands}
                      onChange={e => setAutoCreateMissingBrands(e.target.checked)}
                      className="mt-0.5 rounded text-[#187004] focus:ring-[#187004]"
                    />
                    <span>
                      Auto-create missing brands under their matched category
                      {validation.missingBrands.length > 0
                        ? ` (${validation.missingBrands.length} missing)`
                        : ''}
                    </span>
                  </label>
                  {validation.missingBrands.length > 0 ? (
                    <p className="text-[11px] text-amber-800 pl-6">
                      Missing brands:{' '}
                      {validation.missingBrands
                        .map(b => `${b.brandName} (${b.categoryName})`)
                        .join(', ')}
                    </p>
                  ) : (
                    <p className="text-[11px] text-slate-500 pl-6">
                      All specified brands match existing records under their categories.
                    </p>
                  )}
                </div>
              </div>

              {/* Validation Filter & Count Strip */}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPreviewFilter('all')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors cursor-pointer ${
                    previewFilter === 'all'
                      ? 'bg-slate-900 text-white border-slate-900'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  All ({validation.rows.length})
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewFilter('valid')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors cursor-pointer ${
                    previewFilter === 'valid'
                      ? 'bg-[#187004] text-white border-[#187004]'
                      : 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                  }`}
                >
                  Valid ({validation.validCount})
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewFilter('warning')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors cursor-pointer ${
                    previewFilter === 'warning'
                      ? 'bg-amber-600 text-white border-amber-600'
                      : 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100'
                  }`}
                >
                  Warnings ({validation.warningCount})
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewFilter('error')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors cursor-pointer ${
                    previewFilter === 'error'
                      ? 'bg-red-600 text-white border-red-600'
                      : 'bg-red-50 text-red-800 border-red-200 hover:bg-red-100'
                  }`}
                >
                  Errors ({validation.errorCount})
                </button>
                {validation.skipCount > 0 && (
                  <button
                    type="button"
                    onClick={() => setPreviewFilter('skip')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors cursor-pointer ${
                      previewFilter === 'skip'
                        ? 'bg-slate-700 text-white border-slate-700'
                        : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
                    }`}
                  >
                    Skipped ({validation.skipCount})
                  </button>
                )}
              </div>

              {/* Progress Bar during live import */}
              {isImporting && progress && (
                <div className="p-4 rounded-xl bg-emerald-50/70 border border-emerald-200 space-y-2">
                  <div className="flex items-center justify-between gap-2 text-xs font-bold text-[#0e3e03]">
                    <span className="flex items-center gap-2 truncate">
                      <Loader2 className="w-4 h-4 animate-spin shrink-0 text-[#187004]" />
                      <span className="truncate">
                        Importing {progress.completed} of {progress.total}: {progress.currentProductName}
                      </span>
                    </span>
                    <span className="tabular-nums shrink-0">{progressPct}%</span>
                  </div>
                  <div
                    role="progressbar"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={progressPct}
                    className="w-full h-2.5 bg-emerald-200/70 rounded-full overflow-hidden"
                  >
                    <div
                      className="h-full bg-[#187004] transition-all duration-300 rounded-full"
                      style={{ width: `${progressPct}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Desktop Preview Table */}
              <div className="hidden lg:block rounded-xl border border-slate-200 overflow-hidden bg-white">
                <div className="overflow-x-auto max-h-[340px]">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-600 uppercase tracking-wider font-bold border-b border-slate-200 sticky top-0 z-10">
                      <tr>
                        <th className="px-3 py-2.5">Row</th>
                        <th className="px-3 py-2.5">Status</th>
                        <th className="px-3 py-2.5">Product & SKU</th>
                        <th className="px-3 py-2.5">Category & Brand</th>
                        <th className="px-3 py-2.5">Price / MOQ</th>
                        <th className="px-3 py-2.5">Stock</th>
                        <th className="px-3 py-2.5">Validation Reason / Notes</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredPreviewRows.map(row => (
                        <PreviewTableRow key={row.rowNumber} row={row} />
                      ))}
                      {filteredPreviewRows.length === 0 && (
                        <tr>
                          <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                            No rows match this filter.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Mobile & Tablet Card Preview List */}
              <div className="lg:hidden space-y-2.5">
                {filteredPreviewRows.map(row => (
                  <PreviewMobileCard key={row.rowNumber} row={row} />
                ))}
                {filteredPreviewRows.length === 0 && (
                  <div className="p-6 text-center text-xs text-slate-500 bg-slate-50 rounded-xl border border-slate-200">
                    No rows match this filter.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Step 3: Post-Import Completion Summary */}
          {executionResult && (
            <div className="space-y-5">
              <div className="p-5 rounded-2xl bg-emerald-50/70 border border-emerald-200 flex items-start gap-3">
                <CheckCircle2 className="w-6 h-6 text-[#187004] shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-base font-extrabold text-slate-900 font-heading">
                    Bulk Import Complete
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-600 mt-0.5">
                    Processed "{fileName}". Catalogue listings have been refreshed.
                  </p>
                </div>
              </div>

              {/* 4 Summary Stat Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-center">
                  <p className="text-2xl font-black text-[#187004] tabular-nums">
                    {executionResult.created}
                  </p>
                  <p className="text-xs font-bold text-emerald-900 mt-0.5">Created</p>
                </div>
                <div className="p-4 rounded-xl bg-sky-50 border border-sky-200 text-center">
                  <p className="text-2xl font-black text-sky-700 tabular-nums">
                    {executionResult.updated}
                  </p>
                  <p className="text-xs font-bold text-sky-900 mt-0.5">Updated</p>
                </div>
                <div className="p-4 rounded-xl bg-slate-100 border border-slate-200 text-center">
                  <p className="text-2xl font-black text-slate-700 tabular-nums">
                    {executionResult.skipped}
                  </p>
                  <p className="text-xs font-bold text-slate-700 mt-0.5">Skipped</p>
                </div>
                <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-center">
                  <p className="text-2xl font-black text-red-700 tabular-nums">
                    {executionResult.failed}
                  </p>
                  <p className="text-xs font-bold text-red-900 mt-0.5">Failed</p>
                </div>
              </div>

              {/* Image Warnings Summary */}
              {executionResult.imageWarnings.length > 0 && (
                <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 space-y-2">
                  <div className="flex items-center gap-2 text-xs sm:text-sm font-bold text-amber-900">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>
                      {executionResult.imageWarnings.length} product(s) imported with image warnings:
                    </span>
                  </div>
                  <ul className="space-y-1 text-xs text-amber-800 pl-6 list-disc">
                    {executionResult.imageWarnings.map(w => (
                      <li key={w.rowNumber}>
                        <span className="font-bold">Row {w.rowNumber} ({w.name}):</span> {w.reason}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Error Report Entries Preview + Download */}
              {executionResult.reportEntries.length > 0 && (
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <p className="text-xs sm:text-sm font-bold text-slate-900">
                      {executionResult.reportEntries.length} row(s) recorded in the report
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Download the CSV report to inspect failed/error rows or image warnings, fix the spreadsheet, and re-upload.
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleDownloadErrorReport}
                    className="gap-1.5 bg-white font-bold shrink-0"
                  >
                    <Download className="w-4 h-4 text-[#187004]" />
                    <span>Download error report</span>
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-4 sm:px-6 py-3.5 border-t border-slate-200 bg-slate-50/70 flex flex-wrap items-center justify-between gap-3 shrink-0">
          {!executionResult ? (
            <>
              <div className="text-xs text-slate-500">
                {validation
                  ? validation.errorCount > 0
                    ? `${validation.errorCount} error row(s) will be skipped. Valid & warning rows will be imported.`
                    : validation.importableCount > 0
                    ? `${validation.importableCount} product(s) ready to import.`
                    : 'No new or updatable products to import.'
                  : 'Upload a CSV or Excel file to begin.'}
              </div>

              <div className="flex items-center gap-2.5 ml-auto">
                <Button
                  type="button"
                  variant="outline"
                  size="md"
                  disabled={isImporting}
                  onClick={handleCloseModal}
                >
                  Cancel
                </Button>
                {validation && (
                  <Button
                    type="button"
                    variant="primary"
                    size="md"
                    isLoading={isImporting}
                    disabled={validation.importableCount === 0 || isImporting}
                    onClick={handleStartImport}
                    className="font-bold"
                  >
                    <Sparkles className="w-4 h-4 mr-1.5 text-[#F5A623]" />
                    <span>
                      Import {validation.importableCount} valid product
                      {validation.importableCount === 1 ? '' : 's'}
                    </span>
                  </Button>
                )}
              </div>
            </>
          ) : (
            <div className="flex flex-wrap items-center justify-end gap-2.5 w-full">
              <Button type="button" variant="outline" size="md" onClick={resetAll}>
                Import Another File
              </Button>
              <Button type="button" variant="primary" size="md" onClick={handleCloseModal}>
                Done
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function RowStatusPill({ row }: { row: ValidatedBulkImportRow }) {
  if (row.severity === 'error') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-red-100 text-red-800 border border-red-200 font-bold text-[11px]">
        <AlertCircle className="w-3 h-3 shrink-0" />
        <span>Error</span>
      </span>
    );
  }
  if (row.action === 'skip') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200 font-bold text-[11px]">
        <SkipForward className="w-3 h-3 shrink-0" />
        <span>Skipped</span>
      </span>
    );
  }
  if (row.severity === 'warning') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 border border-amber-200 font-bold text-[11px]">
        <AlertTriangle className="w-3 h-3 shrink-0" />
        <span>Warning</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 border border-emerald-200 font-bold text-[11px]">
      <CheckCircle2 className="w-3 h-3 shrink-0" />
      <span>Valid</span>
    </span>
  );
}

function PreviewTableRow({ row }: { row: ValidatedBulkImportRow }) {
  const rowBg =
    row.severity === 'error'
      ? 'bg-red-50/40'
      : row.action === 'skip'
      ? 'bg-slate-50/60'
      : row.severity === 'warning'
      ? 'bg-amber-50/40'
      : '';

  const messages = [...row.errors, ...row.warnings, ...row.notes];

  return (
    <tr className={rowBg}>
      <td className="px-3 py-2.5 font-mono text-slate-500 font-bold">#{row.rowNumber}</td>
      <td className="px-3 py-2.5 whitespace-nowrap">
        <div className="flex flex-col items-start gap-1">
          <RowStatusPill row={row} />
          {row.action === 'update' && (
            <span className="text-[10px] font-bold text-sky-700">
              Update ({row.duplicateMatch?.matchedBy.toUpperCase()})
            </span>
          )}
        </div>
      </td>
      <td className="px-3 py-2.5 max-w-[210px]">
        <p className="font-bold text-slate-900 truncate">
          {row.name || <span className="italic text-red-600">(Missing name)</span>}
        </p>
        <p className="text-[11px] text-slate-500 font-mono truncate">
          {row.sku ? `${row.sku} • ` : ''}
          {row.slug || '—'}
        </p>
      </td>
      <td className="px-3 py-2.5">
        <p className="font-semibold text-slate-800">{row.categoryName || '—'}</p>
        <p className="text-[11px] text-slate-500">
          {row.brandName || 'No brand'}
          {row.isMissingBrand && row.errors.length === 0 && (
            <span className="ml-1 text-emerald-700 font-bold">(new)</span>
          )}
        </p>
      </td>
      <td className="px-3 py-2.5 whitespace-nowrap tabular-nums">
        <p className="font-bold text-slate-900">
          {row.tradePrice !== null ? formatNaira(row.tradePrice) : '—'}
        </p>
        <p className="text-[11px] text-slate-500">MOQ: {row.moq}</p>
      </td>
      <td className="px-3 py-2.5 whitespace-nowrap">
        <div className="flex flex-col items-start gap-1">
          <span className="font-bold tabular-nums text-slate-800">{row.stockQuantity} u</span>
          <StockBadge status={row.stockStatus} />
        </div>
      </td>
      <td className="px-3 py-2.5 max-w-[250px]">
        {messages.length > 0 ? (
          <ul className="space-y-0.5 text-[11px]">
            {row.errors.map((err, i) => (
              <li key={`e-${i}`} className="text-red-700 font-semibold">
                {err}
              </li>
            ))}
            {row.warnings.map((w, i) => (
              <li key={`w-${i}`} className="text-amber-800 font-medium">
                {w}
              </li>
            ))}
            {row.notes.map((n, i) => (
              <li key={`n-${i}`} className="text-slate-600">
                {n}
              </li>
            ))}
          </ul>
        ) : (
          <span className="text-[11px] text-emerald-700 font-medium">Ready to create</span>
        )}
      </td>
    </tr>
  );
}

function PreviewMobileCard({ row }: { row: ValidatedBulkImportRow }) {
  const messages = [...row.errors, ...row.warnings, ...row.notes];
  return (
    <div
      className={`p-3.5 rounded-xl border text-xs space-y-2 ${
        row.severity === 'error'
          ? 'bg-red-50/50 border-red-200'
          : row.severity === 'warning'
          ? 'bg-amber-50/50 border-amber-200'
          : 'bg-white border-slate-200'
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono font-bold text-slate-500">Row #{row.rowNumber}</span>
        <div className="flex items-center gap-2">
          {row.action === 'update' && (
            <span className="text-[10px] font-bold text-sky-700">
              Update ({row.duplicateMatch?.matchedBy.toUpperCase()})
            </span>
          )}
          <RowStatusPill row={row} />
        </div>
      </div>

      <div>
        <p className="font-bold text-slate-900">
          {row.name || <span className="italic text-red-600">(Missing name)</span>}
        </p>
        <p className="text-[11px] text-slate-500 mt-0.5">
          {row.categoryName || '—'}
          {row.brandName ? ` • ${row.brandName}` : ''}
          {row.sku ? ` • ${row.sku}` : ''}
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-200/70">
        <span className="font-bold text-slate-900 tabular-nums">
          {row.tradePrice !== null ? formatNaira(row.tradePrice) : '—'} (MOQ {row.moq})
        </span>
        <div className="flex items-center gap-1.5">
          <span className="font-bold tabular-nums">{row.stockQuantity} u</span>
          <StockBadge status={row.stockStatus} />
        </div>
      </div>

      {messages.length > 0 && (
        <ul className="space-y-0.5 pt-1 text-[11px]">
          {row.errors.map((err, i) => (
            <li key={`me-${i}`} className="text-red-700 font-semibold">
              {err}
            </li>
          ))}
          {row.warnings.map((w, i) => (
            <li key={`mw-${i}`} className="text-amber-800 font-medium">
              {w}
            </li>
          ))}
          {row.notes.map((n, i) => (
            <li key={`mn-${i}`} className="text-slate-600">
              {n}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
