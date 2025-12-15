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
import {
	focusDailyLine,
	DateInputModal,
	openNote,
	OpenMode,
} from "helper/NoteSwitcher";
import { sendTask } from "helper/ListMerger";
import { FutureNoteModal } from "helper/FutureNotes";
import { backupNotice, backupFile, countFiles } from "helper/Backup";

import * as path from "path";
import * as fs from "fs";

const COMMAND_MakeNotes = "1年分のノートを作る";
const COMMAND_OpenNote = "今週のノートを開く";
const COMMAND_OpenPrevNote = "前のノートを開く";
const COMMAND_OpenPrevNoteToLeft = "前のノートを左に開く";
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
const COMMAND_BackupVault = "全ノートをバックアップ";

interface WeeklyNoteSettings {
	template: string;
	holidays: string[];
	backupDir: string;
	autoBackupEnabled: boolean;
	backupDebounceSeconds: number;
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
	backupDir: "",
	autoBackupEnabled: true,
	backupDebounceSeconds: 10,
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
	private filesToBackup: Set<TFile> = new Set();
	private backupDebounceTimer: NodeJS.Timeout | null = null;

	private get backupDirPath(): string {
		return this.settings.backupDir.replace(
			/\${([a-zA-Z]+)}/g,
			(match, varName) => {
				return process.env[varName] || match;
			}
		);
	}

	private openNote(path: string, mode: OpenMode = "currentTab") {
		openNote(this.app, path, mode, () => {
			focusDailyLine(this.app);
		});
	}

	private getActiveNote(): WeeklyNote | null {
		const file = this.app.workspace.getActiveFile();
		if (!file) {
			new Notice("No active note!");
			return null;
		}
		const note = fromPath(file.path);
		if (!note) {
			new Notice("Note path is invalid format!", 0);
			return null;
		}
		return note;
	}

	private getFullpath(file: TFile): string {
		return path.join(this.app.vault.getRoot().path, file.path);
	}

	private get backupRunnable(): boolean {
		return this.settings.autoBackupEnabled && this.backupDirPath !== "";
	}

	private scheduleBackup(file: TFile): void {
		if (!this.backupRunnable) {
			return;
		}

		this.filesToBackup.add(file);

		if (this.backupDebounceTimer) {
			clearTimeout(this.backupDebounceTimer);
		}

		const debounceTime = this.settings.backupDebounceSeconds * 1000;
		this.backupDebounceTimer = setTimeout(() => {
			this.runBackup();
			this.backupDebounceTimer = null;
		}, debounceTime);
	}

	private async runBackup(): Promise<void> {
		if (!this.backupRunnable) {
			return;
		}
		const files = Array.from(this.filesToBackup);
		this.filesToBackup.clear();
		for (const file of files) {
			try {
				await backupFile(this.app, file, this.backupDirPath);
				backupNotice(`Backuped '${file.path}'`, false);
			} catch (error) {
				backupNotice(`Failed to backup '${file.path}': ${error}`, true);
				if (fs.existsSync(this.getFullpath(file))) {
					this.filesToBackup.add(file);
					console.log(
						`${new Date()} Retry '${file.path}' backup next time.`
					);
				}
			}
		}
	}

	private async runVaultBackup(): Promise<void> {
		if (!this.backupRunnable) {
			return;
		}
		try {
			const files = this.app.vault.getFiles();
			let count = 0;
			for (const file of files) {
				if (!file.path.endsWith(".md")) {
					continue;
				}
				await backupFile(this.app, file, this.backupDirPath);
				count++;
			}
			backupNotice(
				`Backuped ${count} files to '${this.backupDirPath}'`,
				false
			);
		} catch (error) {
			backupNotice(`Backup error: ${error}`, true);
		}
	}

	async onload() {
		await this.loadSettings();

		const statusbar = this.addStatusBarItem();
		const weekCounter = statusbar.createSpan();
		weekCounter.id = "weeklynote-statusbar-week-counter";

		this.registerEvent(
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
			)
		);

		this.registerEvent(
			this.app.workspace.on("file-open", async (file: TFile | null) => {
				if (!file) {
					return;
				}
				if (
					this.app.workspace.getLeavesOfType("markdown").length !== 1
				) {
					return;
				}
				focusDailyLine(this.app);
			})
		);

		this.app.workspace.onLayoutReady(() => {
			if (
				this.backupRunnable &&
				countFiles(this.backupDirPath) <
					this.app.vault.getFiles().length
			) {
				this.runVaultBackup();
			}

			this.registerEvent(
				this.app.vault.on("modify", (file: TFile) => {
					this.scheduleBackup(file);
				})
			);

			this.registerEvent(
				this.app.vault.on("create", (file: TFile) => {
					this.scheduleBackup(file);
				})
			);
		});

