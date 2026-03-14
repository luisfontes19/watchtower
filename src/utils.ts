import { minimatch } from 'minimatch'
import * as vscode from 'vscode'

export const isActiveTab = (uri: vscode.Uri) => vscode.window.activeTextEditor?.document.uri.fsPath === uri.fsPath

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

export const normalizeUri = (uri: vscode.Uri): vscode.Uri => {
    const workspaceFolder = vscode.workspace.getWorkspaceFolder(uri)
    if (!workspaceFolder) return uri // should only happen in tests
    return vscode.Uri.joinPath(workspaceFolder.uri, vscode.workspace.asRelativePath(uri, false))
}

export const fileMatchesPatterns = (uri: vscode.Uri, patterns: string[]): boolean => {
    let normalized = vscode.workspace.asRelativePath(normalizeUri(uri), false)

    if (process.env.NODE_ENV === 'test')
        normalized = normalized.startsWith('/') ? normalized.substring(1) : normalized // since we dont have a workspace, relative file paths will be set in the root

    return patterns.some(pattern => minimatch(normalized, pattern))
}
