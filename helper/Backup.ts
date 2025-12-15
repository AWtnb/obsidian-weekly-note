import { App, Notice, TFile } from "obsidian";
import * as path from "path";
import * as fs from "fs";

export const expandEnvVars = (input: string): string => {
	return input.replace(/\${(\w+)}/g, (match, varName) => {
		return process.env[varName] || match;
	});
};

export const backupNote = async (
	app: App,
	note: TFile,
	destDir: string
): Promise<void> => {
	destDir = expandEnvVars(destDir);
	if (!fs.existsSync(destDir)) {
		fs.mkdirSync(destDir, { recursive: true });
	}
	const content = await app.vault.read(note);
	const newPath = path.join(destDir, note.path).replace(".md", ".txt");
	fs.writeFileSync(newPath, content, "utf8");
};

export const backupNotice = (s: string, asError: boolean = false): void => {
	if (asError) {
		new Notice(s, 0);
		console.error(`${new Date()} ${s}`);
	} else {
		new Notice(s);
		console.log(`${new Date()} ${s}`);
	}
};

export const backupVault = async (
	app: App,
	backupDir: string
): Promise<void> => {
	if (!backupDir) {
		backupNotice("Backup dir is not specified!");
		return;
	}
	backupDir = expandEnvVars(backupDir);
	if (!fs.existsSync(backupDir)) {
		backupNotice(`Backup dir '${backupDir}' not exists!`, true);
		return;
	}
	try {
		const files = app.vault.getFiles();
		let copiedCount = 0;
		for (const file of files) {
			await backupNote(app, file, backupDir);
			copiedCount++;
		}
		backupNotice(`Backuped ${copiedCount} files to '${backupDir}'`);
	} catch (error) {
		throw error;
	}
};
