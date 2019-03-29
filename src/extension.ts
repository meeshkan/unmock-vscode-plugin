import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import * as ini from "ini";
import * as os from "os";
import { IInsertUnmockAction } from "./interfaces";
import { MockExplorer, MockTreeItem } from "./explorer";
import { AllJSFileFilters, TypescriptInsertUnmockCodeLens, TypeScriptInsertUnmockAction } from "./providers";
import { getImportStatement, getTestCalls } from "./utils";

export function activate(context: vscode.ExtensionContext) {
	// Add the suggestion CodeLens
	vscode.commands.registerTextEditorCommand("unmock.insertUnmockToTest",
		(textEditor: vscode.TextEditor, edit: vscode.TextEditorEdit, ...args: IInsertUnmockAction[]) => {
			if (args.length === 0) {
				return;
			}
			const argsObj = args[0];
			textEditor.insertSnippet(new vscode.SnippetString(`${getImportStatement(argsObj.lang)}\n`),
									 argsObj.unmockImportLocation);
			const lastImportLocation = argsObj.lastImportLocation;
			// +1 to add after the last import statement, +1 to account for the addition of the unmock import
			const afterLastImport = new vscode.Range(lastImportLocation.line + 2, 0, lastImportLocation.line + 2, 0);
			textEditor.insertSnippet(new vscode.SnippetString(`\n${getTestCalls(argsObj.lang)}\n`), afterLastImport);
	});
	vscode.languages.registerCodeLensProvider(AllJSFileFilters, new TypescriptInsertUnmockCodeLens());
	// Registers lightbulb
	vscode.languages.registerCodeActionsProvider(AllJSFileFilters, new TypeScriptInsertUnmockAction());

	// Add the extension button
	const jsonExplorer = new MockExplorer();
	vscode.window.registerTreeDataProvider("unmock.mocksExplorer", jsonExplorer);
	vscode.commands.registerCommand("unmock.editMock", (element: MockTreeItem) => {
		vscode.commands.executeCommand("vscode.open", vscode.Uri.file(element.currentPath));
	});

	// Create the statusbar section
	const statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);
	vscode.commands.registerCommand("unmock.statusbar.hide", () => statusBar.hide());
	vscode.commands.registerCommand("unmock.statusbar.text", (text: string) => {
		statusBar.text = `Unmock: ${text}`;
		statusBar.show();
	});
	statusBar.command = "unmock.statusbar.hide";

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
