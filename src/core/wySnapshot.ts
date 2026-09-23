// 网易云歌单快照：登录后自动保存全部歌单，支持定期更新与导出导入
import { getLoginStatus, getUserPlaylistList } from '@/utils/musicSdk/wy/userPlaylist'
import { getListDetailAll } from '@/core/songlist'
import { saveData, getData } from '@/plugins/storage'
import { storageDataPrefix } from '@/config/constant'
import settingState from '@/store/setting/state'
import { handleSaveFile, handleReadFile, confirmDialog } from '@/utils/tools'
import { log } from '@/utils/log'

export interface WySnapshotPlaylist {
  id: string
  name: string
  trackCount: number
  author: string
  img: string
  updatedAt: number
}

export interface WySnapshotMeta {
  uid: string
  updatedAt: number
  playlists: WySnapshotPlaylist[]
}

export interface WySnapshotProgress {
  done: number
  total: number
}

// 防止并发更新
const updateLock = { running: false }
export const isSnapshotUpdating = () => updateLock.running

// 读取快照元信息
export const getSnapshotMeta = async(): Promise<WySnapshotMeta | null> => {
  return getData<WySnapshotMeta>(storageDataPrefix.wySnapshotMeta)
}

// 读取某个歌单的歌曲
export const getSnapshotSongs = async(id: string): Promise<LX.Music.MusicInfoOnline[]> => {
  return await getData<LX.Music.MusicInfoOnline[]>(storageDataPrefix.wySnapshotSongs + id) ?? []
}

const sleep = async(ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms))

/**
 * 全量保存快照：拉取账号全部歌单及歌曲，串行保存（防限流）
 * 单个歌单失败不中断整体；失败时保留旧数据
 */
export const saveSnapshot = async(
  token: string,
  onProgress?: (progress: WySnapshotProgress) => void,
): Promise<{ playlists: WySnapshotPlaylist[], failed: number }> => {
  if (updateLock.running) throw new Error('snapshot updating')
  updateLock.running = true
  log.info('[WY 快照] 开始保存歌单快照')
  try {
    const profile = await getLoginStatus(token)
    const list = await getUserPlaylistList({ uid: profile.userId, token })
    const playlists = list.filter((item: any) => item.trackCount > 0)
    const oldMeta = await getSnapshotMeta()

    const saved: WySnapshotPlaylist[] = []
    let failed = 0
    for (let i = 0; i < playlists.length; i++) {
      const item = playlists[i]
      onProgress?.({ done: i, total: playlists.length })
      const oldInfo = oldMeta?.playlists.find(p => p.id == String(item.id))
      const info: WySnapshotPlaylist = {
        id: String(item.id),
        name: item.name,
        trackCount: item.trackCount,
        author: item.creator?.nickname ?? '',
        img: item.coverImgUrl ?? '',
        updatedAt: Date.now(),
      }
      try {
        // 带上 token 请求，保证私有歌单（收藏的私密歌单）也可拉取
        const songs = await getListDetailAll('wy', `${String(item.id)}###${token}`)
        await saveData(storageDataPrefix.wySnapshotSongs + info.id, songs)
        saved.push(info)
        log.info(`[WY 快照] 歌单「${info.name}」已保存（${songs.length} 首）`)
      } catch (err) {
        failed++
        log.warn(`[WY 快照] 歌单「${info.name}」保存失败: ${(err as Error).message}`)
        // 失败时保留旧数据（含旧更新时间）
        if (oldInfo) {
          const oldSongs = await getSnapshotSongs(info.id)
          if (oldSongs.length) {
            saved.push(oldInfo)
            continue
          }
        }
        saved.push(info)
      }
      // 串行间隔，降低限流风险
      if (i < playlists.length - 1) await sleep(800)
    }
    onProgress?.({ done: playlists.length, total: playlists.length })

    const meta: WySnapshotMeta = {
      uid: String(profile.userId ?? ''),
      updatedAt: Date.now(),
      playlists: saved,
    }
    await saveData(storageDataPrefix.wySnapshotMeta, meta)
    log.info(`[WY 快照] 保存完成，共 ${saved.length} 个歌单（失败 ${failed} 个）`)
    return { playlists: saved, failed }
  } finally {
    updateLock.running = false
  }
}

/**
 * 检查并按设置的间隔自动更新（12/24/48 小时；off 关闭）
 * 在登录成功、进入歌单页、App 启动时调用
 */
export const checkAndAutoUpdate = async(): Promise<{ updated: boolean, playlists?: WySnapshotPlaylist[] }> => {
  const interval = settingState.setting['wy.snapshotUpdateInterval']
  if (interval === 'off') return { updated: false }
  const token = settingState.setting['wy.musicUToken']
  if (!token) return { updated: false }
  const hours = parseInt(interval)
  if (!(hours > 0)) return { updated: false }

  const meta = await getSnapshotMeta()
  if (meta && Date.now() - meta.updatedAt < hours * 3600_000) return { updated: false }
  if (updateLock.running) return { updated: false }

  log.info(`[WY 快照] 距上次更新已超过 ${hours} 小时，触发自动更新`)
  try {
    const result = await saveSnapshot(token)
    return { updated: true, playlists: result.playlists }
  } catch (err) {
    log.warn(`[WY 快照] 自动更新失败: ${(err as Error).message}`)
    return { updated: false }
  }
}

