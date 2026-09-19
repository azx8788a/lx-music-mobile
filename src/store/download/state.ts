
interface InitState {
  taskList: LX.Download.ListItem[]
  pickerInfo: {
    musicInfo: LX.Music.MusicInfoOnline
  } | null
}
const state: InitState = {
  taskList: [],
  pickerInfo: null,
}


export {
  state,
}
