import { useEffect, useState } from 'react'
import { state } from './state'
import { event } from './event'

export const useTaskList = () => {
  const [value, update] = useState(state.taskList)

  useEffect(() => {
    event.on('list_changed', update)
    return () => {
      event.off('list_changed', update)
    }
  }, [])

  return value
}
