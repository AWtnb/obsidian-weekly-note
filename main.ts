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
	WeeklyNote,
	WeeklyNoteModal,
	fromWeek,
	fromPath,
	DEFAULT_TEMPLATE,
	toDateString,
} from "helper/Weeklynote";
import { NoteEditor, asMdList } from "helper/Noteeditor";
import { JumpModal, openNote } from "helper/Notejumper";

const COMMAND_MakeNotes = "1年分のノートを作る";
const COMMAND_OpenNote = "今週のノートを開く";
const COMMAND_OpenPrevNote = "前のノートを開く";
const COMMAND_OpenNextNote = "次のノートを開く";
const COMMAND_SendToNextNote = "次のノートに送る";
const COMMAND_JumpToNote = "ノートにジャンプ";
const COMMAND_ScrollToCursor = "カーソルまでスクロール";
const COMMAND_JumpDownToNextPlainLine = "次のプレーンな行までジャンプ";
const COMMAND_JumpUpToLastPlainLine = "前のプレーンな行までジャンプ";

const appendToFile = async (
	app: App,
	path: string,
	content: string
): Promise<void> => {
	const file = app.vault.getFileByPath(path);
	if (file instanceof TFile) {
		await app.vault.append(file, content);
		new Notice(`Appended to: ${path}`);
		return;
	}
	const s = `ERROR: Failed to append to "${path}" (file not found)`;
	new Notice(s, 0);
};

interface WeeklyNoteSettings {
	template: string;
	holidays: string[];
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
};

const revealLine = (editor: Editor, lineIdx: number) => {
	editor.scrollIntoView(
		{
			from: { line: lineIdx, ch: 0 },
			to: { line: lineIdx, ch: 0 },
		},
		true
	);
};

export default class WeeklyNotePlugin extends Plugin {
	settings: WeeklyNoteSettings;

	private openNote(path: string) {
		openNote(this.app, path, false);
	}

	private getActiveNote(): WeeklyNote | null {
		const file = this.app.workspace.getActiveFile();
		if (!file) {
			new Notice("No active note!");
			return null;
		}
		const note = fromPath(file.path);
		if (!note) {
			new Notice(
				"Note path is invalid! Note must be MMdd-MMdd format under year-named folder.",
				0
			);
			return null;
		}
		return note;
	}

	async onload() {
		await this.loadSettings();

		this.app.workspace.on("file-open", async (file: TFile | null) => {
			if (!file) return;
			const md = this.app.workspace.activeEditor;
			if (!md || !md.editor) return;
			const editor = md.editor;
			const now = new Date();
			const today = toDateString(now);
			const found = editor
				.getValue()
				.split("\n")
				.map((line, i) => {
					if (line.indexOf(today) != -1) return i;
					return -1;
				})
				.filter((i) => -1 < i);
			if (0 < found.length) {
				const n = found[0];
				editor.setSelection({ line: n, ch: 0 });
			}
		});

		this.addCommand({
			id: "weeklynote-scroll-to-cursor",
			icon: "move-down",
			name: COMMAND_ScrollToCursor,
			editorCallback: (editor: Editor, _: MarkdownView) => {
				const selTop = editor.getCursor("from").line;
				revealLine(editor, selTop);
			},
		});

		this.addCommand({
			id: "weeklynote-jump-down-to-next-plain-line",
			icon: "chevrons-down",
			name: COMMAND_JumpDownToNextPlainLine,
			editorCallback: (editor: Editor, _: MarkdownView) => {
				const ed = new NoteEditor(editor);
				const nextPlain = ed.nextNonListLineIndex();
				const to = nextPlain || ed.maxLineIndex;
				editor.setCursor(to);
				revealLine(editor, to);
			},
		});

		this.addCommand({
			id: "weeklynote-jump-up-to-last-plain-line",
			icon: "chevrons-up",
			name: COMMAND_JumpUpToLastPlainLine,
			editorCallback: (editor: Editor, _: MarkdownView) => {
				const ed = new NoteEditor(editor);
				const lastPlain = ed.lastNonListLineIndex();
				const to = lastPlain || 0;
				editor.setCursor(to);
				revealLine(editor, to);
			},
		});

		this.addCommand({
			id: "weeklynote-make-notes",
			icon: "calendar-plus",
			name: COMMAND_MakeNotes,
			callback: () => {
				new WeeklyNoteModal(
					this.app,
					this.settings.template,
					this.settings.holidays
				).open();
			},
		});

		this.addCommand({
			id: "weeklynote-jump-to-note",
			icon: "book-open",
			name: COMMAND_JumpToNote,
			callback: () => {
				new JumpModal(this.app).open();
			},
		});

		this.addRibbonIcon("book-open", COMMAND_JumpToNote, () => {
			new JumpModal(this.app).open();
		});

		this.addCommand({
			id: "weeklynote-open-note",
			icon: "calendar-fold",
			name: COMMAND_OpenNote,
			callback: () => {
				const note = fromWeek();
				this.openNote(note.path);
			},
		});

		this.addRibbonIcon("calendar-fold", COMMAND_OpenNote, () => {
			const note = fromWeek();
			this.openNote(note.path);
		});

		this.addCommand({
			id: "weeklynote-open-prev-note",
			icon: "square-arrow-left",
			name: COMMAND_OpenPrevNote,
			callback: () => {
				const note = this.getActiveNote();
				if (note) {
					const prev = note.decrement();
					this.openNote(prev.path);
				}
			},
		});

		this.addRibbonIcon("square-arrow-left", COMMAND_OpenPrevNote, () => {
			const note = this.getActiveNote();
			if (note) {
				const prev = note.decrement();
				this.openNote(prev.path);
			}
		});

		this.addCommand({
			id: "weeklynote-open-next-note",
			icon: "square-arrow-right",
			name: COMMAND_OpenNextNote,
			callback: () => {
				const note = this.getActiveNote();
				if (note) {
					const next = note.increment();
					this.openNote(next.path);
				}
			},
		});

		this.addRibbonIcon("square-arrow-right", COMMAND_OpenNextNote, () => {
			const note = this.getActiveNote();
			if (note) {
				const next = note.increment();
				this.openNote(next.path);
			}
		});

		this.addCommand({
			id: "weeklynote-send-to-next-note",
			icon: "forward",
			name: COMMAND_SendToNextNote,
			editorCallback: (editor: Editor, view: MarkdownView): void => {
				const file = view.file;
				if (!file) return;
				const note = fromPath(file.path);
				if (!note) return;

				const ed = new NoteEditor(editor);
				const curLines = ed.cursorLines();

				const appended = [];
				if (0 < asMdList(curLines[0].trim()).symbol.length) {
					const lastPlain = ed.lastNonListLineIndex();
					if (lastPlain) {
						appended.push(editor.getLine(lastPlain));
					}
					const breadcrumbs = ed.breadcrumbs();
					if (0 < breadcrumbs.length) {
						appended.push(...breadcrumbs);
					}
				}
				appended.push(...curLines);
				appended.unshift("\n");
				const nextPath = note.increment().path;
				appendToFile(this.app, nextPath, appended.join("\n"));

				ed.strikeThroughCursorLines();
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
				"Template for weekly note. `{{Mon}}` and `{{Tue}}` will be converted to dates like `Jan. 01` and `Jan. 02`. `{{prev}}` and `{{next}}` will be replaced with link to previous / next note."
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
	}
}
