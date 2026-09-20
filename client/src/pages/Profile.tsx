import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store'
import { apiClient } from '../services/api'
import { LogOut } from 'lucide-react'

export default function ProfilePage() {
  const navigate = useNavigate()
  const user = useAuthStore((state) => state.user)
  const setUser = useAuthStore((state) => state.setUser)

  const handleLogout = () => {
    apiClient.logout()
    setUser(null)
    navigate('/login')
  }

  return (
    <div className="w-full max-w-2xl mx-auto p-4 pb-24 md:pb-4">
      <h1 className="text-3xl font-bold text-gray-900 mb-6">Profile</h1>

      {user && (
        <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-16 h-16 bg-gradient-to-br from-blue-400 to-blue-600 rounded-full flex items-center justify-center text-white text-2xl font-bold">
              {user.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">{user.name}</h2>
              <p className="text-gray-600">{user.email}</p>
            </div>
          </div>

          <hr className="mb-6" />

          <div className="space-y-4 mb-6">
            <div>
              <p className="text-sm font-medium text-gray-700">Name</p>
              <p className="text-gray-900">{user.name}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-700">Email</p>
              <p className="text-gray-900">{user.email}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-700">Member Since</p>
              <p className="text-gray-900">
                {new Date((user as any).createdAt || Date.now()).toLocaleDateString()}
              </p>
            </div>
          </div>

          <hr className="mb-6" />

          <div className="space-y-3">
            <button className="w-full px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium">
              Edit Profile
            </button>
            <button className="w-full px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium">
              Settings
            </button>
            <button
              onClick={handleLogout}
              className="w-full px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors font-medium flex items-center justify-center gap-2"
            >
              <LogOut className="w-5 h-5" />
              Logout
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
