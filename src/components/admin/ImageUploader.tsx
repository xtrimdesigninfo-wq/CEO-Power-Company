import React, { useRef, useState } from 'react';
import { UploadCloud, X, Star, ArrowLeft, ArrowRight, Loader2, Image as ImageIcon } from 'lucide-react';
import { dataService } from '../../services/dataService';
import { useToast } from '../ui/Toast';

export interface ImageUploaderProps {
  images: string[];
  onChange: (images: string[]) => void;
  maxImages?: number;
  inputId?: string;
  dropzoneTitle?: string;
  dropzoneSubtitle?: string;
  mainBadgeLabel?: string | null;
  showSetMain?: boolean;
}

export function ImageUploader({
  images,
  onChange,
  maxImages = 6,
  inputId = 'product-image-file-input',
  dropzoneTitle = 'Tap or Drag photos here from phone gallery, camera, or laptop',
  dropzoneSubtitle = 'JPG, PNG, or WebP. Auto-compressed to max 1600px WebP (max 5MB limit).',
  mainBadgeLabel = 'Main Photo',
  showSetMain = true,
}: ImageUploaderProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { error: toastError, success: toastSuccess } = useToast();

  const limitReached = images.length >= maxImages;

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    if (images.length + files.length > maxImages) {
      toastError(
        maxImages === 1
          ? 'Only 1 image can be uploaded here. Remove the current image first to replace it.'
          : `You can upload a maximum of ${maxImages} images.`
      );
      return;
    }

    setIsUploading(true);
    try {
      const uploadedUrls: string[] = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
          toastError(`"${file.name}" is not an accepted format. Only JPG, PNG, and WebP are allowed.`);
          continue;
        }

        const url = await dataService.uploadProductImage(file);
        uploadedUrls.push(url);
      }

      if (uploadedUrls.length > 0) {
        onChange([...images, ...uploadedUrls].slice(0, maxImages));
        toastSuccess(`Successfully uploaded ${uploadedUrls.length} image(s).`);
      }
    } catch (err: any) {
      console.error('Upload failed:', err);
      toastError(err.message || 'Failed to upload images.');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRemove = (index: number) => {
    const next = [...images];
    next.splice(index, 1);
    onChange(next);
  };

  const handleSetMain = (index: number) => {
    if (index === 0) return;
    const next = [...images];
    const [selected] = next.splice(index, 1);
    next.unshift(selected);
    onChange(next);
  };

  const handleMove = (index: number, direction: 'left' | 'right') => {
    const targetIndex = direction === 'left' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= images.length) return;
    const next = [...images];
    const temp = next[index];
    next[index] = next[targetIndex];
    next[targetIndex] = temp;
    onChange(next);
  };

  return (
    <div className="space-y-3">
      {/* Hidden Native File Input accepting camera or gallery */}
      <input
        ref={fileInputRef}
        type="file"
        multiple={maxImages > 1}
        accept="image/jpeg,image/png,image/webp"
        capture="environment"
        onChange={e => handleFiles(e.target.files)}
        className="hidden"
        id={inputId}
      />

      {/* Upload Dropzone (hidden when maxImages reached) */}
      {!limitReached ? (
        <div
          onDragOver={e => {
            e.preventDefault();
            setDragActive(true);
          }}
          onDragLeave={() => setDragActive(false)}
          onDrop={e => {
            e.preventDefault();
            setDragActive(false);
            handleFiles(e.dataTransfer.files);
          }}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-2xl p-5 text-center transition-all cursor-pointer ${
            dragActive
              ? 'border-[#F5A623] bg-amber-50/50'
              : 'border-slate-300 hover:border-[#187004] bg-slate-50/50 hover:bg-white'
          }`}
        >
          <div className="flex flex-col items-center justify-center space-y-2">
            {isUploading ? (
              <>
                <Loader2 className="w-7 h-7 text-[#187004] animate-spin" />
                <p className="text-xs font-semibold text-slate-700">
                  Compressing to WebP & uploading...
                </p>
              </>
            ) : (
              <>
                <div className="w-11 h-11 rounded-2xl bg-white shadow-xs border border-slate-200 flex items-center justify-center text-[#187004]">
                  <UploadCloud className="w-5 h-5 text-[#187004]" />
                </div>
                <div>
                  <p className="text-xs sm:text-sm font-bold text-slate-800">
                    {dropzoneTitle}
                  </p>
                  <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5">
                    {dropzoneSubtitle}
                  </p>
                </div>
              </>
            )}
          </div>
        </div>
      ) : (
        <div className="px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 flex items-center justify-between gap-2">
          <span>
            Maximum of <strong>{maxImages}</strong> {maxImages === 1 ? 'image' : 'images'} uploaded. Remove {maxImages === 1 ? 'it' : 'one'} below to replace.
          </span>
        </div>
      )}

      {/* Image Previews / Management Grid */}
      {images.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 pt-1">
          {images.map((url, idx) => {
            const isMain = idx === 0 && Boolean(mainBadgeLabel);
            return (
              <div
                key={url + idx}
                className={`relative rounded-xl overflow-hidden border-2 bg-slate-100 aspect-square group shadow-xs ${
                  isMain ? 'border-[#F5A623] ring-2 ring-[#F5A623]/20' : 'border-slate-200'
                }`}
              >
                <img src={url} alt={`Product ${idx + 1}`} className="w-full h-full object-cover" />

                {/* Main / Featured badge */}
                {isMain && mainBadgeLabel && (
                  <span className="absolute top-2 left-2 px-2 py-0.5 bg-[#F5A623] text-slate-950 text-[10px] font-black rounded uppercase shadow-sm">
                    {mainBadgeLabel}
                  </span>
                )}

                {/* Hover / Touch Action Controls */}
                <div className="absolute inset-0 bg-slate-900/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-between p-2">
                  <div className="flex items-center justify-between">
                    {showSetMain && idx !== 0 && (
                      <button
                        type="button"
                        onClick={e => {
                          e.stopPropagation();
                          handleSetMain(idx);
                        }}
                        title="Set as Main Photo"
                        className="p-1 rounded bg-white text-slate-950 hover:bg-[#F5A623] text-xs font-bold flex items-center gap-1 shadow-xs"
                      >
                        <Star className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={e => {
                        e.stopPropagation();
                        handleRemove(idx);
                      }}
                      title="Delete photo"
                      className="ml-auto p-1 rounded bg-red-600 text-white hover:bg-red-700 shadow-xs"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Reorder Buttons */}
                  <div className="flex items-center justify-between pt-2">
                    <button
                      type="button"
                      disabled={idx === 0}
                      onClick={e => {
                        e.stopPropagation();
                        handleMove(idx, 'left');
                      }}
                      className="p-1 rounded bg-white/80 hover:bg-white text-slate-800 disabled:opacity-30"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      disabled={idx === images.length - 1}
                      onClick={e => {
                        e.stopPropagation();
                        handleMove(idx, 'right');
                      }}
                      className="p-1 rounded bg-white/80 hover:bg-white text-slate-800 disabled:opacity-30"
                    >
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
