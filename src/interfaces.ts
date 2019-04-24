import * as vscode from "vscode";
import { Snap } from "./providers/link-tests-mocks";

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

export interface IBuildLinkTestMockHover {
  relevantSnap: Snap;
  testIndex: number;
  range?: vscode.Range;
}
