import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import {
  initializeFirestore,
  getFirestore,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  query,
  where,
  getCountFromServer,
  type Firestore,
  type DocumentData,
} from 'firebase/firestore';
import {
  getAuth,
  type Auth,
  type User,
} from 'firebase/auth';

export const firebaseConfig = {
  apiKey: 'AIzaSyDZ6H5PUnpweaCBdULQjthWtJJufOOG4V0',
  authDomain: 'agyal-al-eyman.firebaseapp.com',
  projectId: 'agyal-al-eyman',
  storageBucket: 'agyal-al-eyman.firebasestorage.app',
  messagingSenderId: '1049590642539',
  appId: '1:1049590642539:web:8d9de733adaee88a21fe2e',
  measurementId: 'G-2XR7L234B6',
};

// تهيئة تطبيق Firebase (مرة واحدة)
export const app: FirebaseApp = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const auth: Auth = getAuth(app);
export const db: Firestore = (() => {
  try {
    return initializeFirestore(app, {
      experimentalAutoDetectLongPolling: true,
    });
  } catch {
    return getFirestore(app);
  }
})();

export interface AdminProfile {
  id: string;
  email: string;
  username: string;
  role: 'super_admin' | 'admin';
  permissions: string[];
  is_active: boolean;
}

/**
 * تحويل أخطاء Firebase إلى رسائل واضحة ومفهومة باللغة العربية
 */
export function formatFirebaseError(error: unknown, fallback: string): string {
  if (!error) return fallback;
  const msg = error instanceof Error ? error.message : String(error);

  if (msg.includes('auth/invalid-credential') || msg.includes('auth/wrong-password')) {
    return 'البريد الإلكتروني أو كلمة المرور غير صحيحة.';
  }
  if (msg.includes('auth/user-not-found')) {
    return 'لا يوجد حساب بهذا البريد الإلكتروني في Firebase Authentication.';
  }
  if (msg.includes('auth/too-many-requests')) {
    return 'تم حظر المحاولات مؤقتًا لكثرة المحاولات الخاطئة. يرجى المحاولة لاحقًا.';
  }
  if (msg.includes('auth/network-request-failed')) {
    return 'تعذر الاتصال بخوادم Firebase. تحقق من اتصال الإنترنت.';
  }
  if (msg.includes('permission-denied') || msg.includes('PERMISSION_DENIED')) {
    return 'تم رفض الوصول (Security Rules). تأكد من ضبط قواعد Firestore لتسمح بالقراءة والكتابة.';
  }
  if (msg.includes('unavailable')) {
    return 'خدمة Firestore غير متاحة حالياً. تأكد من تفعيل Firestore في Firebase Console.';
  }

  return msg || fallback;
}

/**
 * التحقق من صلاحيات المشرف
 * إذا كانت قاعدة البيانات جديدة ولا تحتوي على أي مشرفين إطلاقاً،
 * يتم تسجيل أول مستخدم مسجل في Firebase كمدير عام (Super Admin) تلقائياً لتفادي القفل.
 */
export async function verifyAdminStatus(user: User): Promise<{
  allowed: boolean;
  profile?: AdminProfile;
  error?: string;
}> {
  try {
    const adminsCol = collection(db, 'admins');

    // 1) فحص الوثيقة بالـ UID مباشرة
    const directDoc = await getDoc(doc(db, 'admins', user.uid));
    if (directDoc.exists()) {
      const data = directDoc.data() as DocumentData;
      if (data.is_active === false) {
        return { allowed: false, error: 'هذا الحساب معطل من قبل الإدارة.' };
      }
      return {
        allowed: true,
        profile: {
          id: directDoc.id,
          email: String(data.email || user.email || ''),
          username: String(data.username || user.displayName || user.email?.split('@')[0] || 'مشرف'),
          role: (data.role as 'super_admin' | 'admin') || 'admin',
          permissions: Array.isArray(data.permissions)
            ? data.permissions
            : typeof data.permissions === 'string'
              ? data.permissions.split(',').map((p: string) => p.trim())
              : ['general'],
          is_active: data.is_active !== false,
        },
      };
    }

    // 2) فحص بالبريد الإلكتروني
    if (user.email) {
      const q = query(adminsCol, where('email', '==', user.email.trim()));
      const snap = await getDocs(q);
      if (!snap.empty) {
        const found = snap.docs[0];
        const data = found.data();
        if (data.is_active === false) {
          return { allowed: false, error: 'هذا الحساب معطل من قبل الإدارة.' };
        }
        return {
          allowed: true,
          profile: {
            id: found.id,
            email: String(data.email || user.email),
            username: String(data.username || user.displayName || 'مشرف'),
            role: (data.role as 'super_admin' | 'admin') || 'admin',
            permissions: Array.isArray(data.permissions)
              ? data.permissions
              : typeof data.permissions === 'string'
                ? data.permissions.split(',').map((p: string) => p.trim())
                : ['general'],
            is_active: data.is_active !== false,
          },
        };
      }
    }

    // 3) فحص هل جدول المشرفين فارغ تماماً؟
    const totalAdminsCountSnap = await getCountFromServer(adminsCol);
    const count = totalAdminsCountSnap.data().count;

    if (count === 0) {
      // قاعدة بيانات جديدة: ننشئ أول مشرف كمدير عام تلقائياً
      const firstAdminData: AdminProfile = {
        id: user.uid,
        email: user.email || '',
        username: user.displayName || user.email?.split('@')[0] || 'المدير العام',
        role: 'super_admin',
        permissions: ['general', 'courses', 'children', 'teens'],
        is_active: true,
      };

      await setDoc(doc(db, 'admins', user.uid), {
        ...firstAdminData,
        created_at: new Date().toISOString(),
      });

      return {
        allowed: true,
        profile: firstAdminData,
      };
    }

    return {
      allowed: false,
      error: 'هذا البريد غير مدرج في قائمة المشرفين المعتمدين (admins).',
    };
  } catch (err: unknown) {
    return {
      allowed: false,
      error: formatFirebaseError(err, 'تعذر التحقق من صلاحيات المشرف.'),
    };
  }
}

/**
 * اختبار الاتصال بـ Firestore
 */
export async function testFirebaseConnection(): Promise<{ ok: boolean; error?: string }> {
  try {
    await getCountFromServer(collection(db, 'covers'));
    return { ok: true };
  } catch (err: unknown) {
    return {
      ok: false,
      error: formatFirebaseError(err, 'تعذر الاتصال بـ Firestore. تأكد من تفعيل قواعد القراءة.'),
    };
  }
}
