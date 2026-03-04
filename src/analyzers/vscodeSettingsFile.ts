import * as jsonc from 'jsonc-parser'
import * as vscode from 'vscode'
import { Finding, FindingType } from '../types'
import { findFiles, isActiveTab, WorkspaceFile } from '../utils'
import { StaticAnalyzer, VscodeSettingsFileAnalyzerParams } from './types'

export class SettingsAnalyzer {

    // would be nice to detect changes to:
    //      chat.tools.autoApprove
    //      *.executablePath

    static async analyze(options?: VscodeSettingsFileAnalyzerParams): Promise<Finding[]> {
        const findings: Finding[] = []

        for (const uri of await findFiles(WorkspaceFile.Settings)) {
            findings.push(...await SettingsAnalyzer.checkFile(uri))
        }

        return findings
    }

    static async checkFile(uri: vscode.Uri): Promise<Finding[]> {
        const findings: Finding[] = []
        const fileFindings = await SettingsAnalyzer.checkBinarySettings(uri)
        findings.push(...fileFindings)
        return findings
    }

    public static async onChange(uri: vscode.Uri): Promise<Finding[]> {
        const findings: Finding[] = []

        const active = isActiveTab(uri)

        if (!active) {
            findings.push({
                type: FindingType.SilentFileChange,
                name: 'VSCode Settings Edited not by user ',
                detail: 'settings.json was modified while not being the active editor tab — it may have been changed by an extension or automated process',
                severity: 'high',
                file: uri.fsPath
            })
        }


        return findings
    }

    public static async checkBinarySettings(uri: vscode.Uri): Promise<Finding[]> {

        const findings: Finding[] = []

        // read file
        const content = await vscode.workspace.fs.readFile(uri)
        const json = jsonc.parse(content.toString()) as Record<string, unknown>

        const findInterpreterPaths = (obj: unknown, path: string = ''): void => {
            if (obj === null || obj === undefined || typeof obj !== 'object') {
                return
            }
            for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
                const currentPath = path ? `${path}.${key}` : key
                if (key.toLowerCase().includes('interpreterpath')) {
                    findings.push({
                        type: FindingType.SilentFileChange,
                        name: 'Custom Interpreter Path Detected',
                        detail: `Setting "${currentPath}" points to a custom interpreter path: "${value}". This could be used to execute arbitrary binaries.`,
                        severity: 'high',
                        file: uri.fsPath
                    })
                }
                if (typeof value === 'object') {
                    findInterpreterPaths(value, currentPath)
                }
            }
        }

        findInterpreterPaths(json)

        return findings
    }


}

const _checkStatic: StaticAnalyzer = SettingsAnalyzer
