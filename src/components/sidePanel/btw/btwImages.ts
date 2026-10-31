/**
 * btw 草稿里的图片 token：粘贴的图片路径（终端拖入 / Orca 截图粘贴 / 剪贴板
 * 图片）在输入框里显示成主输入框同款的 `[Image #N]`，而不是一长串临时路径。
 *
 * sideQuery 只收文本，图片本身送不过去：token 只是展示层，发送时由
 * {@link expandBtwImages} 在 token 后补上原路径，模型至少看得到文件名。
 * 编号全局递增（进程内），同一编号永远只对应一个路径，旧轮次的问题重新
 * 拼进上下文时也能还原。
 */
import { statSync } from 'node:fs'
import { imagePathMediaType, parsePastedImagePath } from '../../../utils/pastedImagePath.js'

const paths = new Map<number, string>()
let nextNumber = 0

/** 草稿里一个完整 token（`[Image #12]`）。 */
const TOKEN = /\[Image #(\d+)\]/gu

function isExistingImage(path: string): boolean {
  if (imagePathMediaType(path) === undefined) return false
  try {
    return statSync(path).isFile()
  } catch {
    return false
  }
}

/** 登记一个图片路径，返回要插入草稿的 token。 */
export function registerBtwImage(path: string): string {
  nextNumber += 1
  paths.set(nextNumber, path)
  return `[Image #${nextNumber}]`
}

/**
 * 粘贴文本若是一个现存图片文件的路径（可带引号 / file:// / 转义），登记并
 * 返回 token；否则 null，按普通文本粘贴。
 */
export function btwImageTokenForPaste(text: string): string | null {
  const path = parsePastedImagePath(text)
  if (path === null || !isExistingImage(path)) return null
  return registerBtwImage(path)
}

/** 剪贴板图片 / 文件：只登记现存的图片文件，返回 token（空格分隔）或 null。 */
export function btwImageTokensForFiles(files: readonly string[]): string | null {
  const tokens = files.filter(isExistingImage).map(registerBtwImage)
  return tokens.length === 0 ? null : tokens.join(' ')
}

/** 发送前：已登记的 token 后补原路径（`[Image #1] (/tmp/a.png)`）。 */
export function expandBtwImages(text: string): string {
  return text.replace(TOKEN, (token, digits: string) => {
    const path = paths.get(Number(digits))
    return path === undefined ? token : `${token} (${path})`
  })
}

/** caret 正好在一个 token 末尾时返回该 token 的起点，否则 null。 */
export function btwImageTokenEndingAt(text: string, caret: number): number | null {
  const match = /\[Image #\d+\]$/u.exec(text.slice(0, caret))
  return match === null ? null : caret - match[0].length
}

/** caret 正好在一个 token 起点时返回该 token 的终点，否则 null。 */
export function btwImageTokenStartingAt(text: string, caret: number): number | null {
  const match = /^\[Image #\d+\]/u.exec(text.slice(caret))
  return match === null ? null : caret + match[0].length
}
