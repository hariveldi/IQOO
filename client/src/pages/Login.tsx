import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { LoginSchema } from '@iqoo/shared'
import { apiClient } from '../services/api'
import { useAuthStore } from '../store'

type LoginInputs = {
  email: string
  password: string
}

export default function LoginPage() {
  const navigate = useNavigate()
  const setUser = useAuthStore((state) => state.setUser)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  const { register, handleSubmit, formState: { errors } } = useForm<LoginInputs>({
    resolver: zodResolver(LoginSchema),
  })

  const onSubmit = async (data: LoginInputs) => {
    setIsLoading(true)
    setError('')

    try {
      const response = await apiClient.login(data.email, data.password)
      apiClient.setToken(response.data.accessToken, response.data.refreshToken)
      setUser(response.data.user)
      navigate('/')
    } catch (err: any) {
      setError(err.response?.data?.error || 'Login failed')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-500 to-blue-600 p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-lg shadow-xl p-8">
          <h1 className="text-3xl font-bold text-center text-gray-900 mb-2">iQOO</h1>
          <p className="text-center text-gray-600 mb-8">AI Productivity Platform</p>

          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <input
                type="email"
                id="email"
                {...register('email')}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="you@example.com"
              />
              {errors.email && <p className="text-red-500 text-sm mt-1">{errors.email.message}</p>}
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                Password
              </label>
              <input
                type="password"
                id="password"
                {...register('password')}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="••••••••"
              />
              {errors.password && <p className="text-red-500 text-sm mt-1">{errors.password.message}</p>}
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-blue-500 text-white font-medium py-2 rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50"
            >
              {isLoading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <p className="text-center text-gray-600 mt-6">
            Don't have an account?{' '}
            <a href="/register" className="text-blue-500 hover:underline font-medium">
              Register
            </a>
          </p>

          {/* Demo credentials */}
          <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
            <p className="text-sm text-gray-700 font-medium mb-2">Demo Credentials:</p>
            <p className="text-xs text-gray-600">Email: demo@example.com</p>
            <p className="text-xs text-gray-600">Password: password</p>
          </div>
        </div>
      </div>
    </div>
  )
}
