import { App, Modal, Editor, MarkdownView } from "obsidian";

const orderLines = (a: string, b: string): string => {
	if (!a) return b;
	if (!b) return a;
	return [a, b].sort().join("\n");
};

export class SchedulerModal extends Modal {
	private readonly editor: Editor;
	private readonly view: MarkdownView;

	constructor(app: App, editor: Editor, view: MarkdownView) {
		super(app);
		this.editor = editor;
		this.view = view;
	}

	onOpen() {
		if (!this.view || this.view.getMode() == "preview") {
			this.close();
			return;
		}

		const { contentEl } = this;
		contentEl.id = "schedule-modal";
		const startTime = contentEl
			.createEl("label", { text: "start" })
			.createEl("input", { type: "number" });
		const endTime = contentEl
			.createEl("label", { text: "end" })
			.createEl("input", { type: "number" });
		const schedule = contentEl
			.createEl("label", { text: "schedule" })
			.createEl("input", { type: "text" });
		const button = contentEl.createEl("button", { text: "OK" });

		startTime.focus();

		const insertSchedule = () => {
			if (schedule.value.length < 1 || startTime.value.length < 1) {
				return;
			}
			let scheduleLine = `- ${startTime.value}`;
			if (0 < endTime.value.length) {
				scheduleLine += `-${endTime.value} `;
			} else {
				scheduleLine += "- ";
			}
			scheduleLine += schedule.value;
			const cursor = this.editor.getCursor();
			this.editor.setLine(
				cursor.line,
				orderLines(scheduleLine, this.editor.getLine(cursor.line))
			);
			this.editor.setCursor(cursor.line, scheduleLine.length);
			this.close();
		};

		schedule.onkeydown = (ev) => {
			if (ev.key == "Enter") {
				insertSchedule();
			}
		};
		button.onclick = insertSchedule;
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}
