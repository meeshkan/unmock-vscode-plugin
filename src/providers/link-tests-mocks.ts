import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";

export class LinkMockHoverProvider implements vscode.HoverProvider {
  snaps: vscode.Uri[] = [];

  provideHover(document: vscode.TextDocument,
               position: vscode.Position,
               token: vscode.CancellationToken): vscode.ProviderResult<vscode.Hover> {
  this.getSnapFiles();
  const file = this.snapFile(document.fileName);
  if (file !== undefined) {
    // We can now parse from the snap file...
  }
    // Check if there exists a .snap file somewhere nearby (currently only supports jest)
    // const srcText = document.getText();
  //     const matchCall = matchJSRequestWithoutUnmock(srcText);
  //     if (!matchCall) {
  //         return;
  //     }
  //     const relevantRanges = getRangeFromTextAndMatch(srcText, matchCall);
  //     const relevantRange = relevantRanges.filter(occRange => occRange.contains(position));
  //     if (relevantRange.length !== 1) {
  //         return;
  //     }
  //     const commandUri = vscode.Uri.parse(`command:unmock.insertUnmockToTest?${
  //         encodeURIComponent(JSON.stringify(buildTypescriptUnmockActionObject(srcText)))
  //     }`);
      const content = new vscode.MarkdownString(":+1:");
  //     content.isTrusted = true;
      return new vscode.Hover(content);
  }

  private getSnapFiles() {
    if (this.snaps.length === 0) {
      vscode.workspace.findFiles(`**/*${SNAPSHOT_SUFFIX}`)
        .then(files => {
          if (files === undefined || files.length === 0) {
            return;
          }
          // Check if any of the found snap files have a "hash" keyword...
          files.forEach((file) => {
            const contents = fs.readFileSync(file.fsPath, "utf-8");
            const hasKeywords = SNAPSHOT_KEYWORDS.reduce((agg, kw) => agg = agg && contents.includes(kw), true);
            if (hasKeywords) {
              this.snaps.push(file);
            }
          });
        });
    }
  }

  private snapFile(filename: string) {
    const filtered = this.snaps.filter(snapFile => path.basename(snapFile.fsPath, SNAPSHOT_SUFFIX) === path.basename(filename));
    if (filtered) {
      return filtered[0];
    }
    return;
  }
}

// Defined as functions (and not arrow notation) so these are available anywhere in the document

const SNAPSHOT_SUFFIX = ".snap";
// These must be found in a snapshot to be considered valid
const SNAPSHOT_KEYWORDS = ["\"hash\":", "\"host\":", "\"method\":", "\"path\":"];

async function getAssociatedSnapshot(filename: string): Promise<vscode.Uri | undefined> {
  const files = await vscode.workspace.findFiles(`**/${filename}${SNAPSHOT_SUFFIX}`);
  if (files === undefined || files.length === 0) {
    return;
  }
  
}