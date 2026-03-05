import * as vscode from 'vscode'
import { ScanLifecycle } from './scanLifecycle'
import { Watchtower } from './watchtower'



export function activate(context: vscode.ExtensionContext) {

	const watchtower = Watchtower.getInstance()
	const scanLifecycle = ScanLifecycle.getInstance(context)

	// Commands
	console.log("Watchtower Extension Loaded")
	context.subscriptions.push(vscode.commands.registerCommand('watchtower.analyze', () => scanLifecycle.runManualScan()))
	context.subscriptions.push(vscode.commands.registerCommand('watchtower.resetAcknowledgement', () => scanLifecycle.resetProjectAcknowledgement()))
	context.subscriptions.push(vscode.commands.registerCommand('watchtower.enableProtections', () => scanLifecycle.enableProtections()))
	context.subscriptions.push(vscode.commands.registerCommand('watchtower.disableProtections', () => scanLifecycle.handleDisableProtections()))
	context.subscriptions.push(vscode.commands.registerCommand('watchtower.checkStatus', () => {
		const status = scanLifecycle.getProtectionStatus()
		vscode.window.showInformationMessage(status)
	}))


	// Listeners
	context.subscriptions.push(vscode.workspace.onDidGrantWorkspaceTrust(watchtower.onWorkspaceTrusted.bind(watchtower)))
	// context.subscriptions.push(vscode.tasks.onDidStartTask(watchtower.onDidStartTask.bind(watchtower)))
	// context.subscriptions.push(vscode.workspace.onWillSaveTextDocument(watchtower.onWillSaveFile.bind(watchtower)))
	// context.subscriptions.push(vscode.workspace.onWillCreateFiles(watchtower.onWillCreateFiles.bind(watchtower)))


	const watcher = vscode.workspace.createFileSystemWatcher('**/*')
	watcher.onDidCreate((uri) => watchtower.onFileCreated(uri, scanLifecycle))
	watcher.onDidChange((uri) => watchtower.onFileChanged(uri, scanLifecycle))


	context.subscriptions.push(watcher)

	// Run initial scan based on ScanLifecycle logic
	scanLifecycle.runInitialScan()

}

export function deactivate() { }
