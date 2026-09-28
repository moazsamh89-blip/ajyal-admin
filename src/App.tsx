/* eslint-disable react-hooks/set-state-in-effect */
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  Clapperboard,
  ClipboardList,
  Edit3,
  Film,
  Flame,
  Gamepad2,
  GraduationCap,
  HelpCircle,
  Image,
  Loader2,
  LogIn,
  LogOut,
  RefreshCw,
  Save,
  Settings,
  ShieldCheck,
  Sparkles,
  Trash2,
  UserCheck,
  Users,
  UserX,
  UserPlus,
} from 'lucide-react'
import {
  auth,
  db,
  formatFirebaseError,
  verifyAdminStatus,
} from './services/firebaseClient'
import {
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut as firebaseSignOut,
  onAuthStateChanged,
} from 'firebase/auth'
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  getCountFromServer,
} from 'firebase/firestore'
import { ConnectionPanel } from './components/ConnectionPanel'
import { ImageUploadField } from './components/ImageUploadField'
import { VideoUploadField } from './components/VideoUploadField'
import { FileUploadField } from './components/FileUploadField'
import logo from './assets/logo.png'
import './App.css'

type ContentTable =
  | 'covers'
  | 'books'
  | 'anime_shows'
  | 'episodes'
  | 'courses'
  | 'games'
  | 'cartoon_stories'
  | 'religious_content'
  | 'volunteer_fields'
  | 'volunteer_submissions'
  | 'staff_members'
  | 'system_errors'
  | 'category_settings'
  | 'admins'
  | 'app_settings'

type ActiveSection = ContentTable | 'connection'

type FieldType = 'text' | 'textarea' | 'select' | 'number' | 'boolean' | 'cover_select' | 'checkbox_group'

export interface CreatorEntry {
  name: string
  role?: string
  id?: string
}

type RowValue = string | number | boolean | string[] | CreatorEntry[] | Record<string, unknown> | null
type RowData = Record<string, RowValue>

const isCreatorEntry = (value: unknown): value is CreatorEntry => (
  typeof value === 'object' && value !== null && !Array.isArray(value) && 'name' in value
)

interface FieldConfig {
  key: string
  label: string
  type?: FieldType
  options?: Array<{ value: string; label: string }>
  /** For cover_select: filter covers by this section_type */
  coverFilter?: string
  /** Small helper text shown under the field */
  hint?: string
}

interface TableConfig {
  key: ContentTable
  title: string
  description: string
  icon: typeof BookOpen
  fields: FieldConfig[]
}

const categoryOptions = [
  { value: 'children', label: 'الأطفال' },
  { value: 'teens', label: 'المراهقين' },
  { value: 'adults', label: 'الكبار' },
]

const audienceOptions = categoryOptions.slice(0, 2)

const bookTypeOptions = [
  { value: 'manga', label: 'مانجا' },
  { value: 'novel', label: 'روايات' },
]

const statusOptions = [
  { value: 'ongoing', label: 'مستمر' },
  { value: 'completed', label: 'مكتمل' },
]

const mangaTypeOptions = [
  { value: 'manga', label: 'مانجا (Manga)' },
  { value: 'manhwa', label: 'مانهوا كورية (Manhwa)' },
  { value: 'manhua', label: 'مانها صينية (Manhua)' },
  { value: 'webtoon', label: 'ويب تون (Webtoon)' },
]

const novelTypeOptions = [
  { value: 'novel', label: 'رواية (Novel)' },
  { value: 'light_novel', label: 'لايت نوفل (Light Novel)' },
]

const showTypeOptions = [
  { value: 'anime', label: 'أنمي' },
  { value: 'cartoon', label: 'كرتون' },
]

const contentTypeOptions = [
  { value: 'video', label: 'فيديو' },
  { value: 'audio', label: 'صوت' },
  { value: 'article', label: 'مقال' },
]

const roleOptions = [
  { value: 'super_admin', label: 'مدير عام' },
  { value: 'admin', label: 'مشرف' },
]

const sectionTypeOptions = [
  { value: 'books', label: 'المانجا والروايات' },
  { value: 'anime', label: 'أنمي' },
  { value: 'cartoon', label: 'كرتون' },
  { value: 'courses', label: 'الكورسات' },
  { value: 'cartoon_stories', label: 'القصص الكرتونية' },
  { value: 'religious_content', label: 'المحتوى الديني' },
]

const targetGenderOptions = [
  { value: 'all', label: 'الجميع (بنين وبنات) 👥' },
  { value: 'boys', label: 'مخصص للبنين فقط (أولاد 👦)' },
  { value: 'girls', label: 'مخصص للبنات فقط (فتيات 👧)' },
]

const volunteerFieldTypeOptions = [
  { value: 'text', label: 'نص قصير (Text)' },
  { value: 'textarea', label: 'نص متعدد الأسطر (Textarea)' },
  { value: 'select', label: 'قائمة اختيار منسدلة (Select)' },
  { value: 'email', label: 'بريد إلكتروني (Email)' },
  { value: 'tel', label: 'رقم هاتف / واتساب (Tel)' },
  { value: 'url', label: 'رابط إلكتروني (URL)' },
]

