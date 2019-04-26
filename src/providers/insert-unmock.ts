import * as vscode from "vscode";
import { IInsertUnmockAction } from "../interfaces";
import { removeJSCommentsFromSourceText, getRangeFromTextAndMatch, getImportStatement, getTestCalls } from "../utils";

export class InsertUnmockHoverProvider implements vscode.HoverProvider {
  provideHover(
    document: vscode.TextDocument,
    position: vscode.Position,
    token: vscode.CancellationToken
  ): vscode.ProviderResult<vscode.Hover> {
    const srcText = document.getText();
    const matchCall = matchJSRequestWithoutUnmock(srcText);
    if (!matchCall) {
      return;
    }
    const relevantRanges = getRangeFromTextAndMatch(srcText, matchCall);
    const relevantRange = relevantRanges.filter(occRange => occRange.contains(position));
    if (relevantRange.length !== 1) {
      return;
    }
    const commandUri = vscode.Uri.parse(
      `command:unmock.insertUnmockToTest?${encodeURIComponent(
        JSON.stringify(buildTypescriptUnmockActionObject(srcText))
      )}`
    );
    const content = new vscode.MarkdownString(
      "### Unmock\n" +
        "You should probably use Unmock here to intercept calls to 3rd party APIs.\n" +
        "We promise to send back reliable, semantically correct mocked responses for your tests.\n\n" +
        `[Insert unmock](${commandUri})`
    );
    content.isTrusted = true;
    return new vscode.Hover(content);
  }
}

export class TypeScriptInsertUnmockAction implements vscode.CodeActionProvider {
  provideCodeActions(
    document: vscode.TextDocument,
    range: vscode.Range | vscode.Selection,
    context: vscode.CodeActionContext,
    token: vscode.CancellationToken
  ): vscode.ProviderResult<Array<vscode.Command | vscode.CodeAction>> {
    const srcText = document.getText();
    const matchCall = matchJSRequestWithoutUnmock(srcText);
    if (!matchCall) {
      return;
    }
    const relevantRanges = getRangeFromTextAndMatch(srcText, matchCall);
    const relevantRange = relevantRanges.filter(occRange => occRange.contains(range));
    if (relevantRange.length !== 1) {
      return;
    }

    const action = new vscode.CodeAction("Insert call to unmock", vscode.CodeActionKind.QuickFix);
    action.command = {
      command: "unmock.insertUnmockToTest",
      title: "Insert call to unmock",
      arguments: [buildTypescriptUnmockActionObject(srcText)],
    };
    const diagnostic = new vscode.Diagnostic(
      relevantRange[0],
      "This test file might make real calls to remote endpoints.\n" +
        "You can use unmock to intercept these and get semantically " +
        "correct mocked responses instead.",
      vscode.DiagnosticSeverity.Information
    );
    action.diagnostics = [diagnostic];
    return [action];
  }
}

export class TypescriptInsertUnmockCodeLens implements vscode.CodeLensProvider {
  onDidChangeCodeLenses?: vscode.Event<void> | undefined;
  provideCodeLenses(
    document: vscode.TextDocument,
    token: vscode.CancellationToken
  ): vscode.ProviderResult<vscode.CodeLens[]> {
    const srcText = document.getText();
    const matchCall = matchJSRequestWithoutUnmock(srcText);
    if (!matchCall) {
      return;
    }
    const relevantRange = getRangeFromTextAndMatch(srcText, matchCall)[0];
    return [
      new vscode.CodeLens(relevantRange, {
        command: "unmock.insertUnmockToTest",
        title: "Insert call to unmock",
        arguments: [buildTypescriptUnmockActionObject(srcText)],
      }),
    ];
  }
}

// The following are defined as functions and not using the const and arrow style, so we can call them
// from anywhere in the file while keeping the exported objects at the top of this file :)

function buildTypescriptUnmockActionObject(srcText: string): IInsertUnmockAction {
  return {
    lastImportLocation: findLastJSImport(srcText),
    unmockImportLocation: unmockJSImportLocation(srcText),
    lang: "typescript",
  };
}

function unmockJSImportLocation(srcText: string): vscode.Range {
  const matchCall = srcText.match(/^import .*?"unmock".*?$/m);
  if (matchCall === null) {
    return new vscode.Range(0, 0, 0, 0); // First line
  }
  return getRangeFromTextAndMatch(srcText, matchCall)[0];
}

function matchJSRequestWithoutUnmock(srcText: string): null | RegExpMatchArray {
  // Remove comments (see https://gist.github.com/DesignByOnyx/05c2241affc9dc498379e0d819c4d756)
  const srcTextWithoutComments = removeJSCommentsFromSourceText(srcText);
  // Really rough sketch - look for the following as method calls
  if (
    /[\w_]+\.(?:request|get|delete|head|options|post|put|patch)\(/.test(srcTextWithoutComments) &&
    /axios|superagent|request|fetch|supertest/.test(srcTextWithoutComments) && // And one of these libraries has to be used
    !/unmock\(/.test(srcTextWithoutComments)
  ) {
    // And there was no call to Unmock
    return srcText.match(/[\w_]+\.(?:request|get|delete|head|options|post|put|patch)\(/g);
  }
  return null;
}

function findLastJSImport(srcText: string): vscode.Position {
  const defaultPosition = new vscode.Position(0, 0);
  // Get last "import" in commentless code
  const srcTextWithoutComments = removeJSCommentsFromSourceText(srcText);
  // Match for ^import
  const match = srcTextWithoutComments.match(/^import [^;]+;/gm);
  if (match === null) {
    return defaultPosition;
  }
  const lastMatch = match.pop();
  if (lastMatch === undefined) {
    return defaultPosition;
  }
  // find location of lastMatch...
  const flatIndexOf = srcText.lastIndexOf(lastMatch);
  return new vscode.Position(srcText.substr(0, flatIndexOf).split("\n").length - 1, 0);
}

export function insertUnmockToTest(
  textEditor: vscode.TextEditor,
  edit: vscode.TextEditorEdit,
  ...args: IInsertUnmockAction[]
) {
  // Adds unmock to a test file
  if (args.length === 0) {
    // No args given
    return;
  }
  const argsObj = args[0];
  // Adds the import statement in the specified `unmockImportLocation` under `args`
  textEditor.insertSnippet(
    new vscode.SnippetString(`${getImportStatement(argsObj.lang)}\n`),
    argsObj.unmockImportLocation
  );
  const lastImportLocation = argsObj.lastImportLocation;
  // Add the beforeEach and afterEach calls after the last import
  // +1 to add after the last import statement, +1 to account for the addition of the unmock import
  const afterLastImport = new vscode.Range(lastImportLocation.line + 2, 0, lastImportLocation.line + 2, 0);
  textEditor.insertSnippet(new vscode.SnippetString(`\n${getTestCalls(argsObj.lang)}\n`), afterLastImport);
}
