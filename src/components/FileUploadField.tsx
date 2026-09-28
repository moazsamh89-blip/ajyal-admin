import React, { useRef, useState } from 'react';
import { Upload, CheckCircle2, RefreshCw, FileText, ExternalLink } from 'lucide-react';

interface FileUploadFieldProps {
  value: string;
  onChange: (url: string) => void;
  disabled?: boolean;
}

export const FileUploadField: React.FC<FileUploadFieldProps> = ({
  value,
  onChange,
  disabled = false,
}) => {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const serverUrl = 'http://localhost:4000'; // عنوان خادم التخزين السحابي TaaS

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    e.target.value = '';
    setError(null);
    setUploading(true);
    setProgress(0);

    const formData = new FormData();
    formData.append('file', file);

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
          if (res.success && (res.channelUrl || res.streamUrl)) {
            // نفضل رابط المنشور المباشر في القناة العامة t.me/agyajk/<id> أو رابط البث
            const finalUrl = res.channelUrl || `${serverUrl}${res.streamUrl}`;
            onChange(finalUrl);
          } else {
            setError(res.error || 'فشل استلام رابط الملف من تليجرام.');
          }
        } catch {
          setError('فشل قراءة استجابة الخادم.');
        }
      } else {
        setError(`فشل الرفع إلى خادم التخزين (كود ${xhr.status}). تأكد من تشغيل taas-server.`);
      }
    };

    xhr.onerror = () => {
      setUploading(false);
      setError('تعذر الاتصال بخادم التخزين (TaaS). تأكد من تشغيله على المنفذ 4000.');
    };

    xhr.send(formData);
  };

  return (
    <div style={{ marginTop: '8px', marginBottom: '12px' }}>
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.epub,.zip,.cbz,.cbr,application/pdf"
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
            padding: '9px 18px',
            borderRadius: '8px',
            background: uploading ? '#475569' : '#14213d',
            color: '#fca311',
            border: '1.5px solid #fca311',
            fontSize: '0.86rem',
            fontWeight: 700,
            cursor: disabled || uploading ? 'not-allowed' : 'pointer',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
            transition: 'all 0.18s ease',
          }}
          title="رفع ملف PDF أو الرواية أو المانجا كاملاً إلى السحابة المفتوحة (TaaS)"
        >
          {uploading ? (
            <>
              <RefreshCw className="spin" size={16} />
              <span>جارٍ الرفع ({progress}%)...</span>
            </>
          ) : (
            <>
              <Upload size={16} />
              <FileText size={16} />
              <span>رفع ملف المانجا / الرواية (PDF) كاملاً للسحابة</span>
            </>
          )}
        </button>

        {value && (
          <a
            href={value}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              borderRadius: '8px',
              background: '#f8fafc',
              color: '#0f172a',
              border: '1px solid #cbd5e1',
              fontSize: '0.82rem',
              fontWeight: 600,
              textDecoration: 'none',
            }}
          >
            <ExternalLink size={14} color="#0284c7" />
            <span>فتح ومعاينة الملف المرفوع</span>
          </a>
        )}
      </div>

      {/* شريط التقدم 0% - 100% */}
      {uploading && (
        <div style={{ marginTop: '10px', background: '#0a1120', padding: '10px 14px', borderRadius: '8px', border: '1px solid #fca311' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: '#fca311', marginBottom: '6px', fontWeight: 600 }}>
            <span>جارٍ ضخ ملف الـ PDF إلى السحابة بحجم مفتوح...</span>
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
          <span>تم ربط ملف القراءة بنجاح:</span>
          <span style={{ direction: 'ltr', color: '#0f172a', fontWeight: 600, maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {value}
          </span>
        </div>
      )}
    </div>
  );
};
