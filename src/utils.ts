import axios from "axios";
import * as vscode from "vscode";
import * as fs from "fs";

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
    const { data: { accessToken } } = await axios.post("https://api.unmock.io:443/token/access", {refreshToken});
    return accessToken;
  } catch {
    return;  // How do we want to handle errors here?
  }
}

export function verifyFileHasBodyJson(filepath: string) {
  // Returns file contents if it is a valid json for a body response
  // Returns undefined otherwise
  const fileContents = fs.readFileSync(filepath, 'utf-8');
  try {
    const parsedContent = JSON.parse(fileContents);
    return parsedContent["body"];
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
export const TestJSFilter: vscode.DocumentFilter = {scheme: "file", pattern: `**/*.test.*${JS_SUFFIXES}`}; // containing ".test." in filename
export const TestJSFolderFilter: vscode.DocumentFilter = {scheme: "file", pattern: `**/test/*.${JS_SUFFIXES}`}; // under "test" folder
export const TestsJSFolderFilter: vscode.DocumentFilter = {scheme: "file", pattern: `**/tests/*.${JS_SUFFIXES}`}; // under "tests" folder
export const AllJSFileFilters = [TestJSFilter, TestJSFolderFilter, TestsJSFolderFilter];

export function removeJSCommentsFromSourceText(srcText: string): string {
  return srcText.replace(/\/\*[\s\S]*?\*\/|([^\\:]|^)\/\/.*$/gm, "");
}

export function getRangeFromTextAndMatch(srcText: string, matchCall: RegExpMatchArray): vscode.Range[] {
  let lastPosition = 0;
  const splittedSrcText = srcText.split("\n");
  return matchCall.map((match) => {
    // -1 for zero-based
    const pos = srcText.indexOf(match, lastPosition);
    lastPosition += pos;
    const lineNumber = srcText.substr(0, pos).split("\n").length - 1;
    const relevantLine = splittedSrcText[lineNumber];
    const lineLength = relevantLine.length;
    const firstCharInLine = relevantLine.length - relevantLine.trimLeft().length;
    return new vscode.Range(lineNumber, firstCharInLine, lineNumber, lineLength);
  });
}
