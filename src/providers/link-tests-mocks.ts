import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import * as _ from "lodash";
import { removeJSCommentsFromSourceText, getRangeFromTextAndMatch, removeStringsFromSourceText } from "../utils";
import { ITestSnap } from "../interfaces";

export class LinkMockHoverProvider implements vscode.HoverProvider {
  snaps: vscode.Uri[] = [];

  provideHover(document: vscode.TextDocument,
               position: vscode.Position,
               token: vscode.CancellationToken): vscode.ProviderResult<vscode.Hover> {
    this.getSnapFiles();
    const file = this.snapFile(document.fileName);
    if (file === undefined) {
      return;
    }
    const snap = new Snap(file.fsPath);
    // TODO - need to compensate for comments, as it offsets line results
    const srcText = removeJSCommentsFromSourceText(document.getText());
    const relevantRanges = findRangesFromTestNames(srcText, snap.tests);
    let matchingTestIndex = -1;
    let i = 0;
    while (i < relevantRanges.length) {
      if (relevantRanges[i].contains(position)) {
        matchingTestIndex = i;
        break;
      }
      i += 1;
    }
    if (matchingTestIndex === -1) { // None matching...
      return;
    }
    
    const relevantTestSnap: ITestSnap[] = snap.loadSnap(matchingTestIndex);

    // The idea is:
    // 1. Extract all the `exports` from the snapfile
    // 2. Remove all final words in the snapfile and uniq them
    // 2.a. This only applies if the final word is a number, so e.g. "unmock end to end node 1" => "unmock end to end node"
    // 3. for each of the uniq'd words, find where they appear in sequence
    // 4. Find the first `{` after their location, and find the matching `}`
    // 5. Check if the position is in this range
    // 6. If yes, show links and such?

    // TODO is hover the best idea? Do we want a code-lens type, to show next to the matching calls, etc?

    // We can now parse from the snap file...
    // Check if there exists a .snap file somewhere nearby (currently only supports jest)

    

    const content = new vscode.MarkdownString();
    relevantTestSnap.forEach(snp => { // TODO - fix the link
      content.appendMarkdown(`[${snp.hash}](${
        vscode.Uri.parse(`command:vscode.window.showTextDocument?${encodeURIComponent("./index.ts")}`)
      }):` +
        `\t_${snp.method.toUpperCase()}_ [${snp.host}${snp.path}]()  \n`);  // Should host/path be trimmed ?
    });
    content.isTrusted = true;
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

function countBracesInLine(line: string) {
  return (line.match(/\{/g) || []).length - (line.match(/\}/g) || []).length;
}

function findBalancedCurlyBraces(location: vscode.Range, srcText: string[]): vscode.Range {
  const lines = srcText.slice(location.start.line); // Start looking from the relevant line
  let lineSpan = 0; // How many lines we traversed already
  let bracesCount = -1; // How many braces we encountered, -1 signifies start of loop

  for (const line of lines) { // Iterate over lines, searching for braces
    const lineWithoutStrings = removeStringsFromSourceText(line); // Ignore braces found in strings...
    if (bracesCount === -1) {  // Look for matching first brace first!
      if (lineWithoutStrings.indexOf('{') !== -1) {  // The line indeed has '{' - otherwise we keep searching for it...
        bracesCount = countBracesInLine(lineWithoutStrings);
      }
    } else {
      bracesCount += countBracesInLine(lineWithoutStrings);
    }

    if (bracesCount <= 0) {
      break; // Found the matching braces!
    }
    lineSpan += 1;
  }

  // Find character location of matching '}' in end line
  let bracesToIgnore = -1 * bracesCount; // how many '}' should be ignored
  /* Imagine e.g.
    ```
      ... some code
      ... blablabla}}}
    ```
    -> bracesCount = -1
      Then we ignore the last '}'
    -> bracesCount = 0
      Then we don't ignore any, the location of the last '}' is the one we need.
    -> bracesCount = -2
      The two trailing }} are wrong, etc.
   */
  const endLine = lines[lineSpan];
  let endLocation = 0;
  while (bracesToIgnore > -1) {
    endLocation = endLine.indexOf('}', endLocation);
    bracesToIgnore -= 1;
  }

  // endLocation + 1 to include '}'
  return new vscode.Range(location.start.line, location.start.character,
                          location.start.line + lineSpan, endLocation + 1);
}

function findRangesFromTestNames(rawContent: string, uniqueTests: string[]) {
  const splitContent = rawContent.split("\n");
  const testNameLocations = getRangeFromTextAndMatch(rawContent, uniqueTests, false);
  // returned range spans from beginning of the given line to the location of matching '}'...
  return testNameLocations.map(location => findBalancedCurlyBraces(location, splitContent));
}

class Snap {
  private snapContents: any;
  public tests: string[];

  constructor(private snapFile: string) {
    this.snapContents = require(snapFile); // Load contents from snap file
    // Get test names listed in this snap file
    // 1. Get keys from the loaded snap object
    // 2. Remove the last word from each key (assumed to be a number)
    // 3. uniq the result
    this.tests = _.uniq(Object.keys(this.snapContents).map(k => k.split(" ").slice(0, -1).join(" ")));
  }

  public loadSnap(idx: number) {
    if (idx < 0 || idx >= this.tests.length) {
      throw Error("Invalid index for test snapshot.");
    }

    const testName = this.tests[idx];
    return Object.keys(this.snapContents)
      .filter(key => key.startsWith(testName))
      .map(key => JSON.parse(this.snapContents[key]));
  }
}