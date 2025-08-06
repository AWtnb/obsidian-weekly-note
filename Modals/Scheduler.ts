import { App, Modal, Editor, MarkdownView } from "obsidian";

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
		startTime.addClass("time");
		const endTime = contentEl
			.createEl("label", { text: "end" })
			.createEl("input", { type: "number" });
		startTime.addClass("time");
		const schedule = contentEl
			.createEl("label", { text: "schedule" })
			.createEl("input", { type: "text" });
		const button = contentEl.createEl("button", { text: "OK" });

		startTime.focus();

		const insertSchedule = () => {
			if (schedule.value.length < 1 || startTime.value.length < 1) {
				return;
			}
			const scheduleLine = `- ${startTime.value}-${endTime.value} ${schedule.value}`;
			const cursor = this.editor.getCursor();
			this.editor.setLine(cursor.line, scheduleLine);
			this.editor.setCursor(cursor.line, scheduleLine.length);
			this.close();
		};

		schedule.addEventListener("keydown", (e) => {
			if (e.key === "Enter") {
				e.preventDefault();
				insertSchedule();
			}
		});
		button.onclick = insertSchedule;
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}
