// 网易云歌单歌曲操作 API（写入）
// 接口：/weapi/playlist/manipulate/tracks（op: add 添加歌曲；需登录）
// 防风控：Cookie 带 __csrf、os=pc，payload 带 csrf_token 与 imme
// 返回语义：
// - 200 成功；502（或 message 含"重复/已存在"）视为歌曲已在歌单中
// - 512 先按社区兜底方式将曲目列表复制一份重试；仍失败多为版权/会员限制
// - 301 登录态失效；-460 网络环境风控
import { weapi } from './utils/crypto'
import { httpFetch } from '../../request'
import { getWyCsrf } from '../../wyCsrf'


const successCode = 200

const request = (data, token) => {
  const csrf = getWyCsrf()
  const requestObj = httpFetch('https://music.163.com/weapi/playlist/manipulate/tracks', {
    method: 'post',
    format: 'json',
    headers: {
      'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/60.0.3112.90 Safari/537.36',
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

/**
 * 向歌单添加歌曲
 * @param {{ pid: string, trackIds: string[], token: string }} params
 * @returns {Promise<{ added: number }>}
 */
export const addTracksToPlaylist = async({ pid, trackIds, token }) => {
  const buildData = ids => ({
    op: 'add',
    pid: Number(pid),
    trackIds: `[${ids.join(',')}]`,
    imme: 'true',
  })
  let res = await retryOnFail(() => request(buildData(trackIds), token))
  // 512 兜底：按 NeteaseCloudMusicApi 社区验证的方式，将曲目列表复制一份重试
  if (res.statusCode === 200 && res.body.code === 512) {
    res = await retryOnFail(() => request(buildData([...trackIds, ...trackIds]), token))
  }
  const { statusCode, body } = res
  if (statusCode !== 200) throw new Error(`添加歌曲请求失败 (statusCode: ${statusCode})`)
  if (body.code === successCode) return { added: trackIds.length }
  const message = body.message ?? body.msg ?? ''
  if (body.code === 502 || /重复|已存在/.test(message)) {
    const err = new Error(message || '歌曲已在歌单中')
    err.code = 'TRACK_DUPLICATED'
    throw err
  }
  if (body.code === 512) {
    // 重试后仍返回 512：多为版权/会员限制导致歌曲不可收藏
    const err = new Error(message || '该歌曲可能因版权或会员限制无法收藏')
    err.code = 'TRACK_UNSUPPORTED'
    throw err
  }
  if (body.code === 301) {
    const err = new Error('登录态已失效')
    err.code = 'INVALID_TOKEN'
    throw err
  }
  if (body.code === -460) {
    const err = new Error('网络环境存在风险')
    err.code = 'RISK_CONTROL'
    throw err
  }
  throw new Error(`添加歌曲失败 (code: ${body.code}, message: ${message || '-'})`)
}
