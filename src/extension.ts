import * as vscode from 'vscode';
import { MockExplorer } from './explorer';

export function activate(context: vscode.ExtensionContext) {

	const jsonExplorer = new MockExplorer();
	vscode.window.registerTreeDataProvider('mocksExplorer', jsonExplorer);
	vscode.commands.registerCommand('helloWorld.console', () => console.log("HELLO THERE"));
}

// this method is called when your extension is deactivated
export function deactivate() {}
