import * as vscode from "vscode";

export interface IInsertUnmockAction {
    lastImportLocation: vscode.Position;
    addImport?: boolean;
}