import { useState } from 'react';
import { CheckCircle2, Loader2, RefreshCw, ShieldCheck, Flame, ExternalLink } from 'lucide-react';
import { firebaseConfig, testFirebaseConnection } from '../services/firebaseClient';

interface ConnectionPanelProps {
  isLoggedIn: boolean;
  onMessage: (message: string) => void;
}

export function ConnectionPanel({ onMessage }: ConnectionPanelProps) {
  const [testing, setTesting] = useState(false);
  const [testOk, setTestOk] = useState<boolean | null>(null);
  const [errorDetails, setErrorDetails] = useState<string | null>(null);

  const handleTest = async () => {
    setTesting(true);
    setTestOk(null);
    setErrorDetails(null);

    const result = await testFirebaseConnection();
    setTesting(false);

    if (result.ok) {
      setTestOk(true);
      onMessage('الاتصال ناجح — تم التحقق من الوصول إلى قاعدة بيانات Cloud Firestore.');
    } else {
      setTestOk(false);
      setErrorDetails(result.error || 'فشل الاتصال');
      onMessage(`فشل الاتصال: ${result.error}`);
    }
  };

  return (
    <section className="connection-panel" style={{ maxWidth: '800px', margin: '0 auto', display: 'grid', gap: '20px' }}>
      <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '24px', boxShadow: '0 4px 12px rgba(0,0,0,0.04)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px', borderBottom: '1px solid #f1f5f9', paddingBottom: '14px' }}>
          <div style={{ background: '#fef3c7', padding: '10px', borderRadius: '10px', color: '#d97706' }}>
            <Flame size={24} />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.25rem', color: '#0f172a' }}>حالة الاتصال بـ Firebase</h3>
            <p style={{ margin: '4px 0 0', fontSize: '0.85rem', color: '#64748b' }}>
              مشروع Firebase الأساسي المتصل بقاعدة بيانات Cloud Firestore ونظام المصادقة.
            </p>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px', marginBottom: '20px' }}>
          <div style={{ background: '#f8fafc', padding: '14px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
            <span style={{ fontSize: '0.78rem', color: '#64748b', display: 'block' }}>معرف المشروع (Project ID)</span>
            <strong style={{ fontSize: '0.95rem', color: '#0f172a', direction: 'ltr', display: 'inline-block' }}>{firebaseConfig.projectId}</strong>
          </div>
          <div style={{ background: '#f8fafc', padding: '14px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
            <span style={{ fontSize: '0.78rem', color: '#64748b', display: 'block' }}>نطاق المصادقة (Auth Domain)</span>
            <strong style={{ fontSize: '0.92rem', color: '#0f172a', direction: 'ltr', display: 'inline-block' }}>{firebaseConfig.authDomain}</strong>
          </div>
          <div style={{ background: '#f8fafc', padding: '14px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
            <span style={{ fontSize: '0.78rem', color: '#64748b', display: 'block' }}>حاوية التخزين (Storage Bucket)</span>
            <strong style={{ fontSize: '0.92rem', color: '#0f172a', direction: 'ltr', display: 'inline-block' }}>{firebaseConfig.storageBucket}</strong>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={handleTest}
            disabled={testing}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 20px',
              borderRadius: '8px',
              background: '#0f172a',
              color: '#fff',
              border: 'none',
              cursor: testing ? 'not-allowed' : 'pointer',
              fontWeight: 600,
              fontSize: '0.9rem',
            }}
          >
            {testing ? <Loader2 className="spin" size={18} /> : <RefreshCw size={18} />}
            {testing ? 'جارٍ اختبار الاتصال...' : 'اختبار الاتصال بقاعدة البيانات'}
          </button>

          <a
            href="https://console.firebase.google.com/project/agyal-al-eyman/firestore"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '10px 18px',
              borderRadius: '8px',
              background: '#f1f5f9',
              color: '#334155',
              textDecoration: 'none',
              fontWeight: 600,
              fontSize: '0.88rem',
            }}
          >
            <ExternalLink size={16} />
            فتح Firebase Console
          </a>
        </div>

        {testOk === true && (
          <div style={{ marginTop: '16px', padding: '12px 16px', borderRadius: '8px', background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#166534', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <CheckCircle2 size={20} />
            <span>الاتصال بقاعدة بيانات Cloud Firestore يعمل بكفاءة وبشكل سليم 100%.</span>
          </div>
        )}

        {testOk === false && (
          <div style={{ marginTop: '16px', padding: '14px 16px', borderRadius: '8px', background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b' }}>
            <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>⚠️ تعذر الوصول إلى Cloud Firestore:</div>
            <div style={{ fontSize: '0.88rem' }}>{errorDetails}</div>
            <div style={{ fontSize: '0.8rem', marginTop: '8px', color: '#b91c1c' }}>
              💡 نصيحة: ادخل إلى Firebase Console ← Firestore Database ← تيقن من تفعيل Firestore، وفي تبويب Rules تأكد من السماح بالقراءة والكتابة.
            </div>
          </div>
        )}
      </div>

      <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '24px' }}>
        <h4 style={{ margin: '0 0 12px', fontSize: '1rem', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <ShieldCheck size={20} color="#2563eb" />
          قواعد الأمان المقترحة لـ Firestore (Firestore Security Rules):
        </h4>
        <p style={{ margin: '0 0 10px', fontSize: '0.85rem', color: '#475569', lineHeight: 1.6 }}>
          يمكنك نسخ هذه القواعد ووضعها في تبويب <strong>Rules</strong> في Firebase Console لتمكين القراءة للزوار والكتابة للمشرفين المعتمدين:
        </p>
        <pre style={{ background: '#0f172a', color: '#e2e8f0', padding: '16px', borderRadius: '8px', fontSize: '0.82rem', direction: 'ltr', overflowX: 'auto', lineHeight: 1.5 }}>
{`rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // قراءة عامة للجميع، وكتابة فقط للمستخدم المسجل في Firebase Authentication
    match /{document=**} {
      allow read: if true;
      allow write: if request.auth != null;
    }
  }
}`}
        </pre>
      </div>
    </section>
  );
}
