import * as vscode from "vscode";

export const JestTestFileSelector: vscode.DocumentSelector = {};

export class TypescriptGotoMockProvider implements vscode.CodeLensProvider {
    onDidChangeCodeLenses?: vscode.Event<void> | undefined;
    provideCodeLenses(document: vscode.TextDocument, token: vscode.CancellationToken): vscode.ProviderResult<vscode.CodeLens[]> {
        throw new Error("Method not implemented.");
    }
    resolveCodeLens(codeLens: vscode.CodeLens, token: vscode.CancellationToken): vscode.ProviderResult<vscode.CodeLens> {
        throw new Error("Method not implemented.");
    }
}
