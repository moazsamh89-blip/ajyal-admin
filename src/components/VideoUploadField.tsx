import React, { useRef, useState } from 'react';
import { Upload, CheckCircle2, RefreshCw, Play } from 'lucide-react';
import { VideoPlayer } from './VideoPlayer';

interface VideoUploadFieldProps {
  value: string;
  onChange: (url: string) => void;
  disabled?: boolean;
}

export const VideoUploadField: React.FC<VideoUploadFieldProps> = ({
  value,
  onChange,
  disabled = false,
}) => {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const serverUrl = 'http://localhost:4000'; // عنوان خادم بث تليجرام المحلي

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    e.target.value = '';
    setError(null);
    setUploading(true);
    setProgress(0);

    const formData = new FormData();
    formData.append('video', file);

    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${serverUrl}/api/upload`);

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        const percent = Math.round((event.loaded / event.total) * 100);
        setProgress(percent);
      }
    };

    xhr.onload = () => {
      setUploading(false);
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const res = JSON.parse(xhr.responseText);
          if (res.success && res.streamUrl) {
            const fullStreamUrl = `${serverUrl}${res.streamUrl}`;
            onChange(fullStreamUrl);
          } else {
            setError(res.error || 'فشل استلام رابط البث من تليجرام.');
          }
        } catch {
          setError('فشل قراءة استجابة الخادم.');
        }
      } else {
        setError(`فشل الرفع إلى خادم تليجرام (كود ${xhr.status}). تأكد من تشغيل taas-server.`);
      }
    };

    xhr.onerror = () => {
      setUploading(false);
      setError('تعذر الاتصال بخادم تليجرام (TaaS Server). تأكد من تشغيله على المنفذ 4000.');
    };

    xhr.send(formData);
  };

  return (
    <div style={{ marginTop: '6px', marginBottom: '10px' }}>
      <input
        ref={fileInputRef}
        type="file"
        accept="video/mp4,video/webm,video/x-matroska,video/quicktime"
        style={{ display: 'none' }}
        onChange={handleFileChange}
        disabled={disabled || uploading}
      />

      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled || uploading}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 16px',
            borderRadius: '8px',
            background: uploading ? '#475569' : '#071914',
            color: '#fca311',
            border: '1px solid #fca311',
            fontSize: '0.85rem',
            fontWeight: 700,
            cursor: disabled || uploading ? 'not-allowed' : 'pointer',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          }}
          title="رفع فيديو الحلقة مباشرة إلى سحابة تليجرام (TaaS)"
        >
          {uploading ? (
            <>
              <RefreshCw className="spin" size={16} />
              <span>جارٍ الرفع ({progress}%)...</span>
            </>
          ) : (
            <>
              <Upload size={16} />
              <span>رفع فيديو لسحابة تليجرام (TaaS)</span>
            </>
          )}
        </button>

        {value && !uploading && (
          <button
            type="button"
            onClick={() => setShowPreview(!showPreview)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '7px 12px',
              borderRadius: '8px',
              background: '#14213d',
              color: '#fff',
              border: 'none',
              fontSize: '0.82rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            <Play size={14} fill="#fca311" color="#fca311" />
            {showPreview ? 'إخفاء المعاينة' : 'معاينة بالمشغل الفاخر'}
          </button>
        )}
      </div>

      {/* شريط التقدم الحي 0% - 100% */}
      {uploading && (
        <div style={{ marginTop: '10px', background: '#0a1120', padding: '10px 14px', borderRadius: '8px', border: '1px solid #fca311' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: '#fca311', marginBottom: '6px', fontWeight: 600 }}>
            <span>جارٍ ضخ الفيديو لسيرفرات تليجرام السحابية...</span>
            <span>{progress}%</span>
          </div>
          <div style={{ width: '100%', height: '8px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px', overflow: 'hidden' }}>
            <div
              style={{
                width: `${progress}%`,
                height: '100%',
                background: 'linear-gradient(90deg, #fca311, #2ec4b6)',
                transition: 'width 0.2s ease',
              }}
            />
          </div>
        </div>
      )}

      {error && (
        <div style={{ marginTop: '8px', color: '#ef4444', fontSize: '0.82rem', fontWeight: 600 }}>
          ⚠️ {error}
        </div>
      )}

      {value && !uploading && (
        <div style={{ marginTop: '6px', display: 'flex', alignItems: 'center', gap: '6px', color: '#16a34a', fontSize: '0.82rem' }}>
          <CheckCircle2 size={16} />
          <span>تم ربط رابط البث بنجاح:</span>
          <span style={{ direction: 'ltr', color: '#0f172a', fontWeight: 600, maxWidth: '280px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {value}
          </span>
        </div>
      )}

      {/* معاينة الفيديو بالمشغل الفاخر */}
      {showPreview && value && (
        <div style={{ marginTop: '14px', maxWidth: '640px' }}>
          <VideoPlayer src={value} title="معاينة الفيديو" />
        </div>
      )}
    </div>
  );
};
