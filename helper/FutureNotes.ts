import { App, Modal, TFile } from "obsidian";
import { openNote, searchAndFocusLine } from "./NoteSwitcher";
import { notifyWeekDelta, parseNoteName } from "./Weeklynote";

export class FutureNoteModal extends Modal {
	constructor(app: App) {
		super(app);
	}

	private getFutureNotes(): TFile[] {
		const now = new Date();
		return this.app.vault
			.getFiles()
			.filter((file) => {
				const elems = file.path.split("/");
				const d = elems.at(-2);
				if (!d) return false;
				const f = elems.at(-1);
				if (!f) return false;
				const n = parseNoteName(f);
				if (!n) return false;
				const t = new Date(
					Number(d),
					Number(n.startMM) - 1,
					Number(n.startDD)
				);
				return !Number.isNaN(t.getTime()) && now < t;
			})
			.sort((a, b) => {
				if (a.path < b.path) {
					return -1;
				}
				if (b.path < a.path) {
					return 1;
				}
				return 0;
			});
	}

	private openNote(path: string, search: string) {
		openNote(this.app, path, "split", () => {
			searchAndFocusLine(this.app, search);
			notifyWeekDelta(path);
		});
		this.close();
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.id = "future-modal";
		contentEl.createEl("h1").setText("Search:");
		const searchBox = contentEl.createEl("input");
		searchBox.focus();

		const results = contentEl.createDiv();
		results.id = "results";

		const clearResults = () => {
			while (results.firstChild) {
				results.removeChild(results.firstChild);
			}
		};

		const makeResult = (file: TFile, content: string, found: string) => {
			const result = results.createDiv();
			result.addClass("result");
			const b = result.createEl("button");
			b.setText(file.name);
			b.onclick = () => {
				this.openNote(file.path, found);
			};
			const detail = result.createDiv();
			detail.addClass("matches");
			content.split("\n").forEach((line) => {
				const i = line.indexOf(found);
				if (i == -1) return;
				const matchLine = detail.createDiv();
				matchLine.appendText(line.substring(0, i));
				matchLine.createEl("mark").setText(found);
				matchLine.appendText(line.substring(i + found.length));
			});
		};

		searchBox.oninput = () => {
			clearResults();
			if (searchBox.value.trim().length < 1) {
				return;
			}
			this.getFutureNotes().forEach(async (file) => {
				const content = await this.app.vault.read(file);
				const i = content.indexOf(searchBox.value);
				if (i == -1) return;
				makeResult(file, content, searchBox.value);
			});
		};
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}
