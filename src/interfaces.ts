import * as vscode from "vscode";

export interface IInsertUnmockAction {
  lastImportLocation: vscode.Position;
  unmockImportLocation: vscode.Range;
  lang: string;
}