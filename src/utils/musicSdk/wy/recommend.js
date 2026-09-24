// 网易云每日推荐歌曲 API
// 接口：/weapi/v3/discovery/recommend/songs（需登录，参考 NeteaseCloudMusicApi recommend_song 模块）
import { weapi } from './utils/crypto'
import { httpFetch } from '../../request'


const successCode = 200

const request = (path, data, token) => {
  const requestObj = httpFetch(`https://music.163.com${path}`, {
    method: 'post',
    format: 'json',
    headers: {
      'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/60.0.3112.90 Safari/537.36',
      Referer: 'https://music.163.com',
      Cookie: `MUSIC_U=${token}`,
    },
    form: weapi(data),
    timeout: 10_000,
  })
  return requestObj.promise
}

const retryOnFail = (handler, tryNum = 0) => {
  if (tryNum > 2) return Promise.reject(new Error('try max num'))
  return handler(tryNum + 1).catch(err => {
    console.log('retry', err.message)
    return retryOnFail(handler, tryNum + 1)
  })
}

/**
 * 获取每日推荐歌曲 id 列表
 * @param {string} token MUSIC_U
 * @returns {Promise<string[]>} 网易云歌曲 id 数组
 */
export const getDailyRecommendSongIds = async(token) => {
  const { statusCode, body } = await retryOnFail(() => request('/weapi/v3/discovery/recommend/songs', {}, token))
  if (statusCode !== 200) throw new Error(`获取每日推荐请求失败 (statusCode: ${statusCode})`)
  if (body.code !== successCode) throw new Error(`获取每日推荐失败 (code: ${body.code}, message: ${body.message ?? '-'})`)
  const songs = body.data?.dailySongs
  if (!Array.isArray(songs)) {
    // 登录态失效时网易云会返回 301，与 getLoginStatus 的 INVALID_TOKEN 语义对齐
    const err = new Error('登录态已失效')
    err.code = 'INVALID_TOKEN'
    throw err
  }
  return songs.map(song => song.id)
}
