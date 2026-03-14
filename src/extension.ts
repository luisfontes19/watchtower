import * as vscode from 'vscode'
import { Settings } from './settings'
import { showSettingsPanel } from './settingsPanel'
import { Watchtower } from './watchtower'



export function activate(context: vscode.ExtensionContext) {
	console.log("Watchtower Extension Loading")

	const settings = Settings.getInstance(context)
	const watchtower = Watchtower.getInstance(context.extensionUri)

	/////////////////////////////
	// Commands
	/////////////////////////////
	const commands = [
		vscode.commands.registerCommand('watchtower.scan', watchtower.commandRunScan.bind(watchtower)),
		vscode.commands.registerCommand('watchtower.disableWorkspaceStartupScan', watchtower.commandDisableStartupScanForWorkspace.bind(watchtower)),
		vscode.commands.registerCommand('watchtower.disableWorkspaceRealTimeDetection', watchtower.commandDisableRealTimeDetectionForWorkspace.bind(watchtower)),
		vscode.commands.registerCommand('watchtower.enableWorkspaceStartupScan', () => settings.setWorkspaceStartupScan(true)),
		vscode.commands.registerCommand('watchtower.enableWorkspaceRealTimeDetection', () => settings.setWorkspaceRealTimeDetection(true)),
		vscode.commands.registerCommand('watchtower.showSettings', showSettingsPanel),
	]

	commands.forEach(command => context.subscriptions.push(command))


	/////////////////////////////
	// Real-time file listeners
	/////////////////////////////

	const watcher = vscode.workspace.createFileSystemWatcher('**/*')
	watcher.onDidCreate((uri) => watchtower.onFileCreated(uri))
	watcher.onDidChange((uri) => watchtower.onFileChanged(uri))

	const realTimeListeners = [
		vscode.workspace.onDidOpenTextDocument(watchtower.onFileOpened.bind(watchtower)),
		vscode.window.onDidChangeActiveTextEditor(watchtower.onActiveEditorChanged.bind(watchtower)),
		watcher
	]

	if (settings.shouldRunRealtimeScanForWorkspace()) {
		realTimeListeners.forEach(listener => context.subscriptions.push(listener))
	}


	context.subscriptions.push(vscode.workspace.onDidGrantWorkspaceTrust(() => {
		console.log("Workspace trust granted")
		if (!settings.shouldRunRealtimeScanForWorkspace()) {
			console.log("Disposing real time listeners due to workspace trust change")
			realTimeListeners.forEach(listener => listener.dispose())
		}
	}))



	watchtower.runInitialScan()


	if (vscode.window.activeTextEditor)
		watchtower.onActiveEditorChanged(vscode.window.activeTextEditor)


}

export function deactivate() { }
