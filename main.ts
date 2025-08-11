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
	new Notice(s, 0);
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
	holidayAltSuffix: string;
}

const DEFAULT_SETTINGS: WeeklyNoteSettings = {
	template: DEFAULT_TEMPLATE,
	holidays: [
		"2025-01-01 元日",
		"2025-01-13 成人の日",
		"2025-02-11 建国記念の日",
		"2025-02-23 天皇誕生日",
		"2025-02-24 振替休日",
		"2025-03-20 春分の日",
		"2025-04-29 昭和の日",
		"2025-05-03 憲法記念日",
		"2025-05-04 みどりの日",
		"2025-05-05 こどもの日",
		"2025-05-06 振替休日",
		"2025-07-21 海の日",
		"2025-08-11 山の日",
		"2025-09-15 敬老の日",
		"2025-09-23 秋分の日",
		"2025-10-13 スポーツの日",
		"2025-11-03 文化の日",
		"2025-11-23 勤労感謝の日",
		"2025-11-24 振替休日",
	],
	holidayAltSuffix: " 休",
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
					this.settings.holidayAltSuffix
				).open();
			},
		});

		this.addCommand({
			id: "weeklynote-open-note",
			icon: "calendar-fold",
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
			icon: "square-arrow-right",
			name: COMMAND_OpenNextNote,
			callback: () => {
				const file = this.app.workspace.getActiveFile();
				if (!file) {
					new Notice("No active note!");
					return;
				}
				const note = weeklyNoteFromPath(file.path);
				if (!note) {
					new Notice(
						"Note path is invalid! Note must be MMdd-MMdd format under year-named folder.",
						0
					);
					return;
				}
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
			icon: "forward",
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
			icon: "calendar-clock",
			name: COMMAND_Schedule,
			editorCallback: (editor: Editor, view: MarkdownView): void => {
				new SchedulerModal(this.app, editor, view).open();
			},
		});

		this.addCommand({
			id: "weeklynote-select-list-tree",
			icon: "list-tree",
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
				"Specify holidays in yyyy-MM-dd format, separated by lines. If a holiday name is specified after yyyy-MM-dd with a space, it will be inserted after the date. Otherwise, the Alternative suffix (below) will be inserted."
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
			.setName("Alternative suffix for holiday")
			.setDesc("Alternative suffix for holiday.")
			.addText((text) =>
				text
					.setValue(this.plugin.settings.holidayAltSuffix)
					.setPlaceholder(DEFAULT_SETTINGS.holidayAltSuffix)
					.onChange(async (value) => {
						const suffix =
							value.length < 1
								? DEFAULT_SETTINGS.holidayAltSuffix
								: value;
						this.plugin.settings.holidayAltSuffix = suffix;
						await this.plugin.saveSettings();
					})
			);
	}
}
