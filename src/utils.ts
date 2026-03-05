import { minimatch } from 'minimatch'
import * as vscode from 'vscode'
import { SensitiveFiles } from './watchtower'


export const isActiveTab = (uri: vscode.Uri) => vscode.window.activeTextEditor?.document.uri.fsPath === uri.fsPath


export const isSensitiveFile = (uri: vscode.Uri): boolean => {
    const path = uri.fsPath
    const relativePath = vscode.workspace.asRelativePath(uri, false)

    return SensitiveFiles.some(sensitiveFile => minimatch(relativePath, `/${sensitiveFile}`))
}

export const findFiles = async (pattern: string): Promise<vscode.Uri[]> => {
    const agentFiles: vscode.Uri[] = []
    const workspaceFolders = vscode.workspace.workspaceFolders

    if (!workspaceFolders) return agentFiles

    for (const folder of workspaceFolders) {

        const files = await vscode.workspace.findFiles(new vscode.RelativePattern(folder, pattern), '**/node_modules/**')

        console.log("Found agent files:", files.map(f => f.fsPath))
        agentFiles.push(...files)
    }


    return agentFiles
}
