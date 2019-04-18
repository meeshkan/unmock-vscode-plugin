import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import * as ini from "ini";
import * as os from "os";
import { IInsertUnmockAction } from "./interfaces";
import { MockExplorer, MockTreeItem } from "./explorer";
import { TypescriptInsertUnmockCodeLens, TypeScriptInsertUnmockAction,
         InsertUnmockHoverProvider } from "./providers/insert-unmock";
import { LinkMockHoverProvider } from "./providers/link-tests-mocks";
import { getImportStatement, getTestCalls, getConfig, AllJSFileFilters } from "./utils";

const insertUnmockToTest = (textEditor: vscode.TextEditor, edit: vscode.TextEditorEdit, ...args: IInsertUnmockAction[]) => {
  // Adds unmock to a test file
  if (args.length === 0) { // No args given
    return;
  }
  const argsObj = args[0];
  // Adds the import statement in the specified `unmockImportLocation` under `args`
  textEditor.insertSnippet(new vscode.SnippetString(`${getImportStatement(argsObj.lang)}\n`),
                           argsObj.unmockImportLocation);
  const lastImportLocation = argsObj.lastImportLocation;
  // Add the beforeEach and afterEach calls after the last import
  // +1 to add after the last import statement, +1 to account for the addition of the unmock import
  const afterLastImport = new vscode.Range(lastImportLocation.line + 2, 0, lastImportLocation.line + 2, 0);
  textEditor.insertSnippet(new vscode.SnippetString(`\n${getTestCalls(argsObj.lang)}\n`), afterLastImport);
};

const updateRefreshToken = (config: vscode.WorkspaceConfiguration) => {
  let refreshToken: string | undefined;
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
};

export function activate(context: vscode.ExtensionContext) {
  const config = getConfig();

  vscode.commands.registerTextEditorCommand("unmock.insertUnmockToTest", insertUnmockToTest);

  if (config.codeLens === true) {  // Add the CodeLens suggestions (if enabled)
    vscode.languages.registerCodeLensProvider(AllJSFileFilters, new TypescriptInsertUnmockCodeLens());
  }
  if (config.lightbulb === true) { // Add the lightbulb suggestions (if enabled)
    vscode.languages.registerCodeActionsProvider(AllJSFileFilters, new TypeScriptInsertUnmockAction());
  }
  // Register hover provider (suggests adding unmock in tooltips)
  vscode.languages.registerHoverProvider(AllJSFileFilters, new InsertUnmockHoverProvider());
  vscode.languages.registerHoverProvider(AllJSFileFilters, new LinkMockHoverProvider());

	// Add the extension button
	const jsonExplorer = new MockExplorer();
  vscode.window.registerTreeDataProvider("unmock.mocksExplorer", jsonExplorer);

  // Add individual commands
	vscode.commands.registerCommand("unmock.editMock", (element: MockTreeItem) => {  // Open mock from MockTreeItem
		vscode.commands.executeCommand("vscode.open", vscode.Uri.file(element.currentPath));
  });
  vscode.commands.registerCommand("unmock.editMockByHash", (hash: string) => { // Open mock from hash
    const fspath = jsonExplorer.getPathFromHash(hash);
    if (fspath !== undefined) {
      vscode.commands.executeCommand("vscode.open", vscode.Uri.file(fspath));
    }
  });

	// Create the statusbar section
	const statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);
	vscode.commands.registerCommand("unmock.statusbar.hide", () => statusBar.hide());
	vscode.commands.registerCommand("unmock.statusbar.text", (text: string) => {
		statusBar.text = `Unmock: ${text}`;
		statusBar.show();
	});
	statusBar.command = "unmock.statusbar.hide";

  if (config.refreshToken === null) { // Not set in configuration, look for it in other places
    updateRefreshToken(config);
	}
}

// this method is called when your extension is deactivated
export function deactivate() {}