const configs: TableConfig[] = [
  {
    key: 'covers',
    title: 'الأغلفة',
    description: 'أنشئ الأغلفة أولاً مع صورة الغلاف وتخصيص الجنس (بنين / بنات) ونوع القسم، ثم أضف المحتوى واربطه بالغلاف.',
    icon: Image,
    fields: [
      { key: 'title', label: 'اسم العمل / الغلاف' },
      { key: 'creator_name', label: 'فريق العمل والمبدعون (مع الأدوار)', hint: 'أضف مبدعي هذا العمل وحدد دور كل مبدع (مؤلف، رسام، مترجم، مخرج، مدقق، إلخ) مع إمكانية إضافة أكثر من مبدع' },
      { key: 'target_gender', label: 'تخصيص الجنس (بنين / بنات / الجميع)', type: 'select', options: targetGenderOptions },
      { key: 'section_type', label: 'نوع القسم', type: 'select', options: sectionTypeOptions },
      {
        key: 'cover_url',
        label: 'رابط صورة الغلاف الأساسي',
        hint: 'ارفع الصورة مباشرة بالزر أدناه أو الصق رابطاً مباشراً للصورة.',
      },
      { key: 'description', label: 'وصف الغلاف', type: 'textarea' },
      { key: 'category', label: 'الفئة العمرية (اختر حتى فئتين)', type: 'checkbox_group', options: categoryOptions },
      {
        key: 'cover_children_url',
        label: 'غلاف مخصص للأطفال (اختياري)',
        hint: 'إذا تُرك فارغًا يُستخدم الغلاف الأساسي.',
      },
      {
        key: 'cover_teens_url',
        label: 'غلاف مخصص للمراهقين (اختياري)',
        hint: 'إذا تُرك فارغًا يُستخدم الغلاف الأساسي.',
      },
      {
        key: 'cover_adults_url',
        label: 'غلاف مخصص للكبار (اختياري)',
        hint: 'إذا تُرك فارغًا يُستخدم الغلاف الأساسي.',
      },
    ],
  },
  {
    key: 'books',
    title: 'المانجا والروايات',
    description: 'إدارة مجلدات وفصول المانجا والروايات واللايت نوفل.',
    icon: BookOpen,
    fields: [
      { key: 'cover_id', label: 'اختر الغلاف', type: 'cover_select', coverFilter: 'books' },
      { key: 'title', label: 'العنوان' },
      { key: 'book_type', label: 'التصنيف الرئيسي (مانجا / روايات فقط)', type: 'select', options: bookTypeOptions },
      { key: 'sub_type', label: 'النوع الفرعي', type: 'select', options: [...mangaTypeOptions, ...novelTypeOptions] },
      { key: 'author', label: 'المؤلف' },
      { key: 'artist', label: 'الرسام (للمانجا والويبتون)' },
      { key: 'year', label: 'سنة الإصدار', type: 'number' },
      { key: 'status', label: 'الحالة', type: 'select', options: statusOptions },
      { key: 'chapter_count', label: 'عدد الفصول', type: 'number' },
      { key: 'rating', label: 'التقييم (مثال: 8.9)' },
      { key: 'category', label: 'الفئة', type: 'select', options: categoryOptions },
      { key: 'target_gender', label: 'النسخة المخصصة (بنين / بنات)', type: 'select', options: targetGenderOptions },
      {
        key: 'file_url',
        label: 'رابط ملف الـ PDF (أو رابط أرشيف المباشر)',
        type: 'textarea',
        hint: 'استخدم رابط Internet Archive المباشر (archive.org/download/...) ليعمل في العارض المدمج دون استهلاك سيرفرك',
      },
      {
        key: 'content_text',
        label: 'نص الرواية (للروايات النصية)',
        type: 'textarea',
        hint: 'يمكن كتابة أو لصق نص الفصل هنا للقراءة في عارض الروايات المخصص',
      },
      { key: 'related_works', label: 'معرف الأنمي المقتبس أو الأعمال المرتبطة (Related Works)' },
      { key: 'youtube_url', label: 'رابط يوتيوب تعريفي (اختياري)' },
    ],
  },
  {
    key: 'anime_shows',
    title: 'عروض الأنمي والكرتون',
    description: 'إدارة مواسم الأنمي مع البانر والبيانات التفصيلية والأعمال المرتبطة.',
    icon: Clapperboard,
    fields: [
      { key: 'cover_id', label: 'اختر الغلاف', type: 'cover_select', coverFilter: 'anime,cartoon' },
      { key: 'title', label: 'العنوان باللغة العربية' },
      { key: 'title_en', label: 'العنوان باللغة الإنجليزية' },
      { key: 'title_jp', label: 'العنوان باللغة اليابانية' },
      {
        key: 'banner_url',
        label: 'رابط بانر Hero عريض (خلفية صفحة الأنمي)',
        hint: 'ارفع صورة البانر بزر الرفع (ImgBB) بالأسفل.',
      },
      { key: 'year', label: 'سنة الإصدار', type: 'number' },
      { key: 'status', label: 'حالة العرض', type: 'select', options: statusOptions },
      { key: 'episode_count', label: 'عدد الحلقات', type: 'number' },
      { key: 'rating', label: 'التقييم (من 10)' },
      { key: 'age_rating', label: 'الفئة العمرية (مثال: +13)' },
      { key: 'category', label: 'فئة الجمهور', type: 'select', options: audienceOptions },
      { key: 'show_type', label: 'النوع', type: 'select', options: showTypeOptions },
      { key: 'description', label: 'الوصف والقصة', type: 'textarea' },
      { key: 'related_works', label: 'معرف المانجا أو الرواية الأصلية (Related Works)' },
      { key: 'display_cover', label: 'إظهار الغلاف كمدخل للأنمي', type: 'boolean' },
    ],
  },
  {
    key: 'episodes',
    title: 'حلقات الأنمي والكرتون',
    description: 'إدارة الحلقات مع دعم الرفع المباشر لسحابة تليجرام TaaS ومشغل الفيديو الفاخر.',
    icon: Film,
    fields: [
      { key: 'show_id', label: 'معرّف أو رقم الأنمي' },
      { key: 'title', label: 'عنوان الحلقة' },
      { key: 'episode_number', label: 'رقم الحلقة', type: 'number' },
      {
        key: 'thumbnail',
        label: 'صورة مصغرة للحلقة (Thumbnail)',
        hint: 'ارفع صورة مصغرة للحلقة بزر الرفع (ImgBB) بالأسفل.',
      },
      {
        key: 'video_url',
        label: 'رابط الفيديو (سحابة تليجرام أو مباشر)',
        hint: 'ارفع الفيديو مباشرة لسحابة تليجرام بالزر أدناه أو الصق رابط فيديو مباشر.',
      },
      {
        key: 'external_url',
        label: 'رابط سيرفر احتياطي أو خارجي (اختياري)',
        hint: 'رابط صفحة الفيديو على الموقع الأصلي — يظهر كزر "فتح" احتياطي',
      },
    ],
  },
  {
    key: 'courses',
    title: 'الكورسات',
    description: 'الكورسات عبارة عن أغلفة عند الضغط عليها تفتح رابط مباشر.',
    icon: GraduationCap,
    fields: [
      { key: 'cover_id', label: 'اختر الغلاف', type: 'cover_select', coverFilter: 'courses' },
      { key: 'title', label: 'العنوان' },
      { key: 'description', label: 'الوصف', type: 'textarea' },
      { key: 'course_link', label: 'رابط الكورس المباشر' },
    ],
  },
  {
    key: 'games',
    title: 'الألعاب',
    description: 'أزرار الألعاب وروابطها.',
    icon: Gamepad2,
    fields: [
      { key: 'title', label: 'عنوان الزر (اسم اللعبة)' },
      { key: 'game_url', label: 'رابط اللعبة' },
    ],
  },
  {
    key: 'cartoon_stories',
    title: 'القصص الكرتونية',
    description: 'قصص نصية مع صور وروابط فيديو اختيارية.',
    icon: Sparkles,
    fields: [
      { key: 'cover_id', label: 'اختر الغلاف', type: 'cover_select', coverFilter: 'cartoon_stories' },
      { key: 'title', label: 'العنوان' },
      { key: 'content_text', label: 'النص', type: 'textarea' },
      {
        key: 'images',
        label: 'روابط الصور (مفصولة بفواصل أو مرفوعة عبر ImgBB)',
        hint: 'يمكنك رفع الصور مباشرة عبر الزر بالأسفل وستُضاف تلقائيًا.',
      },
      { key: 'category', label: 'الفئة', type: 'select', options: audienceOptions },
      { key: 'video_url', label: 'رابط الفيديو' },
      {
        key: 'external_url',
        label: 'رابط صفحة الفيديو الخارجي (اختياري)',
        hint: 'رابط صفحة الفيديو على الموقع الأصلي — يظهر كزر "فتح" احتياطي',
      },
    ],
  },
  {
    key: 'religious_content',
    title: 'المحتوى الديني',
    description: 'مقالات، صوتيات، وفيديوهات للمراهقين والكبار.',
    icon: ShieldCheck,
    fields: [
      { key: 'cover_id', label: 'اختر الغلاف', type: 'cover_select', coverFilter: 'religious_content' },
      { key: 'title', label: 'العنوان' },
      { key: 'content_text', label: 'النص', type: 'textarea' },
      { key: 'content_type', label: 'النوع', type: 'select', options: contentTypeOptions },
      {
        key: 'media_url',
        label: 'رابط الوسائط',
        hint: 'رابط الفيديو أو الصوت من يوتيوب، أو Pixeldrain، أو Internet Archive',
      },
      {
        key: 'external_url',
        label: 'رابط صفحة الوسائط الخارجي (اختياري)',
        hint: 'رابط الصفحة الأصلية على الموقع الخارجي — يظهر كزر "فتح" احتياطي',
      },
    ],
  },
  {
    key: 'volunteer_fields',
    title: 'تخصيص أسئلة التطوع',
    description: 'إضافة وتعديل أسئلة استمارة التطوع ونوع كل حقل والإلزامي منها لزوار الموقع.',
    icon: HelpCircle,
    fields: [
      { key: 'label', label: 'عنوان السؤال / الحقل' },
      { key: 'field_key', label: 'المعرف البرمجي (إنجليزي)', hint: 'مثال: full_name أو phone أو track' },
      {
        key: 'field_type',
        label: 'نوع الحقل',
        type: 'select',
        options: volunteerFieldTypeOptions,
      },
      { key: 'placeholder', label: 'نص توضيحي داخل الحقل (Placeholder)' },
      { key: 'options', label: 'خيارات القائمة المنسدلة (مفصولة بفواصل)', hint: 'تُملأ فقط إذا كان نوع الحقل قائمة منسدلة' },
      { key: 'is_required', label: 'هل الإجابة إجبارية؟', type: 'boolean' },
      { key: 'order_num', label: 'ترتيب ظهور السؤال (رقم)', type: 'number' },
    ],
  },
  {
    key: 'volunteer_submissions',
    title: 'طلبات التطوع الواردة',
    description: 'سجل استمارات وطلبات التطوع المرسلة من المتقدمين عبر الموقع.',
    icon: ClipboardList,
    fields: [
      { key: 'name', label: 'الاسم الكامل' },
      { key: 'email', label: 'البريد الإلكتروني' },
      { key: 'phone', label: 'رقم الهاتف / واتساب' },
      { key: 'role', label: 'مجال التطوع' },
      { key: 'portfolio', label: 'رابط الأعمال السابقة' },
      { key: 'bio', label: 'نبذة عن المتقدم', type: 'textarea' },
      { key: 'created_at', label: 'تاريخ الإرسال' },
    ],
  },
  {
    key: 'staff_members',
    title: 'فريق العمل والمبدعين',
    description: 'إدارة حسابات العاملين والمبدعين. يمنحهم النظام وصولاً كاملاً لكل أقسام الموقع دون أي حجب أو تحديد سن/جنس، مع صفحة ملف شخصي خاصة بكل مبدع.',
    icon: Users,
    fields: [
      { key: 'name', label: 'اسم المبدع / الموظف' },
      { key: 'email', label: 'البريد الإلكتروني (لتسجيل الدخول والتعرف عليه بدون حجب أي محتوى)', hint: 'يجب أن يطابق بريد حسابه في جوجل' },
      { key: 'role', label: 'الدور / المسمى الوظيفي', hint: 'مثال: رسام مانجا، مؤلف روايات، مبرمج، مصمم' },
      { key: 'phone', label: 'رقم الهاتف / الواتساب', hint: 'يظهر مباشرة بجانب اسم المبدع على الموقع ومباشرة للتواصل عبر الواتساب' },
      {
        key: 'avatar_url',
        label: 'رابط الصورة الشخصية للمبدع (أو ارفع بالزر أدناه)',
        hint: 'ارفع صورتك كصانع محتوى بزر الرفع (ImgBB) بالأسفل أو الصق رابط صورة مباشر.',
      },
      { key: 'bio', label: 'نبذة عن المبدع وخبراته', type: 'textarea' },
      { key: 'social_links', label: 'روابط التواصل (Instagram, Telegram, X...)', type: 'textarea' },
      { key: 'is_active', label: 'الحساب مفعل', type: 'boolean' },
    ],
  },
  {
    key: 'system_errors',
    title: 'سجل أخطاء النظام',
    description: 'سجل الأخطاء التقنية التي تم التقاطها بصمت لدى زوار الموقع لمتابعتها وحلها فوراً.',
    icon: AlertTriangle,
    fields: [
      { key: 'message', label: 'رسالة الخطأ' },
      { key: 'url', label: 'رابط الصفحة' },
      { key: 'type', label: 'نوع الخطأ' },
      { key: 'stack', label: 'تفاصيل الخطأ البرمجي', type: 'textarea' },
      { key: 'created_at', label: 'التوقيت' },
    ],
  },
  {
    key: 'category_settings',
    title: 'إعدادات الأقسام',
    description: 'تفعيل الفئات وترتيب الأقسام التي يقرأها تطبيق الموبايل.',
    icon: Settings,
    fields: [
      { key: 'category_key', label: 'مفتاح الفئة', type: 'select', options: categoryOptions },
      { key: 'title_ar', label: 'الاسم العربي' },
      { key: 'is_active', label: 'مفعل', type: 'boolean' },
    ],
  },
  {
    key: 'admins',
    title: 'المستخدمون المسموح لهم',
    description: 'تفعيل/إيقاف دخول المشرفين وحذفهم من لوحة التحكم.',
    icon: UserCheck,
    fields: [
      { key: 'id', label: 'معرف المستخدم (UID) من Firebase Auth' },
      { key: 'email', label: 'البريد الإلكتروني' },
      { key: 'username', label: 'الاسم' },
      { key: 'role', label: 'الدور', type: 'select', options: roleOptions },
      { key: 'permissions', label: 'الصلاحيات مفصولة بفواصل' },
      { key: 'is_active', label: 'مسموح له بالدخول', type: 'boolean' },
    ],
  },
  {
    key: 'app_settings',
    title: 'إعدادات التطبيق والموقع',
    description: 'الروابط الإضافية والإعلانات وكود جوجل أدسنس (وثيقة إعدادات موحدة).',
    icon: Settings,
    fields: [
      {
        key: 'site_status',
        label: 'حالة الموقع العامة',
        type: 'select',
        options: [
          { value: 'open', label: 'الموقع مفتوح للجميع (طبيعي)' },
          { value: 'maintenance', label: 'تحت الصيانة' },
        ],
      },
      { key: 'banner_announcement', label: 'نص شريط الإعلانات العام (أعلى الموقع)' },
      { key: 'donate_vodafone', label: 'رقم فودافون كاش / المحافظ الإلكترونية' },
      { key: 'donate_instapay', label: 'معرف إنستاباي (InstaPay)' },
      { key: 'donate_iban', label: 'الحساب البنكي الدولي (IBAN)' },
      { key: 'haizo_link', label: 'رابط منصة هايزو (Haizo)' },
      { key: 'contact_link', label: 'رابط التواصل' },
      { key: 'volunteer_link', label: 'رابط التطوع' },
      {
        key: 'site_logo_url',
        label: 'رابط لوجو الموقع',
        hint: 'ارفع لوجو الموقع مباشرة بزر الرفع بالأسفل.',
      },
      {
        key: 'custom_ad_image_url',
        label: 'رابط صورة الإعلان المخصص (تطبيق الموبايل)',
        hint: 'ارفع صورة الإعلان مباشرة بزر الرفع بالأسفل.',
      },
      { key: 'custom_ad_link', label: 'الرابط عند الضغط على الإعلان (تطبيق الموبايل)' },
      { key: 'google_adsense_code', label: 'كود جوجل أدسنس', type: 'textarea' },
      { key: 'ad_top_code', label: 'كود الإعلان العلوي (الموقع)', type: 'textarea' },
      { key: 'ad_top_width', label: 'عرض الإعلان العلوي (مثال: 100% أو 300px)' },
      { key: 'ad_top_height', label: 'طول الإعلان العلوي (مثال: 90px أو auto)' },
      { key: 'ad_mid_code', label: 'كود إعلان وسط الموقع', type: 'textarea' },
      { key: 'ad_mid_width', label: 'عرض إعلان وسط الموقع' },
      { key: 'ad_mid_height', label: 'طول إعلان وسط الموقع' },
      { key: 'ad_modal_code', label: 'كود إعلان النوافذ المنبثقة', type: 'textarea' },
      { key: 'ad_modal_width', label: 'عرض إعلان النوافذ المنبثقة' },
      { key: 'ad_modal_height', label: 'طول إعلان النوافذ المنبثقة' },
    ],
  },
]

