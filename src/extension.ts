import * as vscode from 'vscode'
import { Shield } from './shield'



export function activate(context: vscode.ExtensionContext) {

	const shield = Shield.getInstance()

	// Commands
	console.log("Shield Extension Loaded")
	context.subscriptions.push(vscode.commands.registerCommand('vscode-shield.analyze', shield.analyze.bind(shield)))


	// Listeners
	context.subscriptions.push(vscode.workspace.onDidGrantWorkspaceTrust(shield.onWorkspaceTrusted.bind(shield)))
	// context.subscriptions.push(vscode.tasks.onDidStartTask(shield.onDidStartTask.bind(shield)))
	// context.subscriptions.push(vscode.workspace.onWillSaveTextDocument(shield.onWillSaveFile.bind(shield)))
	// context.subscriptions.push(vscode.workspace.onWillCreateFiles(shield.onWillCreateFiles.bind(shield)))


	const watcher = vscode.workspace.createFileSystemWatcher('**/*')
	watcher.onDidCreate(shield.onFileCreated.bind(shield))
	watcher.onDidChange(shield.onFileChanged.bind(shield))


	context.subscriptions.push(watcher)

	shield.analyze()

}

export function deactivate() { }
