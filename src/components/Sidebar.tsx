import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  LayoutDashboard, 
  BookOpen, 
  Tv, 
  GraduationCap, 
  Music, 
  BookOpenCheck, 
  Sparkles, 
  Users, 
  Settings, 
  LogOut 
} from 'lucide-react';

const Sidebar: React.FC = () => {
  const { profile, signOut } = useAuth();

  const menuItems = [
    { name: 'لوحة التحكم', path: '/', icon: LayoutDashboard, permission: 'general' },
    { name: 'إعدادات الأقسام', path: '/settings', icon: Settings, permission: 'general' },
    { name: 'إدارة الكتب', path: '/books', icon: BookOpen, permission: 'general' },
    { name: 'الأنمي والكرتون', path: '/anime', icon: Tv, permission: 'general' },
    { name: 'الكورسات التعليمية', path: '/courses', icon: GraduationCap, permission: 'courses' },
    { name: 'طيور الجنة', path: '/toyor-al-janah', icon: Music, permission: 'children' },
    { name: 'القصص الكرتونية', path: '/stories', icon: BookOpenCheck, permission: 'children' },
    { name: 'المحتوى الديني', path: '/religious', icon: Sparkles, permission: 'teens' },
  ];

  const hasPermission = (permission: string) => {
    if (!profile) return false;
    if (profile.role === 'super_admin') return true;
    if (permission === 'general') return true;
    return profile.permissions.includes(permission) || profile.permissions.includes('general');
  };

  return (
    <div className="w-64 bg-primary text-white flex flex-col h-screen fixed right-0 top-0 border-l border-primary-light">
      <div className="p-6 text-center border-b border-primary-light">
        <h1 className="text-2xl font-extrabold tracking-wider text-gold flex items-center justify-center gap-2">
          <img src="/logo.png" alt="أجيال الإيمان" className="w-8 h-8 rounded-lg object-cover shadow border border-gold/30" />
          <span>أجيال الإيمان</span>
        </h1>
        <p className="text-xs text-gray-300 mt-1">لوحة التحكم والإدارة</p>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-1">
        {menuItems.map((item) => {
          if (!hasPermission(item.permission)) return null;
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
                  isActive
                    ? 'bg-gold text-primary font-bold shadow-md shadow-gold/10'
                    : 'text-gray-300 hover:bg-primary-light hover:text-white'
                }`
              }
            >
              <Icon size={20} />
              <span>{item.name}</span>
            </NavLink>
          );
        })}

        {profile?.role === 'super_admin' && (
          <NavLink
            to="/admins"
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
                isActive
                  ? 'bg-gold text-primary font-bold shadow-md'
                  : 'text-gray-300 hover:bg-primary-light hover:text-white'
              }`
            }
          >
            <Users size={20} />
            <span>إدارة المشرفين</span>
          </NavLink>
        )}
      </div>

      <div className="p-4 border-t border-primary-light">
        <div className="flex items-center justify-between bg-primary-dark p-3 rounded-xl mb-3">
          <div className="truncate">
            <p className="text-sm font-semibold truncate">{profile?.username}</p>
            <p className="text-xs text-gray-400 capitalize">{profile?.role === 'super_admin' ? 'مدير عام' : 'مشرف محتوى'}</p>
          </div>
        </div>
        <button
          onClick={signOut}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-red-600/20 hover:bg-red-600/80 text-red-300 hover:text-white transition-all duration-200 text-sm font-semibold"
        >
          <LogOut size={16} />
          تسجيل الخروج
        </button>
      </div>
    </div>
  );
};

export default Sidebar;
