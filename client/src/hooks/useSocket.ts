import { useEffect, useRef, useCallback } from 'react'
import { io, Socket } from 'socket.io-client'
import { useTrainingStore } from '@/stores/trainingStore'
import type { MeasurementSample } from '@/types'

const SOCKET_URL = import.meta.env.VITE_API_URL ?? ''

let socketInstance: Socket | null = null

function getSocket(): Socket {
  if (!socketInstance || !socketInstance.connected) {
    socketInstance = io(SOCKET_URL, {
      withCredentials: true,
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    })
  }
  return socketInstance
}

/** 실시간 훈련 Socket.IO 훅 */
export function useTrainingSocket() {
  const socketRef = useRef<Socket | null>(null)
  const { addSample, startSession, endSession } = useTrainingStore()

  const connect = useCallback(() => {
    const socket = getSocket()
    socketRef.current = socket

    socket.on('measurement', (data: MeasurementSample) => {
      addSample(data)
    })

    socket.on('session_started', (data: { session_id: number; level: number; target_cycles: number }) => {
      startSession(data.session_id, data.level, data.target_cycles)
    })

    socket.on('session_ended', () => {
      endSession()
    })

    return socket
  }, [addSample, startSession, endSession])

  const emitStart = useCallback((level: number, targetCycles = 30) => {
    socketRef.current?.emit('start_session', { level, target_cycles: targetCycles })
  }, [])

  const emitEnd = useCallback(() => {
    socketRef.current?.emit('end_session')
  }, [])

  useEffect(() => {
    connect()
    return () => {
      socketRef.current?.off('measurement')
      socketRef.current?.off('session_started')
      socketRef.current?.off('session_ended')
    }
  }, [connect])

  return { emitStart, emitEnd, socket: socketRef.current }
}
