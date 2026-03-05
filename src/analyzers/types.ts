import * as vscode from 'vscode'
import { Finding } from '../types'

export abstract class StaticAnalyzer {
    abstract analyze(options?: any): Promise<Finding[]>
    abstract onChange?(uri: vscode.Uri): Promise<Finding[]>

    abstract checkFile(uri: vscode.Uri, content?: Uint8Array<ArrayBufferLike>): Promise<Finding[]>
}

