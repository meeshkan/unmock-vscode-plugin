import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

export class MockExplorer implements vscode.TreeDataProvider<vscode.TreeItem> {
    // private watcher = vscode.workspace.createFileSystemWatcher("*.json");
    private contents = new Array<vscode.TreeItem>();
    private _onDidChangeTreeData = new vscode.EventEmitter<vscode.TreeItem>();
    onDidChangeTreeData = this._onDidChangeTreeData.event;

    constructor() {
        this.hardRefresh();
    }

    getTreeItem(element: vscode.TreeItem): vscode.TreeItem | Thenable<vscode.TreeItem> {
        return element;
    }

    getChildren(element?: vscode.TreeItem | undefined): vscode.ProviderResult<vscode.TreeItem[]> {
        return this.contents;
    }

    private hardRefresh() {
        vscode.workspace.findFiles("**/*.json").then(files => {
            this.contents = files.map(f => {
                const shortPath = path.join(path.basename(path.dirname(f.fsPath)), path.basename(f.fsPath));
                return new vscode.TreeItem(shortPath);
            });
            this._onDidChangeTreeData.fire();
        });
    }
}