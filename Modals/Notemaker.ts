import { App, Modal, TFile, Notice, MarkdownView } from "obsidian";

const toMMdd = (date: Date): string => {
	return (
		String(date.getMonth() + 1).padStart(2, "0") +
		String(date.getDate()).padStart(2, "0")
	);
};

interface StartOfWeek {
	Year: number;
	Month: number;
	Day: number;
}

class WeeklyNote {
	readonly name: string;
	readonly start: StartOfWeek;
	constructor(monday: Date) {
		const sunday = new Date(monday);
		sunday.setDate(monday.getDate() + 6);
		this.name = `${toMMdd(monday)}-${toMMdd(sunday)}.md`;
		this.start = {
			Year: monday.getFullYear(),
			Month: monday.getMonth() + 1,
			Day: monday.getDate(),
		};
	}
	get path(): string {
		return `${this.start.Year}/${this.name}`;
	}
	increment(): WeeklyNote {
		const nextMonday = new Date(
			this.start.Year,
			this.start.Month - 1,
			this.start.Day + 7
		);
		return new WeeklyNote(nextMonday);
	}
}

export const fromPath = (path: string): WeeklyNote | null => {
	const pathElems = path.split("/");
	if (pathElems.length < 2) return null;
	const folder = pathElems.at(-2);
	if (!folder) return null;
	if (!/^\d{4}/.test(folder)) return null;
	const name = pathElems.at(-1);
	if (!name) return null;
	if (!/^\d{4}/.test(name)) return null;
	const mm = name.substring(0, 2);
	const dd = name.substring(2, 4);
	const monday = new Date(Number(folder), Number(mm) - 1, Number(dd));
	const note = new WeeklyNote(monday);
	return note;
};

export const viewingNote = (view: MarkdownView): WeeklyNote | null => {
	const file = view.file;
	if (!file) return null;
	return fromPath(file.path);
};

const weeklyNotes = (yyyy: number): WeeklyNote[] => {
	const startDate = new Date(`${yyyy}-01-01`);
	const startDayOfWeek = startDate.getDay();
	const firstMonday = new Date(startDate);
	firstMonday.setDate(startDate.getDate() + ((8 - startDayOfWeek) % 7));
	const notes: WeeklyNote[] = [];
	let monday = firstMonday;
	while (monday.getFullYear() === yyyy) {
		const note = new WeeklyNote(monday);
		notes.push(note);
		monday.setDate(monday.getDate() + 7);
	}
	return notes;
};

export const DEFAULT_TEMPLATE = [
	"月 {{Mon}}\n",
	"火 {{Tue}}\n",
	"水 {{Wed}}\n",
	"木 {{Thu}}\n",
	"金 {{Fri}}\n",
	"土 {{Sat}}\n",
	"日 {{Sun}}\n",
	"---",
	"# Todo\n\n",
].join("\n");

const fillTemplate = (
	template: string,
	holidays: string[],
	holidaySuffix: string,
	note: WeeklyNote
): string => {
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
			note.start.Year,
			note.start.Month - 1,
			note.start.Day + i
		);
		const mon = abbrs[d.getMonth()];
		const dd = String(d.getDate()).padStart(2, "0");
		const regex = new RegExp(`{{${day}}}`, "g");
		let date = `${mon}. ${dd}`;
		const ymd =
			`${d.getFullYear()}-` +
			String(d.getMonth() + 1).padStart(2, "0") +
			`-${String(d.getDate()).padStart(2, "0")}`;
		if (holidays.includes(ymd)) {
			date += holidaySuffix;
		}
		template = template.replace(regex, date);
	});
	return template;
};

export class NoteMakerModal extends Modal {
	private template: string;
	private holidays: string[];
	private holidaySuffix: string;

	constructor(
		app: App,
		template: string,
		holidays: string[],
		holidaySuffix: string
	) {
		super(app);
		this.template = template;
		this.holidays = holidays;
		this.holidaySuffix = holidaySuffix;
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

		if (!this.app.vault.getFolderByPath(yyyy)) {
			await this.app.vault.createFolder(yyyy);
		}

		const notes = weeklyNotes(y);
		for (let i = 0; i < notes.length; i++) {
			const note = notes[i];
			const notePath = note.path;
			if (this.app.vault.getFileByPath(notePath)) {
				new Notice(`${notePath} already exists.`);
			} else {
				const t = this.template || "";
				const navs = [];
				if (0 < i) {
					navs.push(`[[${notes[i - 1].name}|prev]]`);
				}
				if (i < notes.length - 1) {
					navs.push(`[[${notes[i + 1].name}|next]]`);
				}
				const nav = `${navs.join("  |  ")}\n\n`;
				await this.app.vault.create(
					notePath,
					nav + fillTemplate(t, this.holidays, this.holidaySuffix, note)
				);
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
	const note = new WeeklyNote(monday);
	return note;
};
