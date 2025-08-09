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

import {
	NoteMakerModal,
	viewingNote,
	getNoteByWeek,
	fromPath,
	DEFAULT_TEMPLATE,
} from "Modals/Notemaker";
import { SchedulerModal } from "Modals/Scheduler";

const COMMAND_MakeNotes = "1年分のノートを作る";
const COMMAND_OpenNote = "今週のノートを開く";
const COMMAND_OpenNoteOfNextWeek = "来週のノートを開く";
const COMMAND_OpenNextNote = "次のノートを開く";
const COMMAND_SendToNoteOfNextWeek = "来週のノートに送る";
const COMMAND_SendToNextNote = "次のノートに送る";
const COMMAND_Schedule = "スケジュール追加";

const noticeInvalidNotePath = (path: string) => {
	const s = `ERROR: "${path}" not found!`;
	new Notice(s);
	console.log(s);
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
		noticeInvalidNotePath(filePath);
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

interface WeeklyNoteSettings {
	template: string;
	holidays: string[];
	holidaySuffix: string;
}

const DEFAULT_SETTINGS: WeeklyNoteSettings = {
	template: DEFAULT_TEMPLATE,
	holidays: ["2025-01-01", "2026-01-01", "2027-01-01"],
	holidaySuffix: " 休",
};

export default class WeeklyNotePlugin extends Plugin {
	settings: WeeklyNoteSettings;

	async onload() {
		await this.loadSettings();

		this.addCommand({
			id: "weeklynote-make-notes",
			name: COMMAND_MakeNotes,
			checkCallback: (checking: boolean): boolean | void => {
				if (checking) {
					return true;
				}
				new NoteMakerModal(
					this.app,
					this.settings.template,
					this.settings.holidays,
					this.settings.holidaySuffix
				).open();
			},
		});

		this.addCommand({
			id: "weeklynote-open-note",
			name: COMMAND_OpenNote,
			checkCallback: (checking: boolean): boolean | void => {
				if (checking) {
					return true;
				}
				const note = getNoteByWeek(0);
				const notePath = note.path;
				if (this.app.vault.getFileByPath(notePath)) {
					this.app.workspace.openLinkText("", notePath, true);
				} else {
					noticeInvalidNotePath(notePath);
				}
			},
		});

		this.addCommand({
			id: "weeklynote-open-next-note",
			name: COMMAND_OpenNextNote,
			checkCallback: (checking: boolean): boolean | void => {
				if (checking) {
					return true;
				}
				const view =
					this.app.workspace.getActiveViewOfType(MarkdownView);
				if (!view) return;
				const file = view.file;
				if (!file) return;
				const note = fromPath(file.path);
				if (!note) return;
				const next = note.getNext();
				const nextPath = next.path;
				if (this.app.vault.getFileByPath(nextPath)) {
					this.app.workspace.openLinkText("", nextPath, true);
				} else {
					noticeInvalidNotePath(nextPath);
				}
			},
		});

		this.addCommand({
			id: "weeklynote-open-note-of-next-week",
			name: COMMAND_OpenNoteOfNextWeek,
			checkCallback: (checking: boolean): boolean | void => {
				if (checking) {
					return true;
				}
				const next = getNoteByWeek(1);
				const nextPath = next.path;
				if (this.app.vault.getFileByPath(nextPath)) {
					this.app.workspace.openLinkText("", nextPath, true);
				} else {
					noticeInvalidNotePath(nextPath);
				}
			},
		});

		this.addCommand({
			id: "weeklynote-send-to-next-note",
			name: COMMAND_SendToNextNote,
			editorCallback: (editor: Editor, view: MarkdownView): void => {
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
			editorCallback: (editor: Editor, view: MarkdownView): void => {
				const note = getNoteByWeek(1);
				if (!note) return;
				const t = getSelectedText(editor);
				if (t.length < 1) return;
				appendToFile(this.app, note.path, t);
			},
		});

		this.addCommand({
			id: "weeklynote-schedule",
			name: COMMAND_Schedule,
			editorCallback: (editor: Editor, view: MarkdownView): void => {
				new SchedulerModal(this.app, editor, view).open();
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
			.setName("Template")
			.setDesc(
				"Template for weekly note. `{{Mon}}` and `{{Tue}}` will be converted to dates like `Jan. 01` and `Jan. 02`."
			)
			.addTextArea((textarea) =>
				textarea
					.setValue(this.plugin.settings.template)
					.setPlaceholder(DEFAULT_TEMPLATE)
					.onChange(async (value) => {
						const template =
							value.length < 1 ? DEFAULT_TEMPLATE : value;
						this.plugin.settings.template = template;
						await this.plugin.saveSettings();
					})
			)
			.setClass("weeklynote-setting-box");

		new Setting(containerEl)
			.setName("Holidays")
			.setDesc(
				"Specify holidays in yyyy-MM-dd format, separated by lines."
			)
			.addTextArea((textarea) =>
				textarea
					.setValue(this.plugin.settings.holidays.join("\n"))
					.setPlaceholder(DEFAULT_SETTINGS.holidays.join("\n"))
					.onChange(async (value) => {
						if (value.length < 1) {
							this.plugin.settings.holidays =
								DEFAULT_SETTINGS.holidays;
							await this.plugin.saveSettings();
							return;
						}
						this.plugin.settings.holidays = value
							.split("\n")
							.filter((line) => line.trim());
						await this.plugin.saveSettings();
					})
			)
			.setClass("weeklynote-setting-box");

		new Setting(containerEl)
			.setName("Suffix for holiday")
			.setDesc("Suffix for holiday.")
			.addText((text) =>
				text
					.setValue(this.plugin.settings.holidaySuffix)
					.setPlaceholder(DEFAULT_SETTINGS.holidaySuffix)
					.onChange(async (value) => {
						const suffix =
							value.length < 1
								? DEFAULT_SETTINGS.holidaySuffix
								: value;
						this.plugin.settings.holidaySuffix = suffix;
						await this.plugin.saveSettings();
					})
			);
	}
}
