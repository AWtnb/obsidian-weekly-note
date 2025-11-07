import { App, Modal, Notice } from "obsidian";
import { notifyWeekDelta, toDateString, WeeklyNote } from "./Weeklynote";

const splitAt = (s: string, i: number): [number, number] => {
	const a = Number(s.substring(0, i));
	const b = Number(s.substring(i));
	return [a, b];
};

interface YMD {
	y: number;
	m: number;
	d: number;
}

const asYMD = (y: number, m: number, d: number): YMD => {
	return { y: y, m: m, d: d };
};

const asYMDs = (s: string): YMD[] => {
	const now = new Date();
	const year = now.getFullYear();
	const month = now.getMonth() + 1;
	const date = now.getDate();
	const num = Number(s);
	if (s.length < 1 || isNaN(num) || num < 1) {
		return [asYMD(0, 0, 0)];
	}

	if (s.length == 1) {
		return [asYMD(year, month, num), asYMD(year, num, 1)];
	}
	if (s.length == 2) {
		const a = [asYMD(year, month, num), asYMD(year, num, 1)];
		const [m, d] = splitAt(s, 1);
		if (m < month || (m == month && d <= date)) {
			a.push(asYMD(year + 1, m, d));
		}
		a.push(asYMD(year, m, d));
		return a;
	}
	if (s.length == 3) {
		const a = [];
		// mmd
		const [mm, d] = splitAt(s, 2);
		if (mm < month || (mm == month && d <= date)) {
			a.push(asYMD(year + 1, mm, d));
		}
		a.push(asYMD(year, mm, d));
		// mdd
		const [m, dd] = splitAt(s, 1);
		if (m < month || (m == month && d <= date)) {
			a.push(asYMD(year + 1, m, dd));
		}
		a.push(asYMD(year, m, dd));
		// yym(1)
		a.push(asYMD(2000 + mm, d, 1));
		return a;
	}
	if (s.length == 4) {
		const a = [];
		// mmdd
		const [mm, dd] = splitAt(s, 2);
		if (mm < month || (mm == month && dd <= date)) {
			a.push(asYMD(year + 1, mm, dd));
		}
		a.push(asYMD(year, mm, dd));
		// yymm(1)
		a.push(asYMD(2000 + mm, dd, 1));
		// yymd
		const [m, d] = splitAt(String(dd), 1);
		a.push(asYMD(2000 + mm, m, d));
		return a;
	}
	if (s.length == 5) {
		const a = [];
		const yyyy = 2000 + Number(s.substring(0, 2));
		// yymmd
		const [mm, d] = splitAt(s.substring(2), 2);
		a.push(asYMD(yyyy, mm, d));
		// yymdd
		const [m, dd] = splitAt(s.substring(2), 1);
		a.push(asYMD(yyyy, m, dd));
		// yyyym(1)
		a.push(asYMD(...splitAt(s, 4), 1));
		return a;
	}
	if (s.length == 6) {
		const a = [];
		// yymmdd
		const yyyy = 2000 + Number(s.substring(0, 2));
		const [mm, dd] = splitAt(s.substring(2), 2);
		a.push(asYMD(yyyy, mm, dd));
		// yyyymd
		a.push(asYMD(...splitAt(s.substring(0, 5), 4), Number(s.substring(5))));
		// yyyymm(1)
		a.push(asYMD(...splitAt(s.substring(0, 6), 4), 1));
		return a;
	}
	if (s.length == 7) {
		const a = [];
		const yyyy = Number(s.substring(0, 4));
		// yyyymmd
		const [mm, d] = splitAt(s.substring(4), 2);
		a.push(asYMD(yyyy, mm, d));
		// yyyymdd
		const [m, dd] = splitAt(s.substring(4), 1);
		a.push(asYMD(yyyy, m, dd));
		return a;
	}
	const yyyy = Number(s.substring(0, 4));
	const [mm, dd] = splitAt(s.substring(4, 8), 2);
	return [asYMD(yyyy, mm, dd)];
};

