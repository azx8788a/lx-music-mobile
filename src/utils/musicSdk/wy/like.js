// 网易云「我喜欢的音乐」（喜欢/收藏）写入 API
// - 主通道：/weapi/song/like（新版喜欢接口，like 布尔值为"设定"语义；参考同构项目实测可用）
// - 写前检查：/weapi/song/like/check（防重复；检查失败返回 null 不阻断）
// - /weapi/radio/like 红心接口在部分网络环境持续命中风控（-460），已弃用
// - csrf_token / __csrf / os=pc / origin 按网易云 Web 端标准环境补齐
import { weapi } from './utils/crypto'
import { httpFetch } from '../../request'
import { getWyCsrf } from '../../wyCsrf'


const successCode = 200

const request = (path, data, token) => {
  const csrf = getWyCsrf()
  const requestObj = httpFetch(`https://music.163.com${path}`, {
    method: 'post',
    format: 'json',
    headers: {
      'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/60.0.3112.90 Safari/537.36',
      origin: 'https://music.163.com',
      Referer: 'https://music.163.com',
      Cookie: `MUSIC_U=${token}; __csrf=${csrf}; os=pc`,
    },
    form: weapi({ ...data, csrf_token: csrf }),
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

const toError = (body, fallbackMessage) => {
  const message = body.message ?? body.msg ?? fallbackMessage
  const err = new Error(message)
  if (body.code === 301) err.code = 'INVALID_TOKEN'
  else if (body.code === -460 || body.code === -462) err.code = 'RISK_CONTROL'
  else if (body.code === 502 || body.code === 512) err.code = 'TRACK_DUPLICATED'
  return err
}

/**
 * 查询歌曲是否已在「我喜欢的音乐」中
 * @returns true/false；接口异常或响应结构未知时返回 null（调用方按未喜欢处理）
 */
export const checkTrackLiked = async({ trackId, token }) => {
  try {
    const { statusCode, body } = await retryOnFail(() => request('/weapi/song/like/check', { trackIds: `[${trackId}]` }, token))
    if (statusCode !== 200 || body.code !== successCode) return null
    const data = body.data
    if (data != null && typeof data === 'object') {
      const value = data[String(trackId)]
      if (typeof value === 'boolean') return value
    }
    return null
  } catch (err) {
    // 检查仅为增强项，任何异常都不阻断收藏主流程
    return null
  }
}

/**
 * 收藏歌曲到「我喜欢的音乐」（/weapi/song/like，like 为"设定"语义）
 */
export const likeTrack = async({ trackId, token }) => {
  const { statusCode, body } = await retryOnFail(() => request('/weapi/song/like', {
    trackId,
    like: true,
    time: 3,
    alg: 'itembased',
  }, token))
  if (statusCode !== 200) throw new Error(`收藏请求失败 (statusCode: ${statusCode})`)
  if (body.code === successCode) return
  if (body.code === 301) throw toError(body, '登录态已失效')
  if (body.code === -460 || body.code === -462) throw toError(body, '网络环境存在风险')
  if (body.code === 502 || body.code === 512) throw toError(body, '歌曲已在我喜欢的音乐中')
  throw new Error(`收藏失败 (code: ${body.code}, message: ${body.message ?? body.msg ?? '-'})`)
}
