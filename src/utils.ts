import * as jsonc from 'jsonc-parser'
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

export const sanitizeHtml = (str: string): string => {
    return String(str).replace(/[\u00A0-\u9999<>\&]/g, i => '&#' + i.charCodeAt(0) + ';')
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

export const rangeFromJsonNode = (text: string, path: jsonc.JSONPath): vscode.Range | undefined => {
    const tree = jsonc.parseTree(text)
    if (!tree) return undefined
    const node = jsonc.findNodeAtLocation(tree, path)
    if (!node) return undefined
    return rangeFromOffset(text, node.offset, node.offset + node.length)
}

export const rangeFromOffset = (text: string, start: number, end: number): vscode.Range => {
    const before = text.slice(0, start)
    const startLines = before.split(/\r?\n/)
    const startLine = startLines.length - 1
    const startChar = startLines[startLine].length

    const beforeEnd = text.slice(0, end)
    const endLines = beforeEnd.split(/\r?\n/)
    const endLine = endLines.length - 1
    const endChar = endLines[endLine].length

    return new vscode.Range(startLine, startChar, endLine, endChar)
}

export const rangeOfKeyInText = (text: string, key: string): vscode.Range | undefined => {
    const pattern = new RegExp(`"${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"\\s*:`)
    const match = text.match(pattern)
    if (!match || match.index === undefined) return undefined

    const linesBefore = text.slice(0, match.index).split(/\r?\n/)
    const line = linesBefore.length - 1

    // range covers the entire line to end
    const lineEnd = text.indexOf('\n', match.index)
    return new vscode.Range(line, 0, line, lineEnd === -1 ? text.length : lineEnd - text.slice(0, match.index).lastIndexOf('\n') - 1)
}
