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
