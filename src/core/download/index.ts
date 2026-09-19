import { downloadFile, stopDownload, existsFile, mkdir, moveFile, unlink, externalStorageDirectoryPath } from '@/utils/fs'
import { getMusicUrl } from '@/core/music'
import { saveData, getData } from '@/plugins/storage'
import { storageDataPrefix } from '@/config/constant'
import settingState from '@/store/setting/state'
import * as downloadAction from '@/store/download/action'
import { state as downloadState } from '@/store/download/state'
import { toast } from '@/utils/tools'
import { sizeFormate } from '@/utils/common'
import { showDownloadModal, showDownloadManagerModal } from '@/navigation/utils'


const throttleSave = (() => {
  let timer: ReturnType<typeof setTimeout> | null = null
  return () => {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => {
      timer = null
      void saveData(storageDataPrefix.downloadTaskList, downloadState.taskList)
    }, 1000)
  }
})()

let isRunning = false
let currentJobId: number | null = null
let currentTaskId: string | null = null
let isPaused = false
let speedTimer: ReturnType<typeof setInterval> | null = null

const qualityExt = (q: LX.Quality): LX.Download.FileExt => {
  if (q == 'flac' || q == 'flac24bit') return 'flac'
  if (q == 'wav') return 'wav'
  if (q == 'ape') return 'ape'
  return 'mp3'
}

const getSaveDir = () => {
  return settingState.setting['download.savePath'] || `${externalStorageDirectoryPath}/Music`
}

