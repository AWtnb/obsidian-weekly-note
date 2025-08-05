import {
	App,
	Editor,
	MarkdownView,
	Notice,
	Plugin,
	PluginSettingTab,
	Setting,
	TFile,
} from "obsidian";

import { NoteMakerModal, viewingNote, getNoteByWeek } from "Modals/Notemaker";

const COMMAND_MakeNotes = "1年分のノートを作る";
const COMMAND_OpenNote = "今週のノートを開く";
const COMMAND_SendToNoteOfNextWeek = "来週のノートに送る";
const COMMAND_SendToNextNote = "次のノートに送る";

interface WeeklyNoteSettings {
	templatePath: string;
}

const DEFAULT_SETTINGS: WeeklyNoteSettings = {
	templatePath: "",
};

const checkFile = (app: App, path: string): boolean => {
	const file = app.vault.getFileByPath(path);
	return file instanceof TFile;
};

const appendToFile = async (
	app: App,
	filePath: string,
	content: string
): Promise<void> => {
	const file = app.vault.getFileByPath(filePath);
	if (file instanceof TFile) {
		await app.vault.append(file, content);
		new Notice(`Appended to: ${filePath}`);
	} else {
		new Notice(`ERROR: Note not found: ${filePath}`);
	}
};

const getSelectedText = (editor: Editor): string => {
	const cursorTop = editor.getCursor("from").line;
	const cursorBottom = editor.getCursor("to").line;
	if (cursorTop == cursorBottom) {
		return editor.getLine(cursorTop);
	}
	return editor.getRange(
		{ line: cursorTop, ch: 0 },
		{ line: cursorBottom, ch: editor.getLine(cursorBottom).length }
	);
};

export default class WeeklyNotePlugin extends Plugin {
	settings: WeeklyNoteSettings;

	async onload() {
		await this.loadSettings();

		this.addCommand({
			id: "weeklynote-make-notes",
			name: COMMAND_MakeNotes,
			checkCallback: (checking: boolean) => {
				if (checking) {
					return true;
				}
				new NoteMakerModal(this.app, this.settings.templatePath).open();
			},
		});

		this.addCommand({
			id: "weeklynote-open-note",
			name: COMMAND_OpenNote,
			checkCallback: (checking: boolean) => {
				if (checking) {
					return true;
				}
				const note = getNoteByWeek(0);
				const notePath = note.path;
				if (this.app.vault.getFileByPath(notePath)) {
					this.app.workspace.openLinkText(notePath, "", false);
				} else {
					new Notice(`"${notePath}" not found!`);
				}
			},
		});

		this.addCommand({
			id: "weeklynote-send-to-next-note",
			name: COMMAND_SendToNextNote,
			editorCallback: (editor: Editor, view: MarkdownView) => {
				const note = viewingNote(view);
				if (!note) return;
				const t = getSelectedText(editor);
				if (t.length < 1) return;
				const nextPath = note.getNext().path;
				appendToFile(this.app, nextPath, t);
			},
		});

		this.addCommand({
			id: "weeklynote-send-to-note-of-next-week",
			name: COMMAND_SendToNoteOfNextWeek,
			editorCallback: (editor: Editor, view: MarkdownView) => {
				const note = getNoteByWeek(1);
				if (!note) return;
				const t = getSelectedText(editor);
				if (t.length < 1) return;
				appendToFile(this.app, note.path, t);
			},
		});

		this.addSettingTab(new WeeklyNoteSettingTab(this.app, this));
	}

	onunload() {}
	async loadSettings() {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			await this.loadData()
		);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}

class WeeklyNoteSettingTab extends PluginSettingTab {
	plugin: WeeklyNotePlugin;

	constructor(app: App, plugin: WeeklyNotePlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		new Setting(containerEl)
			.setName("Template path")
			.setDesc(
				"Path of template file for weekly note. `{{Mon}}` and `{{Tue}}` will be converted to dates like `Jan. 01` and `Jan. 02`."
			)
			.addText((text) =>
				text
					.setValue(this.plugin.settings.templatePath)
					.onChange(async (value) => {
						this.plugin.settings.templatePath = value;
						await this.plugin.saveSettings();
					})
			);
	}
}
