import * as vscode from 'vscode'
import { Settings } from './settings'
import { Watchtower } from './watchtower'



export function activate(context: vscode.ExtensionContext) {

	const settings = Settings.getInstance(context)
	const watchtower = Watchtower.getInstance(context.extensionUri)

	// Commands
	console.log("Watchtower Extension Loaded")
	context.subscriptions.push(vscode.commands.registerCommand('watchtower.scan', watchtower.commandRunScan.bind(watchtower)))
	context.subscriptions.push(vscode.commands.registerCommand('watchtower.disableWorkspaceStartupScan', watchtower.commandDisableStartupScanForWorkspace.bind(watchtower)))
	context.subscriptions.push(vscode.commands.registerCommand('watchtower.disableWorkspaceRealTimeDetection', watchtower.commandDisableRealTimeDetectionForWorkspace.bind(watchtower)))

	context.subscriptions.push(vscode.commands.registerCommand('watchtower.enableWorkspaceStartupScan', () => settings.setWorkspaceStartupScan(true)))
	context.subscriptions.push(vscode.commands.registerCommand('watchtower.enableWorkspaceRealTimeDetection', () => settings.setWorkspaceRealTimeDetection(true)))


	// Listeners
	context.subscriptions.push(vscode.workspace.onDidGrantWorkspaceTrust(watchtower.onWorkspaceTrusted.bind(watchtower)))
	context.subscriptions.push(vscode.workspace.onDidOpenTextDocument(watchtower.onFileOpened.bind(watchtower)))
	context.subscriptions.push(vscode.window.onDidChangeActiveTextEditor(watchtower.onActiveEditorChanged.bind(watchtower)))


	const watcher = vscode.workspace.createFileSystemWatcher('**/*')
	watcher.onDidCreate((uri) => watchtower.onFileCreated(uri))
	watcher.onDidChange((uri) => watchtower.onFileChanged(uri))


	context.subscriptions.push(watcher)

	// Run initial scan based on ScanLifecycle settings
	watchtower.runInitialScan()


	if (vscode.window.activeTextEditor)
		watchtower.onActiveEditorChanged(vscode.window.activeTextEditor)


}

export function deactivate() { }
