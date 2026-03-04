import * as vscode from 'vscode'
import { Finding, FindingType } from '../types'
import { isActiveTab } from '../utils'
import { Analyzer, VscodeAgentsFileAnalyzerParams } from './types'


export class AgentsAnalyzer implements Analyzer {

    public static readonly AGENTS_FILE_NAMES = [
        /^CLAUDE\.md$/i,
        /^\.github\/copilot-instructions\.md$/i,
        /^\.github\/instructions\/.*\.instructions\.md$/i,
        /^\.windsur$/i,
        /AGENTS.md$/i, //do not use ^ and  as any file named AGENTS.md is used by copilot
        /^.agents\/.*\/SKILL.md/i
    ]

    async analyze(options: VscodeAgentsFileAnalyzerParams): Promise<Finding[]> {
        return []
    }

    async onChange(uri: vscode.Uri): Promise<Finding[]> {
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
