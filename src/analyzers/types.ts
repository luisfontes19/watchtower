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

}

export interface DevContainerFileAnalyzerParams {

}

export interface StaticAnalyzer {
    analyze(options?: VscodeSettingsFileAnalyzerParams | JsonFileAnalyzerParams | TaskAnalyzerParams | DevContainerFileAnalyzerParams | VscodeAgentsFileAnalyzerParams): Promise<Finding[]>
    onChange?(uri: vscode.Uri): Promise<Finding[]>
}

