import { App, Notice, TFile } from "obsidian";
import * as path from "path";
import * as fs from "fs";

export const backupFile = async (
	app: App,
	file: TFile,
	destDir: string
): Promise<void> => {
	if (destDir == "") {
		throw new Error("Directory path to backup not specified.");
	}
	const content = await app.vault.read(file);
	const newPath = path.join(destDir, file.path).replace(".md", ".txt");
	const d = path.dirname(newPath);
	if (!fs.existsSync(d)) {
		fs.mkdirSync(d, { recursive: true });
	}
	fs.writeFileSync(newPath, content, "utf8");
};

export const backupNotice = (s: string, asError: boolean): void => {
	if (asError) {
		new Notice(s, 0);
		console.error(`${new Date()} ${s}`);
	} else {
		new Notice(s);
		console.log(`${new Date()} ${s}`);
	}
};
