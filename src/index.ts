import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import * as ini from "ini";
import * as os from "os";
import { debounce } from "debounce";
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

  /* TODO
   * Saved in code for future reference (while still in `dev` - please delete me before merging to `master`!)
   * Example of how to add (with CSS) comments in-line with the code.
   * Supports markdown as needed; this could be a good replacement for codelens and less intrusive; doesn't affect vertical space.
   * To use without slowing down the IDE, should use debounce.
   *
   * const t = vscode.window.createTextEditorDecorationType({
   *   after: {
   *     margin: "0 0 0 3em",
   *     textDecoration: "none",
   *   },
   *   rangeBehavior: vscode.DecorationRangeBehavior.ClosedOpen,
   * });
   * vscode.window.onDidChangeTextEditorSelection(
   *   debounce((e: vscode.TextEditorSelectionChangeEvent) => {
   *     const editor = e.textEditor;
   *     const endPosition = e.selections[0].active.with(undefined, Number.MAX_SAFE_INTEGER);
   *     editor.setDecorations(t, [
   *       {
   *         hoverMessage: new vscode.MarkdownString("## What is this").appendMarkdown("\nthat this is"),
   *         range: new vscode.Range(endPosition, endPosition),
   *         renderOptions: {
   *           after: {
   *             contentText: "spameggs",
   *           },
   *         },
   *       },
   *     ]);
   *   }, 250)
   * );
   */

  // This is needed for the Uri used in markdowns
  disposables.push(vscode.commands.registerTextEditorCommand("unmock.insertUnmockToTest", insertUnmockToTest));

  disposables.push(
    vscode.commands.registerTextEditorCommand(
      "unmock.showMockLinkHover",
      (editor: vscode.TextEditor, edit: vscode.TextEditorEdit, ...args: any[]) => {
        const { range } = args[0];
        // Somewhat hackish. To show the markdown-supporting Hover, the cursor (not mouse) needs to be inside the relevant range.
        // To not-interrupt user action, effectively move the cursor to relevant position, call the showHover, and reset cursor selection.
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
