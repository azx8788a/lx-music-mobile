import { downloadFile, stopDownload, existsFile, mkdir, moveFile, unlink, externalStorageDirectoryPath } from '@/utils/fs'
import { getMusicUrl } from '@/core/music'
import { saveData, getData } from '@/plugins/storage'
import { storageDataPrefix } from '@/config/constant'
import settingState from '@/store/setting/state'
import * as downloadAction from '@/store/download/action'
import { state as downloadState } from '@/store/download/state'
import { toast } from '@/utils/tools'
import { showStoragePermissionDialog, testDirWritable, collectStorageDiagnostics } from '@/utils/storagePermission'
import { sizeFormate } from '@/utils/common'
import { showDownloadModal, showDownloadManagerModal } from '@/navigation/utils'
import { log } from '@/utils/log'
import { writeDownloadMetadata } from './metadata'


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

// 下载错误码：
// DL_URL_001 获取音乐链接失败 / DL_HTTP_001 下载响应 HTTP 状态码非 2xx / DL_NET_001 下载请求失败（网络/空文件）
// DL_FS_001 下载目录不可用 / DL_FS_002 文件写入失败 / DL_FS_003 文件移动失败 / DL_TASK_001 其他任务异常
const createDownloadError = (code: string, phase: string, message: string): Error & { code: string, phase: string } => {
  const err = new Error(message) as Error & { code: string, phase: string }
  err.code = code
  err.phase = phase
  return err
}

// 由异常与当前阶段推导错误码
const resolveErrorCode = (err: any, phase: string): { code: string, phase: string } => {
  if (typeof err.code == 'string' && err.code.startsWith('DL_')) {
    return { code: err.code, phase: typeof err.phase == 'string' ? err.phase : phase }
  }
  const nativeCode = String(err.code ?? '')
  if (nativeCode == 'ENOENT' || nativeCode == 'EISDIR' || nativeCode == 'ENOSPC') return { code: 'DL_FS_002', phase }
  switch (phase) {
    case 'get-url': return { code: 'DL_URL_001', phase }
    case 'prepare-dir': return { code: 'DL_FS_001', phase }
    case 'move': return { code: 'DL_FS_003', phase }
    default: return { code: 'DL_NET_001', phase }
  }
}

// 尝试创建目录并验证真实可写性
// 注意：不能依赖 existsFile 预判（无权限时可能返回 false），直接 mkdir 并容忍 EEXIST
const tryPrepareSaveDir = async(dir: string): Promise<boolean> => {
  try {
    await mkdir(dir)
  } catch (err) {
    const msg = String((err as Error).message ?? err)
    // 已存在（EEXIST）视为成功，其余情况记录日志后继续走存在性检查
    if (!/exist/i.test(msg)) log.warn(`[下载] 创建目录失败：${dir}（${msg}）`)
  }
  if (!await existsFile(dir)) return false
  // 写入探针验证真实可写性（部分机型上目录存在但写入被拦截）
  return testDirWritable(dir)
}

// 防止多任务场景下授权窗口叠加弹出（用对象包装，避免跨 await 赋值触发 eslint 警告）
const permissionLock = { requesting: false }

