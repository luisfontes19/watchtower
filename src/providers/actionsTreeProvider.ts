import * as vscode from 'vscode'

class ActionItem extends vscode.TreeItem {
    constructor(
        label: string,
        tooltip: string,
        icon: vscode.ThemeIcon,
        command: vscode.Command,
    ) {
        super(label, vscode.TreeItemCollapsibleState.None)
        this.tooltip = tooltip
        this.iconPath = icon
        this.command = command
    }
}

export class ActionsTreeProvider implements vscode.TreeDataProvider<ActionItem> {
    public static readonly viewType = 'watchtower.actions'

    getTreeItem(element: ActionItem): vscode.TreeItem {
        return element
    }

    getChildren(): ActionItem[] {
        return [
            new ActionItem(
                'Scan Extension for Malware',
                'Check if a VS Code extension has been flagged as malicious',
                new vscode.ThemeIcon('extensions'),
                { command: 'watchtower.scanExtension', title: 'Scan Extension for Malware' },
            ),
        ]
    }
}
