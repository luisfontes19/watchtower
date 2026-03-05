import { minimatch } from 'minimatch'
import * as vscode from 'vscode'
import { Finding } from '../types'
import { StaticAnalyzer } from './staticAnalyzer'


export class AgentsAnalyzer extends StaticAnalyzer {

    public static readonly AGENTS_FILE_NAMES = [
        "CLAUDE.md",
        ".github/copilot-instructions.md",
        ".github/instructions/*.instructions.md",
        "**/AGENTS.md",
        ".agents/**/SKILL.md"
    ]

    async checkFile(uri: vscode.Uri, content?: Uint8Array<ArrayBufferLike>): Promise<Finding[]> {
        // we are not checking anything inside the file for now
        return []
    }

    static isAgentFile(uri: vscode.Uri): boolean {
        const relativePath = vscode.workspace.asRelativePath(uri, false)

        return AgentsAnalyzer.AGENTS_FILE_NAMES.some(pattern => minimatch(relativePath, `/${pattern}`))

    }


}
