import axios from "axios";
import * as vscode from "vscode";
import * as fs from "fs";

// @ts-ignore
export const dynamicRequire = typeof __webpack_require__ === "function" ? __non_webpack_require__ : require;

export function getImportStatement(lang: string): string | undefined {
  lang = lang.toLowerCase();
  if (lang === "typescript" || lang === "javascript") {
    return "import { unmock, kcomnu } from \"unmock\";";
  }
}

export function getTestCalls(lang: string): string | undefined {
  lang = lang.toLowerCase();
  if (lang === "typescript" || lang === "javascript") {
    return "beforeEach(async () => await unmock());\nafterEach(() => kcomnu());";
  }
}

export async function getAccessToken() {
  const refreshToken = getRefreshToken();
  if (refreshToken === undefined) {
    return;
  }
  try {
    const {
      data: { accessToken },
    } = await axios.post("https://api.unmock.io:443/token/access", { refreshToken });
    return accessToken;
  } catch {
    return; // How do we want to handle errors here?
  }
}

export function getJsonFileBody(filepath: string) {
  // Returns "body" contents of valid JSON file;
  // Returns undefined if file is not valid JSON or body does not exist
  const fileContents = fs.readFileSync(filepath, "utf-8");
  try {
    const parsedContent = JSON.parse(fileContents);
    return parsedContent.body;
  } catch {
    return;
  }
}

export function getConfig() {
  return vscode.workspace.getConfiguration("unmock");
}

function getRefreshToken(): string | undefined {
  return getConfig().refreshToken;
}

const JS_SUFFIXES = "{js,ts,tsx,jsx}"; // es,es6,ts.erb?
export const TestJSFilter: vscode.DocumentFilter = { scheme: "file", pattern: `**/*.test.*${JS_SUFFIXES}` }; // containing ".test." in filename
export const TestJSFolderFilter: vscode.DocumentFilter = { scheme: "file", pattern: `**/test/*.${JS_SUFFIXES}` }; // under "test" folder
export const TestsJSFolderFilter: vscode.DocumentFilter = { scheme: "file", pattern: `**/tests/*.${JS_SUFFIXES}` }; // under "tests" folder
export const UnderscoreTestsJSFolderFilter: vscode.DocumentFilter = {
  scheme: "file",
  pattern: `**/__tests__/*.${JS_SUFFIXES}`,
}; // under "tests" folder
export const AllJSFileFilters = [TestJSFilter, TestJSFolderFilter, TestsJSFolderFilter, UnderscoreTestsJSFolderFilter];

export function removeJSCommentsFromSourceText(srcText: string): string {
  // Replaces comments with newlines to maintain line count.
  return srcText.replace(/\/\*[\s\S]*?\*\/|([^\\:]|^)\/\/.*$/gm, match => {
    return "\n".repeat(countInString(match, "\n"));
  });
}

export function countInString(str: string, substr: string) {
  return (str.match(new RegExp(substr, "g")) || []).length;
}

export function removeStringsFromSourceText(srcText: string): string {
  return srcText.replace(/(?:"[^"]*?"|'[^']*?'|`[^`]*?`)/gm, "");
}

export function getRangeFromTextAndMatch(
  srcText: string,
  searchFor: RegExpMatchArray | string[],
  entireLine: boolean = true
): vscode.Range[] {
  /**
   * Constructs a `vscode.Range` object for each element in `searchFor` that's found in `srcText`.
   *
   * Assumptions:
   *  - Every element in `searchFor` is indeed in `srcText`
   *
   * @param srcText - Raw source text, unsplitted (contains `\n`)
   * @param searchFor - List of strings (or a `RegExpMatchArray`) to search in `srcText` and build a Range object for
   * @param entireLine - Whether or not the returned Range objects will cover the entire line (ignoring indentation)
   *    or just encapsulate the matched string.
   *
   * @returns An array of `vscode.Range` objects, where each Range object describes the location
   *  (line, start location, end location) of a matching element in `searchFor` in `srcText`.
   */
  let lastPosition = 0;
  const splittedSrcText = srcText.split("\n");

  return searchFor.map(str => {
    const pos = srcText.indexOf(str, lastPosition);
    lastPosition += pos;
    // -1 for zero-based
    const lineNumber = srcText.substr(0, pos).split("\n").length - 1;
    const relevantLine = splittedSrcText[lineNumber];

    if (entireLine) {
      // The Range will cover the entire line (ignoring indentation though)
      const lineLength = relevantLine.length;
      const firstCharInLine = relevantLine.length - relevantLine.trimLeft().length;
      return new vscode.Range(lineNumber, firstCharInLine, lineNumber, lineLength);
    } else {
      // The range will only cover the matched text.
      const firstCharLocation = relevantLine.indexOf(str);
      const lastCharLocation = firstCharLocation + str.length;
      return new vscode.Range(lineNumber, firstCharLocation, lineNumber, lastCharLocation);
    }
  });
}

export function findPositionInRanges(position: vscode.Position, ranges: vscode.Range[]): number {
  /**
   * Returns the index for the Range (in `ranges`) containing `position` or -1 if none contain it.
   */
  for (let i = 0; i < ranges.length; i++) {
    if (ranges[i].contains(position)) {
      return i;
    }
  }
  return -1;
}
