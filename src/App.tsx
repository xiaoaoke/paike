import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, 
  CalendarDays, 
  Settings, 
  Users, 
  BookOpen, 
  School, 
  BarChart3, 
  Bell, 
  Search,
  Menu,
  X,
  LogOut,
  ChevronDown,
  Eye,
  Loader2
} from 'lucide-react';
import { Toaster } from './components/ui/sonner';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { useAppStore } from './lib/store';
import Dashboard from './pages/Dashboard';
import ScheduleEditor from './pages/ScheduleEditor';
import ScheduleView from './pages/ScheduleView';
import RulesConfiguration from './pages/RulesConfiguration';
import DataManagement from './pages/DataManagement';
import Statistics from './pages/Statistics';

const NAV_ITEMS = [
  { id: 'dashboard', label: '工作台', icon: LayoutDashboard },
  { id: 'schedule', label: '排课中心', icon: CalendarDays },
  { id: 'view', label: '课表查看', icon: Eye },
  { id: 'data', label: '基础数据', icon: BookOpen },
  { id: 'rules', label: '规则设置', icon: Settings },
];

export default function App() {
  const [activeTab, setActiveTab] = useState(() => {
    const hash = window.location.hash.replace('#', '');
    return NAV_ITEMS.some(item => item.id === hash) ? hash : 'dashboard';
  });
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const { loading, error, initialize } = useAppStore();

  // 监听路由改变并同步状态
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace('#', '');
      if (NAV_ITEMS.some(item => item.id === hash)) {
        setActiveTab(hash);
      }
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // activeTab 发生变化时同步到路由
  useEffect(() => {
    if (window.location.hash.replace('#', '') !== activeTab) {
      window.location.hash = activeTab;
    }
  }, [activeTab]);

  useEffect(() => {
    initialize();
  }, [initialize]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-10 w-10 animate-spin text-indigo-600" />
          <p className="text-slate-600 font-medium">正在加载数据...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <div className="text-center max-w-md">
          <p className="text-red-600 font-bold text-lg mb-2">数据加载失败</p>
          <p className="text-slate-500 text-sm mb-4">{error}</p>
          <button onClick={() => initialize()} className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">
            重试
          </button>
        </div>
      </div>
    );
  }

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <Dashboard />;
      case 'schedule':
        return <ScheduleEditor />;
      case 'view':
        return <ScheduleView />;
      case 'rules':
        return <RulesConfiguration />;
      case 'data':
        return <DataManagement />;
      default:
        return <div className="p-8 text-slate-500">功能开发中...</div>;
    }
  };

  return (
    <DndProvider backend={HTML5Backend}>
      <div className="flex h-screen bg-slate-50 font-sans text-slate-900">
        <Toaster position="top-right" richColors />
                {/* Sidebar */}
        <aside 
          className={`${
            sidebarOpen ? 'w-64' : 'w-16'
          } bg-indigo-900 text-white transition-all duration-300 flex flex-col fixed h-full z-20 md:relative`}
        >
          {/* Logo Handle */}
          <div className={`h-16 flex items-center ${sidebarOpen ? 'justify-between px-4' : 'justify-center px-2'} border-b border-indigo-800 shrink-0`}>
            <div className={`flex items-center overflow-hidden whitespace-nowrap ${!sidebarOpen ? 'justify-center' : ''}`}>
              <div className="w-8 h-8 bg-indigo-500 rounded-lg flex items-center justify-center shrink-0">
                <School size={20} className="text-white" />
              </div>
              {sidebarOpen && (
                <span className="ml-3 font-bold text-lg">
                  智云排课
                </span>
              )}
            </div>
            {sidebarOpen && (
              <button 
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="p-1 hover:bg-indigo-800 rounded-md !hidden md:!block"
              >
                <Menu size={20} />
              </button>
            )}
            {sidebarOpen && (
              <button 
                onClick={() => setSidebarOpen(false)}
                className="p-1 hover:bg-indigo-800 rounded-md md:!hidden"
              >
                <X size={20} />
              </button>
            )}
          </div>

          <div className={`${sidebarOpen ? 'p-4' : 'p-2'} flex flex-col gap-1 flex-1 overflow-y-auto`}>
            {!sidebarOpen && (
              <button
                onClick={() => setSidebarOpen(true)}
                className="flex items-center justify-center p-2 mb-2 text-indigo-300 hover:bg-indigo-800/50 hover:text-white rounded-lg transition-colors"
                title="展开菜单"
              >
                <Menu size={18} />
              </button>
            )}
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;

              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`flex items-center ${sidebarOpen ? 'px-3 py-3' : 'justify-center p-3'} rounded-lg transition-colors overflow-hidden whitespace-nowrap
                    ${isActive 
                      ? 'bg-indigo-800 text-white font-medium' 
                      : 'text-indigo-200 hover:bg-indigo-800/50 hover:text-white'
                    }`}
                  title={!sidebarOpen ? item.label : undefined}
                >
                  <Icon size={20} className="shrink-0" />
                  {sidebarOpen && (
                    <span className="ml-3">
                      {item.label}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 flex flex-col h-screen overflow-hidden print:h-auto print:overflow-visible">
          {/* Header */}
          <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 shrink-0 print:hidden">
            <div className="flex items-center gap-4">
              <button 
                onClick={() => setSidebarOpen(true)}
                className="p-2 hover:bg-slate-100 rounded-md md:hidden text-slate-500"
              >
                <Menu size={20} />
              </button>
              
              <div className="relative hidden sm:block">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input 
                  type="text" 
                  placeholder="搜索班级或课程..." 
                  className="pl-10 pr-4 py-2 bg-slate-100 border-transparent rounded-lg text-sm focus:bg-white focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 transition-all outline-none w-64"
                />
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              {/* 取消了假登录相关的所有组件 */}
            </div>
          </header>

          {/* Content Area */}
          <div className="flex-1 overflow-auto bg-slate-50/50 print:overflow-visible print:bg-white">
            {renderContent()}
          </div>
        </main>
      </div>
    </DndProvider>
  );
}