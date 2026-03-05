import * as vscode from 'vscode'
import { Finding } from '../types'
import { StaticAnalyzer } from './staticAnalyzer'


export class AgentsAnalyzer extends StaticAnalyzer {

    public static readonly AGENTS_FILE_NAMES = [
        "CLAUDE.md",
        ".github/copilot-instructions.md",
        ".github/instructions/*.instructions.md",
        "*AGENTS.md", //do not use ^ and  as any file named AGENTS.md is used by copilot
        ".agents/**/SKILL.md"
    ]

    async checkFile(uri: vscode.Uri, content?: Uint8Array<ArrayBufferLike>): Promise<Finding[]> {
        return []
    }

    static isAgentFile(uri: vscode.Uri): boolean {
        const relativePath = vscode.workspace.asRelativePath(uri, false)
        return AgentsAnalyzer.AGENTS_FILE_NAMES.some(pattern => {
            const regex = new RegExp(
                '^' +
                pattern
                    .replace(/[.+^${}()|[\]\\]/g, '\\$&')  // escape regex specials (except * and ?)
                    .replace(/\*\*/g, '{{GLOBSTAR}}')        // placeholder for **
                    .replace(/\*/g, '[^/]*')                 // * matches anything except /
                    .replace(/\?/g, '[^/]')                  // ? matches single char except /
                    .replace(/\{\{GLOBSTAR\}\}/g, '.*')      // ** matches everything
                + '$'
            )
            return regex.test(relativePath)
        })
    }
}
