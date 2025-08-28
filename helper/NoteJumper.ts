import { App, Modal, Notice, PaneType } from "obsidian";
import { toDateString, WeeklyNote } from "./Weeklynote";

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

const asYMDs = (s: string): YMD[] => {
	const now = new Date();
	const year = now.getFullYear();
	const month = now.getMonth() + 1;
	const num = Number(s);
	if (s.length < 1 || Number.isNaN(s) || num < 1) {
		return [{ y: 0, m: 0, d: 0 }];
	}

	if (s.length == 1) {
		return [{ y: year, m: month, d: num }];
	}
	if (s.length == 2) {
		const a = [{ y: year, m: month, d: num }];
		const [m, d] = splitAt(s, 1);
		a.push({ y: year, m: m, d: d });
		return a;
	}
	if (s.length == 3) {
		const a = [];
		// mmd
		const [mm, d] = splitAt(s, 2);
		a.push({ y: year, m: mm, d: d });
		// mdd
		const [m, dd] = splitAt(s, 1);
		a.push({ y: year, m: m, d: dd });
		return a;
	}
	if (s.length == 4) {
		const [mm, dd] = splitAt(s, 2);
		return [{ y: year, m: mm, d: dd }];
	}
	if (s.length == 5) {
		const a = [];
		const yyyy = 2000 + Number(s.substring(0, 2));
		// yymmd
		const [mm, d] = splitAt(s.substring(2), 2);
		a.push({ y: yyyy, m: mm, d: d });
		// yymdd
		const [m, dd] = splitAt(s.substring(2), 1);
		a.push({ y: yyyy, m: m, d: dd });
		return a;
	}
	if (s.length == 6) {
		const yyyy = 2000 + Number(s.substring(0, 2));
		const [mm, dd] = splitAt(s.substring(2), 2);
		return [{ y: yyyy, m: mm, d: dd }];
	}
	if (s.length == 7) {
		const a = [];
		const yyyy = Number(s.substring(0, 4));
		// yyyymmd
		const [mm, d] = splitAt(s.substring(4), 2);
		a.push({ y: yyyy, m: mm, d: d });
		// yyyymdd
		const [m, dd] = splitAt(s.substring(4), 1);
		a.push({ y: yyyy, m: m, d: dd });
		return a;
	}
	if (s.length == 8) {
		const yyyy = Number(s.substring(0, 4));
		const [mm, dd] = splitAt(s.substring(4), 2);
		return [{ y: yyyy, m: mm, d: dd }];
	}
	return [{ y: 0, m: 0, d: 0 }];
};

const getNotePath = (d: Date): string => {
	const monday = new Date(d);
	const offset = (d.getDay() + 6) % 7;
	monday.setDate(d.getDate() - offset);
	const note = new WeeklyNote(monday);
	return note.path;
};

export const focusDailyLine = (app: App, date: Date | null = null) => {
	const md = app.workspace.activeEditor;
	if (!md || !md.editor) return;
	const editor = md.editor;
	const today = toDateString(date || new Date());
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
		editor.setCursor(n);
	}
};

interface FileOpenedCallback {
	(): void;
}

export const openNote = (
	app: App,
	path: string,
	position: boolean | PaneType = true,
	onOpen: FileOpenedCallback | null = null
): boolean => {
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

export class JumpModal extends Modal {
	constructor(app: App) {
		super(app);
	}

	private jumpTo(
		path: string,
		date: string,
		contextEvent: PointerEvent | KeyboardEvent
	): void {
		const pos = (() => {
			if (!this.app.workspace.getActiveFile()) return false;
			return contextEvent.ctrlKey ? "split" : true;
		})();
		const result = openNote(this.app, path, pos, () => {
			const d = new Date(date);
			focusDailyLine(this.app, d);
		});
		if (result) {
			new Notice(`Opened note containing ${date}`, 4000);
		}
		this.close();
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.id = "jump-modal";
		contentEl.createDiv().setText("Jump to:");
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
			b.onclick = (ev) => {
				this.jumpTo(button.href, button.label, ev);
			};
			b.onkeydown = (ev) => {
				if (ev.key != "Enter") return;
				ev.preventDefault();
				this.jumpTo(button.href, button.label, ev);
			};
		};

		input.oninput = () => {
			clearBox();
			asYMDs(input.value)
				.map((ymd): Button | null => {
					const label = `${ymd.y}-${ymd.m}-${ymd.d}`;
					if (Number.isNaN(Date.parse(label))) {
						return null;
					}
					const d = new Date(label);
					return {
						label: label,
						href: getNotePath(d),
					};
				})
				.forEach((b) => {
					if (b) {
						createButtonElem(b);
					}
				});
		};
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}
