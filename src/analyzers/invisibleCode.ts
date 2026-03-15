


import * as vscode from 'vscode'
import { Finding, FindingType } from '../types'
import { StaticAnalyzer } from './staticAnalyzer'

//https://github.com/nickboucher/trojan-source/

export class InvisibleCodeAnalyzer extends StaticAnalyzer {

    alertOnEditedInBackground(): boolean {
        return false
    }

    // copilot context: The fix narrows to the specific tag character range U+E0000–U+E007F, requires 3+ consecutive chars, and uses a negative lookbehind to skip emoji flag sequences.
    public static readonly INVISIBLE_PATTERN = /(?<!\u{1F3F4}[\u{E0000}-\u{E007F}]*)([\u{E0000}-\u{E007F}]{3,})/ug
    public static readonly TROJAN_SOURCE = /\u202E|\u202D|\u2067|\u2066|\u2069|\u202C|\u2068/ug

    async checkFile(uri: vscode.Uri, content?: Uint8Array<ArrayBufferLike>): Promise<Finding[]> {
        const data = content ?? await vscode.workspace.fs.readFile(uri)

        const { isBinaryFile } = await import('isbinaryfile')
        if (await isBinaryFile(Buffer.from(data))) {
            console.log(`Skipping binary file: ${uri.fsPath}`)
            return []
        }

        const text = new TextDecoder().decode(data)
        const invisible = this.findInvisibleCode(text, uri)
        const trojan = this.findTrojanSource(text, uri)

        return [...invisible, ...trojan]
    }

    public findTrojanSource(text: string, uri: vscode.Uri): Finding[] {
        const relativePath = vscode.workspace.asRelativePath(uri)
        const file = vscode.workspace.asRelativePath(uri, false)

        return [...text.matchAll(InvisibleCodeAnalyzer.TROJAN_SOURCE)].map(match => {
            const char = match[0]
            const unicodeChar = `U+${char.codePointAt(0)!.toString(16).toUpperCase().padStart(4, '0')}`
            return {
                type: FindingType.InvisibleCode,
                name: `Trojan Source Character Detected`,
                detail: `Trojan Source attacks use special Unicode characters to manipulate the display of code, making it appear different from its actual execution. The character \`${unicodeChar}\` is commonly used in these attacks. `,
                priority: 'high',
                file,
                range: this.rangeFromMatch(text, match)
            } as Finding
        })
    }


    public findInvisibleCode(text: string, uri: vscode.Uri): Finding[] {
        const relativePath = vscode.workspace.asRelativePath(uri)
        const file = vscode.workspace.asRelativePath(uri, false)

        return [...text.matchAll(InvisibleCodeAnalyzer.INVISIBLE_PATTERN)].map(match => {
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
    }

    canScanFile(uri: vscode.Uri): boolean {
        return true // we want to scan all files for invisible code, as it can be hidden anywhere
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

