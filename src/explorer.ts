import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import * as axios from "axios";

export class MockExplorer implements vscode.TreeDataProvider<MockTreeItem> {
    private _tree: MockTreeItem[] = [];
    private watcher: vscode.FileSystemWatcher | undefined;
    private mockPath: string | undefined;
    private mockRelativePattern: vscode.RelativePattern | undefined;
    private locationOfJsons: string[] = [];
    private _onDidChangeTreeData = new vscode.EventEmitter<MockTreeItem>();
    onDidChangeTreeData = this._onDidChangeTreeData.event;

    constructor() {
        // TODO: Also add a watcher, perhaps instead of registering to events like this?
        const rootPath = vscode.workspace.rootPath;
        if (rootPath !== undefined) {
            this.mockPath = path.join(rootPath, vscode.workspace.getConfiguration("unmock").path, "save");
            this.mockRelativePattern = new vscode.RelativePattern(this.mockPath, "**/*.json");
            this.hardRefresh();

            this.watcher = vscode.workspace.createFileSystemWatcher("**/*.json");
            this.watcher.onDidChange(fileUri => {
                console.log("POST UPDATE TO CLOUD FOR " + fileUri.fsPath);
            });
            this.watcher.onDidCreate(fileUri => {
                // TODO: We can probably make this more efficient -- but do we need to?
                // This effectively refreshes all of the tree, instead of simply adding/removing where needs...
                this.hardRefresh();
                this._onDidChangeTreeData.fire();
            });

            this.watcher.onDidDelete(fileUri => {
                this.hardRefresh();
                this._onDidChangeTreeData.fire();
            });
        }
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
            return this._tree;
        }
        const matchingCached = this._tree.find((mi) => mi === element);
        return matchingCached && matchingCached.children.length > 0 ? matchingCached.children : this.populateChildren(element.currentPath, element);
    }

    private hardRefresh() {
        this.locationOfJsons = [];  // Clear known jsons location
        vscode.workspace.findFiles(this.mockRelativePattern || "**/*.json").then(filepaths => {
            filepaths.forEach(fp => this.locationOfJsons.push(fp.fsPath));
            const rootPath = vscode.workspace.rootPath;
            if (rootPath === undefined) {
                this._tree = [];
            }
            else {
                this._tree = this.populateChildren(this.mockPath);
            }
            this._onDidChangeTreeData.fire();
        });
    }

    private populateChildren(rootDir?: string, parent?: MockTreeItem) {
        if (rootDir === undefined) {
            return [];
        }
        const files = this.getJsons(rootDir);
        const children = files.map(f => {
            const label = MockExplorer.trimToFolderOrFileBeneath(f, rootDir);
            const isFile = fs.statSync(f).isFile();
            const ti = new MockTreeItem(label, isFile ? vscode.TreeItemCollapsibleState.None : vscode.TreeItemCollapsibleState.Expanded,
                                        f, path.join(rootDir, label), isFile);
            ti.resourceUri = vscode.Uri.file(f);
            if (parent !== undefined) {
                ti.parent = parent;
            }
            return ti;
        });
        if (parent !== undefined) {
            parent.children = children;
        }
        return children;
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
    public children: MockTreeItem[] = [];
    
    constructor (label: string, collapsibleState: vscode.TreeItemCollapsibleState,
                 public fullPath: string, public currentPath: string, public isFile: boolean = false) {
        super(label, collapsibleState);
    }
}