		this.addCommand({
			id: "weeklynote-backup-vault",
			icon: "save",
			name: COMMAND_BackupVault,
			callback: async () => {
				await this.runVaultBackup();
			},
		});

		this.addCommand({
			id: "weeklynote-scroll-to-cursor",
			icon: "move-vertical",
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
				const cursorTop = editor.getCursor("from");
				const line = editor.getLine(cursorTop.line);
				const ed = new NoteEditor(editor);
				let to = ed.maxLineIndex;
				if (nonListLine(line) && cursorTop.ch != line.length) {
					to = cursorTop.line;
				} else {
					const nextPlain = ed.getNextLineIndex(nonListLine);
					if (nextPlain) {
						to = nextPlain;
					}
				}
				editor.setCursor(to, editor.getLine(to).length);
			},
		});

		this.addCommand({
			id: "weeklynote-jump-to-last-non-list-line",
			icon: "chevrons-up",
			name: COMMAND_JumpToLastNonListLine,
			editorCallback: (editor: Editor, _: MarkdownView) => {
				const cursorBottom = editor.getCursor("to");
				const line = editor.getLine(cursorBottom.line);
				const ed = new NoteEditor(editor);
				let to = 0;
				if (nonListLine(line) && cursorBottom.ch != 0) {
					to = cursorBottom.line;
				} else {
					const lastPlain = ed.getLastLineIndex(nonListLine);
					if (lastPlain) {
						to = lastPlain;
					}
				}
				editor.setCursor(to, 0);
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
			icon: "calendar-search",
			name: COMMAND_OpenNoteByDate,
			callback: () => {
				new DateInputModal(this.app, false).open();
			},
		});

		this.addRibbonIcon("calendar-search", COMMAND_OpenNoteByDate, () => {
			new DateInputModal(this.app, false).open();
		});

		this.addCommand({
			id: "weeklynote-open-note-by-date-to-right",
			icon: "calendar-search",
			name: COMMAND_OpenNoteByDateToRight,
			callback: () => {
				new DateInputModal(this.app, true).open();
			},
		});

		this.addCommand({
			id: "weeklynote-open-note",
			icon: "refresh-ccw",
			name: COMMAND_OpenNote,
			callback: () => {
				const note = fromWeek();
				this.openNote(note.path);
			},
		});

		this.addRibbonIcon("refresh-ccw", COMMAND_OpenNote, () => {
			const note = fromWeek();
			this.openNote(note.path);
		});

		this.addCommand({
			id: "weeklynote-search-future-note",
			icon: "milestone",
			name: COMMAND_SearchFutureNote,
			callback: () => {
				new FutureNoteModal(this.app).open();
			},
		});

		this.addRibbonIcon("milestone", COMMAND_SearchFutureNote, () => {
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
			id: "weeklynote-open-prev-note-to-left",
			icon: "square-arrow-left",
			name: COMMAND_OpenPrevNoteToLeft,
			callback: () => {
				const note = this.getActiveNote();
				if (note) {
					const prev = note.increment(-1);
					this.openNote(prev.path, "split-left");
				}
			},
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
					this.openNote(next.path, "split-right");
				}
			},
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

	onunload() {
		if (this.backupDebounceTimer) {
			clearTimeout(this.backupDebounceTimer);
		}
		if (0 < this.filesToBackup.size) {
			this.runBackup();
		}
	}

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

		new Setting(containerEl)
			.setName("Backup directory")
			.setDesc(
				"Directory path to backup all notes. (e.g. `${USERPROFILE}/obsidian_weeklynote_backup`)"
			)
			.addText((text) =>
				text
					.setValue(this.plugin.settings.backupDir)
					.setPlaceholder("/path/to/backup/directory")
					.onChange(async (value) => {
						this.plugin.settings.backupDir = value;
						await this.plugin.saveSettings();
					})
			)
			.setClass("weeklynote-setting-box");

		new Setting(containerEl)
			.setName("Auto backup")
			.setDesc(
				"Enable auto backup on edit (modify / delete / create) file."
			)
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.autoBackupEnabled)
					.onChange(async (value) => {
						this.plugin.settings.autoBackupEnabled = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Backup debounce seconds")
			.setDesc("Seconds after the last edit to perform a backup.")
			.addText((text) =>
				text
					.setValue(
						String(this.plugin.settings.backupDebounceSeconds)
					)
					.setPlaceholder("1")
					.onChange(async (value) => {
						const n = Number(value);
						if (isNaN(n) || n < 1) {
							return;
						}
						this.plugin.settings.backupDebounceSeconds = n;
						await this.plugin.saveSettings();
					})
			);
	}
}
