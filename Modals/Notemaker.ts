import { App, Modal, TFile, Notice } from "obsidian";

const toMMdd = (date: Date): string => {
	return (
		String(date.getMonth() + 1).padStart(2, "0") +
		String(date.getDate()).padStart(2, "0")
	);
};

interface WeeklyNote {
	name: string;
	startYear: number;
	startMonth: number;
	startDay: number;
}

const fromMonday = (monday: Date): WeeklyNote => {
	const sunday = new Date(monday);
	sunday.setDate(monday.getDate() + 6);
	return {
		name: `${toMMdd(monday)}-${toMMdd(sunday)}.md`,
		startYear: monday.getFullYear(),
		startMonth: monday.getMonth() + 1,
		startDay: monday.getDate(),
	};
};

const weeklyNotes = (yyyy: number): WeeklyNote[] => {
	const startDate = new Date(`${yyyy}-01-01`);
	const startDayOfWeek = startDate.getDay();
	const firstMonday = new Date(startDate);
	firstMonday.setDate(startDate.getDate() + ((8 - startDayOfWeek) % 7));
	const notes: WeeklyNote[] = [];
	let monday = firstMonday;
	while (monday.getFullYear() === yyyy) {
		const note = fromMonday(monday);
		notes.push(note);
		monday.setDate(monday.getDate() + 7);
	}
	return notes;
};

const noteTemplate = async (app: App, path: string): Promise<string> => {
	if (path) {
		const note = app.vault.getAbstractFileByPath(path);
		if (note && note instanceof TFile) {
			return app.vault.read(note).then((content) => content);
		}
	}
	return Promise.resolve(
		[
			"月 {{Mon}}\n",
			"火 {{Tue}}\n",
			"水 {{Wed}}\n",
			"木 {{Thu}}\n",
			"金 {{Fri}}\n",
			"土 {{Sat}}\n",
			"日 {{Sun}}\n",
			"---\n",
			"# Todo\n\n",
		].join("\n")
	);
};

const fillTemplate = (template: string, note: WeeklyNote): string => {
	const abbrs = [
		"Jan",
		"Feb",
		"Mar",
		"Apr",
		"May",
		"Jun",
		"Jul",
		"Aug",
		"Sep",
		"Oct",
		"Nov",
		"Dec",
	];
	["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].forEach((day, i) => {
		const d = new Date(
			note.startYear,
			note.startMonth - 1,
			note.startDay + i
		);
		const mon = abbrs[d.getMonth()];
		const dd = String(d.getDate()).padStart(2, "0");
		const regex = new RegExp(`{{${day}}}`, "g");
		template = template.replace(regex, `${mon}. ${dd}`);
	});
	return template;
};

export class NoteMakerModal extends Modal {
	private template: string | undefined;

	constructor(app: App, templatePath: string = "") {
		super(app);
		noteTemplate(app, templatePath).then((t) => {
			this.template = t;
		});
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.id = "note-maker-modal";
		contentEl.createEl("h1", { text: "Year" });
		const input = contentEl.createEl("input", { type: "tel" });
		const button = contentEl.createEl("button", { text: "OK" });

		input.focus();

		input.onkeydown = (ev) => {
			if (ev.key == "Enter") {
				this.makeNotes(input.value);
			}
		};
		button.onclick = () => {
			this.makeNotes(input.value);
		};
	}
	async makeNotes(yyyy: string) {
		if (yyyy.length < 1) {
			return;
		}
		const y = Number(yyyy);
		if (y < 2000 || 2500 < y) {
			return;
		}

		const folderPath = `${yyyy}/`;
		if (!this.app.vault.getFolderByPath(folderPath)) {
			await this.app.vault.createFolder(folderPath);
		}

		const notes = weeklyNotes(y);
		for (const note of notes) {
			const notePath = folderPath + note.name;
			if (this.app.vault.getFileByPath(notePath)) {
				new Notice(`${notePath} already exists.`);
			} else {
				const t = this.template || "";
				await this.app.vault.create(notePath, fillTemplate(t, note));
			}
		}
		this.close();
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}

export const getNoteByWeek = (weekDelta: number): WeeklyNote => {
	const now = new Date();
	const dayOfWeek = now.getDay();
	const monday = new Date(now);
	monday.setDate(now.getDate() - dayOfWeek + 1 + 7 * weekDelta);
	return fromMonday(monday);
};
