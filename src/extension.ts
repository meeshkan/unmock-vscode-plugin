import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import * as ini from "ini";
import * as os from "os";
import { MockExplorer } from "./explorer";

export function activate(context: vscode.ExtensionContext) {

	const jsonExplorer = new MockExplorer();
	vscode.window.registerTreeDataProvider("mocksExplorer", jsonExplorer);
	vscode.commands.registerCommand("helloWorld.console", () => console.log("HELLO THERE"));

	const config = vscode.workspace.getConfiguration("unmock");
	let refreshToken: string | undefined = config.refreshToken;

	if (refreshToken === null) { // Not set in configuration, look for it in other places
		const homeDirs = [];
		if (vscode.workspace.rootPath !== undefined) { // First preference to workspace home directory
			homeDirs.push(vscode.workspace.rootPath);
		}
		homeDirs.push(os.homedir()); // Second preference to user home directory
		const unmockPath = config.path;
		let foundCredentialsFile = false;
		homeDirs.forEach(homedir => {
			if (!foundCredentialsFile) {
				const credentialFile = path.join(homedir, unmockPath, "credentials");
				if (fs.existsSync(credentialFile)) {
					const iniContents = ini.parse(fs.readFileSync(credentialFile, 'utf-8'));
					refreshToken = iniContents.unmock.token;
					foundCredentialsFile = true;
				}
			}
		});
		// save refresh token in configuration in workspace
		config.update("refreshToken", refreshToken, false);
	}
}

// this method is called when your extension is deactivated
export function deactivate() {}
