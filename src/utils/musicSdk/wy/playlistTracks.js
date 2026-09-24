// 网易云歌单歌曲操作 API（写入）
// 接口：/weapi/playlist/manipulate/tracks（op: add 添加歌曲；需登录）
// 返回语义：body.code 200 成功；502/512 或 message 含“重复”视为歌曲已在歌单中；301 视为登录态失效
import { weapi } from './utils/crypto'
import { httpFetch } from '../../request'


const successCode = 200

const request = (data, token) => {
  const requestObj = httpFetch('https://music.163.com/weapi/playlist/manipulate/tracks', {
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
 * 向歌单添加歌曲
 * @param {{ pid: string, trackIds: string[], token: string }} params
 * @returns {Promise<{ added: number }>}
 */
export const addTracksToPlaylist = async({ pid, trackIds, token }) => {
  const { statusCode, body } = await retryOnFail(() => request({
    op: 'add',
    pid: Number(pid),
    trackIds: `[${trackIds.join(',')}]`,
  }, token))
  if (statusCode !== 200) throw new Error(`添加歌曲请求失败 (statusCode: ${statusCode})`)
  if (body.code === successCode) return { added: trackIds.length }
  if (body.code === 502 || body.code === 512 || /重复/.test(body.message ?? '')) {
    const err = new Error(body.message ?? '歌曲已在歌单中')
    err.code = 'TRACK_DUPLICATED'
    throw err
  }
  if (body.code === 301) {
    const err = new Error('登录态已失效')
    err.code = 'INVALID_TOKEN'
    throw err
  }
  throw new Error(`添加歌曲失败 (code: ${body.code}, message: ${body.message ?? '-'})`)
}
