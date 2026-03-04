import * as vscode from 'vscode'
import { Finding, FindingType } from '../types'
import { isActiveTab } from '../utils'
import { StaticAnalyzer, VscodeAgentsFileAnalyzerParams } from './types'


export class AgentsAnalyzer {

    public static readonly AGENTS_FILE_NAMES = [
        "CLAUDE\.md",
        ".github/copilot-instructions.md",
        ".github/instructions/*.instructions.md",
        ".windsurf",
        "*AGENTS.md", //do not use ^ and  as any file named AGENTS.md is used by copilot
        ".agents/**/SKILL.md"

    ]

    static async analyze(options?: VscodeAgentsFileAnalyzerParams): Promise<Finding[]> {
        //const agentFiles = await Promise.all(AgentsAnalyzer.AGENTS_FILE_NAMES.map(f => findFiles(f))).then(results => results.flat())
        const findings: Finding[] = []

        return findings
    }

    static async onChange(uri: vscode.Uri): Promise<Finding[]> {
        const findings: Finding[] = []

        const active = isActiveTab(uri)

        if (!active) {
            findings.push({
                type: FindingType.SilentFileChange,
                name: 'AI file Edited not by user',
                detail: `The file ${uri.fsPath} was modified while not being the active editor tab — it may indicate an attack against AI agents`,
                severity: 'low',
                file: uri.fsPath
            })
        }


        return findings

    }

}

const _checkStatic: StaticAnalyzer = AgentsAnalyzer
