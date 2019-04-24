import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import * as ini from "ini";
import * as os from "os";
import { IMockLocation } from "./interfaces";
import { MockExplorer } from "./explorer";
import {
  TypescriptInsertUnmockCodeLens,
  TypeScriptInsertUnmockAction,
  InsertUnmockHoverProvider,
  insertUnmockToTest,
} from "./providers/insert-unmock";
import { LinkMockHoverProvider, LinkMockCodeLens, SnapCollection } from "./providers/link-tests-mocks";
import { getConfig, AllJSFileFilters } from "./utils";

const updateRefreshToken = (config: vscode.WorkspaceConfiguration) => {
  let refreshToken: string | undefined;
  const homeDirs = [];
  if (vscode.workspace.rootPath !== undefined) {
    // First preference to workspace home directory
    homeDirs.push(vscode.workspace.rootPath);
  }
  homeDirs.push(os.homedir()); // Second preference to user home directory
  const unmockPath = config.path;
  let foundCredentialsFile = false;
  homeDirs.forEach(homedir => {
    if (!foundCredentialsFile) {
      const credentialFile = path.join(homedir, unmockPath, "credentials");
      if (fs.existsSync(credentialFile)) {
        const iniContents = ini.parse(fs.readFileSync(credentialFile, "utf-8"));
        refreshToken = iniContents.unmock.token;
        foundCredentialsFile = true;
      }
    }
  });
  // save refresh token in configuration in workspace
  config.update("refreshToken", refreshToken, false);
};

export let mockExplorer: undefined | MockExplorer;

const disposables: vscode.Disposable[] = [];

export function activate(context: vscode.ExtensionContext) {
  const config = getConfig();

  // This is needed for the Uri used in markdowns
  disposables.push(vscode.commands.registerTextEditorCommand("unmock.insertUnmockToTest", insertUnmockToTest));

  disposables.push(
    vscode.commands.registerTextEditorCommand(
      "unmock.showMockLinkHover",
      (editor: vscode.TextEditor, edit: vscode.TextEditorEdit, ...args: any[]) => {
        const { range } = args[0];
        const curSelection = editor.selection;
        editor.selection = new vscode.Selection(range.start, range.start);
        vscode.commands.executeCommand("editor.action.showHover").then(() => (editor.selection = curSelection));
      }
    )
  );

  if (config.codeLens === true) {
    // Add the CodeLens suggestions (if enabled)
    disposables.push(vscode.languages.registerCodeLensProvider(AllJSFileFilters, new TypescriptInsertUnmockCodeLens()));
  }
  if (config.lightbulb === true) {
    // Add the lightbulb suggestions (if enabled)
    disposables.push(
      vscode.languages.registerCodeActionsProvider(AllJSFileFilters, new TypeScriptInsertUnmockAction())
    );
  }
  // Register hover providers
  disposables.push(vscode.languages.registerHoverProvider(AllJSFileFilters, new InsertUnmockHoverProvider()));

  // For linking mocks and tests, we need a collection of snap files
  const snapCollection = new SnapCollection(); // todo - cleanup?
  disposables.push(vscode.languages.registerHoverProvider(AllJSFileFilters, new LinkMockHoverProvider(snapCollection)));
  disposables.push(vscode.languages.registerCodeLensProvider(AllJSFileFilters, new LinkMockCodeLens(snapCollection)));

  // Add the extension button
  mockExplorer = new MockExplorer(); // todo - cleanup?
  disposables.push(vscode.window.registerTreeDataProvider("unmock.mocksExplorer", mockExplorer));

  // Add individual commands
  disposables.push(
    vscode.commands.registerCommand("unmock.editMock", (element: IMockLocation) => {
      // Open mock from MockTreeItem
      vscode.commands.executeCommand("vscode.open", vscode.Uri.file(element.currentPath));
    })
  );

  // Create the statusbar section
  const statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);
  disposables.push(statusBar);
  disposables.push(vscode.commands.registerCommand("unmock.statusbar.hide", () => statusBar.hide()));
  disposables.push(
    vscode.commands.registerCommand("unmock.statusbar.text", (text: string) => {
      statusBar.text = `Unmock: ${text}`;
      statusBar.show();
    })
  );
  statusBar.command = "unmock.statusbar.hide";

  if (config.refreshToken === null) {
    // Not set in configuration, look for it in other places
    updateRefreshToken(config);
  }
}

// this method is called when the extension is deactivated
export function deactivate() {
  disposables.forEach(disp => disp.dispose());
}
