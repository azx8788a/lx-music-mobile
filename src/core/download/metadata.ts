import { getLyricInfo, getPicPath } from '@/core/music'
import { writeMetadata, writePic, writeLyric } from '@/utils/localMediaMetadata'
import { buildLyrics } from '@/utils/lrcTools'
import { downloadFile, mkdir, unlink, writeFile } from '@/utils/fs'
import { TEMP_FILE_PATH } from '@/utils/tools'
import settingState from '@/store/setting/state'
import { log } from '@/utils/log'

const TAG_UNSUPPORTED_EXTS = new Set<LX.Download.FileExt>(['ape'])

export type MetadataField = 'tag' | 'pic' | 'lyric' | 'lrcFile'

const getErrorMessage = (err: unknown) => err instanceof Error ? err.message : String(err)

// 取在线封面并下载到临时目录，返回本地路径；无封面时返回空字符串
const fetchPicToTemp = async(musicInfo: LX.Music.MusicInfoOnline): Promise<string> => {
  const url = await getPicPath({ musicInfo, isRefresh: false })
  if (!url) return ''

  let ext = url.split('?')[0]
  ext = ext.substring(ext.lastIndexOf('.') + 1).toLowerCase()
  if (!ext || ext.length > 5) ext = 'jpeg'

  await mkdir(TEMP_FILE_PATH)
  const picPath = `${TEMP_FILE_PATH}/dl_pic_${Date.now()}_${Math.random().toString(36).substring(5)}.${ext}`
  try {
    const { promise } = downloadFile(url, picPath, { connectionTimeout: 10000, readTimeout: 10000 })
    const res = await promise
    if (res.statusCode < 200 || res.statusCode >= 300) {
      throw new Error(`HTTP ${res.statusCode}`)
    }
    if (!res.bytesWritten) throw new Error('封面内容为空')
    return picPath
  } catch (err) {
    await unlink(picPath).catch(() => {})
    throw err
  }
}

const buildLrcPath = (filePath: string) => `${filePath.replace(/\.[^.]+$/, '')}.lrc`

// 元数据写入是下载完成后的附加步骤，任何一步失败都不影响音频文件下载完成。
export const writeDownloadMetadata = async(task: LX.Download.ListItem): Promise<MetadataField[]> => {
  const failed: MetadataField[] = []
  const { musicInfo, filePath, ext } = task.metadata
  const supportTag = !TAG_UNSUPPORTED_EXTS.has(ext)

  if (settingState.setting['download.isWriteMetadata'] && supportTag) {
    try {
      await writeMetadata(filePath, {
        name: musicInfo.name,
        singer: musicInfo.singer,
        albumName: musicInfo.meta.albumName,
      })
      log.info(`[下载] 标签写入成功：${musicInfo.name} - ${musicInfo.singer}`)
    } catch (err) {
      failed.push('tag')
      log.warn(`[下载] 标签写入失败（${musicInfo.name}）：${getErrorMessage(err)}`)
    }

    let picPath = ''
    try {
      picPath = await fetchPicToTemp(musicInfo)
      if (!picPath) {
        failed.push('pic')
        log.warn(`[下载] 未获取到封面链接，已跳过封面写入（${musicInfo.name}）`)
      } else {
        await writePic(filePath, picPath)
        log.info(`[下载] 封面写入成功：${musicInfo.name}`)
      }
    } catch (err) {
      failed.push('pic')
      log.warn(`[下载] 封面写入失败（${musicInfo.name}）：${getErrorMessage(err)}`)
    } finally {
      if (picPath) await unlink(picPath).catch(() => {})
    }
  } else if (settingState.setting['download.isWriteMetadata']) {
    failed.push('tag', 'pic')
    log.info(`[下载] ${ext} 格式暂不写入标签与封面：${musicInfo.name}`)
  }

  if (settingState.setting['download.isSaveLyric']) {
    let lyric = ''
    try {
      const lrcData = await getLyricInfo({ musicInfo, isRefresh: false })
      // 跟随播放器的翻译/罗马音设置合并歌词，不写入洛雪私有 awlrc 数据。
      lyric = (buildLyrics(
        lrcData,
        false,
        settingState.setting['player.isShowLyricTranslation'],
        settingState.setting['player.isShowLyricRoma'],
      ) ?? '').trim()
    } catch (err) {
      log.warn(`[下载] 歌词获取失败（${musicInfo.name}）：${getErrorMessage(err)}`)
    }

    if (!lyric) {
      failed.push('lyric')
      log.warn(`[下载] 歌词内容为空，已跳过歌词写入（${musicInfo.name}）`)
    } else {
      if (supportTag) {
        try {
          await writeLyric(filePath, lyric)
          log.info(`[下载] 歌词内嵌成功：${musicInfo.name}`)
        } catch (err) {
          failed.push('lyric')
          log.warn(`[下载] 歌词内嵌失败（${musicInfo.name}）：${getErrorMessage(err)}`)
        }
      }

      const lrcPath = buildLrcPath(filePath)
      try {
        await writeFile(lrcPath, lyric, 'utf8')
        log.info(`[下载] 歌词文件已保存：${lrcPath}`)
      } catch (err) {
        failed.push('lrcFile')
        log.warn(`[下载] 歌词文件写入失败（${lrcPath}）：${getErrorMessage(err)}`)
      }
    }
  }

  return failed
}
