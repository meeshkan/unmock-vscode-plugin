import * as vscode from "vscode";

const matchRequestWithoutUnmock = (srcText: string) => {
    // Remove comments (see https://gist.github.com/DesignByOnyx/05c2241affc9dc498379e0d819c4d756)
    const srcTextWithoutComments = srcText.replace(/\/\*[\s\S]*?\*\/|([^\\:]|^)\/\/.*$/gm, "");
    // Really rough sketch - look for the following as method calls
    if (/[\w_]+\.(?:request|get|delete|head|options|post|put|patch)\(/.test(srcTextWithoutComments) &&
        /axios|superagent|request|fetch|supertest/.test(srcTextWithoutComments) &&  // And one of these libraries has to be used
        !/unmock\(/.test(srcTextWithoutComments)) {  // And there was no call to Unmock
            return srcText.match(/[\w_]+\.(?:request|get|delete|head|options|post|put|patch)\(/);
    }
    return;
};

const getRangeFromTextAndMatch = (srcText: string, matchCall: RegExpMatchArray) => {
    let lineNumber = srcText.substr(0, matchCall.index).split("\n").length - 1;  // -1 for zero-based
    const relevantLine = srcText.split("\n")[lineNumber];
    const lineLength = relevantLine.length;
    const firstCharInLine = relevantLine.length - relevantLine.trimLeft().length;
    return new vscode.Range(lineNumber, firstCharInLine, lineNumber, lineLength);
};

// Effectively a DocumentFilter, selecting files with ".test." in them, as is the convention in Jest
export const JestTestFileSelector: vscode.DocumentSelector = {scheme: "file", pattern: "**/*.test.*"};

export class TypeScriptInsertUnmockAction implements vscode.CodeActionProvider {
    provideCodeActions(document: vscode.TextDocument,
                       range: vscode.Range | vscode.Selection,
                       context: vscode.CodeActionContext,
                       token: vscode.CancellationToken): vscode.ProviderResult<(vscode.Command | vscode.CodeAction)[]> {
        const srcText = document.getText();
        const matchCall = matchRequestWithoutUnmock(srcText);
        if (!matchCall) {
            return;
        }
        const relevantRange = getRangeFromTextAndMatch(srcText, matchCall);
        if (!relevantRange.contains(range)) {
            return;
        }

        const action = new vscode.CodeAction("Insert call to unmock", vscode.CodeActionKind.QuickFix);
        action.command = {command: "unmock.insertUnmockToTest", title: "Insert call to unmock", arguments: [relevantRange]};
        action.diagnostics = [
            new vscode.Diagnostic(relevantRange,
                                    `This test file might make real calls to remote endpoints.\n
                                    You can use unmock to intercept these and get semantically correct mocked responses instead.`,
                                    vscode.DiagnosticSeverity.Information)
        ];
        return [action];
    }
}

export class TypescriptInsertUnmockCodeLens implements vscode.CodeLensProvider {
    onDidChangeCodeLenses?: vscode.Event<void> | undefined;
    provideCodeLenses(document: vscode.TextDocument, token: vscode.CancellationToken): vscode.ProviderResult<vscode.CodeLens[]> {
        const srcText = document.getText();
        const matchCall = matchRequestWithoutUnmock(srcText);
        if (!matchCall) {
            return;
        }
        const relevantRange = getRangeFromTextAndMatch(srcText, matchCall);
        return [
            new vscode.CodeLens(relevantRange, {
                command: "unmock.insertUnmockToTest",
                title: "Insert call to unmock",
                arguments: [relevantRange]
            })
        ];
    }
}
