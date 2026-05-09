import * as vscode from 'vscode'
import { RuleRegistry } from '../rules'
import { Settings } from '../settings'
import { InlineFindingType, StartupScansMode } from '../types'

class SettingsItem extends vscode.TreeItem {
    constructor(
        label: string,
        description: string,
        tooltip: string,
        icon: vscode.ThemeIcon,
        command: vscode.Command,
        collapsibleState: vscode.TreeItemCollapsibleState = vscode.TreeItemCollapsibleState.None,
    ) {
        super(label, collapsibleState)
        this.description = description
        this.tooltip = tooltip
        this.iconPath = icon
        this.command = command
    }
}

class RulesGroupItem extends vscode.TreeItem {
    constructor() {
        super('Rules', vscode.TreeItemCollapsibleState.Collapsed)
        this.tooltip = 'Toggle individual security rules on or off'
        this.iconPath = new vscode.ThemeIcon('checklist')
    }
}

export class SettingsTreeProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
    public static readonly viewType = 'watchtower.settings'

    private _onDidChangeTreeData = new vscode.EventEmitter<void>()
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event

    refresh() {
        this._onDidChangeTreeData.fire()
    }

    getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
        return element
    }

    getChildren(element?: vscode.TreeItem): vscode.TreeItem[] {
        if (!element) {
            const settings = Settings.getInstance()
            const startupScans = settings.getGlobalStartupScans()
            const inlineFindings = settings.getGlobalInlineFindings()
            const workspaceStartup = settings.getWorkspaceStartupScan()
            const workspaceRealTime = settings.getWorkspaceRealTimeDetection()

            return [
                new SettingsItem(
                    'Startup Scans',
                    startupScansLabel(startupScans),
                    'Click to cycle: On Every Project → On Untrusted → Off',
                    new vscode.ThemeIcon('rocket', startupScansColor(startupScans)),
                    { command: 'watchtower.cycleStartupScans', title: 'Cycle Startup Scans' },
                ),
                new SettingsItem(
                    'Inline Findings',
                    inlineFindingsLabel(inlineFindings),
                    'Click to cycle: All → Invisible Only → None',
                    new vscode.ThemeIcon('eye', inlineFindingsColor(inlineFindings)),
                    { command: 'watchtower.cycleInlineFindings', title: 'Cycle Inline Findings' },
                ),
                new SettingsItem(
                    '(Project) Run on Startup',
                    enabledLabel(workspaceStartup),
                    'Click to toggle',
                    enabledIcon('play-circle', workspaceStartup),
                    { command: 'watchtower.toggleWorkspaceStartupScan', title: 'Toggle Startup Scan' },
                ),
                new SettingsItem(
                    '(Project) Real-Time Detection',
                    enabledLabel(workspaceRealTime),
                    'Click to toggle',
                    enabledIcon('broadcast', workspaceRealTime),
                    { command: 'watchtower.toggleWorkspaceRealTime', title: 'Toggle Real-Time Detection' },
                ),
                new RulesGroupItem(),
            ]
        }

        if (element instanceof RulesGroupItem) {
            const disabledRules = Settings.getInstance().getDisabledRules()
            return RuleRegistry.getAllRules().map(rule => {
                const enabled = !disabledRules.includes(rule.id)
                return new SettingsItem(
                    rule.id,
                    enabledLabel(enabled),
                    `${rule.description}\nClick to ${enabled ? 'disable' : 'enable'}`,
                    enabledIcon('shield', enabled),
                    { command: 'watchtower.toggleRule', title: 'Toggle Rule', arguments: [rule.id] },
                )
            })
        }

        return []
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
