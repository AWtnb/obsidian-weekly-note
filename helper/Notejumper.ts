import { App, Modal, Notice } from "obsidian";
import { WeeklyNote } from "./Weeklynote";

const parseAsDateStr = (s: string): string => {
	const now = new Date();
	const year = now.getFullYear();
	const month = now.getMonth() + 1;
	if (s.length == 1 || s.length == 2) {
		const d = Number(s);
		if (0 < d && d <= 31) {
			return `${year}-${month}-${s}`;
		}
	}
	if (s.length == 4) {
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
		monday.setDate(d.getDate() - d.getDay() + 1);
		const note = new WeeklyNote(monday);
		return note.path;
	}
	return null;
};

export const openNote = (
	app: App,
	path: string,
	newTab: boolean = false
): boolean => {
	if (app.vault.getFileByPath(path)) {
		app.workspace.openLinkText("", path, newTab);
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

	jumpTo(dest: string): void {
		const path = asWeeklyNotePath(dest);
		if (path) {
			const result = openNote(this.app, path, true);
			if (result) {
				new Notice(`Opened note containing ${dest}`, 4000);
			}
		}
		this.close();
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.id = "jump-modal";
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

		const button = contentEl.createEl("button", { text: "GO" });
		input.onkeydown = (ev) => {
			if (ev.key == "Enter") {
				ev.preventDefault();
				this.jumpTo(dest());
			}
		};
		button.onclick = () => {
			this.jumpTo(dest());
		};
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}
