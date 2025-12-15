import { App, Notice, TFile } from "obsidian";
import * as path from "path";
import * as fs from "fs";

export const expandEnvVars = (input: string): string => {
	return input.replace(/\${(\w+)}/g, (match, varName) => {
		return process.env[varName] || match;
	});
};

export const backupNote = async (app: App, note: TFile, destDir: string) => {
	destDir = expandEnvVars(destDir);
	if (!fs.existsSync(destDir)) {
		fs.mkdirSync(destDir, { recursive: true });
	}
	const content = await app.vault.read(note);
	const newPath = path.join(destDir, note.path).replace(".md", ".txt");
	fs.writeFileSync(newPath, content, "utf8");
};

export const backupVault = async (
	app: App,
	backupDir: string
): Promise<void> => {
	if (!backupDir) {
		new Notice("Backup dir is not specified!");
		return;
	}
	backupDir = expandEnvVars(backupDir);
	if (!fs.existsSync(backupDir)) {
		new Notice(`Backup dir '${backupDir}' not exists!`, 0);
		return;
	}
	try {
		const files = app.vault.getFiles();
		let copiedCount = 0;
		for (const file of files) {
			await backupNote(app, file, backupDir);
			copiedCount++;
		}
		new Notice(`Backuped ${copiedCount} files.`);
		console.log(`Backuped ${copiedCount} files to '${backupDir}'`);
	} catch (error) {
		new Notice(`Backup error: ${error.message}`, 0);
		console.error("Backup error:", error);
		throw error;
	}
};
