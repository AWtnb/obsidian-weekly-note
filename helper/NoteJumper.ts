import { App, Modal, Notice, PaneType } from "obsidian";
import { toDateString, WeeklyNote } from "./Weeklynote";

const parseAsDateStr = (s: string): string => {
	const now = new Date();
	const year = now.getFullYear();
	const month = now.getMonth() + 1;
	if (0 < s.length && s.length <= 2) {
		const d = Number(s);
		if (0 < d && d <= 31) {
			return `${year}-${month}-${s}`;
		}
	}
	if (2 < s.length && s.length <= 4) {
		const m = Number(s.substring(0, 2));
		if (0 < m && m <= 12) {
			const d = Number(s.substring(2));
			if (0 < d && d <= 31) {
				return `${year}-${s.substring(0, 2)}-${s.substring(2)}`;
			}
		}
	}
	if (s.length == 6) {
		const m = Number(s.substring(4));
		if (0 < m && m <= 12) {
			return `${s.substring(0, 4)}-${m}-1`;
		}
	}
	if (s.length == 8) {
		const m = Number(s.substring(4, 6));
		if (0 < m && m <= 12) {
			const d = Number(s.substring(6));
			if (0 < d && d <= 31) {
				return `${s.substring(0, 4)}-${m}-${d}`;
			}
		}
	}
	return "";
};

const asWeeklyNotePath = (ymd: string): string | null => {
	if (0 < ymd.length) {
		const d = new Date(ymd);
		const monday = new Date(d);
		const offset = (d.getDay() + 6) % 7;
		monday.setDate(d.getDate() - offset);
		const note = new WeeklyNote(monday);
		return note.path;
	}
	return null;
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

	private jumpTo(dest: string, position: boolean | PaneType): void {
		const path = asWeeklyNotePath(dest);
		if (path) {
			const result = openNote(this.app, path, position, () => {
				const d = new Date(dest);
				focusDailyLine(this.app, d);
			});
			if (result) {
				new Notice(`Opened note containing ${dest}`, 4000);
			}
		}
		this.close();
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.id = "jump-modal";
		contentEl.createEl("h2").setText("Jump to:");
		const preview = contentEl.createDiv();
		preview.addClass("dest-preview");
		const input = contentEl.createEl("input", { type: "tel" });
		input.focus();

		const dest = (): string => {
			return parseAsDateStr(input.value);
		};

		input.oninput = () => {
			preview.setText(dest());
		};

		input.onkeydown = (ev) => {
			if (ev.key == "Enter") {
				ev.preventDefault();

				const pos = (() => {
					if (!this.app.workspace.getActiveFile()) return false;
					return ev.ctrlKey ? "split" : true;
				})();

				this.jumpTo(dest(), pos);
			}
		};
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}
