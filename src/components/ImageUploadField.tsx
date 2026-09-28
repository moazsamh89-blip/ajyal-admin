import React, { useRef, useState } from 'react';
import { CheckCircle2, Loader2, Upload } from 'lucide-react';
import { uploadImageToImgBB } from '../services/imgbbService';

interface ImageUploadFieldProps {
  value: string;
  onChange: (url: string) => void;
  disabled?: boolean;
}

export const ImageUploadField: React.FC<ImageUploadFieldProps> = ({
  value,
  onChange,
  disabled = false,
}) => {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [justUploaded, setJustUploaded] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Reset input so the user can re-select the same file if needed
    event.target.value = '';

    setUploading(true);
    setError(null);
    setJustUploaded(false);

    try {
      const url = await uploadImageToImgBB(file);
      onChange(url);
      setJustUploaded(true);
      setTimeout(() => setJustUploaded(false), 3500);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('حدث خطأ أثناء رفع الصورة.');
      }
    } finally {
      setUploading(false);
    }
  };

  const triggerSelect = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="imgbb-upload-container" style={{ marginTop: '6px', marginBottom: '8px' }}>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        style={{ display: 'none' }}
        onChange={handleFileChange}
        disabled={disabled || uploading}
      />

      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={triggerSelect}
          disabled={disabled || uploading}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '7px 14px',
            borderRadius: '6px',
            background: uploading ? '#cbd5e1' : '#2563eb',
            color: '#fff',
            border: 'none',
            fontSize: '0.85rem',
            fontWeight: 600,
            cursor: disabled || uploading ? 'not-allowed' : 'pointer',
            transition: 'background 0.2s',
          }}
          title="اختر صورة من جهازك لرفعها مباشرة"
        >
          {uploading ? (
            <>
              <Loader2 className="spin" size={16} />
              <span>جارٍ رفع الصورة...</span>
            </>
          ) : (
            <>
              <Upload size={16} />
              <span>رفع صورة مباشرة</span>
            </>
          )}
        </button>

        {justUploaded && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#16a34a', fontSize: '0.82rem', fontWeight: 600 }}>
            <CheckCircle2 size={16} />
            تم الرفع بنجاح ووضع الرابط تلقائيًا!
          </span>
        )}

        {error && (
          <span style={{ color: '#dc2626', fontSize: '0.82rem', fontWeight: 500 }}>
            ⚠️ {error}
          </span>
        )}
      </div>

      {value && value.trim().length > 0 && (
        <div style={{ marginTop: '6px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '0.75rem', color: '#64748b' }}>الرابط الحالي:</span>
          <a
            href={value}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              fontSize: '0.78rem',
              color: '#2563eb',
              textDecoration: 'underline',
              maxWidth: '320px',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              display: 'inline-block',
              direction: 'ltr',
            }}
          >
            {value}
          </a>
        </div>
      )}
    </div>
  );
};
