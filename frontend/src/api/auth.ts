import api from './client'
import type {
  LoginResponse,
  RegisterPayload,
  User,
} from './types'

export const authApi = {
  login: async (email: string, password: string): Promise<LoginResponse> => {
    const { data } = await api.post('/auth/login/', { email, password })
    return data
  },

  googleLogin: async (token: string): Promise<LoginResponse> => {
    const { data } = await api.post('/auth/google-login/', { token })
    return data
  },

  register: async (payload: RegisterPayload): Promise<LoginResponse> => {
    const { data } = await api.post('/auth/register/', payload)
    return data
  },

  logout: async (refreshToken: string): Promise<void> => {
    await api.post('/auth/logout/', { refresh: refreshToken })
  },

  refreshToken: async (refresh: string): Promise<{ access: string }> => {
    const { data } = await api.post('/auth/token/refresh/', { refresh })
    return data
  },

  getProfile: async (): Promise<User> => {
    const { data } = await api.get('/auth/me/')
    return data
  },

  updateProfile: async (payload: Partial<User>): Promise<User> => {
    const { data } = await api.patch('/auth/me/', payload)
    return data
  },

  changePassword: async (oldPassword: string, newPassword: string, confirmPassword: string): Promise<void> => {
    await api.post('/auth/password/change/', {
      old_password: oldPassword,
      new_password: newPassword,
      new_password_confirm: confirmPassword,
    })
  },
}
