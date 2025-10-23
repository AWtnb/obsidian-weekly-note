import {
	App,
	Editor,
	MarkdownView,
	Notice,
	Plugin,
	PluginSettingTab,
	Setting,
	TFile,
	WorkspaceLeaf,
} from "obsidian";

import {
	WeeklyNote,
	WeeklyNoteModal,
	fromWeek,
	fromPath,
	DEFAULT_TEMPLATE,
} from "helper/Weeklynote";
import { NoteEditor, nonListLine, unFinishedListLine } from "helper/NoteEditor";
import { focusDailyLine, DateInputModal, openNote } from "helper/NoteSwitcher";
import { sendTask } from "helper/ListMerger";
import { FutureNoteModal } from "helper/FutureNotes";

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
const COMMAND_JumpToNextUnFinishedListLine = "次の未完了リスト行までジャンプ";
const COMMAND_JumpToLastUnFinishedListLine = "前の未完了リスト行までジャンプ";
const COMMAND_JumpToNextNonListLine = "次の非リスト行までジャンプ";
const COMMAND_JumpToLastNonListLine = "前の非リスト行までジャンプ";
const COMMAND_SearchFutureNote = "未来のノートから検索";

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

	private openNote(path: string, split: boolean = false) {
		const note = this.getActiveNote();
		if (note && note.path == path) {
			focusDailyLine(this.app);
			return;
		}
		if (split) {
			openNote(this.app, path, "split");
		} else {
			openNote(this.app, path, "nextTab");
		}
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
				"Note path is invalid format!",
				0
			);
			return null;
		}
		return note;
	}

	async onload() {
		await this.loadSettings();

		const statusbar = this.addStatusBarItem();
		const weekCounter = statusbar.createSpan();
		weekCounter.id = "weeklynote-statusbar-week-counter";

		this.app.workspace.on(
			"active-leaf-change",
			(leaf: WorkspaceLeaf | null) => {
				if (leaf && leaf.view instanceof MarkdownView) {
					const file = leaf.view.file;
					if (file) {
						const note = fromPath(file.path);
						if (note) {
							weekCounter.setText(`Week ${note.weekIndex}`);
							return;
						}
					}
				}
				weekCounter.setText("");
			}
		);

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
			id: "weeklynote-jump-to-next-unfinished-list-line",
			icon: "circle-chevron-down",
			name: COMMAND_JumpToNextUnFinishedListLine,
			editorCallback: (editor: Editor, _: MarkdownView) => {
				const ed = new NoteEditor(editor);
				const nextListRoot = ed.getNextLineIndex(unFinishedListLine);
				const to = nextListRoot || ed.maxLineIndex;
				editor.setCursor(to);
				revealLine(editor, to);
			},
		});

		this.addCommand({
			id: "weeklynote-jump-to-last-unfinished-list-line",
			icon: "circle-chevron-up",
			name: COMMAND_JumpToLastUnFinishedListLine,
			editorCallback: (editor: Editor, _: MarkdownView) => {
				const ed = new NoteEditor(editor);
				const lastListRoot = ed.getLastLineIndex(unFinishedListLine);
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
				new DateInputModal(this.app, false).open();
			},
		});

		this.addRibbonIcon("book-open", COMMAND_OpenNoteByDate, () => {
			new DateInputModal(this.app, false).open();
		});

		this.addCommand({
			id: "weeklynote-open-note-by-date-to-right",
			icon: "book-open",
			name: COMMAND_OpenNoteByDateToRight,
			callback: () => {
				new DateInputModal(this.app, true).open();
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
			id: "weeklynote-search-future-note",
			icon: "file-search",
			name: COMMAND_SearchFutureNote,
			callback: () => {
				new FutureNoteModal(this.app).open();
			},
		});

		this.addRibbonIcon("file-search", COMMAND_SearchFutureNote, () => {
			new FutureNoteModal(this.app).open();
		});

		this.addCommand({
			id: "weeklynote-open-prev-note",
			icon: "square-arrow-left",
			name: COMMAND_OpenPrevNote,
			callback: () => {
				const note = this.getActiveNote();
				if (note) {
					const prev = note.increment(-1);
					this.openNote(prev.path);
				}
			},
		});

		this.addCommand({
			id: "weeklynote-open-prev-note-to-right",
			icon: "square-arrow-left",
			name: COMMAND_OpenPrevNoteToRight,
			callback: () => {
				const note = this.getActiveNote();
				if (note) {
					const prev = note.increment(-1);
					this.openNote(prev.path, true);
				}
			},
		});

		this.addRibbonIcon("square-arrow-left", COMMAND_OpenPrevNote, () => {
			const note = this.getActiveNote();
			if (note) {
				const prev = note.increment(-1);
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

		this.addCommand({
			id: "weeklynote-open-next-note-to-right",
			icon: "square-arrow-right",
			name: COMMAND_OpenNextNoteToRight,
			callback: () => {
				const note = this.getActiveNote();
				if (note) {
					const next = note.increment();
					this.openNote(next.path, true);
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
				sendTask(this.app, editor, view);
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
