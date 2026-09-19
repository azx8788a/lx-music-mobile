import { state } from './state'
import { event } from './event'

export const setPickerInfo = (info: { musicInfo: LX.Music.MusicInfoOnline } | null) => {
  state.pickerInfo = info
}

export const setTaskList = (list: LX.Download.ListItem[]) => {
  state.taskList = list
  event.list_changed([...list])
}

export const addTask = (task: LX.Download.ListItem) => {
  state.taskList.unshift({ ...task })
  event.list_changed([...state.taskList])
}

export const updateTask = (task: LX.Download.ListItem) => {
  const index = state.taskList.findIndex(t => t.id == task.id)
  if (index > -1) state.taskList[index] = { ...task }
  event.list_changed([...state.taskList])
  event.task_changed({ ...task })
}

export const removeTask = (id: string) => {
  const index = state.taskList.findIndex(t => t.id == id)
  if (index < 0) return
  state.taskList.splice(index, 1)
  event.list_changed([...state.taskList])
}
