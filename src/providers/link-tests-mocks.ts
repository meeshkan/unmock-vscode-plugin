import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import * as _ from "lodash";
import { removeJSCommentsFromSourceText,
         getRangeFromTextAndMatch,
         removeStringsFromSourceText,
         countInString,
         findPositionInRanges } from "../utils";
import { ITestSnap } from "../interfaces";
import { mockExplorer } from "../index";

class SnapCollection { 
  private snapsLocations: string[] = [];
  private snaps: {[snapLocation: string]: Snap} = {};

  constructor() {
    this.refreshSnaps();
  }

  private refreshSnaps() {
    this.snaps = {};
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
            this.snapsLocations.push(file.fsPath);
          }
        });
      });
  }

  public snapFromFilename(filename: string): Snap | undefined {
    const name = path.basename(filename);
    if (this.snaps[name] !== undefined) {
      return this.snaps[name];
    }
    const filtered = this.snapsLocations.filter(snapLoc => path.basename(snapLoc, SNAPSHOT_SUFFIX) === name);
    if (filtered) {
      this.snaps[name] = new Snap(filtered[0]);
      return this.snaps[name];
    }
    return;
  }
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

  public loadTest({idx, name} : {idx?: number, name?: string}) {
    let testName: string;
    if (name === undefined) {
      if (idx === undefined || idx < 0 || idx >= this.tests.length) {
        throw Error("Invalid index for test snapshot.");
      }
  
      testName = this.tests[idx];
    } else {
      testName = name;
    }
    return Object.keys(this.snapContents)
      .filter(key => key.startsWith(testName))
      .map(key => JSON.parse(this.snapContents[key]));
  }
}

const SNAP_COLLECTION = new SnapCollection();

export class LinkMockCodeLens implements vscode.CodeLensProvider {
  onDidChangeCodeLenses?: vscode.Event<void> | undefined;

  provideCodeLenses(document: vscode.TextDocument, token: vscode.CancellationToken): vscode.ProviderResult<vscode.CodeLens[]> {
    throw new Error("Method not implemented.");
  }
}

// TODO is hover the best idea? Do we want a code-lens type, to show next to the matching calls, etc?
export class LinkMockHoverProvider implements vscode.HoverProvider {
  snaps: vscode.Uri[] = [];

  provideHover(document: vscode.TextDocument,
               position: vscode.Position,
               token: vscode.CancellationToken): vscode.ProviderResult<vscode.Hover> {

    const snap = SNAP_COLLECTION.snapFromFilename(document.fileName); // find snapshot file that matches current document
    if (snap === undefined) {
      return;
    }
    const srcText = removeJSCommentsFromSourceText(document.getText());
    // Find the ranges for different tests that are recorded in the snapshot
    const relevantRanges = findRangesFromTestNames(srcText, snap.tests);
    // Test if any of the ranges apply for current position; otherwise we don't need to show information
    let matchingTestIndex = findPositionInRanges(position, relevantRanges);
    if (matchingTestIndex === -1) { // None matching...
      return;
    }
    const relevantTestSnap: ITestSnap[] = snap.loadTest({idx: matchingTestIndex}); // Loads the snapshot's content

    // Create the content to show
    const content = new vscode.MarkdownString();
    relevantTestSnap.forEach(snp => {
      if (mockExplorer === undefined) {
        return;  // Can't verify mocks actually exist
      }
      const mockLocation = mockExplorer.getPathFromHash(snp.hash);
      if (mockLocation === undefined) {
        return; // Filter mocks that aren't found in the explorer
      }
      const cmdUri = vscode.Uri.parse(`command:unmock.editMock?${
        encodeURIComponent(JSON.stringify({currentPath: mockLocation}))
      }`);
      const md = `[\`${snp.hash}\`](${cmdUri}): _${snp.method.toUpperCase()}_ ` +
                 `[${(snp.host + snp.path).substr(0, 24) + "..."}]()  \n`;
      content.appendMarkdown(md);
    });
    content.isTrusted = true;
    return new vscode.Hover(content);
  }
}

// Defined as functions (and not arrow notation) so these are available anywhere in the document

const SNAPSHOT_SUFFIX = ".snap";
// These must be found in a snapshot to be considered valid
const SNAPSHOT_KEYWORDS = ["\"hash\":", "\"host\":", "\"method\":", "\"path\":"];

function countBracesInLine(line: string) {
  return countInString(line, '{') - countInString(line, '}');
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
