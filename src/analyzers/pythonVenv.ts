import * as vscode from 'vscode'
import { Finding, FindingType } from '../types'
import { StaticAnalyzer } from './staticAnalyzer'

export class PythonVenv extends StaticAnalyzer {
    alertOnEditedInBackground(): boolean {
        return false
    }

    canScanFile(uri: vscode.Uri): boolean {
        return uri.fsPath.includes('/.venv/bin/python')
    }

    async checkFile(uri: vscode.Uri, content?: Uint8Array<ArrayBufferLike>): Promise<Finding[]> {
        return [
            {
                type: FindingType.Binary,
                name: `Python venv binary detected`,
                detail: `When loading a project with a venv folder VSCode will automatically call the python binary inside (unless in restricted mode) which can be abused by an attacker. It is not a common pattern to commit this folder. If you received the project with the \`.venv\` folder consider deleting it and creating a new one with \`python -m venv .venv\` to ensure the integrity of the virtual environment.`,
                priority: 'high',
                file: vscode.workspace.asRelativePath(uri, false)
            } as Finding
        ]
    }
}
