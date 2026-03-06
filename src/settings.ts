import * as vscode from 'vscode'
import { InlineFindingType } from './types'

export class Settings {
    private static instance: Settings
    private workspaceStorage: vscode.Memento

    private constructor(context: vscode.ExtensionContext) {
        this.workspaceStorage = context.workspaceState
    }

    public static getInstance(context?: vscode.ExtensionContext): Settings {
        if (!Settings.instance) {
            if (!context) {
                throw new Error('Extension context is required for first initialization')
            }
            Settings.instance = new Settings(context)
        }
        return Settings.instance
    }


    // TODO: this may be a bit problematic, will need to be addressed eventually
    private getWorkspacePath(): string {
        const workspaceFolders = vscode.workspace.workspaceFolders
        if (!workspaceFolders || workspaceFolders.length === 0) {
            return 'default'
        }
        return workspaceFolders[0].uri.fsPath
    }

    private workspaceKey(setting: string): string {
        return `${this.getWorkspacePath()}.${setting}`
    }


    private getGlobalStartupScans(): boolean {
        return vscode.workspace
            .getConfiguration('watchtower')
            .get<boolean>('enableStartupScans', true)
    }

    public runsOnlyOnRestrictedWorkspaces(): boolean {
        return vscode.workspace
            .getConfiguration('watchtower')
            .get<boolean>('runOnlyOnRestrictedWorkspaces', false)
    }

    public getGlobalInlineFindings(): InlineFindingType {
        return vscode.workspace
            .getConfiguration('watchtower')
            .get<InlineFindingType>('inlineFindings', InlineFindingType.invisible)
    }


    public async setGlobalStartupScans(enabled: boolean): Promise<void> {
        await vscode.workspace
            .getConfiguration('watchtower')
            .update('enableStartupScans', enabled, vscode.ConfigurationTarget.Global)
    }

    public async setGlobalOnlyRestrictedMode(enabled: boolean): Promise<void> {
        await vscode.workspace
            .getConfiguration('watchtower')
            .update('runOnlyOnRestrictedWorkspaces', enabled, vscode.ConfigurationTarget.Global)
    }

    public async setGlobalInlineFindings(type: InlineFindingType): Promise<void> {
        await vscode.workspace
            .getConfiguration('watchtower')
            .update('inlineFindings', type, vscode.ConfigurationTarget.Global)
    }


    public getWorkspaceStartupScan(): boolean {
        return this.workspaceStorage.get<boolean>(this.workspaceKey('runStartupScan'), true)
    }

    public async setWorkspaceStartupScan(enabled: boolean): Promise<void> {
        await this.workspaceStorage.update(this.workspaceKey('runStartupScan'), enabled)
    }

    public getWorkspaceRealTimeDetection(): boolean {
        return this.workspaceStorage.get<boolean>(this.workspaceKey('runRealTimeDetection'), true)
    }

    public async setWorkspaceRealTimeDetection(enabled: boolean): Promise<void> {
        await this.workspaceStorage.update(this.workspaceKey('runRealTimeDetection'), enabled)
    }


    public shouldRunStartupScanForWorkspace(): boolean {
        if (this.shouldEnforceRestrictedScanOnlySetting()) return false
        return this.getGlobalStartupScans() && this.getWorkspaceStartupScan()
    }


    public shouldRunRealtimeScanForWorkspace(): boolean {
        if (this.shouldEnforceRestrictedScanOnlySetting()) return false
        return this.getGlobalStartupScans() && this.getWorkspaceRealTimeDetection()
    }

    public shouldEnforceRestrictedScanOnlySetting(): boolean {
        return this.runsOnlyOnRestrictedWorkspaces() && vscode.workspace.isTrusted
    }


    public shouldShowInlineFindings(): boolean {
        return this.getGlobalInlineFindings() !== InlineFindingType.none
    }


    public getProjectState(): { startupScanDisabled: boolean; realtimeDetectionDisabled: boolean } {
        return {
            startupScanDisabled: !this.getWorkspaceStartupScan(),
            realtimeDetectionDisabled: !this.getWorkspaceRealTimeDetection()
        }
    }
}