const EXPORT_SONGS_KEY = '@wy_snapshot_songs__'

interface ExportData {
  type: 'wySnapshot_v1'
  data: {
    meta: WySnapshotMeta
    songsMap: Record<string, LX.Music.MusicInfoOnline[]>
  }
}

/**
 * 导出快照到文件（.lxmc，gzip JSON）
 */
export const exportSnapshot = async(path: string): Promise<void> => {
  const meta = await getSnapshotMeta()
  if (!meta) throw new Error(global.i18n.t('wy_snapshot_export_empty'))
  const songsMap: Record<string, LX.Music.MusicInfoOnline[]> = {}
  for (const p of meta.playlists) {
    songsMap[p.id] = await getSnapshotSongs(p.id)
  }
  const data: ExportData = { type: 'wySnapshot_v1', data: { meta, songsMap } }
  await handleSaveFile(`${path}/wy_songlist_snapshot.lxmc`, data)
  log.info(`[WY 快照] 已导出 ${meta.playlists.length} 个歌单到 ${path}/wy_songlist_snapshot.lxmc`)
}

export interface ImportResult {
  added: number
  skipped: number
  updated: number
  failed: number
}

/**
 * 导入快照文件并合并：
 * - 新歌单：自动添加
 * - 已有歌单：完全相同跳过；有新增自动添加；有缺失询问是否移除
 */
export const importSnapshot = async(path: string): Promise<ImportResult> => {
  const configData = await handleReadFile<ExportData>(path)
  if (configData?.type !== 'wySnapshot_v1' || !configData.data?.meta) {
    throw new Error(global.i18n.t('wy_snapshot_import_invalid'))
  }
  const { meta: importMeta, songsMap } = configData.data
  const localMeta = await getSnapshotMeta()
  const result: ImportResult = { added: 0, skipped: 0, updated: 0, failed: 0 }

  const mergedPlaylists: WySnapshotPlaylist[] = localMeta ? [...localMeta.playlists] : []

  for (const imp of importMeta.playlists) {
    try {
      const impSongs = songsMap[imp.id] ?? []
      const localIdx = mergedPlaylists.findIndex(p => p.id == imp.id)
      if (localIdx < 0) {
        // 新歌单：自动添加
        await saveData(storageDataPrefix.wySnapshotSongs + imp.id, impSongs)
        mergedPlaylists.push({ ...imp, updatedAt: Date.now() })
        result.added++
        log.info(`[WY 快照] 导入新歌单「${imp.name}」（${impSongs.length} 首）`)
        continue
      }
      const localSongs = await getSnapshotSongs(imp.id)
      const localIds = new Set(localSongs.map(s => s.id))
      const impIds = new Set(impSongs.map(s => s.id))
      const needAdd = impSongs.filter(s => !localIds.has(s.id))
      const needRemove = localSongs.filter(s => !impIds.has(s.id))

      if (!needAdd.length && !needRemove.length) {
        // 两份文件一样：无需导入
        result.skipped++
        continue
      }

      // 有缺失（本地多出的歌）：询问用户是否移除
      let removeConfirmed = false
      if (needRemove.length) {
        removeConfirmed = await confirmDialog({
          message: global.i18n.t('wy_snapshot_merge_remove_tip', { name: imp.name, num: needRemove.length }),
          confirmButtonText: global.i18n.t('wy_snapshot_merge_remove_confirm'),
          cancelButtonText: global.i18n.t('wy_snapshot_merge_keep'),
          bgClose: false,
        })
      }
      const removeIds = new Set(removeConfirmed ? needRemove.map(s => s.id) : [])
      const mergedSongs = [
        ...localSongs.filter(s => !removeIds.has(s.id)),
        ...needAdd,
      ]
      await saveData(storageDataPrefix.wySnapshotSongs + imp.id, mergedSongs)
      mergedPlaylists[localIdx] = {
        ...mergedPlaylists[localIdx],
        trackCount: mergedSongs.length,
        updatedAt: Date.now(),
      }
      result.updated++
      log.info(`[WY 快照] 合并歌单「${imp.name}」：新增 ${needAdd.length} 首，移除 ${removeIds.size} 首`)
    } catch (err) {
      result.failed++
      log.warn(`[WY 快照] 导入歌单「${imp.name}」失败: ${(err as Error).message}`)
    }
  }

  const finalMeta: WySnapshotMeta = {
    uid: localMeta?.uid ?? importMeta.uid,
    updatedAt: Date.now(),
    playlists: mergedPlaylists,
  }
  await saveData(storageDataPrefix.wySnapshotMeta, finalMeta)
  log.info(`[WY 快照] 导入完成：新增 ${result.added}，合并 ${result.updated}，跳过 ${result.skipped}，失败 ${result.failed}`)
  return result
}

/**
 * 删除快照（退出登录时可选调用）
 */
export const clearSnapshot = async() => {
  const meta = await getSnapshotMeta()
  if (meta) {
    for (const p of meta.playlists) {
      await saveData(storageDataPrefix.wySnapshotSongs + p.id, [])
    }
  }
  await saveData(storageDataPrefix.wySnapshotMeta, null)
  log.info('[WY 快照] 已清除快照')
}

// 供调试用
export { EXPORT_SONGS_KEY }
