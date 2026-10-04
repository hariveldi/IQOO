import React from 'react'
import { Home, CheckSquare, FolderOpen, Brain, User, BarChart3, Inbox, Radio } from 'lucide-react'
import { NavLink } from 'react-router-dom'

export const BottomNavigation: React.FC = () => {
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 safe-area-inset-bottom md:relative md:border-t-0 md:border-r md:w-16">
      <div className="flex md:flex-col h-16 md:h-screen justify-around md:justify-start md:pt-4 md:gap-2">
        <NavLink
          to="/"
          className={({ isActive }) =>
            `flex items-center justify-center p-3 transition-colors ${
              isActive ? 'text-blue-600 bg-blue-50' : 'text-gray-600 hover:bg-gray-50'
            }`
          }
          title="Home"
        >
          <Home className="w-6 h-6" />
        </NavLink>
        <NavLink
          to="/inbox"
          className={({ isActive }) =>
            `flex items-center justify-center p-3 transition-colors ${
              isActive ? 'text-blue-600 bg-blue-50' : 'text-gray-600 hover:bg-gray-50'
            }`
          }
          title="Inbox"
        >
          <Inbox className="w-6 h-6" />
        </NavLink>
        <NavLink
          to="/tasks"
          className={({ isActive }) =>
            `flex items-center justify-center p-3 transition-colors ${
              isActive ? 'text-blue-600 bg-blue-50' : 'text-gray-600 hover:bg-gray-50'
            }`
          }
          title="Tasks"
        >
          <CheckSquare className="w-6 h-6" />
        </NavLink>
        <NavLink
          to="/projects"
          className={({ isActive }) =>
            `flex items-center justify-center p-3 transition-colors ${
              isActive ? 'text-blue-600 bg-blue-50' : 'text-gray-600 hover:bg-gray-50'
            }`
          }
          title="Projects"
        >
          <FolderOpen className="w-6 h-6" />
        </NavLink>
        <NavLink
          to="/dashboard"
          className={({ isActive }) =>
            `flex items-center justify-center p-3 transition-colors ${
              isActive ? 'text-blue-600 bg-blue-50' : 'text-gray-600 hover:bg-gray-50'
            }`
          }
          title="Dashboard"
        >
          <BarChart3 className="w-6 h-6" />
        </NavLink>
        <NavLink
          to="/ambient"
          className={({ isActive }) =>
            `flex items-center justify-center p-3 transition-colors ${
              isActive ? 'text-indigo-600 bg-indigo-50' : 'text-gray-600 hover:bg-gray-50'
            }`
          }
          title="Ambient AI"
        >
          <Radio className="w-6 h-6" />
        </NavLink>
        <NavLink
          to="/ai"
          className={({ isActive }) =>
            `flex items-center justify-center p-3 transition-colors ${
              isActive ? 'text-blue-600 bg-blue-50' : 'text-gray-600 hover:bg-gray-50'
            }`
          }
          title="AI Assistant"
        >
          <Brain className="w-6 h-6" />
        </NavLink>
        <NavLink
          to="/profile"
          className={({ isActive }) =>
            `flex items-center justify-center p-3 transition-colors ${
              isActive ? 'text-blue-600 bg-blue-50' : 'text-gray-600 hover:bg-gray-50'
            }`
          }
          title="Profile"
        >
          <User className="w-6 h-6" />
        </NavLink>
      </div>
    </nav>
  )
}
