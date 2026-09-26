// 网易云歌单写入（Stage 4D/4E）：
// - 通过 getUserPlaylistList 定位「我喜欢的音乐」或用户指定歌单（不硬编码 ID）
// - 使用现有歌单数据做前端去重；尾部状态由调用方决定是否构建失败
// - token 失效 / 重复 / 网络失败都由提示展示（见 UI 层）
import { getLoginStatus, getUserPlaylistList } from '@/utils/musicSdk/wy/userPlaylist'
import { addTracksToPlaylist } from '@/utils/musicSdk/wy/playlistTracks'
import { getListDetailAll } from '@/core/songlist'
import { getSnapshotMeta } from '@/core/wySnapshot'
import settingState from '@/store/setting/state'
import { toast } from '@/utils/tools'

export interface WyPlaylistItem {
  id: string
  name: string
  trackCount: number
  author: string
  img: string
  specialType?: number
}

// 从歌曲列表提取网易云曲目 ID（非网易云来源返回空）
export const wyTrackIdsFromMusics = (list: Array<LX.Music.MusicInfo | LX.Music.MusicInfoOnline>): string[] => {
  return list
    .filter(m => m.source == 'wy')
    .map(m => String(m.meta.songId ?? ''))
    .filter(Boolean)
}

// 写入结果的统一提示（重复/登出/网络错误分别说明，绝不静默）
export const toastWyWriteResult = (result: TrackWriteResult) => {
  if (result.error) {
    if (result.error.code == 'INVALID_TOKEN') {
      toast(global.i18n.t('wy_write_token_invalid'))
    } else if (result.error.code == 'NO_FAVORITE') {
      toast(global.i18n.t('wy_write_no_favorite'))
    } else if (result.error.code == 'NO_TOKEN') {
      toast(global.i18n.t('wy_playlist_token_empty'))
    } else {
      toast(global.i18n.t('wy_write_failed'))
    }
  } else if (result.duplicated) {
    toast(global.i18n.t('wy_write_duplicated'))
  } else {
    toast(global.i18n.t('wy_write_success', { name: result.playlistName }))
  }
}

const ensureToken = (): string => {
  const token = settingState.setting['wy.musicUToken']
  if (!token) {
    const err = new Error('missing wy.musicUToken') as Error & { code: string }
    err.code = 'NO_TOKEN'
    throw err
  }
  return token
}

// 拉取用户歌单（创建的 + 收藏的）
// 不按 trackCount 过滤：空的「我喜欢的音乐」与新建空歌单也需要能被定位/选择
export const fetchUserPlaylists = async(): Promise<WyPlaylistItem[]> => {
  const token = ensureToken()
  const profile = await getLoginStatus(token)
  const list = await getUserPlaylistList({ uid: profile.userId, token })
  return list.map((item: any) => ({
    id: String(item.id),
    name: item.name,
    trackCount: item.trackCount ?? 0,
    author: item.creator?.nickname ?? '',
    img: item.coverImgUrl ?? '',
    specialType: item.specialType ?? 0,
  }))
}

// 定位「我喜欢的音乐」歌单：优先网易云 specialType==5 标记，名称匹配兜底（兼容改名/空歌单）
export const findFavoritePlaylist = (playlists: WyPlaylistItem[]): WyPlaylistItem | null => {
  const byType = playlists.find(p => p.specialType === 5)
  if (byType) return byType
  return playlists.find(p => p.name == '我喜欢的音乐' || p.name == '喜欢的音乐') ?? null
}

// 已存在判断：先查本地缓存的歌单歌曲（getListDetailAll），无数据则提交前不阻断
export const filterTrackIds = async(playlistId: string, trackIds: string[]): Promise<string[]> => {
  if (!trackIds.length) return []
  let existing: string[] = []
  try {
    const list = await getListDetailAll('wy', playlistId)
    existing = list.map((m: LX.Music.MusicInfoOnline) => m.meta.songId as string).filter(Boolean)
  } catch (err) {
    // 歌单详情取不到（如曲库受限）时按无重复提交，服务端会给出重复码
  }
  const existingSet = new Set(existing)
  return trackIds.filter(id => !existingSet.has(id))
}

export interface TrackWriteResult {
  playlistName: string
  duplicated: boolean
  error: null | { code: string, message: string }
}

/**
 * 添加歌曲到指定歌单（前端过滤已存在的歌曲）
 */
export const addTracksToWyPlaylist = async(playlist: WyPlaylistItem, trackIds: string[]): Promise<TrackWriteResult> => {
  const result: TrackWriteResult = { playlistName: playlist.name, duplicated: false, error: null }
  const token = ensureToken()
  const newIds = await filterTrackIds(playlist.id, trackIds)
  if (!newIds.length) {
    result.duplicated = true
    return result
  }
  try {
    await addTracksToPlaylist({ pid: playlist.id, trackIds: newIds, token })
  } catch (err: any) {
    if (err?.code == 'TRACK_DUPLICATED') {
      result.duplicated = true
      return result
    }
    result.error = { code: err?.code ?? 'NETWORK', message: err?.message ?? String(err) }
  }
  return result
}

/**
 * 收藏歌曲到「我喜欢的音乐」歌单
 */
export const favoriteToWyPlaylist = async(trackIds: string[]): Promise<TrackWriteResult> => {
  let playlists: WyPlaylistItem[] = []
  let onlineError: { code?: string, message: string } | null = null
  try {
    playlists = await fetchUserPlaylists()
  } catch (err) {
    const e = err as { code?: string, message?: string }
    onlineError = { code: e.code, message: e.message ?? String(err) }
    playlists = []
  }
  let usedSnapshot = false
  if (!playlists.length) {
    const meta = await getSnapshotMeta()
    const snapshot = meta?.playlists ?? []
    if (snapshot.length) {
      usedSnapshot = true
      playlists = snapshot.map(item => ({
        id: item.id,
        name: item.name,
        trackCount: item.trackCount,
        author: item.author,
        img: item.img,
        specialType: item.specialType ?? 0,
      }))
    }
  }
  const favorite = findFavoritePlaylist(playlists)
  if (!favorite) {
    // 在线获取失败且无本地快照可用时，直接反馈真实原因（如登录失效），避免误报「未找到歌单」
    if (!usedSnapshot && onlineError) {
      return { playlistName: '', duplicated: false, error: { code: onlineError.code ?? 'NETWORK', message: onlineError.message } }
    }
    return { playlistName: '', duplicated: false, error: { code: 'NO_FAVORITE', message: '未找到我喜欢的音乐歌单' } }
  }
  return addTracksToWyPlaylist(favorite, trackIds)
}
