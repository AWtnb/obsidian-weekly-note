import { App, Notice } from "obsidian";
import * as path from "path";
import * as fs from "fs";

export const expandEnvVars = (input: string): string => {
	return input.replace(/\${(\w+)}/g, (match, varName) => {
		return process.env[varName] || match;
	});
};

export const backupVault = async (
	app: App,
	backupDir: string
): Promise<void> => {
	if (!backupDir) {
		new Notice("Backup dir is not specified!");
		return;
	}
	try {
		backupDir = expandEnvVars(backupDir);
		if (!fs.existsSync(backupDir)) {
			new Notice(`Backup dir '${backupDir}' not exists!`);
			return;
		}

		const files = app.vault.getFiles();
		let copiedCount = 0;
		for (const file of files) {
			const relPath = file.path;
			const destPath = path.join(backupDir, relPath).replace(".md", ".txt");
			const destDir = path.dirname(destPath);
			if (!fs.existsSync(destDir)) {
				fs.mkdirSync(destDir, { recursive: true });
			}
			const content = await app.vault.read(file);
			fs.writeFileSync(destPath, content, "utf8");
			copiedCount++;
		}
		new Notice(`Backuped ${copiedCount} files to '${backupDir}'`);
	} catch (error) {
		new Notice(`Backup error: ${error.message}`, 0);
		console.error("Backup error:", error);
	}
};
