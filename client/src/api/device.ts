import { api } from './client'
import type { Device } from '@/types'

export const deviceApi = {
  list: () => api.get<{ devices: Device[] }>('/api/devices'),
  pair: (device_id: string, mac_address?: string) =>
    api.post<{ device: Device }>('/api/devices/pair', { device_id, mac_address }),
  test: (id: number, level: number) =>
    api.post(`/api/devices/${id}/test`, { level }),
  remove: (id: number) => api.delete(`/api/devices/${id}`),
}
