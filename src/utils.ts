import * as vscode from 'vscode'

export enum WorkspaceFile {
    Settings = '.vscode/settings.json',
    Tasks = '.vscode/tasks.json',
    DevContainer = '.devcontainer/devcontainer.json',
}

export const isActiveTab = (uri: vscode.Uri) => vscode.window.activeTextEditor?.document.uri.fsPath === uri.fsPath


export const getWorkspacesFile = (file: WorkspaceFile): vscode.Uri[] => {
    const folders = vscode.workspace.workspaceFolders
    if (!folders) return []

    return folders.map(folder => vscode.Uri.joinPath(folder.uri, file)).filter(async uri => {
        try {
            const stat = await vscode.workspace.fs.stat(uri)
            return !!stat
        } catch {
            // File doesn't exist in this folder – skip.
            return false
        }
    }) || null
}
