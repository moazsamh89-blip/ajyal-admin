export const IMGBB_API_KEY = '1df3f3dda578c5014805a166524107b4';
export const IMGBB_UPLOAD_URL = 'https://api.imgbb.com/1/upload';

export interface ImgBBUploadResponse {
  data: {
    id: string;
    title: string;
    url_viewer: string;
    url: string;
    display_url: string;
    width: string | number;
    height: string | number;
    size: number;
    time: string;
    expiration: string;
    image: {
      filename: string;
      name: string;
      mime: string;
      extension: string;
      url: string;
    };
    thumb?: {
      filename: string;
      name: string;
      mime: string;
      extension: string;
      url: string;
    };
    delete_url: string;
  };
  success: boolean;
  status: number;
}

/**
 * يرفع صورة إلى خدمة ImgBB ويعيد الرابط المباشر للصورة.
 * @param file ملف الصورة المراد رفعه
 * @returns رابط الصورة المباشر (Direct URL)
 */
export async function uploadImageToImgBB(file: File): Promise<string> {
  if (!file) {
    throw new Error('لم يتم تحديد أي ملف للرفع.');
  }

  // فحص نوع الملف
  if (!file.type.startsWith('image/')) {
    throw new Error('الملف المحدد ليس صورة صالحة. يرجى اختيار ملف صورة (JPG, PNG, WebP, GIF).');
  }

  // الحد الأقصى لحجم الصورة في ImgBB هو 32MB
  const maxSizeBytes = 32 * 1024 * 1024;
  if (file.size > maxSizeBytes) {
    throw new Error('حجم الصورة كبير جدًا. الحد الأقصى المسموح به هو 32 ميجابايت.');
  }

  const formData = new FormData();
  formData.append('key', IMGBB_API_KEY);
  formData.append('image', file);

  try {
    const response = await fetch(IMGBB_UPLOAD_URL, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const errText = await response.text();
      let errorMsg = `فشل الرفع (كود ${response.status})`;
      try {
        const parsed = JSON.parse(errText);
        if (parsed.error && parsed.error.message) {
          errorMsg = parsed.error.message;
        }
      } catch {
        // use fallback errorMsg
      }
      throw new Error(errorMsg);
    }

    const result: ImgBBUploadResponse = await response.json();
    if (!result.success || !result.data) {
      throw new Error('فشل الرفع من خادم ImgBB.');
    }

    // نفضل الرابط المباشر data.url أو data.display_url
    return result.data.url || result.data.display_url;
  } catch (error: unknown) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('حدث خطأ غير متوقع أثناء رفع الصورة إلى ImgBB.', { cause: error });
  }
}
