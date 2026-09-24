// 网易云私人漫游 / 心动模式 API
// 接口：/weapi/v1/radio/get（需登录；获取随机推荐歌曲 id 列表，后续统一走 musicDetail 批量补全）
import { weapi } from './utils/crypto'
import { httpFetch } from '../../request'


const successCode = 200

const requestRadio = token => {
  const requestObj = httpFetch('https://music.163.com/weapi/v1/radio/get', {
    method: 'post',
    format: 'json',
    headers: {
      'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/60.0.3112.90 Safari/537.36',
      Referer: 'https://music.163.com',
      Cookie: `MUSIC_U=${token}`,
    },
    form: weapi({}),
    timeout: 10_000,
  })
  return requestObj.promise
}

// 从响应中提取歌曲 id 列表；无 data 数组视为登录态失效
const pickIds = body => {
  const list = body?.data
  if (!Array.isArray(list)) {
    const err = new Error('登录态已失效')
    err.code = 'INVALID_TOKEN'
    throw err
  }
  return list.map(item => item?.id).filter(Boolean)
}

// 私人漫游与心动模式共用同一端点（官方行为以实际接口响应为准）
const getRadioSongIds = async token => {
  const { statusCode, body } = await requestRadio(token)
  if (statusCode !== 200) throw new Error(`获取漫游歌曲请求失败 (statusCode: ${statusCode})`)
  if (body.code !== successCode) throw new Error(`获取漫游歌曲失败 (code: ${body.code}, message: ${body.message ?? '-'})`)
  return pickIds(body)
}

/**
 * 私人漫游：获取一批推荐歌曲 id
 * @param {string} token MUSIC_U
 * @returns {Promise<string[]>}
 */
export const getPersonalFmSongIds = token => getRadioSongIds(token)

/**
 * 心动模式：获取一批相似歌曲 id
 * @param {string} token MUSIC_U
 * @returns {Promise<string[]>}
 */
export const getHeartbeatSongIds = token => getRadioSongIds(token)