const emptyForm = (config: TableConfig): RowData => {
  const base: RowData = Object.fromEntries(
    config.fields.map((field) => [
      field.key,
      field.type === 'boolean' ? false : field.type === 'number' ? 0 : '',
    ]),
  )
  if (config.key === 'covers') {
    base.creators = [{ name: '', role: '', id: '' }]
  }
  return base
}

const formatImageUrl = (url: string) => {
  if (!url) return ''
  const driveFileRegex = /drive\.google\.com\/file\/d\/([^/]+)/
  const driveOpenRegex = /drive\.google\.com\/open\?id=([^&]+)/
  const driveUcRegex = /drive\.google\.com\/uc\?.*id=([^&]+)/

  const matchFile = url.match(driveFileRegex)
  if (matchFile && matchFile[1]) {
    return `https://drive.google.com/uc?export=view&id=${matchFile[1]}`
  }
  const matchOpen = url.match(driveOpenRegex)
  if (matchOpen && matchOpen[1]) {
    return `https://drive.google.com/uc?export=view&id=${matchOpen[1]}`
  }
  const matchUc = url.match(driveUcRegex)
  if (matchUc && matchUc[1]) {
    return `https://drive.google.com/uc?export=view&id=${matchUc[1]}`
  }
  return url
}

const normalizePayload = (form: RowData) => {
  const entries = Object.entries(form)
    .filter(([, value]) => value !== '' && value !== undefined)
    .map(([key, value]) => {
      if ((key === 'permissions' || key === 'images') && typeof value === 'string') {
        return [key, value.split(',').map((item) => item.trim()).filter(Boolean)]
      }
      if (key === 'cover_id' && value !== '' && value !== null) {
        return [key, String(value)]
      }
      return [key, value]
    })
  const payload = Object.fromEntries(entries)

  // Normalize multiple creators and roles for covers
  if (Array.isArray(form.creators)) {
    const validCreators = (form.creators as unknown[])
      .filter(isCreatorEntry)
      .filter((c) => String(c.name).trim())
      .map((c) => ({
        name: String(c.name).trim(),
        role: String(c.role || '').trim(),
        id: String(c.id || '').trim(),
      }))
    payload.creators = validCreators
    if (validCreators.length > 0) {
      payload.creator_name = validCreators.map((c) => c.name).join(' ، ')
      payload.creator_role = validCreators.map((c) => c.role ? `${c.name} (${c.role})` : c.name).join(' | ')
      payload.creator_id = validCreators[0]?.id || ''
    } else {
      payload.creator_name = ''
      payload.creator_role = ''
      payload.creator_id = ''
    }
  }

  // Ensure both avatar and avatar_url are saved for staff and creators
  if (payload.avatar_url && !payload.avatar) {
    payload.avatar = payload.avatar_url
  } else if (payload.avatar && !payload.avatar_url) {
    payload.avatar_url = payload.avatar
  }
  return payload
}

