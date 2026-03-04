import * as vscode from 'vscode'
import { Finding } from '../types'

export interface JsonFileAnalyzerParams {
    json: string | Object
}

export interface TaskAnalyzerParams {
    //tasks: Task[]
}

export interface VscodeSettingsFileAnalyzerParams {

}

export interface VscodeAgentsFileAnalyzerParams {
    fileUri: vscode.Uri,
}

export interface DevContainerFileAnalyzerParams {

}

export interface Analyzer {
    analyze(options?: VscodeSettingsFileAnalyzerParams | JsonFileAnalyzerParams | TaskAnalyzerParams): Promise<Finding[]>
    onChange?(uri: vscode.Uri): Promise<Finding[]>
}

