import * as vscode from "vscode";
import { IInsertUnmockAction } from "./interfaces";

const JS_SUFFIXES = "{js,ts,tsx,jsx}"; // es,es6,ts.erb?
export const TestJSFilter: vscode.DocumentFilter = {scheme: "file", pattern: `**/*.test.*${JS_SUFFIXES}`}; // containing ".test." in filename
export const TestJSFolderFilter: vscode.DocumentFilter = {scheme: "file", pattern: `**/test/*.${JS_SUFFIXES}`}; // under "test" folder
export const TestsJSFolderFilter: vscode.DocumentFilter = {scheme: "file", pattern: `**/tests/*.${JS_SUFFIXES}`}; // under "tests" folder
export const AllJSFileFilters = [TestJSFilter, TestJSFolderFilter, TestsJSFolderFilter];

export class TypeScriptInsertUnmockAction implements vscode.CodeActionProvider {
    provideCodeActions(document: vscode.TextDocument,
                       range: vscode.Range | vscode.Selection,
                       context: vscode.CodeActionContext,
                       token: vscode.CancellationToken): vscode.ProviderResult<(vscode.Command | vscode.CodeAction)[]> {
        const srcText = document.getText();
        const matchCall = matchJSRequestWithoutUnmock(srcText);
        if (!matchCall) {
            return;
        }
        const relevantRange = getRangeFromTextAndMatch(srcText, matchCall);
        if (!relevantRange.contains(range)) {
            return;
        }

        const action = new vscode.CodeAction("Insert call to unmock", vscode.CodeActionKind.QuickFix);
        action.command = {
            command: "unmock.insertUnmockToTest",
            title: "Insert call to unmock",
            arguments: [buildTypescriptUnmockActionObject(srcText)]
        };
        const diagnostic = new vscode.Diagnostic(relevantRange,
                                                 "This test file might make real calls to remote endpoints.\n" +
                                                 "You can use unmock to intercept these and get semantically " +
                                                 "correct mocked responses instead.",
                                                 vscode.DiagnosticSeverity.Information);
        action.diagnostics = [diagnostic];
        return [action];
    }
}

export class TypescriptInsertUnmockCodeLens implements vscode.CodeLensProvider {
    onDidChangeCodeLenses?: vscode.Event<void> | undefined;
    provideCodeLenses(document: vscode.TextDocument, token: vscode.CancellationToken): vscode.ProviderResult<vscode.CodeLens[]> {
        const srcText = document.getText();
        const matchCall = matchJSRequestWithoutUnmock(srcText);
        findLastJSImport(srcText);
        if (!matchCall) {
            return;
        }
        const relevantRange = getRangeFromTextAndMatch(srcText, matchCall);
        return [
            new vscode.CodeLens(relevantRange, {
                command: "unmock.insertUnmockToTest",
                title: "Insert call to unmock",
                arguments: [buildTypescriptUnmockActionObject(srcText)]
            })
        ];
    }
}

// The following are defined as functions and not using the const and arrow style, so we can call them
// from anywhere in the file while keeping the exported objects at the top of this file :)

function buildTypescriptUnmockActionObject(srcText: string): IInsertUnmockAction {
    return {
        lastImportLocation: findLastJSImport(srcText),
        unmockImportLocation: unmockJSImportLocation(srcText),
        lang: "typescript"
    };
}

function removeJSCommentsFromSourceText(srcText: string): string {
    return srcText.replace(/\/\*[\s\S]*?\*\/|([^\\:]|^)\/\/.*$/gm, "");
}

function unmockJSImportLocation(srcText: string): vscode.Range {
    const matchCall = srcText.match(/^import .*?"unmock".*?$/m);
    if (matchCall === null) {
        return new vscode.Range(0, 0, 0, 0);  // First line
    }
    return getRangeFromTextAndMatch(srcText, matchCall);
}

function matchJSRequestWithoutUnmock(srcText: string): null | RegExpMatchArray {
    // Remove comments (see https://gist.github.com/DesignByOnyx/05c2241affc9dc498379e0d819c4d756)
    const srcTextWithoutComments = removeJSCommentsFromSourceText(srcText);
    // Really rough sketch - look for the following as method calls
    if (/[\w_]+\.(?:request|get|delete|head|options|post|put|patch)\(/.test(srcTextWithoutComments) &&
        /axios|superagent|request|fetch|supertest/.test(srcTextWithoutComments) &&  // And one of these libraries has to be used
        !/unmock\(/.test(srcTextWithoutComments)) {  // And there was no call to Unmock
            return srcText.match(/[\w_]+\.(?:request|get|delete|head|options|post|put|patch)\(/);
    }
    return null;
}

function getRangeFromTextAndMatch(srcText: string, matchCall: RegExpMatchArray): vscode.Range {
    const lineNumber = srcText.substr(0, matchCall.index).split("\n").length - 1;  // -1 for zero-based
    const relevantLine = srcText.split("\n")[lineNumber];
    const lineLength = relevantLine.length;
    const firstCharInLine = relevantLine.length - relevantLine.trimLeft().length;
    return new vscode.Range(lineNumber, firstCharInLine, lineNumber, lineLength);
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
