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
