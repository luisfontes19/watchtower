import * as vscode from 'vscode'
import { Finding } from '../types'
import { fileMatchesPatterns } from '../utils'
import { StaticAnalyzer } from './staticAnalyzer'


export class AgentsAnalyzer extends StaticAnalyzer {
    public static AGENTS_FILE_NAMES = [
        "CLAUDE.md",
        ".github/copilot-instructions.md",
        ".github/instructions/*.instructions.md",
        "**/AGENTS.md",
        ".agents/**/SKILL.md"
    ]

    alertOnEditedInBackground(): boolean {
        return true
    }

    async checkFile(uri: vscode.Uri, content?: Uint8Array<ArrayBufferLike>): Promise<Finding[]> {
        // we are not checking anything inside the file for now
        return []
    }

    canScanFile(uri: vscode.Uri): boolean {
        const path = uri.fsPath
        return path.endsWith('.md') && AgentsAnalyzer.isAgentFile(uri)
    }

    static isAgentFile(uri: vscode.Uri): boolean {
        return fileMatchesPatterns(uri, AgentsAnalyzer.AGENTS_FILE_NAMES)

    }


}