// 确保下载目录可用：不可用时弹授权引导窗口，用户完成授权后重试
const ensureSaveDir = async(dir: string, onWaitPermission?: () => void): Promise<boolean> => {
  if (await tryPrepareSaveDir(dir)) return true
  log.warn(`[下载] 目录不可用，引导用户授权存储权限：${dir}`)

  if (permissionLock.requesting) {
    // 授权窗口已弹出中，本次不重复弹出
    log.warn('[下载] 授权窗口已弹出，等待用户处理')
    return false
  }
  permissionLock.requesting = true
  if (onWaitPermission) onWaitPermission()
  let granted = false
  try {
    granted = await showStoragePermissionDialog()
  } finally {
    permissionLock.requesting = false
  }
  if (!granted) {
    log.warn('[下载] 用户未完成存储授权，任务失败')
    return false
  }

  return tryPrepareSaveDir(dir)
}

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
  task.errorCode = undefined
  task.errorPhase = undefined
  downloadAction.updateTask(task)
  log.info(`[下载] 开始任务 ${task.id}：${task.metadata.musicInfo.name} - ${task.metadata.musicInfo.singer}（音质: ${task.metadata.quality}）`)

  let phase = 'get-url'
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
        log.info(`[下载] 任务 ${task.id} 尝试换源`)
      },
    })
    const current = downloadState.taskList.find(t2 => t2.id == task.id)
    if (!current || current.status != 'run') return
    task.metadata.url = url
    task.statusText = global.i18n.t('download_status_downloading')
    downloadAction.updateTask(task)
    // 日志不记录完整链接，只记录域名，避免日志泄漏
    log.info(`[下载] 任务 ${task.id} 获取链接成功（域名: ${url.split('//')[1]?.split('/')[0] ?? '-'}）`)

    const ext = qualityExt(task.metadata.quality)
    task.metadata.ext = ext
    task.metadata.fileName = buildFileName(task.metadata.musicInfo, ext)
    task.metadata.filePath = `${getSaveDir()}/${task.metadata.fileName}`

    phase = 'prepare-dir'
    if (!await ensureSaveDir(getSaveDir(), () => {
      const t2 = downloadState.taskList.find(t => t.id == task.id)
      if (t2) {
        t2.statusText = global.i18n.t('download_status_wait_permission')
        downloadAction.updateTask(t2)
      }
    })) {
      throw createDownloadError('DL_FS_001', phase, `下载目录不可用，请检查存储权限或下载路径设置（${getSaveDir()}）`)
    }

    const tmpPath = `${task.metadata.filePath}.dlpart`

    // 清理旧临时文件（失败不阻塞，稍后覆盖写入）
    try {
      if (await existsFile(tmpPath)) await unlink(tmpPath)
    } catch (err) {
      log.warn(`[下载] 任务 ${task.id} 清理临时文件失败：${tmpPath}（${(err as Error).message}）`)
    }

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

    phase = 'download'
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

    const result = await promise
    currentJobId = null

    // react-native-fs 对非 2xx 状态码不会抛错，需要手动检查，否则错误响应会被当作下载成功
    if (result.statusCode < 200 || result.statusCode >= 300) {
      throw createDownloadError('DL_HTTP_001', phase, `HTTP 状态码 ${result.statusCode}`)
    }
    if (!result.bytesWritten) {
      throw createDownloadError('DL_NET_001', phase, '下载内容为空')
    }
    log.info(`[下载] 任务 ${task.id} 下载完成，大小: ${sizeFormate(result.bytesWritten)}（HTTP ${result.statusCode}）`)

    phase = 'move'
    try {
      await moveFile(tmpPath, task.metadata.filePath)
    } catch (err) {
      throw createDownloadError('DL_FS_003', phase, `文件移动失败（${(err as Error).message}）`)
    }
    if (!await existsFile(task.metadata.filePath)) {
      throw createDownloadError('DL_FS_003', phase, '文件移动后不存在，请检查存储权限或路径设置')
    }

    // 下载完成后的元数据处理是附加步骤，失败不影响音频文件本身完成。
    if (speedTimer) { clearInterval(speedTimer); speedTimer = null }
    let metadataFailed: string[] = []
    if (settingState.setting['download.isWriteMetadata'] || settingState.setting['download.isSaveLyric']) {
      task.statusText = global.i18n.t('download_status_write_metadata')
      downloadAction.updateTask(task)
      try {
        metadataFailed = await writeDownloadMetadata(task)
      } catch (err) {
        metadataFailed = ['metadata']
        const message = err instanceof Error ? err.message : String(err)
        log.warn(`[下载] 任务 ${task.id} 元数据处理异常：${message}`)
      }
    }

    // 下载完成
    task.isComplate = true
    task.status = 'completed'
    task.statusText = ''
    task.progress = 1
    downloadAction.updateTask(task)
    log.info(`[下载] 任务 ${task.id} 已完成：${task.metadata.filePath}`)
    if (metadataFailed.length) {
      log.warn(`[下载] 任务 ${task.id} 部分元数据写入失败：${metadataFailed.join('、')}`)
      toast(global.i18n.t('download_success_metadata_warn'))
    } else {
      toast(global.i18n.t('download_success'))
    }
  } catch (err: any) {
    if (speedTimer) { clearInterval(speedTimer); speedTimer = null }
    if (isPaused) return
    const t = downloadState.taskList.find(t2 => t2.id == task.id)
    if (!t) return
    const resolved = resolveErrorCode(err, phase)
    t.status = 'error'
    t.errorCode = resolved.code
    t.errorPhase = resolved.phase
    t.statusText = err.message ?? 'unknown error'
    downloadAction.updateTask(t)
    log.error(`[下载] 任务 ${task.id} 失败 [${resolved.code}]（阶段: ${resolved.phase}）：${t.statusText}`)
    // 文件系统类失败时收集存储诊断信息，便于排查国产 ROM 二级权限墙等问题
    if (resolved.code.startsWith('DL_FS_') || resolved.code === 'DL_NET_001') {
      void collectStorageDiagnostics().then(info => {
        log.error(`[下载] 存储诊断信息:\n${info}`)
      })
    }
    toast(global.i18n.t('download_fail_tip', { code: resolved.code }))
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
  if (loaded.length) {
    log.info(`[下载] 启动恢复 ${loaded.length} 个下载任务`)
    void runNext()
  }
}

