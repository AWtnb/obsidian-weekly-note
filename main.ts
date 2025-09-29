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
} from "helper/Weeklynote";
import {
	NoteEditor,
	isMdList,
	nonListLine,
	unFinishedListRoot,
} from "helper/NoteEditor";
import { focusDailyLine, JumpModal, openNote } from "helper/NoteJumper";
import { findMergedLine } from "helper/ListMerger";

const COMMAND_MakeNotes = "1年分のノートを作る";
const COMMAND_OpenNote = "今週のノートを開く";
const COMMAND_OpenPrevNote = "前のノートを開く";
const COMMAND_OpenPrevNoteToRight = "前のノートを右に開く";
const COMMAND_OpenNextNote = "次のノートを開く";
const COMMAND_OpenNextNoteToRight = "次のノートを右に開く";
const COMMAND_SendToNextNote = "次のノートに送る";
const COMMAND_OpenNoteByDate = "日付指定でノートを開く";
const COMMAND_OpenNoteByDateToRight = "日付指定でノートを右に開く";
const COMMAND_ScrollToCursor = "カーソルまでスクロール";
const COMMAND_JumpToNextUnFinishedListRoot = "次の未完了リスト項目までジャンプ";
const COMMAND_JumpToLastUnFinishedListRoot = "前の未完了リスト項目までジャンプ";
const COMMAND_JumpToNextNonListLine = "次の非リスト行までジャンプ";
const COMMAND_JumpToLastNonListLine = "前の非リスト行までジャンプ";

interface Task {
	heading: string;
	breadcrumb: string[];
	content: string;
}

class SentTask implements Task {
	heading: string = "";
	breadcrumb: string[] = [];
	content: string = "";
}

const appendToFile = async (
	app: App,
	path: string,
	task: SentTask
): Promise<void> => {
	const file = app.vault.getFileByPath(path);
	if (!(file instanceof TFile)) {
		new Notice(`ERROR: Failed to append to "${path}" (file not found)`, 0);
		return;
	}
	const lines = (await app.vault.read(file)).split("\n");
	const found = lines.lastIndexOf(task.heading);
	if (found != -1) {
		let i = found + 1;
		while (i < lines.length && 0 < lines[i].trim().length) {
			i++;
		}

		const baseListLines = lines.slice(0, i);
		const restLines = lines.slice(i);
		const merged = findMergedLine(baseListLines, task.breadcrumb);
		if (!merged) {
			return;
		}
		const newLines = [
			baseListLines.slice(0, merged.offset),
			merged.text,
			baseListLines.slice(merged.offset),
			restLines,
		].flat();
		await app.vault.modify(file, newLines.join("\n"));
	} else {
		const newLines = [task.heading, task.breadcrumb, task.content]
			.flat()
			.filter((line) => 0 < line.trim().length);
		await app.vault.append(file, "\n\n" + newLines.join("\n"));
	}
	new Notice(`Appended to: ${path}`);
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

const revealLine = (
	editor: Editor,
	lineIdx: number,
	center: boolean = false
) => {
	editor.scrollIntoView(
		{
			from: { line: lineIdx, ch: 0 },
			to: { line: lineIdx, ch: 0 },
		},
		center
	);
};

export default class WeeklyNotePlugin extends Plugin {
	settings: WeeklyNoteSettings;

	private openNote(path: string) {
		openNote(this.app, path, "nextTab");
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
			if (!file) {
				return;
			}
			if (this.app.workspace.getLeavesOfType("markdown").length !== 1) {
				return;
			}
			focusDailyLine(this.app);
		});

		this.addCommand({
			id: "weeklynote-scroll-to-cursor",
			icon: "move-down",
			name: COMMAND_ScrollToCursor,
			editorCallback: (editor: Editor, _: MarkdownView) => {
				const selTop = editor.getCursor("from").line;
				revealLine(editor, selTop, true);
			},
		});

		this.addCommand({
			id: "weeklynote-jump-to-next-unfinished-list-root",
			icon: "circle-chevron-down",
			name: COMMAND_JumpToNextUnFinishedListRoot,
			editorCallback: (editor: Editor, _: MarkdownView) => {
				const ed = new NoteEditor(editor);
				const nextListRoot = ed.getNextLineIndex(unFinishedListRoot);
				const to = nextListRoot || ed.maxLineIndex;
				editor.setCursor(to);
				revealLine(editor, to);
			},
		});

		this.addCommand({
			id: "weeklynote-jump-to-last-unfinished-list-root",
			icon: "circle-chevron-up",
			name: COMMAND_JumpToLastUnFinishedListRoot,
			editorCallback: (editor: Editor, _: MarkdownView) => {
				const ed = new NoteEditor(editor);
				const lastListRoot = ed.getLastLineIndex(unFinishedListRoot);
				const to = lastListRoot || 0;
				editor.setCursor(to);
				revealLine(editor, to);
			},
		});

		this.addCommand({
			id: "weeklynote-jump-to-next-non-list-line",
			icon: "chevrons-down",
			name: COMMAND_JumpToNextNonListLine,
			editorCallback: (editor: Editor, _: MarkdownView) => {
				const ed = new NoteEditor(editor);
				const nextPlain = ed.getNextLineIndex(nonListLine);
				const to = nextPlain || ed.maxLineIndex;
				editor.setCursor(to);
				revealLine(editor, to);
			},
		});

		this.addCommand({
			id: "weeklynote-jump-to-last-non-list-line",
			icon: "chevrons-up",
			name: COMMAND_JumpToLastNonListLine,
			editorCallback: (editor: Editor, _: MarkdownView) => {
				const ed = new NoteEditor(editor);
				const lastPlain = ed.getLastLineIndex(nonListLine);
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
			id: "weeklynote-open-note-by-date",
			icon: "book-open",
			name: COMMAND_OpenNoteByDate,
			callback: () => {
				new JumpModal(this.app, false).open();
			},
		});

		this.addRibbonIcon("book-open", COMMAND_OpenNoteByDate, () => {
			new JumpModal(this.app, false).open();
		});

		this.addCommand({
			id: "weeklynote-open-note-by-date-to-right",
			icon: "book-open",
			name: COMMAND_OpenNoteByDateToRight,
			callback: () => {
				new JumpModal(this.app, true).open();
			},
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
				const curLines = ed
					.cursorLines()
					.filter((line) => 0 < line.trim().length);
				if (curLines.length < 1) {
					return;
				}

				const sent = new SentTask();
				const breadcrumb = ed.breadcrumb();
				if (0 < breadcrumb.length) {
					sent.content = curLines.join("\n");
					if (isMdList(breadcrumb[0])) {
						sent.breadcrumb = breadcrumb;
						const lastPlain = ed.getLastLineIndex(nonListLine);
						if (lastPlain) {
							sent.heading = editor.getLine(lastPlain);
						}
					} else {
						sent.breadcrumb = breadcrumb.slice(1);
						sent.heading = breadcrumb[0];
					}
				} else {
					const topLine = curLines[0];
					if (isMdList(topLine)) {
						const lastPlain = ed.getLastLineIndex(nonListLine);
						if (lastPlain) {
							sent.heading = editor.getLine(lastPlain);
						}
						sent.content = curLines.join("\n");
					} else {
						sent.heading = topLine;
						sent.content = curLines.slice(1).join("\n");
					}
				}

				const nextPath = note.increment().path;
				appendToFile(this.app, nextPath, sent);

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