// eslint-disable-next-line no-control-regex
const sanitize = (s: string) => s.replace(/[\\/:*?"<>|]/g, '').replace(/\x00/g, '')

const buildFileName = (info: LX.Music.MusicInfoOnline, ext: string) => {
  let name: string
  switch (settingState.setting['download.fileName']) {
    case '歌手 - 歌名': name = `${info.singer} - ${info.name}`; break
    case '歌名': name = info.name; break
    default: name = `${info.name} - ${info.singer}`
  }
  return `${sanitize(name)}.${ext}`
}

let lastProgressTime = 0
let lastProgressDownloaded = 0

const runNext = async() => {
  if (isRunning) return
  isPaused = false
  const task = downloadState.taskList.find(t => t.status == 'waiting')
  if (!task) { isRunning = false; return }
  isRunning = true
  currentTaskId = task.id
  task.status = 'run'
  task.statusText = global.i18n.t('download_status_get_url')
  downloadAction.updateTask(task)

  try {
    const url = await getMusicUrl({
      musicInfo: task.metadata.musicInfo,
      quality: task.metadata.quality,
      isRefresh: task.metadata.url == null,
      allowToggleSource: true,
      onToggleSource: () => {
        const t = downloadState.taskList.find(t2 => t2.id == task.id)
        if (t) {
          t.statusText = global.i18n.t('download_status_toggle_source')
          downloadAction.updateTask(t)
        }
      },
    })
    const current = downloadState.taskList.find(t2 => t2.id == task.id)
    if (!current || current.status != 'run') return
    task.metadata.url = url
    task.statusText = global.i18n.t('download_status_downloading')
    downloadAction.updateTask(task)

    const ext = qualityExt(task.metadata.quality)
    task.metadata.ext = ext
    task.metadata.fileName = buildFileName(task.metadata.musicInfo, ext)
    task.metadata.filePath = `${getSaveDir()}/${task.metadata.fileName}`

    await mkdir(getSaveDir()).catch(() => {})
    const tmpPath = `${task.metadata.filePath}.dlpart`

    // 清理旧临时文件
    if (await existsFile(tmpPath)) await unlink(tmpPath)

    lastProgressTime = Date.now()
    lastProgressDownloaded = 0
    speedTimer = setInterval(() => {
      const t = downloadState.taskList.find(t2 => t2.id == task.id)
      if (!t || t.downloaded <= lastProgressDownloaded) return
      const elapsed = Math.max(Date.now() - lastProgressTime, 100)
      const speed = ((t.downloaded - lastProgressDownloaded) / elapsed) * 1000
      lastProgressTime = Date.now()
      lastProgressDownloaded = t.downloaded
      t.speed = `${sizeFormate(speed)}/s`
      downloadAction.updateTask(t)
    }, 2000)

    const { jobId, promise } = downloadFile(url, tmpPath, {
      begin: (res) => {
        task.total = res.contentLength
        downloadAction.updateTask(task)
      },
      progress: (res) => {
        task.downloaded = res.bytesWritten
        task.total = res.contentLength
        task.progress = res.contentLength > 0 ? res.bytesWritten / res.contentLength : 0
        downloadAction.updateTask(task)
      },
      progressInterval: 500,
    })
    currentJobId = jobId

    await promise

    // 下载完成
    if (speedTimer) { clearInterval(speedTimer); speedTimer = null }
    await moveFile(tmpPath, task.metadata.filePath).catch(() => {})
    task.isComplate = true
    task.status = 'completed'
    task.statusText = ''
    task.progress = 1
    downloadAction.updateTask(task)
    toast(global.i18n.t('download_success'))
  } catch (err: any) {
    if (speedTimer) { clearInterval(speedTimer); speedTimer = null }
    if (isPaused) return
    const t = downloadState.taskList.find(t2 => t2.id == task.id)
    if (!t) return
    t.status = 'error'
    t.statusText = err.message ?? 'unknown error'
    downloadAction.updateTask(t)
  } finally {
    currentJobId = null
    currentTaskId = null
    // 串行队列复位统一放 finally，由 runNext 接续下一个任务，避免外部中断路径重复驱动
    // eslint-disable-next-line require-atomic-updates
    isRunning = false
    throttleSave()
    void runNext()
  }
}

export const initDownload = async() => {
  const loaded = await getData<LX.Download.ListItem[]>(storageDataPrefix.downloadTaskList) ?? []
  for (const t of loaded) {
    if (t.status == 'run') {
      t.status = 'waiting'
      t.statusText = ''
    }
  }
  downloadAction.setTaskList(loaded)
  if (loaded.length) void runNext()
}

const findTaskIdx = (id: string) => downloadState.taskList.findIndex(t => t.id == id)

export const createDownloadTask = async({ musicInfo, quality }: {
  musicInfo: LX.Music.MusicInfoOnline
  quality: LX.Quality
}) => {
  const ext = qualityExt(quality)
  const fileName = buildFileName(musicInfo, ext)
  const filePath = `${getSaveDir()}/${fileName}`
  if (downloadState.taskList.some(t => t.metadata.filePath == filePath && t.status != 'completed' && t.status != 'error')) {
    toast(global.i18n.t('download_task_exist'))
    return
  }
  const task: LX.Download.ListItem = {
    id: `dl_${Math.random().toString(36).substring(2, 8)}`,
    isComplate: false,
    status: 'waiting',
    statusText: '',
    downloaded: 0,
    total: 0,
    progress: 0,
    speed: '',
    metadata: { musicInfo, url: null, quality, ext, fileName, filePath },
  }
  downloadAction.addTask(task)
  throttleSave()
  void runNext()
}

export const pauseTask = (id: string) => {
  if (currentTaskId == id && currentJobId != null) {
    isPaused = true
    stopDownload(currentJobId)
    if (speedTimer) { clearInterval(speedTimer); speedTimer = null }
    currentJobId = null
  }
  const t = downloadState.taskList.find(t2 => t2.id == id)
  if (t && t.status == 'run') {
    t.status = 'pause'
    t.statusText = ''
    downloadAction.updateTask(t)
    throttleSave()
  }
}

export const resumeTask = (id: string) => {
  const t = downloadState.taskList.find(t2 => t2.id == id)
  if (t && t.status == 'pause') {
    t.status = 'waiting'
    t.statusText = ''
    downloadAction.updateTask(t)
    throttleSave()
    void runNext()
  }
}

export const retryTask = (id: string) => {
  const idx = findTaskIdx(id)
  if (idx < 0) return
  const t = { ...downloadState.taskList[idx] }
  t.status = 'waiting'
  t.statusText = ''
  t.downloaded = 0
  t.total = 0
  t.progress = 0
  t.speed = ''
  t.metadata.url = null
  downloadAction.updateTask(t)
  throttleSave()
  void runNext()
}

export const removeTask = async(id: string) => {
  const jobId = currentJobId
  const isCurrent = currentTaskId == id && jobId != null
  if (isCurrent) {
    isPaused = true
    stopDownload(jobId)
    if (speedTimer) { clearInterval(speedTimer); speedTimer = null }
    currentJobId = null
  }
  const t = downloadState.taskList.find(t2 => t2.id == id)
  downloadAction.removeTask(id)
  if (t) {
    void unlink(`${t.metadata.filePath}.dlpart`).catch(() => {})
  }
  throttleSave()
  if (!isCurrent) void runNext()
}

export const createDownloadTasks = async(list: LX.Music.MusicInfoOnline[]) => {
  for (const musicInfo of list) {
    const supported = global.lx.qualityList[musicInfo.source] ?? []
    const quality = supported.includes(settingState.setting['download.quality'])
      ? settingState.setting['download.quality']
      : supported[0] ?? '320k'
    await createDownloadTask({ musicInfo, quality })
  }
}

export const selectAndDownload = (musicInfo: LX.Music.MusicInfoOnline) => {
  downloadAction.setPickerInfo({ musicInfo })
  showDownloadModal()
}

export const openDownloadManager = () => {
  showDownloadManagerModal()
}
