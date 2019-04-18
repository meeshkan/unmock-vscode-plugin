import * as vscode from "vscode";

export interface IInsertUnmockAction {
  lastImportLocation: vscode.Position;
  unmockImportLocation: vscode.Range;
  lang: string;
}

export interface ITestSnap {
  hash: string;
  host: string;
  method: string;
  path: string;
}

export interface IMockLocation {
  currentPath: string;
}