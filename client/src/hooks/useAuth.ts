import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { authApi } from '@/api/auth'
import { useAuthStore } from '@/stores/authStore'

export function useMe() {
  const { setUser } = useAuthStore()
  return useQuery({
    queryKey: ['me'],
    queryFn: async () => {
      const data = await authApi.me()
      setUser(data.user)
      return data.user
    },
    retry: false,
    staleTime: 1000 * 60 * 5,
  })
}

export function useLogin() {
  const { setUser } = useAuthStore()
  const navigate = useNavigate()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: authApi.login,
    onSuccess: (data) => {
      setUser(data.user)
      qc.invalidateQueries({ queryKey: ['me'] })
      navigate('/dashboard')
      toast.success(`안녕하세요, ${data.user.name}님!`)
    },
    onError: (err: Error) => {
      toast.error(err.message)
    },
  })
}

export function useSignup() {
  const { setUser } = useAuthStore()
  const navigate = useNavigate()

  return useMutation({
    mutationFn: authApi.signup,
    onSuccess: (data) => {
      setUser(data.user)
      navigate('/dashboard')
      toast.success('회원가입이 완료되었습니다!')
    },
    onError: (err: Error) => {
      toast.error(err.message)
    },
  })
}

export function useLogout() {
  const { setUser } = useAuthStore()
  const navigate = useNavigate()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: authApi.logout,
    onSuccess: () => {
      setUser(null)
      qc.clear()
      navigate('/login')
      toast.success('로그아웃되었습니다.')
    },
  })
}

export function useUpdateProfile() {
  const { setUser } = useAuthStore()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: authApi.updateMe,
    onSuccess: (data) => {
      setUser(data.user)
      qc.invalidateQueries({ queryKey: ['me'] })
      toast.success('프로필이 업데이트되었습니다.')
    },
    onError: (err: Error) => toast.error(err.message),
  })
}
