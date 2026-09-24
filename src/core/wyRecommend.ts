// 网易云推荐与私人漫游：歌曲 id → 现有 musicDetail 批量详情 → 播放器可用结构
import musicDetailApi from '@/utils/musicSdk/wy/musicDetail'
import { getDailyRecommendSongIds } from '@/utils/musicSdk/wy/recommend'
import { getPersonalFmSongIds } from '@/utils/musicSdk/wy/personalFm'
import { toNewMusicInfo } from '@/utils'
import settingState from '@/store/setting/state'
import { log } from '@/utils/log'

const ensureToken = (): string => {
  const token = settingState.setting['wy.musicUToken']
  if (!token) {
    const err = new Error('missing wy.musicUToken') as Error & { code: string }
    err.code = 'NO_TOKEN'
    throw err
  }
  return token
}

// 批量 songId → MusicInfoOnline（与歌单详情同一条转换链路）
const idsToMusicInfos = async(ids: string[]): Promise<LX.Music.MusicInfoOnline[]> => {
  if (!ids.length) return []
  const { list } = await musicDetailApi.getList(ids)
  return list.map(item => toNewMusicInfo(item)) as LX.Music.MusicInfoOnline[]
}

/**
 * 每日推荐歌曲（/weapi/v3/discovery/recommend/songs）
 */
export const getDailyRecommend = async(): Promise<LX.Music.MusicInfoOnline[]> => {
  const token = ensureToken()
  log.info('[WY 每日推荐] 开始获取')
  const ids = await getDailyRecommendSongIds(token)
  if (!ids.length) {
    log.info('[WY 每日推荐] 推荐列表为空')
    return []
  }
  const musics = await idsToMusicInfos(ids)
  log.info(`[WY 每日推荐] 获取成功，共 ${musics.length} 首`)
  return musics
}

/**
 * 私人漫游：获取一批歌曲（/weapi/v1/radio/get）
 */
export const getPersonalFmList = async(): Promise<LX.Music.MusicInfoOnline[]> => {
  const token = ensureToken()
  log.info('[WY 私人漫游] 获取歌曲')
  const musics = await idsToMusicInfos(await getPersonalFmSongIds(token))
  log.info(`[WY 私人漫游] 获取成功，共 ${musics.length} 首`)
  return musics
}
