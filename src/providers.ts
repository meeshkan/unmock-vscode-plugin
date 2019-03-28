import * as vscode from "vscode";

// Effectively a DocumentFilter, selecting files with ".test." in them, as is the convention in Jest
export const JestTestFileSelector: vscode.DocumentSelector = {scheme: "file", pattern: "**/*.test.*"};

export class TypescriptGotoMockProvider implements vscode.CodeLensProvider {
    onDidChangeCodeLenses?: vscode.Event<void> | undefined;
    provideCodeLenses(document: vscode.TextDocument, token: vscode.CancellationToken): vscode.ProviderResult<vscode.CodeLens[]> {
        const srcText = document.getText();
        // Remove comments (see https://gist.github.com/DesignByOnyx/05c2241affc9dc498379e0d819c4d756)
        const srcTextWithoutComments = srcText.replace(/\/\*[\s\S]*?\*\/|([^\\:]|^)\/\/.*$/gm, "");
        // Really rough sketch - look for the following as method calls
        if (/[\w_]+\.(?:request|get|delete|head|options|post|put|patch)\(/.test(srcTextWithoutComments) &&
            /axios|superagent|request|fetch|supertest/.test(srcTextWithoutComments) &&  // And one of these libraries has to be used
            !/unmock\(/.test(srcTextWithoutComments)) {  // And there was no call to Unmock
                // get line number and position -- this is unneeded if we want to show it next to the calling code
                const matchCall = srcText.match(/[\w_]+\.(?:request|get|delete|head|options|post|put|patch)\(/);
                if (!matchCall) {
                    return;  // Shouldn't reach here, as we found the pattern in the text without comments...
                }
                let lineNumber = srcText.substr(0, matchCall.index).split("\n").length;
                lineNumber = lineNumber > 0 ? lineNumber - 1 : lineNumber;  // Show it above where needed if possible
                const lineLength = srcText.split("\n")[lineNumber].length;
                // Do we want to show it at the top or around the calling code?
                // const firstInDocument = new vscode.Position(0, 0); // Place to suggest the fix
                const suggestionRange = new vscode.Range(lineNumber, 0, lineNumber, lineLength);
                return [
                    new vscode.CodeLens(suggestionRange, {
                        command: "unmock.insertUnmockToTest",
                        title: "Insert call to unmock",
                        tooltip: "This test file might make actual calls to remote endpoints. You can use unmock to intercept these and get semantically correct responses instead!",
                    })
                ];
        }
        return;
    }
    resolveCodeLens(codeLens: vscode.CodeLens, token: vscode.CancellationToken): vscode.ProviderResult<vscode.CodeLens> {
        throw new Error("Method not implemented.");
    }
}
