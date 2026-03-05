import * as vscode from 'vscode'
import { Finding } from '../types'

export abstract class StaticAnalyzer {
    abstract onChange?(uri: vscode.Uri): Promise<Finding[]>

    abstract checkFile(uri: vscode.Uri, content?: Uint8Array<ArrayBufferLike>): Promise<Finding[]>

    editedInBackground(uri: vscode.Uri): boolean {
        const activeEditor = vscode.window.activeTextEditor
        return !activeEditor || activeEditor.document.uri.fsPath !== uri.fsPath
    }
}

