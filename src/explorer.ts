import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";

export class MockExplorer implements vscode.TreeDataProvider<MockTreeItem> {
    // private watcher = vscode.workspace.createFileSystemWatcher("*.json");
    private locationOfJsons = new Array<string>();
    private _onDidChangeTreeData = new vscode.EventEmitter<MockTreeItem>();
    onDidChangeTreeData = this._onDidChangeTreeData.event;

    constructor() {
        // TODO: Also add a watcher?
        this.hardRefresh();
    }

    getTreeItem(element: MockTreeItem): MockTreeItem | Thenable<MockTreeItem> {
        return {
            ...element,
            command: element.isFile ? { // TODO: Update this to JSON editor that POSTS to cloud if token is given
                command: "unmock.editMock",
                arguments: [element],
                title: "Opens mock for editing",
            } : void 0,
        };
    }

    getChildren(element?: MockTreeItem | undefined): vscode.ProviderResult<MockTreeItem[]> {
        if (element === undefined) {
            const rootPath = vscode.workspace.rootPath;
            if (rootPath === undefined) {
                return [];
            }
            return this.populateChildren(path.join(rootPath, vscode.workspace.getConfiguration("unmock").path, "save"));
        }
        return this.populateChildren(element.currentPath, element);
    }

    private hardRefresh() {
        vscode.workspace.findFiles("**/*.json").then(filepaths => {
            filepaths.forEach(fp => this.locationOfJsons.push(fp.fsPath));
            this._onDidChangeTreeData.fire();
        });
    }

    private populateChildren(rootDir?: string, parent?: MockTreeItem) {
        if (rootDir === undefined) {
            return [];
        }
        const files = this.getJsons(rootDir);
        return files.map(f => {
            const label = MockExplorer.trimToFolderOrFileBeneath(f, rootDir);
            const isFile = fs.statSync(f).isFile();
            const ti = new MockTreeItem(label, isFile ? vscode.TreeItemCollapsibleState.None : vscode.TreeItemCollapsibleState.Expanded,
                                        f, path.join(rootDir, label), isFile);
            if (parent !== undefined) {
                ti.parent = parent;
            }
            return ti;
        });
    }

    private getJsons(rootDir?: string) {
        /**
         * rootDir - either undefined or relative path such as ".unmock/" or ".unmock/save/"
         */
        if (rootDir === undefined) {
            return [];
        }
        const dir = rootDir ? (rootDir.endsWith("/") ? rootDir : rootDir + "/") : "";
        if (this.directoryIsKnownToContainJson(dir) === false) {
            return [];
        }
        const filePaths = fs.readdirSync(dir);
        return filePaths.map(relativePath => path.join(dir, relativePath)).filter(fp => {
            if (this.directoryIsKnownToContainJson(fp) === false) {
                return false;
            }
            return MockExplorer.isJsonFile(fp, true);
        });
    }

    private static isJsonFile(fp?: string, directoryOK = false) {
        if (fp === undefined) {
            return false;
        }
        const fileStats = fs.statSync(fp);
        return (fileStats.isFile() && fp.endsWith(".json")) || (directoryOK && fileStats.isDirectory());
    }

    private directoryIsKnownToContainJson(directory: string) {
        let directoryIsKnownToContainJson = false;
        this.locationOfJsons.forEach(location => {
            directoryIsKnownToContainJson = directoryIsKnownToContainJson || location.indexOf(directory) > -1;
        });
        return directoryIsKnownToContainJson;
    }

    private static trimToFolderOrFileBeneath(filepath: string, rootDir?: string) {
        /**
         * Returns the label as the file or foldername immediately after given rootDir
         * rootDir is expected to be an absolute path.
         */
        const noRoot = rootDir ? filepath.replace(rootDir, "") : filepath;
        const splittedPath = noRoot.split("/");
        return splittedPath[1];  // 1 because the trailing '/' remains after replace
    }
}

export class MockTreeItem extends vscode.TreeItem {
    public parent: MockTreeItem | undefined;
    
    constructor (label: string, collapsibleState: vscode.TreeItemCollapsibleState,
                 public fullPath: string, public currentPath: string, public isFile: boolean = false) {
        super(label, collapsibleState);
    }
}