const findTaskIdx = (id: string) => downloadState.taskList.findIndex(t => t.id == id)

export const createDownloadTask = async({ musicInfo, quality, showTip = true }: {
  musicInfo: LX.Music.MusicInfoOnline
  quality: LX.Quality
  showTip?: boolean
}): Promise<boolean> => {
  const ext = qualityExt(quality)
  const fileName = buildFileName(musicInfo, ext)
  const filePath = `${getSaveDir()}/${fileName}`
  if (downloadState.taskList.some(t => t.metadata.filePath == filePath && t.status != 'completed' && t.status != 'error')) {
    log.warn(`[下载] 跳过创建（已存在同名任务）：${musicInfo.name}（${filePath}）`)
    toast(global.i18n.t('download_task_exist'))
    return false
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
  log.info(`[下载] 创建任务 ${task.id}：${musicInfo.name} - ${musicInfo.singer}（音质: ${quality}，保存到: ${filePath}）`)
  if (showTip) toast(global.i18n.t('download_starting'))
  void runNext()
  return true
}

export const pauseTask = (id: string) => {
  const jobId = currentJobId
  const isCurrent = currentTaskId == id && jobId != null
  if (isCurrent) {
    isPaused = true
    stopDownload(jobId)
    if (speedTimer) { clearInterval(speedTimer); speedTimer = null }
    currentJobId = null
  }
  const t = downloadState.taskList.find(t2 => t2.id == id)
  if (isCurrent && t && t.status == 'run') {
    t.status = 'pause'
    t.statusText = ''
    downloadAction.updateTask(t)
    throttleSave()
    log.info(`[下载] 任务 ${id} 已暂停`)
  }
}

export const resumeTask = (id: string) => {
  const t = downloadState.taskList.find(t2 => t2.id == id)
  if (t && t.status == 'pause') {
    t.status = 'waiting'
    t.statusText = ''
    downloadAction.updateTask(t)
    throttleSave()
    log.info(`[下载] 任务 ${id} 继续下载`)
    void runNext()
  }
}

export const retryTask = (id: string) => {
  const idx = findTaskIdx(id)
  if (idx < 0) return
  const t = { ...downloadState.taskList[idx] }
  t.status = 'waiting'
  t.statusText = ''
  t.errorCode = undefined
  t.errorPhase = undefined
  t.downloaded = 0
  t.total = 0
  t.progress = 0
  t.speed = ''
  t.metadata.url = null
  downloadAction.updateTask(t)
  throttleSave()
  log.info(`[下载] 任务 ${id} 重试`)
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
  log.info(`[下载] 任务 ${id} 已从列表移除`)
  if (!isCurrent) void runNext()
}

export const createDownloadTasks = async(list: LX.Music.MusicInfoOnline[]) => {
  if (!list.length) {
    log.warn('[下载] 批量下载调用时歌曲列表为空，已忽略')
    return
  }
  log.info(`[下载] 发起批量下载，共 ${list.length} 首`)
  let added = 0
  for (const musicInfo of list) {
    const supported = global.lx.qualityList[musicInfo.source] ?? []
    const quality = supported.includes(settingState.setting['download.quality'])
      ? settingState.setting['download.quality']
      : supported[0] ?? '320k'
    if (await createDownloadTask({ musicInfo, quality, showTip: false })) added++
  }
  if (added) toast(global.i18n.t('download_tasks_started', { num: added }))
}

export const selectAndDownload = (musicInfo: LX.Music.MusicInfoOnline) => {
  log.info(`[下载] 打开下载选择弹窗：${musicInfo.name} - ${musicInfo.singer}`)
  downloadAction.setPickerInfo({ musicInfo })
  showDownloadModal()
}

export const openDownloadManager = () => {
  showDownloadManagerModal()
}
