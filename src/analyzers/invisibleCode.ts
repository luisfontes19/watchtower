


import * as vscode from 'vscode'
import { Finding, FindingType } from '../types'
import { StaticAnalyzer } from './staticAnalyzer'

export class InvisibleCodeAnalyzer extends StaticAnalyzer {

    public static readonly INVISIBLE_PATTERN = /([\u{E0000}-\u{E007F}]+)/ug
    public static readonly TROJAN_SOURCE = /\u202E|\u202D|\u2067|\u2066|\u2069|\u202C|\u2068/ug

    async checkFile(uri: vscode.Uri, content?: Uint8Array<ArrayBufferLike>): Promise<Finding[]> {
        const data = content ?? await vscode.workspace.fs.readFile(uri)
        const text = new TextDecoder().decode(data)
        const relativePath = vscode.workspace.asRelativePath(uri)
        const file = vscode.workspace.asRelativePath(uri, false)

        const regex = new RegExp(InvisibleCodeAnalyzer.INVISIBLE_PATTERN, 'gu')

        const invisible = [...text.matchAll(regex)].map(match => {
            const unicodeChars = [...match[0]].map(c => `U+${c.codePointAt(0)!.toString(16).toUpperCase().padStart(4, '0')}`).join(' ')

            return {
                type: FindingType.InvisibleCode,
                name: `Invisible Code Detected on ${relativePath}`,
                detail: `Invisible code as the name suggests is code that is invisible to the user, it can be used to hide malicious code in plain sight. There is no legitimate reason to have invisible characters in code. Content:\n\`${unicodeChars}\``,
                priority: 'high',
                file,
                range: this.rangeFromMatch(text, match)
            } as Finding
        })

        const trojan = [...text.matchAll(InvisibleCodeAnalyzer.TROJAN_SOURCE)].map(match => {
            const char = match[0]
            const unicodeChar = `U+${char.codePointAt(0)!.toString(16).toUpperCase().padStart(4, '0')}`
            return {
                type: FindingType.InvisibleCode,
                name: `Trojan Source Character Detected on ${relativePath}`,
                detail: `Trojan Source attacks use special Unicode characters to manipulate the display of code, making it appear different from its actual execution. The character \`${unicodeChar}\` is commonly used in these attacks. `,
                priority: 'high',
                file,
                range: this.rangeFromMatch(text, match)
            } as Finding
        })

        return [...invisible, ...trojan]
    }

    private rangeFromMatch(text: string, match: RegExpMatchArray): vscode.Range {
        const start = match.index!
        const end = start + match[0].length
        const highlightStart = Math.max(0, start - 1)
        const highlightEnd = Math.min(text.length, end + 1)

        const startLines = text.slice(0, highlightStart).split(/\r?\n/)
        const endLines = text.slice(0, highlightEnd).split(/\r?\n/)

        return new vscode.Range(
            startLines.length - 1, startLines[startLines.length - 1].length,
            endLines.length - 1, endLines[endLines.length - 1].length
        )
    }
}

