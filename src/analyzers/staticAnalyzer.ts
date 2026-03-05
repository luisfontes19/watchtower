import * as vscode from 'vscode'
import { Finding, FindingType } from '../types'
import { AgentsAnalyzer } from './agentsFile'

export abstract class StaticAnalyzer {
    async sensitiveFileBackgroundEditCheck(uri: vscode.Uri): Promise<Finding[]> {
        const findings: Finding[] = []

        if (this.editedInBackground(uri)) {

            let detail = `A file that is deemed sensitive was modified while not being the active editor tab, this indicates that it was edited by some kind of background process, since it's consider a sensitive file it is recommended to investigate this change to make sure it was legitimate`
            let priority = "low"

            if (AgentsAnalyzer.isAgentFile(uri)) {
                detail += ` The file ${vscode.workspace.asRelativePath(uri)} is an AI related file, which may indicate an attack against AI agents.`
                priority = "high"
            }
            findings.push({
                type: FindingType.SilentFileChange,
                name: `Sensitive file ${vscode.workspace.asRelativePath(uri)} edited in the background`,
                detail,
                priority: priority as any,
                file: uri.fsPath
            })

        }
        return findings

    }

    abstract checkFile(uri: vscode.Uri, content?: Uint8Array<ArrayBufferLike>): Promise<Finding[]>

    editedInBackground(uri: vscode.Uri): boolean {
        const activeEditor = vscode.window.activeTextEditor
        return !activeEditor || activeEditor.document.uri.fsPath !== uri.fsPath
    }
}

