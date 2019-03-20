import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import * as ini from "ini";
import { MockExplorer } from "./explorer";

export function activate(context: vscode.ExtensionContext) {

	const jsonExplorer = new MockExplorer();
	vscode.window.registerTreeDataProvider("mocksExplorer", jsonExplorer);
	vscode.commands.registerCommand("helloWorld.console", () => console.log("HELLO THERE"));

	let refreshToken: string | undefined = vscode.workspace.getConfiguration("unmock").refreshToken;
	if (refreshToken === null && vscode.workspace.rootPath !== undefined) {
		const unmockPath = vscode.workspace.getConfiguration("unmock").path;
		const credentialFile = path.join(vscode.workspace.rootPath, unmockPath, "credentials");
		if (fs.existsSync(credentialFile)) {
			const iniContents = ini.parse(fs.readFileSync(credentialFile, 'utf-8'));
			refreshToken = iniContents.unmock.token;
		}
	}
	console.log(refreshToken);
}

// this method is called when your extension is deactivated
export function deactivate() {}
