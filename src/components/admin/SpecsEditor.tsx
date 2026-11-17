import React, { useRef, useState } from 'react';
import { Plus, Trash2, Upload, Download } from 'lucide-react';
import { Button } from '../ui/Button';
import { useToast } from '../ui/Toast';
import { parseSpecsCsv, generateSampleSpecsCsv, downloadCsvFile } from '../../lib/csvParser';

export interface SpecsEditorProps {
  specs: Record<string, string>;
  onChange: (specs: Record<string, string>) => void;
  disabled?: boolean;
}

export function SpecsEditor({ specs, onChange, disabled = false }: SpecsEditorProps) {
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');
  const csvInputRef = useRef<HTMLInputElement>(null);
  const { success, error: toastError } = useToast();

  const entries = Object.entries(specs || {});

  const handleUpdate = (oldKey: string, updatedKey: string, updatedVal: string) => {
    const next: Record<string, string> = {};
    for (const [k, v] of Object.entries(specs)) {
      if (k === oldKey) {
        if (updatedKey.trim()) {
          next[updatedKey.trim()] = updatedVal;
        }
      } else {
        next[k] = v;
      }
    }
    onChange(next);
  };

  const handleRemove = (keyToRemove: string) => {
    const next = { ...specs };
    delete next[keyToRemove];
    onChange(next);
  };

  const handleAdd = () => {
    if (!newKey.trim()) return;
    onChange({
      ...specs,
      [newKey.trim()]: newValue.trim(),
    });
    setNewKey('');
    setNewValue('');
  };

  const handleSpecsCsvUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const imported = parseSpecsCsv(text);
      onChange({
        ...(specs || {}),
        ...imported,
      });
      const count = Object.keys(imported).length;
      success(`Imported ${count} technical specification${count === 1 ? '' : 's'} from CSV.`);
    } catch (err: any) {
      toastError(err?.message || 'Failed to parse specifications CSV.');
    } finally {
      if (csvInputRef.current) {
        csvInputRef.current.value = '';
      }
    }
  };

  const commonPresets = [
    'Wattage',
    'Cell Type',
    'Efficiency',
    'Nominal Voltage',
    'Battery Voltage',
    'Rated Power',
    'Capacity',
    'Cycle Life',
    'Max PV Input',
    'Dimensions',
    'Weight',
    'Warranty',
  ];

  return (
    <div className="space-y-4">
      {/* CSV Import & Template Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-xl bg-slate-50 border border-slate-200/80">
        <div className="text-xs text-slate-600">
          <span className="font-bold text-slate-800">CSV Bulk Specs Update:</span>{' '}
          Upload a 2-column CSV (<span className="font-mono">Specification, Value</span>) to add or update specs.
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <input
            ref={csvInputRef}
            type="file"
            accept=".csv,text/csv"
            disabled={disabled}
            onChange={handleSpecsCsvUpload}
            className="hidden"
            id="specs-csv-upload"
          />
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={disabled}
            onClick={() => downloadCsvFile('technical-specs-template.csv', generateSampleSpecsCsv())}
            className="text-xs gap-1.5"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Sample CSV</span>
          </Button>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={disabled}
            onClick={() => csvInputRef.current?.click()}
            className="text-xs gap-1.5 font-bold"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Upload Specs CSV</span>
          </Button>
        </div>
      </div>

      {/* Existing Specs Rows */}
      {entries.length > 0 ? (
        <div className="space-y-2">
          {entries.map(([key, val], idx) => (
            <div key={idx} className="flex items-center gap-2">
              <input
                type="text"
                value={key}
                onChange={e => handleUpdate(key, e.target.value, val)}
                placeholder="Spec (e.g. Wattage)"
                className="w-1/3 min-h-[40px] px-3 py-1.5 rounded-xl border border-slate-300 text-xs sm:text-sm font-semibold text-slate-800 bg-white"
              />
              <input
                type="text"
                value={val}
                onChange={e => handleUpdate(key, key, e.target.value)}
                placeholder="Value (e.g. 600W)"
                className="flex-1 min-h-[40px] px-3 py-1.5 rounded-xl border border-slate-300 text-xs sm:text-sm text-slate-800 bg-white"
              />
              <button
                type="button"
                onClick={() => handleRemove(key)}
                aria-label={`Remove spec ${key}`}
                className="p-2 text-slate-400 hover:text-red-600 rounded-lg shrink-0"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-500 text-center">
          No specifications added yet. Add key/value pairs below or upload a CSV file above.
        </div>
      )}

      {/* Add New Spec Row */}
      <div className="flex flex-col sm:flex-row items-center gap-2 pt-2 border-t border-slate-100">
        <input
          type="text"
          value={newKey}
          onChange={e => setNewKey(e.target.value)}
          placeholder="New Spec Name (e.g. Battery Voltage)"
          className="w-full sm:w-1/3 min-h-[40px] px-3 py-2 rounded-xl border border-slate-300 text-xs sm:text-sm font-semibold bg-white"
        />
        <input
          type="text"
          value={newValue}
          onChange={e => setNewValue(e.target.value)}
          placeholder="Specification Value (e.g. 48V DC)"
          className="w-full sm:flex-1 min-h-[40px] px-3 py-2 rounded-xl border border-slate-300 text-xs sm:text-sm bg-white"
        />
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={handleAdd}
          disabled={disabled || !newKey.trim()}
          className="w-full sm:w-auto text-xs shrink-0 font-bold"
        >
          <Plus className="w-3.5 h-3.5 mr-1" />
          Add Spec
        </Button>
      </div>

      {/* Quick Add Presets */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mr-1">
            Quick suggestions:
          </span>
          {commonPresets
            .filter(preset => !(preset in (specs || {})))
            .slice(0, 6)
            .map(preset => (
              <button
                key={preset}
                type="button"
                onClick={() => setNewKey(preset)}
                className="text-[11px] px-2 py-0.5 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium"
              >
                + {preset}
              </button>
            ))}
        </div>
        {entries.length > 0 && (
          <button
            type="button"
            onClick={() => onChange({})}
            className="text-[11px] font-semibold text-red-600 hover:underline"
          >
            Clear all specs
          </button>
        )}
      </div>
    </div>
  );
}
