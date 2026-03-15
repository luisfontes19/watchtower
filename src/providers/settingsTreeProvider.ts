import * as vscode from 'vscode'
import { Settings } from '../settings'
import { InlineFindingType, StartupScansMode } from '../types'

type SettingsItemType = 'header' | 'setting' | 'note'

class SettingsItem extends vscode.TreeItem {
    constructor(
        label: string,
        public readonly itemType: SettingsItemType,
        description?: string,
        tooltip?: string,
    ) {
        const collapsible = itemType === 'header'
            ? vscode.TreeItemCollapsibleState.Expanded
            : vscode.TreeItemCollapsibleState.None
        super(label, collapsible)
        this.description = description
        this.tooltip = tooltip
        this.contextValue = itemType
    }
}

export class SettingsTreeProvider implements vscode.TreeDataProvider<SettingsItem> {
    public static readonly viewType = 'watchtower.settings'

    private _onDidChangeTreeData = new vscode.EventEmitter<void>()
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event

    refresh() {
        this._onDidChangeTreeData.fire()
    }

    getTreeItem(element: SettingsItem): vscode.TreeItem {
        return element
    }

    getChildren(element?: SettingsItem): SettingsItem[] {
        if (!element) {
            return this.getRootItems()
        }
        return this.getChildItems(element)
    }

    private getRootItems(): SettingsItem[] {
        const global = new SettingsItem('Global Settings', 'header')
        global.iconPath = new vscode.ThemeIcon('settings-gear', new vscode.ThemeColor('icon.foreground'))

        const project = new SettingsItem('Project Settings', 'header')
        project.iconPath = new vscode.ThemeIcon('folder', new vscode.ThemeColor('icon.foreground'))

        return [global, project]
    }

    private getChildItems(parent: SettingsItem): SettingsItem[] {
        const settings = Settings.getInstance()

        if (parent.label === 'Global Settings') {
            return this.getGlobalItems(settings)
        }
        if (parent.label === 'Project Settings') {
            return this.getProjectItems(settings)
        }
        return []
    }

    private getGlobalItems(settings: Settings): SettingsItem[] {
        const startupScans = settings.getGlobalStartupScans()
        const inlineFindings = settings.getGlobalInlineFindings()

        const startup = new SettingsItem(
            'Startup Scans',
            'setting',
            startupScansLabel(startupScans),
            'Click to open settings',
        )
        startup.iconPath = new vscode.ThemeIcon('rocket', startupScansColor(startupScans))
        startup.command = { command: 'workbench.action.openSettings', title: 'Open Settings', arguments: ['watchtower.startupScans'] }

        const inline = new SettingsItem(
            'Inline Findings',
            'setting',
            inlineFindingsLabel(inlineFindings),
            'Click to open settings',
        )
        inline.iconPath = new vscode.ThemeIcon('eye', inlineFindingsColor(inlineFindings))
        inline.command = { command: 'workbench.action.openSettings', title: 'Open Settings', arguments: ['watchtower.inlineFindings'] }

        return [startup, inline]
    }

    private getProjectItems(settings: Settings): SettingsItem[] {
        const workspaceName = vscode.workspace.workspaceFolders?.[0]?.name ?? 'No workspace'
        const isTrusted = vscode.workspace.isTrusted
        const workspaceStartup = settings.shouldRunStartupScanForWorkspace()
        const workspaceRealTime = settings.shouldRunRealtimeScanForWorkspace()
        const hasProjectOverride = settings.hasExplicitProjectSetting('runStartupScan') || settings.hasExplicitProjectSetting('runRealTimeDetection')
        const startupScansMode = settings.getGlobalStartupScans()
        const restrictedEnforced = !hasProjectOverride && startupScansMode === StartupScansMode.onUntrusted && isTrusted

        const workspace = new SettingsItem('Workspace', 'setting', workspaceName, workspaceName)
        workspace.iconPath = new vscode.ThemeIcon('root-folder', new vscode.ThemeColor('icon.foreground'))

        const trust = new SettingsItem(
            'Trust Status',
            'setting',
            isTrusted ? 'Trusted' : 'Restricted',
            isTrusted ? 'This workspace is trusted' : 'This workspace is restricted',
        )
        trust.iconPath = isTrusted
            ? new vscode.ThemeIcon('verified-filled', new vscode.ThemeColor('testing.iconPassed'))
            : new vscode.ThemeIcon('shield', new vscode.ThemeColor('editorWarning.foreground'))

        const startup = new SettingsItem('Run on Startup', 'setting', enabledLabel(workspaceStartup), 'Click to toggle',)
        startup.iconPath = enabledIcon('play-circle', workspaceStartup)
        startup.command = { command: 'watchtower.toggleWorkspaceStartupScan', title: 'Toggle Startup Scan' }

        const realtime = new SettingsItem('Real-Time Detection', 'setting', enabledLabel(workspaceRealTime), 'Click to toggle',)
        realtime.iconPath = enabledIcon('broadcast', workspaceRealTime)
        realtime.command = { command: 'watchtower.toggleWorkspaceRealTime', title: 'Toggle Real-Time Detection' }

        const items: SettingsItem[] = [workspace, trust, startup, realtime]

        if (restrictedEnforced) {
            const note = new SettingsItem(
                '$(warning) Scans inactive — Startup Scans is OnUntrusted and workspace is trusted',
                'note',
            )
            note.iconPath = new vscode.ThemeIcon('warning', new vscode.ThemeColor('editorWarning.foreground'))
            items.push(note)
        }


        return items
    }
}

function startupScansLabel(mode: StartupScansMode): string {
    switch (mode) {
        case StartupScansMode.onEveryProject: return 'On Every Project'
        case StartupScansMode.onUntrusted: return 'On Untrusted'
        case StartupScansMode.off: return 'Off'
    }
}

function inlineFindingsLabel(type: InlineFindingType): string {
    switch (type) {
        case InlineFindingType.all: return 'All'
        case InlineFindingType.invisible: return 'Invisible Only'
        case InlineFindingType.none: return 'None'
    }
}

function enabledLabel(enabled: boolean): string {
    return enabled ? 'Enabled' : 'Disabled'
}

function enabledIcon(iconId: string, enabled: boolean): vscode.ThemeIcon {
    return enabled
        ? new vscode.ThemeIcon(iconId, new vscode.ThemeColor('testing.iconPassed'))
        : new vscode.ThemeIcon(iconId, new vscode.ThemeColor('testing.iconFailed'))
}

function startupScansColor(mode: StartupScansMode): vscode.ThemeColor {
    switch (mode) {
        case StartupScansMode.onEveryProject: return new vscode.ThemeColor('testing.iconPassed')
        case StartupScansMode.onUntrusted: return new vscode.ThemeColor('editorWarning.foreground')
        case StartupScansMode.off: return new vscode.ThemeColor('testing.iconFailed')
    }
}

function inlineFindingsColor(type: InlineFindingType): vscode.ThemeColor {
    switch (type) {
        case InlineFindingType.all: return new vscode.ThemeColor('testing.iconPassed')
        case InlineFindingType.invisible: return new vscode.ThemeColor('editorWarning.foreground')
        case InlineFindingType.none: return new vscode.ThemeColor('testing.iconFailed')
    }
}
