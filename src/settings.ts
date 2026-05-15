import * as vscode from 'vscode'
import { InlineFindingType, StartupScansMode } from './types'

export class Settings {
    private static instance: Settings
    private workspaceStorage: vscode.Memento
    private globalStorage: vscode.Memento

    private constructor(context: vscode.ExtensionContext) {
        this.workspaceStorage = context.workspaceState
        this.globalStorage = context.globalState
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


    public getGlobalStartupScans(): StartupScansMode {
        return vscode.workspace
            .getConfiguration('watchtower')
            .get<StartupScansMode>('startupScans', StartupScansMode.onUntrusted)
    }

    public getGlobalInlineFindings(): InlineFindingType {
        return vscode.workspace
            .getConfiguration('watchtower')
            .get<InlineFindingType>('inlineFindings', InlineFindingType.invisible)
    }

    public getAutoUninstallMalicious(): boolean {
        return vscode.workspace
            .getConfiguration('watchtower')
            .get<boolean>('autoUninstallMalicious', true)
    }

    public getCheckWorkspaceTrust(): boolean {
        return vscode.workspace
            .getConfiguration('watchtower')
            .get<boolean>('checkWorkspaceTrust', true)
    }

    public getExcludedFolders(): string[] {
        return vscode.workspace
            .getConfiguration('watchtower')
            .get<string[]>('excludedFolders', [])
    }

    public getDisabledRules(): string[] {
        return vscode.workspace.getConfiguration('watchtower').get<string[]>('disabledRules', [])
    }

    public async toggleRule(ruleId: string): Promise<void> {
        const disabled = this.getDisabledRules()
        const updated = disabled.includes(ruleId) ? disabled.filter(id => id !== ruleId) : [...disabled, ruleId]
        await vscode.workspace.getConfiguration('watchtower').update('disabledRules', updated, vscode.ConfigurationTarget.Global)
    }


    public async setGlobalStartupScans(mode: StartupScansMode): Promise<void> {
        await vscode.workspace.getConfiguration('watchtower').update('startupScans', mode, vscode.ConfigurationTarget.Global)
    }

    public async setGlobalInlineFindings(type: InlineFindingType): Promise<void> {
        await vscode.workspace.getConfiguration('watchtower').update('inlineFindings', type, vscode.ConfigurationTarget.Global)
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

    public getWorkspaceDisabledRules(): string[] {
        return this.workspaceStorage.get<string[]>(this.workspaceKey('disabledRules'), [])
    }

    public async toggleWorkspaceRule(ruleId: string): Promise<void> {
        const disabled = this.getWorkspaceDisabledRules()
        const updated = disabled.includes(ruleId) ? disabled.filter(id => id !== ruleId) : [...disabled, ruleId]
        await this.workspaceStorage.update(this.workspaceKey('disabledRules'), updated)
    }

    public getWorkspaceExcludedFiles(): string[] {
        return this.workspaceStorage.get<string[]>(this.workspaceKey('excludedFiles'), [])
    }

    public async setWorkspaceExcludedFiles(patterns: string[]): Promise<void> {
        await this.workspaceStorage.update(this.workspaceKey('excludedFiles'), patterns)
    }

    public getWorkspaceExcludedFolders(): string[] {
        return this.workspaceStorage.get<string[]>(this.workspaceKey('excludedFolders'), [])
    }

    public async setWorkspaceExcludedFolders(patterns: string[]): Promise<void> {
        await this.workspaceStorage.update(this.workspaceKey('excludedFolders'), patterns)
    }

    public getAllExcludedFolders(): string[] {
        return [...this.getExcludedFolders(), ...this.getWorkspaceExcludedFolders()]
    }

    public getAllDisabledRules(): string[] {
        return [...new Set([...this.getDisabledRules(), ...this.getWorkspaceDisabledRules()])]
    }


    public hasExplicitProjectSetting(setting: string): boolean {
        return this.workspaceStorage.get(this.workspaceKey(setting)) !== undefined
    }

    public shouldRunStartupScanForWorkspace(): boolean {
        if (this.hasExplicitProjectSetting('runStartupScan')) return this.getWorkspaceStartupScan()


        const mode = this.getGlobalStartupScans()
        if (mode === StartupScansMode.off) return false
        if (mode === StartupScansMode.onUntrusted && vscode.workspace.isTrusted)
            return false

        return this.getWorkspaceStartupScan()
    }


    public shouldRunRealtimeScanForWorkspace(): boolean {
        if (this.hasExplicitProjectSetting('runRealTimeDetection'))
            return this.getWorkspaceRealTimeDetection()


        const mode = this.getGlobalStartupScans()
        if (mode === StartupScansMode.off) return false
        if (mode === StartupScansMode.onUntrusted) return false

        return this.getWorkspaceRealTimeDetection()
    }

    public getProjectState(): { startupScanDisabled: boolean; realtimeDetectionDisabled: boolean } {
        return {
            startupScanDisabled: !this.getWorkspaceStartupScan(),
            realtimeDetectionDisabled: !this.getWorkspaceRealTimeDetection()
        }
    }

    public getKnownExtensions(): string[] {
        return this.globalStorage.get<string[]>('knownExtensions', [])
    }

    public async setKnownExtensions(extensionIds: string[]): Promise<void> {
        await this.globalStorage.update('knownExtensions', extensionIds)
    }

    public getLastKnownVersion(): string | undefined {
        return this.globalStorage.get<string>('lastVersion')
    }

    public async setLastKnownVersion(version: string): Promise<void> {
        await this.globalStorage.update('lastVersion', version)
    }

}