const getNotePath = (parent: string, d: Date): string => {
	const monday = new Date(d);
	const offset = (d.getDay() + 6) % 7;
	monday.setDate(d.getDate() - offset);
	const note = new WeeklyNote(monday);
	note.setParent(parent);
	return note.path;
};

export const searchAndFocusLine = (app: App, search: string) => {
	const md = app.workspace.activeEditor;
	if (!md || !md.editor) return;
	const editor = md.editor;
	const found = editor
		.getValue()
		.split("\n")
		.map((line, i) => {
			if (line.indexOf(search) != -1) return i;
			return -1;
		})
		.filter((i) => -1 < i);
	if (0 < found.length) {
		const n = found[0];
		editor.setCursor(n);
	}
};

export const focusDailyLine = (app: App, date: Date | null = null) => {
	const s = toDateString(date || new Date());
	searchAndFocusLine(app, s);
};

interface FileOpenedCallback {
	(): void;
}

export type OpenMode = "currentTab" | "nextTab" | "split";

export const openNote = (
	app: App,
	path: string,
	mode: OpenMode,
	onOpen: FileOpenedCallback | null = null
): boolean => {
	const position = mode == "split" ? mode : mode != "currentTab";
	if (app.vault.getFileByPath(path)) {
		app.workspace.openLinkText("", path, position).then(() => {
			if (onOpen) {
				onOpen();
			}
		});
		return true;
	}
	const s = `ERROR: "${path}" not found!`;
	new Notice(s, 0);
	return false;
};

export class DateInputModal extends Modal {
	private readonly openMode: OpenMode;
	constructor(app: App, split: boolean) {
		super(app);
		if (!this.app.workspace.getActiveFile()) {
			this.openMode = "currentTab";
		} else {
			if (split) {
				this.openMode = "split";
			} else {
				this.openMode = "nextTab";
			}
		}
	}

	private getActiveNoteParent(): string {
		const f = this.app.workspace.getActiveFile();
		if (!f) return "";
		return f.path.split("/").slice(0, -2).join("/");
	}

	private jumpTo(path: string, date: string): void {
		const result = openNote(this.app, path, this.openMode, () => {
			const d = new Date(date);
			focusDailyLine(this.app, d);
		});
		if (result) {
			notifyWeekDelta(path);
		}
		this.close();
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.id = "jump-modal";
		if (this.openMode == "split") {
			contentEl.createDiv().setText("Open to right:");
		} else {
			contentEl.createDiv().setText("Open:");
		}
		const input = contentEl.createEl("input", { type: "tel" });
		input.focus();

		const box = contentEl.createDiv();
		box.addClass("button-box");

		const clearBox = () => {
			while (box.firstChild) {
				box.removeChild(box.firstChild);
			}
		};

		interface Button {
			label: string;
			href: string;
		}

		const createButtonElem = (button: Button) => {
			const b = box.createEl("button");
			b.setText(button.label);
			b.onclick = () => {
				this.jumpTo(button.href, button.label);
			};
			b.onkeydown = (ev) => {
				if (ev.key != "Enter") return;
				ev.preventDefault();
				this.jumpTo(button.href, button.label);
			};
		};

		const parentPath = this.getActiveNoteParent();
		input.oninput = () => {
			clearBox();
			asYMDs(input.value)
				.map((ymd): Button | null => {
					const label = `${ymd.y}-${ymd.m}-${ymd.d}`;
					if (Number.isNaN(Date.parse(label))) {
						return null;
					}
					const d = new Date(ymd.y, ymd.m - 1, ymd.d);
					return {
						label: label,
						href: getNotePath(parentPath, d),
					};
				})
				.forEach((b) => {
					if (b) {
						createButtonElem(b);
					}
				});
		};
		input.onkeydown = (ev) => {
			if (ev.key != "Enter") {
				return;
			}
			ev.preventDefault();
			const buttons =
				this.contentEl.querySelectorAll(".button-box button");
			if (0 < buttons.length) {
				(buttons[0] as HTMLElement).focus();
			}
		};
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}