const isImageField = (key: string): boolean => {
  return (
    key === 'cover_url' ||
    key === 'cover_children_url' ||
    key === 'cover_teens_url' ||
    key === 'cover_adults_url' ||
    key === 'site_logo_url' ||
    key === 'custom_ad_image_url' ||
    key === 'images' ||
    key === 'banner_url' ||
    key === 'thumbnail' ||
    key === 'avatar' ||
    key === 'avatar_url' ||
    key === 'photo_url'
  )
}

export default function App() {
  const [activeKey, setActiveKey] = useState<ActiveSection>('covers')
  const [rows, setRows] = useState<RowData[]>([])
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [form, setForm] = useState<RowData>({})
  const [editingId, setEditingId] = useState<string | number | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [sessionEmail, setSessionEmail] = useState<string | null>(null)
  const [sessionRole, setSessionRole] = useState<string | null>(null)
  const [checkingSession, setCheckingSession] = useState(true)
  const [previewStatus, setPreviewStatus] = useState<Record<string, 'ok' | 'error'>>({})
  const [allCovers, setAllCovers] = useState<RowData[]>([])

  const activeConfig = useMemo(
    () => configs.find((item) => item.key === activeKey),
    [activeKey],
  )

  useEffect(() => {
    if (activeConfig) {
      setForm(emptyForm(activeConfig))
      setEditingId(null)
      setMessage('')
    }
  }, [activeConfig])

  /** Creators & Staff list for dropdown selection in covers */
  const [creatorsList, setCreatorsList] = useState<{ id: string; name: string; role?: string }[]>([])

  const loadCreators = useCallback(async () => {
    try {
      const list: { id: string; name: string; role?: string }[] = []
      const sSnap = await getDocs(collection(db, 'staff_members'))
      sSnap.forEach((d) => {
        const data = d.data()
        if (data.name) {
          list.push({ id: d.id, name: String(data.name), role: String(data.role || 'فريق العمل') })
        }
      })
      const aSnap = await getDocs(collection(db, 'admins'))
      aSnap.forEach((d) => {
        const data = d.data()
        const name = String(data.username || data.name || 'المدير العام')
        if (!list.some((c) => c.name.toLowerCase() === name.toLowerCase())) {
          list.push({ id: d.id, name: name, role: 'مدير عام' })
        }
      })
      setCreatorsList(list)
    } catch {
      // Ignored
    }
  }, [])

  /** Load all covers from Firestore for dropdown usage */
  const loadCovers = useCallback(async () => {
    try {
      const snap = await getDocs(collection(db, 'covers'))
      const docs = snap.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }))
      setAllCovers(docs as RowData[])
    } catch {
      // Ignored if permissions not ready yet
    }
  }, [])

  /** Filter covers by section_type for cover_select dropdowns */
  const getFilteredCovers = useCallback(
    (sectionFilter?: string) => {
      if (!sectionFilter) return allCovers
      const allowed = sectionFilter.split(',').map((s) => s.trim())
      return allCovers.filter((c) => allowed.includes(String(c.section_type || '')))
    },
    [allCovers],
  )

  /** Get cover title by ID */
  const getCoverTitle = useCallback(
    (coverId: RowValue) => {
      if (!coverId) return '-'
      const cover = allCovers.find((c) => String(c.id) === String(coverId))
      return cover ? String(cover.title) : '-'
    },
    [allCovers],
  )

  const loadCounts = useCallback(async () => {
    const nextCounts: Record<string, number> = {}
    await Promise.all(
      configs.map(async (config) => {
        try {
          if (config.key === 'app_settings') {
            const docSnap = await getDoc(doc(db, 'app_settings', '1'))
            nextCounts[config.key] = docSnap.exists() ? 1 : 0
          } else {
            const snap = await getCountFromServer(collection(db, config.key))
            nextCounts[config.key] = snap.data().count
          }
        } catch {
          nextCounts[config.key] = 0
        }
      }),
    )
    setCounts(nextCounts)
  }, [])

  const loadTable = useCallback(async (table: ContentTable) => {
    setLoading(true)
    try {
      if (table === 'app_settings') {
        const docSnap = await getDoc(doc(db, 'app_settings', '1'))
        if (docSnap.exists()) {
          const data = docSnap.data() as RowData
          setRows([{ id: '1', ...data }])
          setForm(data)
          setEditingId('1')
        } else {
          setRows([])
          setForm({})
          setEditingId('1')
        }
        setMessage('')
      } else {
        const colRef = collection(db, table)
        let docs: RowData[] = []
        try {
          const q = query(colRef, orderBy('created_at', 'desc'), limit(50))
          const snap = await getDocs(q)
          docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as RowData)
        } catch {
          // Fallback without orderBy in case index or field does not exist
          const snap = await getDocs(query(colRef, limit(50)))
          docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as RowData)
        }
        setRows(docs)
        setMessage('')
      }
    } catch (err: unknown) {
      setRows([])
      setMessage(formatFirebaseError(err, 'تعذر تحميل البيانات من Firestore.'))
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const check = await verifyAdminStatus(user)
        if (check.allowed && check.profile) {
          setSessionEmail(check.profile.email || user.email || '')
          setSessionRole(check.profile.role)
        } else {
          await firebaseSignOut(auth)
          setSessionEmail(null)
          setSessionRole(null)
          setMessage(check.error || 'هذا الحساب غير مصرح له بالدخول.')
        }
      } else {
        setSessionEmail(null)
        setSessionRole(null)
      }
      setCheckingSession(false)
    })

    return () => unsubscribe()
  }, [])

  useEffect(() => {
    if (!sessionEmail || activeKey === 'connection' || !activeConfig) return
    void loadTable(activeConfig.key)
    void loadCounts()
    void loadCovers()
    void loadCreators()
  }, [activeConfig, activeKey, loadCounts, loadTable, sessionEmail, loadCovers, loadCreators])

  const signIn = async () => {
    if (!email.trim() || !password.trim()) {
      setMessage('أدخل البريد الإلكتروني وكلمة المرور.')
      return
    }

    setSaving(true)
    setMessage('')

    try {
      const cred = await signInWithEmailAndPassword(auth, email.trim(), password)
      const check = await verifyAdminStatus(cred.user)
      if (check.allowed && check.profile) {
        setSessionEmail(check.profile.email || cred.user.email || '')
        setSessionRole(check.profile.role)
      } else {
        await firebaseSignOut(auth)
        setSessionEmail(null)
        setSessionRole(null)
        setMessage(check.error || 'هذا الحساب غير مصرح له بدخول لوحة التحكم.')
      }
    } catch (err: unknown) {
      setMessage(formatFirebaseError(err, 'تعذر تسجيل الدخول. تحقق من صحة البيانات.'))
    } finally {
      setSaving(false)
    }
  }

  const signInWithGoogle = async () => {
    setSaving(true)
    setMessage('')
    try {
      const provider = new GoogleAuthProvider()
      const cred = await signInWithPopup(auth, provider)
      const check = await verifyAdminStatus(cred.user)
      if (check.allowed && check.profile) {
        setSessionEmail(check.profile.email || cred.user.email || '')
        setSessionRole(check.profile.role)
      } else {
        await firebaseSignOut(auth)
        setSessionEmail(null)
        setSessionRole(null)
        setMessage(check.error || 'هذا الحساب غير مصرح له بدخول لوحة التحكم.')
      }
    } catch (err: unknown) {
      setMessage(formatFirebaseError(err, 'تعذر تسجيل الدخول بحساب Google.'))
    } finally {
      setSaving(false)
    }
  }

  const signOut = async () => {
    await firebaseSignOut(auth)
    setSessionEmail(null)
    setSessionRole(null)
  }

  const saveRow = async () => {
    if (!activeConfig) return
    setSaving(true)
    const payload = normalizePayload(form)

    try {
      if (activeConfig.key === 'app_settings') {
        await setDoc(doc(db, 'app_settings', '1'), {
          ...payload,
          updated_at: new Date().toISOString(),
        }, { merge: true })
        setMessage('تم حفظ إعدادات التطبيق والموقع بنجاح.')
        setEditingId('1')
        await loadTable('app_settings')
        await loadCounts()
        return
      } else if (editingId) {
        await updateDoc(doc(db, activeConfig.key, String(editingId)), {
          ...payload,
          updated_at: new Date().toISOString(),
        })
      } else {
        await addDoc(collection(db, activeConfig.key), {
          ...payload,
          created_at: new Date().toISOString(),
        })
      }

      // If updating a staff member, also sync photo, phone and name to admins record with matching email
      if (activeConfig.key === 'staff_members' && payload.email) {
        try {
          const em = String(payload.email).trim().toLowerCase()
          const aSnap = await getDocs(query(collection(db, 'admins'), where('email', '==', em)))
          for (const aDoc of aSnap.docs) {
            await updateDoc(doc(db, 'admins', aDoc.id), {
              avatar_url: payload.avatar_url || payload.avatar || '',
              avatar: payload.avatar || payload.avatar_url || '',
              phone: payload.phone || '',
              name: payload.name || '',
            })
          }
        } catch {
          // Keep the staff update successful even if no matching admin record exists.
        }
      }

      setMessage(editingId ? 'تم تعديل العنصر بنجاح.' : 'تم حفظ العنصر بنجاح.')
      setEditingId(null)
      setForm(emptyForm(activeConfig))
      await loadTable(activeConfig.key)
      await loadCounts()
      if (activeConfig.key === 'covers') {
        await loadCovers()
      }
    } catch (err: unknown) {
      setMessage(formatFirebaseError(err, 'تعذر حفظ البيانات في Firestore.'))
    } finally {
      setSaving(false)
    }
  }

  const clearAllErrors = async () => {
    if (!window.confirm('هل أنت متأكد من مسح جميع سجلات أخطاء النظام؟')) return
    setLoading(true)
    try {
      const snap = await getDocs(collection(db, 'system_errors'))
      await Promise.all(snap.docs.map((d) => deleteDoc(d.ref)))
      setMessage('تم مسح جميع سجلات الأخطاء بنجاح.')
      await loadTable('system_errors')
      await loadCounts()
    } catch (err: unknown) {
      setMessage(formatFirebaseError(err, 'تعذر مسح الأخطاء.'))
    } finally {
      setLoading(false)
    }
  }

  const editRow = (row: RowData) => {
    if (!activeConfig) return
    setEditingId(row.id as string | number)
    const clonedRow = { ...row }
    if (clonedRow.avatar && !clonedRow.avatar_url) {
      clonedRow.avatar_url = clonedRow.avatar
    } else if (clonedRow.avatar_url && !clonedRow.avatar) {
      clonedRow.avatar = clonedRow.avatar_url
    }
    const creatorEntries = Array.isArray(clonedRow.creators)
      ? (clonedRow.creators as unknown[]).filter(isCreatorEntry)
      : []
    const initialCreators = creatorEntries.length > 0
      ? creatorEntries.map((c) => ({ name: c.name || '', role: c.role || '', id: c.id || '' }))
      : (clonedRow.creator_name
          ? [{ name: String(clonedRow.creator_name), role: String(clonedRow.creator_role || ''), id: String(clonedRow.creator_id || '') }]
          : [{ name: '', role: '', id: '' }])

    const formObj: RowData = Object.fromEntries(
      activeConfig.fields.map((field) => {
        const value = clonedRow[field.key]
        return [field.key, Array.isArray(value) ? value.join(', ') : value ?? '']
      }),
    )
    if (activeConfig.key === 'covers') {
      formObj.creators = initialCreators
    }
    setForm(formObj)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const deleteRow = async (row: RowData) => {
    if (!activeConfig) return
    try {
      await deleteDoc(doc(db, activeConfig.key, String(row.id)))
      setMessage('تم الحذف بنجاح.')
      await loadTable(activeConfig.key)
      await loadCounts()
      if (activeConfig.key === 'covers') {
        await loadCovers()
      }
    } catch (err: unknown) {
      setMessage(formatFirebaseError(err, 'تعذر حذف العنصر.'))
    }
  }

  const toggleAdminAccess = async (row: RowData) => {
    try {
      await updateDoc(doc(db, 'admins', String(row.id)), {
        is_active: !row.is_active,
      })
      await loadTable('admins')
    } catch (err: unknown) {
      setMessage(formatFirebaseError(err, 'تعذر تغيير حالة المشرف.'))
    }
  }

  if (checkingSession) {
    return (
      <main className="login-screen" dir="rtl">
        <Loader2 className="spin" size={32} />
      </main>
    )
  }

  if (!sessionEmail) {
    return (
      <main className="login-screen" dir="rtl">
        <div className="login-card">
          <img src={logo} alt="أجيال الإيمان" />
          <h1>تسجيل الدخول</h1>
          <p>لوحة تحكم وإدارة منصة أجيال الإيمان</p>

          <label>
            <span>البريد الإلكتروني</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@example.com"
            />
          </label>

          <label>
            <span>كلمة المرور</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              onKeyDown={(e) => {
                if (e.key === 'Enter') void signIn()
              }}
            />
          </label>

          <button className="primary-action" type="button" onClick={signIn} disabled={saving} style={{ marginBottom: '10px' }}>
            {saving ? <Loader2 className="spin" size={18} /> : <LogIn size={18} />}
            دخول المشرف (بالبريد وكلمة المرور)
          </button>

          <div style={{ display: 'flex', alignItems: 'center', margin: '14px 0', gap: '8px' }}>
            <div style={{ flex: 1, height: '1px', background: 'var(--border, #cbd5e1)' }}></div>
            <span style={{ fontSize: '0.85rem', color: '#64748b' }}>أو تسجيل سريع</span>
            <div style={{ flex: 1, height: '1px', background: 'var(--border, #cbd5e1)' }}></div>
          </div>

          <button
            type="button"
            onClick={signInWithGoogle}
            disabled={saving}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
              padding: '12px 18px',
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
              background: '#ffffff',
              color: '#1e293b',
              fontWeight: 700,
              fontSize: '0.95rem',
              cursor: 'pointer',
              boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"/>
              <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"/>
              <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 10.03 0 12s.45 3.82 1.25 5.42l4.03-3.15z"/>
              <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"/>
            </svg>
            تسجيل الدخول بحساب Google (المشرف)
          </button>

          {message && <p className="notice" style={{ marginTop: '14px' }}>{message}</p>}
        </div>
      </main>
    )
  }

  return (
    <div className="admin-shell" dir="rtl">
      <aside className="admin-sidebar">
        <div className="brand">
          <img src={logo} alt="أجيال الإيمان" />
          <div>
            <h1>أجيال الإيمان</h1>
            <p>لوحة التحكم والإدارة</p>
          </div>
        </div>

        <nav>
          {configs.map((config) => {
            const Icon = config.icon
            const active = activeKey === config.key
            return (
              <button
                key={config.key}
                type="button"
                className={active ? 'active' : ''}
                onClick={() => setActiveKey(config.key)}
              >
                <Icon size={18} />
                <span>{config.title}</span>
                {config.key !== 'app_settings' && (
                  <span className="count-badge">{counts[config.key] ?? 0}</span>
                )}
              </button>
            )
          })}

          <button
            type="button"
            className={activeKey === 'connection' ? 'active' : ''}
            onClick={() => setActiveKey('connection')}
          >
            <Flame size={18} color="#f59e0b" />
            <span>اتصال Firebase</span>
          </button>
        </nav>

        <div className="auth-box">
          <div>
            <small>المشرف الحالي</small>
            <p className="auth-user" title={sessionEmail}>
              {sessionEmail}
            </p>
            {sessionRole && (
              <span className="auth-role-badge">
                {sessionRole === 'super_admin' ? '⭐ مدير عام' : 'مشرف'}
              </span>
            )}
          </div>
          <button type="button" onClick={signOut}>
            <LogOut size={16} />
            تسجيل الخروج
          </button>
        </div>
      </aside>

      <main className="admin-content">
        <header className="topbar">
          <div>
            <span className="eyebrow">أجيال الإيمان • الإدارة السحابية</span>
            <h2>{activeKey === 'connection' ? 'إعدادات اتصال Firebase' : activeConfig?.title}</h2>
            <p>
              {activeKey === 'connection'
                ? 'فحص ومراقبة الاتصال بقاعدة بيانات Cloud Firestore وحسابات المشرفين.'
                : activeConfig?.description}
            </p>
          </div>
        </header>

        {message && <p className="notice">{message}</p>}

        {activeKey === 'connection' ? (
          <ConnectionPanel isLoggedIn onMessage={setMessage} />
        ) : activeConfig?.key === 'app_settings' ? (
          <section className="settings-panel">
            <div className="panel-header" style={{ marginBottom: '18px' }}>
              <div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 800 }}>⚙️ إعدادات المنصة والموقع العام</h3>
                <p style={{ color: '#64748b', fontSize: '0.86rem', margin: '4px 0 0' }}>
                  تحكم في إعدادات المنصة الموحدة وأرقام التبرع وروابط الدعم والإعلانات. تُحفظ وتنعكس فوراً على الموقع والتطبيق.
                </p>
              </div>
              <button
                type="button"
                className="primary-action"
                disabled={saving}
                onClick={saveRow}
                style={{ padding: '10px 24px', fontSize: '0.95rem' }}
              >
                {saving ? <Loader2 className="spin" size={18} /> : <Save size={18} />}
                <span>{saving ? 'جارٍ الحفظ...' : '💾 حفظ جميع الإعدادات'}</span>
              </button>
            </div>

            <form onSubmit={(e) => { e.preventDefault(); void saveRow(); }} className="settings-grid">
              {activeConfig.fields.map((field) => (
                <label key={field.key} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <span style={{ fontWeight: 700, fontSize: '0.88rem' }}>{field.label}</span>
                  {field.hint && <small className="field-hint">{field.hint}</small>}
                  {isImageField(field.key) ? (
                    <ImageUploadField
                      value={String(form[field.key] ?? '')}
                      onChange={(url) => setForm({ ...form, [field.key]: url })}
                    />
                  ) : field.type === 'select' ? (
                    <select
                      value={String(form[field.key] ?? '')}
                      onChange={(e) => setForm({ ...form, [field.key]: e.target.value })}
                    >
                      {field.options?.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  ) : field.type === 'textarea' ? (
                    <textarea
                      value={String(form[field.key] ?? '')}
                      onChange={(e) => setForm({ ...form, [field.key]: e.target.value })}
                      placeholder={field.label}
                      rows={3}
                    />
                  ) : (
                    <input
                      type="text"
                      value={String(form[field.key] ?? '')}
                      onChange={(e) => setForm({ ...form, [field.key]: e.target.value })}
                      placeholder={field.label}
                    />
                  )}
                </label>
              ))}
            </form>

            <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="primary-action"
                disabled={saving}
                onClick={saveRow}
                style={{ padding: '10px 28px', fontSize: '0.95rem' }}
              >
                {saving ? <Loader2 className="spin" size={18} /> : <Save size={18} />}
                <span>{saving ? 'جارٍ الحفظ...' : '💾 حفظ جميع الإعدادات'}</span>
              </button>
            </div>
          </section>
        ) : activeConfig?.key === 'system_errors' ? (
          <section className="settings-panel">
            <div className="panel-header" style={{ marginBottom: '18px' }}>
              <div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#dc2626', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <AlertTriangle size={22} />
                  سجل أخطاء النظام الحية (المرصودة تلقائياً من الزوار)
                </h3>
                <p style={{ color: '#64748b', fontSize: '0.86rem', margin: '4px 0 0' }}>
                  تصلك الأخطاء هنا فورياً وبصمت دون إزعاج زوار الموقع أو إظهار أي نوافذ مزعجة لهم.
                </p>
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  type="button"
                  className="secondary-action"
                  onClick={() => loadTable('system_errors')}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <RefreshCw size={16} />
                  <span>تحديث السجل</span>
                </button>
                <button
                  type="button"
                  className="danger-action"
                  onClick={clearAllErrors}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: '8px', padding: '8px 16px', fontWeight: 700, cursor: 'pointer' }}
                >
                  <Trash2 size={16} />
                  <span>مسح جميع الأخطاء</span>
                </button>
              </div>
            </div>

            <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '10px', padding: '12px 18px', marginBottom: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ display: 'inline-block', width: '10px', height: '10px', borderRadius: '50%', background: '#22c55e' }}></span>
                <strong style={{ fontSize: '0.9rem', color: '#991b1b' }}>نظام المراقبة والاستقبال الصامت نشط</strong>
              </div>
              <span style={{ fontSize: '0.85rem', color: '#7f1d1d' }}>إجمالي البلاغات المسجلة: <strong>{rows.length}</strong></span>
            </div>

            {loading ? (
              <div style={{ padding: '40px', textAlign: 'center' }}><Loader2 className="spin" size={32} /></div>
            ) : rows.length === 0 ? (
              <div style={{ padding: '60px 20px', textAlign: 'center', background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                <CheckCircle2 size={48} color="#22c55e" style={{ margin: '0 auto 12px' }} />
                <h4 style={{ margin: '0 0 6px', fontSize: '1.1rem', color: '#0f172a' }}>لا توجد أخطاء مرصودة حالياً!</h4>
                <p style={{ margin: 0, color: '#64748b', fontSize: '0.88rem' }}>النظام يعمل بكفاءة تامة ولم يتم تسجيل أي تعثر لدى الزوار.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {rows.map((row) => (
                  <div
                    key={String(row.id)}
                    style={{
                      background: '#fff',
                      borderRadius: '10px',
                      border: '1px solid #e2e8f0',
                      padding: '16px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ background: '#fee2e2', color: '#dc2626', fontSize: '0.75rem', fontWeight: 800, padding: '3px 8px', borderRadius: '6px' }}>
                          {String(row.type || 'error')}
                        </span>
                        <strong style={{ fontSize: '0.95rem', color: '#1e293b' }}>{String(row.message || 'خطأ غير مسمى')}</strong>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <small style={{ color: '#94a3b8', fontSize: '0.78rem' }}>{String(row.created_at || '')}</small>
                        <button
                          type="button"
                          onClick={() => deleteRow(row)}
                          style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '4px' }}
                          title="حذف هذا الخطأ"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                    {row.url && (
                      <div style={{ fontSize: '0.82rem', color: '#3b82f6', direction: 'ltr', textAlign: 'right' }}>
                        🔗 {String(row.url)}
                      </div>
                    )}
                    {row.stack && (
                      <pre style={{ background: '#0f172a', color: '#f8fafc', padding: '10px 14px', borderRadius: '6px', fontSize: '0.78rem', overflowX: 'auto', direction: 'ltr', margin: 0 }}>
                        {String(row.stack)}
                      </pre>
                    )}
                    {row.user_agent && (
                      <small style={{ color: '#64748b', fontSize: '0.75rem' }}>
                        متصفح وجهاز الزائر: {String(row.user_agent)}
                      </small>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        ) : activeConfig ? (
          <section className="work-grid">
            <form className="editor" onSubmit={(event) => event.preventDefault()}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                <h3 style={{ margin: 0 }}>{editingId ? '✏️ تعديل عنصر' : '➕ إضافة عنصر جديد'}</h3>
                {editingId && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingId(null)
                      if (activeConfig) setForm(emptyForm(activeConfig))
                    }}
                    style={{
                      padding: '4px 10px',
                      fontSize: '0.8rem',
                      borderRadius: '6px',
                      border: '1px solid #cbd5e1',
                      background: '#f8fafc',
                      cursor: 'pointer',
                      color: '#64748b',
                      fontWeight: 600,
                    }}
                  >
                    إلغاء التعديل
                  </button>
                )}
              </div>
                {activeConfig.fields.map((field) => (
                  <label key={field.key}>
                    <span>{field.label}</span>
                    {field.hint && <small className="field-hint">{field.hint}</small>}

                    {/* ImgBB upload widget for image fields */}
                    {isImageField(field.key) && (
                      <ImageUploadField
                        value={String(form[field.key] ?? '')}
                        onChange={(url) => {
                          if (field.key === 'images' && form[field.key]) {
                            // If multiple images are supported, append to comma-separated list
                            const current = String(form[field.key]).trim()
                            setForm({ ...form, [field.key]: current ? `${current}, ${url}` : url })
                          } else {
                            setForm({ ...form, [field.key]: url })
                          }
                        }}
                      />
                    )}

                    {/* Telegram TaaS video upload widget */}
                    {field.key === 'video_url' && (
                      <VideoUploadField
                        value={String(form[field.key] ?? '')}
                        onChange={(url) => setForm({ ...form, [field.key]: url })}
                      />
                    )}

                    {/* Telegram TaaS PDF & Book upload widget for Manga & Novels */}
                    {field.key === 'file_url' && (
                      <FileUploadField
                        value={String(form[field.key] ?? '')}
                        onChange={(url) => setForm({ ...form, [field.key]: url })}
                      />
                    )}

                    {field.type === 'cover_select' ? (
                      <>
                        <select
                          value={String(form[field.key] ?? '')}
                          onChange={(event) => setForm({ ...form, [field.key]: event.target.value })}
                        >
                          <option value="">بدون غلاف</option>
                          {getFilteredCovers(field.coverFilter).map((cover) => (
                            <option key={String(cover.id)} value={String(cover.id)}>
                              {String(cover.title)}
                            </option>
                          ))}
                        </select>
                        {form[field.key] && (() => {
                          const selectedCover = allCovers.find(
                            (c) => String(c.id) === String(form[field.key]),
                          )
                          return selectedCover?.cover_url ? (
                            <div className="cover-preview">
                              <img
                                src={formatImageUrl(String(selectedCover.cover_url))}
                                alt={String(selectedCover.title)}
                              />
                              <span>{String(selectedCover.title)}</span>
                            </div>
                          ) : null
                        })()}
                      </>
                    ) : field.type === 'textarea' ? (
                      <textarea
                        value={String(form[field.key] ?? '')}
                        onChange={(event) => setForm({ ...form, [field.key]: event.target.value })}
                      />
                    ) : field.type === 'select' ? (
                      <select
                        value={String(form[field.key] ?? '')}
                        onChange={(event) => setForm({ ...form, [field.key]: event.target.value })}
                      >
                        <option value="">اختر</option>
                        {field.options?.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    ) : field.type === 'checkbox_group' ? (
                      <div className="checkbox-group">
                        {field.options?.map((option) => {
                          const selectedList = String(form[field.key] ?? '')
                            .split(',')
                            .map((s) => s.trim())
                            .filter(Boolean)
                          const isChecked = selectedList.includes(option.value)
                          return (
                            <label
                              key={option.value}
                              className="checkbox-item"
                              style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '4px 0', fontWeight: 'normal' }}
                            >
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={(event) => {
                                  let nextList = [...selectedList]
                                  if (event.target.checked) {
                                    nextList.push(option.value)
                                  } else {
                                    nextList = nextList.filter((v) => v !== option.value)
                                  }
                                  setForm({ ...form, [field.key]: nextList.join(',') })
                                }}
                              />
                              <span>{option.label}</span>
                            </label>
                          )
                        })}
                      </div>
                    ) : field.type === 'boolean' ? (
                      <input
                        type="checkbox"
                        checked={Boolean(form[field.key])}
                        onChange={(event) => setForm({ ...form, [field.key]: event.target.checked })}
                      />
                    ) : field.key === 'creator_name' ? (
                      (() => {
                        const rawFormCreators = form.creators as unknown
                        const creatorsArray: CreatorEntry[] =
                          Array.isArray(rawFormCreators) && rawFormCreators.length > 0
                            ? (rawFormCreators as CreatorEntry[])
                            : (form.creator_name
                                ? [{ name: String(form.creator_name), role: String(form.creator_role || ''), id: String(form.creator_id || '') }]
                                : [{ name: '', role: '', id: '' }])

                        const updateCreatorAt = (idx: number, patch: Partial<{ name: string; role: string; id: string }>) => {
                          const updated = [...creatorsArray]
                          updated[idx] = { ...updated[idx], ...patch }
                          const valid = updated.filter((c) => c && c.name && c.name.trim())
                          setForm({
                            ...form,
                            creators: updated,
                            creator_name: valid.map((c) => c.name.trim()).join(' ، '),
                            creator_role: valid.map((c) => c.role ? `${c.name} (${c.role})` : c.name).join(' | '),
                            creator_id: valid[0]?.id || '',
                          })
                        }

                        const addCreator = () => {
                          const updated = [...creatorsArray, { name: '', role: '', id: '' }]
                          setForm({ ...form, creators: updated })
                        }

                        const removeCreator = (idx: number) => {
                          let updated = creatorsArray.filter((_, i) => i !== idx)
                          if (updated.length === 0) {
                            updated = [{ name: '', role: '', id: '' }]
                          }
                          const valid = updated.filter((c) => c && c.name && c.name.trim())
                          setForm({
                            ...form,
                            creators: updated,
                            creator_name: valid.map((c) => c.name.trim()).join(' ، '),
                            creator_role: valid.map((c) => c.role ? `${c.name} (${c.role})` : c.name).join(' | '),
                            creator_id: valid[0]?.id || '',
                          })
                        }

                        const suggestedRoles = ['مؤلف', 'رسام', 'مترجم', 'مدقق لغوي', 'مخرج', 'مؤدي صوتي', 'سيناريو', 'فكرة وإعداد', 'إشراف']

                        return (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', background: '#f8fafc', padding: '14px', borderRadius: '12px', border: '1.5px solid #e2e8f0', marginTop: '4px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #e2e8f0', paddingBottom: '8px' }}>
                              <span style={{ fontSize: '0.88rem', fontWeight: 800, color: '#1e293b', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                🎨 فريق العمل والمبدعون لهذا الغلاف ({creatorsArray.filter(c => c.name.trim()).length || creatorsArray.length})
                              </span>
                              <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                                يمكنك إضافة مبدع أو أكثر وتحديد دوره المخصص في هذا العمل
                              </span>
                            </div>

                            {creatorsArray.map((c, idx) => (
                              <div
                                key={idx}
                                style={{
                                  background: '#ffffff',
                                  border: '1.5px solid #cbd5e1',
                                  borderRadius: '10px',
                                  padding: '12px',
                                  display: 'flex',
                                  flexDirection: 'column',
                                  gap: '10px',
                                  boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                                }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                  <span style={{ fontSize: '0.82rem', fontWeight: 800, color: '#1d4ed8', background: '#eff6ff', padding: '2px 10px', borderRadius: '6px', border: '1px solid #bfdbfe' }}>
                                    مبدع #{idx + 1}
                                  </span>
                                  {creatorsArray.length > 1 && (
                                    <button
                                      type="button"
                                      onClick={() => removeCreator(idx)}
                                      style={{
                                        background: '#fee2e2',
                                        color: '#b91c1c',
                                        border: '1px solid #fecaca',
                                        borderRadius: '6px',
                                        padding: '4px 10px',
                                        fontSize: '0.78rem',
                                        fontWeight: 700,
                                        cursor: 'pointer',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '4px',
                                      }}
                                      title="حذف هذا المبدع من الغلاف"
                                    >
                                      <Trash2 size={13} />
                                      <span>حذف المبدع</span>
                                    </button>
                                  )}
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '10px' }}>
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                    <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#334155' }}>
                                      اسم المبدع (اختر أو اكتب يدوياً):
                                    </label>
                                    <select
                                      value={creatorsList.some((cl) => cl.name === c.name) ? c.name : (c.name ? '__custom__' : '')}
                                      onChange={(e) => {
                                        const val = e.target.value
                                        if (val === '__custom__') {
                                          updateCreatorAt(idx, { id: '' })
                                        } else if (val) {
                                          const found = creatorsList.find((cl) => cl.name === val)
                                          updateCreatorAt(idx, {
                                            name: val,
                                            id: found?.id || '',
                                            role: c.role || found?.role || '',
                                          })
                                        } else {
                                          updateCreatorAt(idx, { name: '', id: '' })
                                        }
                                      }}
                                      style={{ padding: '6px 10px', fontSize: '0.84rem' }}
                                    >
                                      <option value="">-- اختر مبدعاً من المسجلين --</option>
                                      {creatorsList.map((creator) => (
                                        <option key={creator.id} value={creator.name}>
                                          🎨 {creator.name} ({creator.role || 'عضو'})
                                        </option>
                                      ))}
                                      <option value="__custom__">➕ اسم مبدع آخر (كتابة يدوية)</option>
                                    </select>
                                    <input
                                      type="text"
                                      value={c.name}
                                      onChange={(e) => updateCreatorAt(idx, { name: e.target.value })}
                                      placeholder="أو اكتب اسم المبدع هنا..."
                                      style={{ fontSize: '0.84rem' }}
                                    />
                                  </div>

                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                    <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#334155' }}>
                                      الدور في هذا العمل (مؤلف، رسام، مترجم...):
                                    </label>
                                    <input
                                      type="text"
                                      value={c.role}
                                      onChange={(e) => updateCreatorAt(idx, { role: e.target.value })}
                                      placeholder="اكتب الدور هنا أو اضغط خياراً سريعاً أدناه..."
                                      style={{ fontSize: '0.84rem' }}
                                    />
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '2px' }}>
                                      {suggestedRoles.map((roleTag) => (
                                        <button
                                          key={roleTag}
                                          type="button"
                                          onClick={() => {
                                            const newRole = c.role ? (c.role.includes(roleTag) ? c.role : `${c.role} و ${roleTag}`) : roleTag
                                            updateCreatorAt(idx, { role: newRole })
                                          }}
                                          style={{
                                            background: c.role?.includes(roleTag) ? '#fef3c7' : '#f1f5f9',
                                            color: c.role?.includes(roleTag) ? '#92400e' : '#475569',
                                            border: '1px solid ' + (c.role?.includes(roleTag) ? '#fde68a' : '#cbd5e1'),
                                            borderRadius: '4px',
                                            padding: '2px 7px',
                                            fontSize: '0.73rem',
                                            fontWeight: 600,
                                            cursor: 'pointer',
                                            transition: '0.15s',
                                          }}
                                        >
                                          +{roleTag}
                                        </button>
                                      ))}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            ))}

                            <button
                              type="button"
                              onClick={addCreator}
                              style={{
                                background: '#f8fafc',
                                border: '2px dashed #60a5fa',
                                color: '#1d4ed8',
                                padding: '10px 14px',
                                borderRadius: '10px',
                                fontWeight: 800,
                                fontSize: '0.88rem',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '8px',
                                transition: 'all 0.2s',
                              }}
                            >
                              <UserPlus size={18} />
                              <span>+ إضافة مبدع / مساهم آخر لهذا العمل</span>
                            </button>
                          </div>
                        )
                      })()
                    ) : (
                      <input
                        type={field.type ?? 'text'}
                        value={String(form[field.key] ?? '')}
                        onChange={(event) =>
                          setForm({
                            ...form,
                            [field.key]:
                              field.type === 'number'
                                ? Number(event.target.value)
                                : event.target.value,
                          })
                        }
                      />
                    )}

                    {/* Preview for fields containing direct image url */}
                    {(field.type === undefined || field.type === 'text' || field.type === 'textarea') &&
                      String(form[field.key] ?? '').includes('http') &&
                      (isImageField(field.key) || field.key.includes('url')) && (
                        <div className="cover-preview" style={{ marginTop: 8 }}>
                          <img
                            src={formatImageUrl(String(form[field.key]))}
                            alt="معاينة"
                            onLoad={() => setPreviewStatus((prev) => ({ ...prev, [field.key]: 'ok' }))}
                            onError={() => setPreviewStatus((prev) => ({ ...prev, [field.key]: 'error' }))}
                          />
                          {previewStatus[field.key] === 'ok' && (
                            <small className="field-ok">✅ رابط الصورة يعمل وتظهر المعاينة بنجاح</small>
                          )}
                          {previewStatus[field.key] === 'error' && (
                            <small className="field-warning">❌ تعذر تحميل الصورة من هذا الرابط</small>
                          )}
                        </div>
                      )}
                  </label>
                ))}

                <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                  <button className="primary-action" type="button" onClick={saveRow} disabled={saving} style={{ flex: 1 }}>
                    {saving ? <Loader2 className="spin" size={18} /> : <Save size={18} />}
                    {editingId ? 'حفظ التعديلات' : 'إضافة العنصر'}
                  </button>
                  {editingId && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingId(null)
                        if (activeConfig) setForm(emptyForm(activeConfig))
                      }}
                      style={{
                        padding: '10px 18px',
                        borderRadius: '8px',
                        border: '1px solid #d8dfeb',
                        background: '#fff',
                        color: '#475467',
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      إلغاء
                    </button>
                  )}
                </div>
              </form>

            <section className="table-panel">
              <div className="panel-header">
                <h3>العناصر الحالية</h3>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <button type="button" onClick={() => loadTable(activeConfig.key)}>
                    <RefreshCw size={16} />
                    تحديث
                  </button>
                </div>
              </div>

              {loading ? (
                <div className="center-state">
                  <Loader2 className="spin" size={24} />
                  <p>جارٍ تحميل البيانات من Firebase Firestore...</p>
                </div>
              ) : rows.length === 0 ? (
                <div className="center-state">
                  <p>لا توجد بيانات مضافة حتى الآن في هذا القسم.</p>
                </div>
              ) : (
                <div className="table-wrapper">
                  <table>
                    <thead>
                      <tr>
                        {activeConfig.fields.map((field) => (
                          <th key={field.key}>{field.label}</th>
                        ))}
                        <th>إجراءات</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row) => (
                        <tr key={String(row.id)}>
                          {activeConfig.fields.map((field) => {
                            const value = row[field.key]
                            if (field.type === 'cover_select') {
                              return <td key={field.key}>{getCoverTitle(value)}</td>
                            }
                            if (field.type === 'boolean') {
                              return (
                                <td key={field.key}>
                                  <span className={`status-pill ${value ? 'active' : 'inactive'}`}>
                                    {value ? 'نعم' : 'لا'}
                                  </span>
                                </td>
                              )
                            }
                            if (field.key === 'target_gender') {
                              const g = String(value || 'all')
                              const isBoys = g === 'boys'
                              const isGirls = g === 'girls'
                              return (
                                <td key={field.key}>
                                  <span
                                    style={{
                                      background: isBoys ? '#e0f2fe' : isGirls ? '#fce7f3' : '#f3f4f6',
                                      color: isBoys ? '#0369a1' : isGirls ? '#be185d' : '#4b5563',
                                      padding: '4px 10px',
                                      borderRadius: '12px',
                                      fontWeight: 800,
                                      fontSize: '0.8rem',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '4px',
                                      whiteSpace: 'nowrap',
                                    }}
                                  >
                                    {isBoys ? '👦 بنين فقط' : isGirls ? '👧 بنات فقط' : '👥 الجميع'}
                                  </span>
                                </td>
                              )
                            }
                            if (field.key === 'creator_name') {
                              const rawRowCreators = row.creators as unknown
                              const creatorsArr: CreatorEntry[] =
                                Array.isArray(rawRowCreators) && rawRowCreators.length > 0
                                  ? (rawRowCreators as CreatorEntry[])
                                  : (value ? [{ name: String(value), role: String(row.creator_role || '') }] : [])
                              if (creatorsArr.length === 0) {
                                return (
                                  <td key={field.key}>
                                    <span style={{ color: '#94a3b8', fontSize: '0.8rem' }}>—</span>
                                  </td>
                                )
                              }
                              return (
                                <td key={field.key}>
                                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                                    {creatorsArr.map((c, i) => (
                                      <span
                                        key={i}
                                        style={{
                                          display: 'inline-flex',
                                          alignItems: 'center',
                                          gap: '4px',
                                          background: '#fef3c7',
                                          color: '#92400e',
                                          padding: '3px 8px',
                                          borderRadius: '6px',
                                          fontWeight: 700,
                                          fontSize: '0.8rem',
                                          whiteSpace: 'nowrap',
                                          border: '1px solid #fde68a',
                                        }}
                                      >
                                        🎨 {c.name}
                                        {c.role ? (
                                          <span style={{ opacity: 0.85, fontWeight: 500, fontSize: '0.74rem' }}>
                                            ({c.role})
                                          </span>
                                        ) : null}
                                      </span>
                                    ))}
                                  </div>
                                </td>
                              )
                            }
                            if (field.key === 'phone' && value) {
                              return (
                                <td key={field.key}>
                                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: '#dcfce7', color: '#166534', padding: '3px 8px', borderRadius: '6px', fontWeight: 700, fontSize: '0.8rem', direction: 'ltr', whiteSpace: 'nowrap' }}>
                                    📱 {String(value)}
                                  </span>
                                </td>
                              )
                            }
                            if (isImageField(field.key) && value) {
                              const imgUrl = String(value)
                              return (
                                <td key={field.key}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <img
                                      src={formatImageUrl(imgUrl.split(',')[0].trim())}
                                      alt=""
                                      style={{ width: '36px', height: '36px', objectFit: 'cover', borderRadius: '4px' }}
                                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                                    />
                                    <span style={{ maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '0.78rem' }}>
                                      {imgUrl}
                                    </span>
                                  </div>
                                </td>
                              )
                            }
                            return (
                              <td key={field.key} className="cell-truncate">
                                {Array.isArray(value) ? value.join(', ') : String(value ?? '-')}
                              </td>
                            )
                          })}
                          <td>
                            <div className="row-actions">
                              <button type="button" onClick={() => editRow(row)} title="تعديل">
                                <Edit3 size={16} />
                              </button>
                              {activeConfig.key === 'admins' && (
                                <button
                                  type="button"
                                  onClick={() => toggleAdminAccess(row)}
                                  title={row.is_active ? 'تعطيل المشرف' : 'تفعيل المشرف'}
                                >
                                  {row.is_active ? <UserX size={16} /> : <UserCheck size={16} />}
                                </button>
                              )}
                              {activeConfig.key !== 'app_settings' && (
                                <button
                                  type="button"
                                  className="danger"
                                  onClick={() => deleteRow(row)}
                                  title="حذف"
                                >
                                  <Trash2 size={16} />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </section>
        ) : null}
      </main>
    </div>
  )
}
