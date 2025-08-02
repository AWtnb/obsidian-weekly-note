import { App, Plugin, Notice, TFolder } from "obsidian";

import { NoteMakerModal, getNoteByWeek } from "Modals/Notemaker";

/* 
ノート名（ファイル名）からパスを取得する。
rootにあればnameをそのまま返す。
hogeというフォルダ内であればhoge/nameというようにスラッシュ区切りでパスを返す
*/
const fromName = (app: App, name: string): string | undefined => {
	const vault = app.vault;
	const root = vault.getRoot();
	if (vault.getFileByPath(name)) {
		return name;
	}
	const folders = vault
		.getAllLoadedFiles()
		.filter((file) => file instanceof TFolder && file.name === name);
	if (folders.length > 0) {
		const folder = folders[0];
		const files = vault.getFiles().filter((file) => file.name === name);
		if (files.length > 0) {
			return folder.path + "/" + name;
		}
	}

	return;
};

const COMMAND_MakeNotes = "1年分のノートを作る";
const COMMAND_OpenWeeklyNote = "今週のノートを開く";

/*
icons
https://lucide.dev/icons/
https://docs.obsidian.md/Plugins/User+interface/Icons#Browse+available+icons
*/

export default class WeeklyNote extends Plugin {
	async onload() {
		this.addCommand({
			id: "weeklynote-make-notes",
			name: COMMAND_MakeNotes,
			checkCallback: (checking: boolean) => {
				if (checking) {
					return true;
				}
				new NoteMakerModal(this.app).open();
			},
		});
		this.addCommand({
			id: "weeklynote-open-note",
			name: COMMAND_OpenWeeklyNote,
			checkCallback: (checking: boolean) => {
				if (checking) {
					return true;
				}
				const note = getNoteByWeek(0);
				const notePath = `${note.start.Year}/${note.name}`;
				if (this.app.vault.getFileByPath(notePath)) {
					this.app.workspace.openLinkText(notePath, "", false);
				} else {
					new Notice(`"${notePath}" not found!`);
				}
			},
		});
	}

	onunload() {}
}
