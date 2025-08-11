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
	newWeeklyNote,
	weeklyNoteFromPath,
	DEFAULT_TEMPLATE,
} from "Modals/Notemaker";
import { SchedulerModal } from "Modals/Scheduler";

const COMMAND_MakeNotes = "1年分のノートを作る";
const COMMAND_OpenNote = "今週のノートを開く";
const COMMAND_OpenNextNote = "次のノートを開く";
const COMMAND_SendToNextNote = "次のノートに送る";
const COMMAND_Schedule = "スケジュール追加";
const COMMAND_SelectListTree = "リスト以下を選択";

const noticeInvalidNotePath = (path: string) => {
	const s = `ERROR: "${path}" not found!`;
	new Notice(s, 1000);
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

interface CursorEdge {
	top: number;
	bottom: number;
}

const getCursorEdge = (editor: Editor): CursorEdge => {
	return {
		top: editor.getCursor("from").line,
		bottom: editor.getCursor("to").line,
	};
};

const getSelectedText = (editor: Editor): string => {
	const edge = getCursorEdge(editor);
	if (edge.top == edge.bottom) {
		return editor.getLine(edge.top);
	}
	return editor.getRange(
		{ line: edge.top, ch: 0 },
		{ line: edge.bottom, ch: editor.getLine(edge.bottom).length }
	);
};

const selectListTree = (editor: Editor) => {
	const edge = getCursorEdge(editor);

	const baseLine = editor.getLine(edge.bottom);
	const baseIndent = baseLine.length - baseLine.trimStart().length;
	let selTop = edge.top;
	let selBottom = edge.bottom;

	const lines = editor.getValue().split("\n");
	for (let i = edge.bottom + 1; i < lines.length; i++) {
		const line = lines[i];
		const indent = line.length - line.trimStart().length;
		if (baseIndent < indent) {
			selBottom = i;
		} else {
			break;
		}
	}
	editor.setSelection(
		{ line: selTop, ch: 0 },
		{ line: selBottom, ch: editor.getLine(selBottom).length }
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
			icon: "calendar-plus",
			name: COMMAND_MakeNotes,
			callback: () => {
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
			callback: () => {
				const note = newWeeklyNote();
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
			callback: () => {
				const file = this.app.workspace.getActiveFile();
				if (!file) return;
				const note = weeklyNoteFromPath(file.path);
				if (!note) return;
				const next = note.increment();
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
				const file = view.file;
				if (!file) return;
				const note = weeklyNoteFromPath(file.path);
				if (!note) return;
				const t = getSelectedText(editor);
				if (t.length < 1) return;
				const nextPath = note.increment().path;
				appendToFile(this.app, nextPath, t);
			},
		});

		this.addCommand({
			id: "weeklynote-schedule",
			name: COMMAND_Schedule,
			editorCallback: (editor: Editor, view: MarkdownView): void => {
				new SchedulerModal(this.app, editor, view).open();
			},
		});

		this.addCommand({
			id: "weeklynote-select-list-tree",
			name: COMMAND_SelectListTree,
			editorCallback: (editor: Editor, _: MarkdownView): void => {
				selectListTree(editor);
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
