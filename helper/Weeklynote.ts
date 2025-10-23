import { App, Modal, Notice } from "obsidian";

const padZero = (n: number, width: number = 2): string => {
	return String(n).padStart(width, "0");
};

const toMMdd = (date: Date): string => {
	return padZero(date.getMonth() + 1) + padZero(date.getDate());
};

interface StartOfWeek {
	Year: number;
	Month: number;
	Day: number;
}

export class WeeklyNote {
	readonly name: string;
	readonly start: StartOfWeek;
	private parentPath: string = "";
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
	setParent(name: string) {
		this.parentPath = name;
	}
	get path(): string {
		const p = `${this.parentPath}/${this.start.Year}/${this.name}`;
		if (p.startsWith("/")) {
			return p.substring(1);
		}
		return p;
	}
	private getMonday(delta: number): WeeklyNote {
		const monday = new Date(
			this.start.Year,
			this.start.Month - 1,
			this.start.Day + 7 * delta
		);
		const note = new WeeklyNote(monday);
		note.setParent(this.parentPath);
		return note;
	}
	increment(): WeeklyNote {
		return this.getMonday(1);
	}
	decrement(): WeeklyNote {
		return this.getMonday(-1);
	}
	get weekIndex(): number {
		const startDate = new Date(this.start.Year, 0, 1);
		const startDayOfWeek = startDate.getDay();
		const firstMonday = new Date(startDate);
		firstMonday.setDate(startDate.getDate() + ((8 - startDayOfWeek) % 7));

		const monday = new Date(
			this.start.Year,
			this.start.Month - 1,
			this.start.Day
		);
		const daysCount = Math.floor(
			(monday.getTime() - firstMonday.getTime()) / (1000 * 60 * 60 * 24)
		);
		return Math.floor(daysCount / 7) + 1;
	}
	weekDelta(another: WeeklyNote): number {
		const start = new Date(
			this.start.Year,
			this.start.Month - 1,
			this.start.Day
		);
		const end = new Date(
			another.start.Year,
			another.start.Month - 1,
			another.start.Day
		);
		const daysCount = Math.floor(
			(end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)
		);
		return Math.floor(daysCount / 7);
	}
}

export const fromWeek = (delta: number = 0): WeeklyNote => {
	const now = new Date();
	const dayOfWeek = now.getDay();
	const monday = new Date(now);
	const offset = (dayOfWeek + 6) % 7;
	monday.setDate(now.getDate() - offset + 7 * delta);
	const note = new WeeklyNote(monday);
	return note;
};

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
	note.setParent(pathElems.slice(0, -2).join("/"));
	return note;
};

const fromYear = (year: number): WeeklyNote[] => {
	const startDate = new Date(year, 0, 1);
	const startDayOfWeek = startDate.getDay();
	const firstMonday = new Date(startDate);
	firstMonday.setDate(startDate.getDate() + ((8 - startDayOfWeek) % 7));
	const notes: WeeklyNote[] = [];
	let monday = firstMonday;
	while (monday.getFullYear() === year) {
		const note = new WeeklyNote(monday);
		notes.push(note);
		monday.setDate(monday.getDate() + 7);
	}
	return notes;
};

export const notifyWeekDelta = (path: string) => {
	const cur = fromWeek();
	const to = fromPath(path);
	const delta = cur.weekDelta(to!);
	if (delta != 0) {
		let msg = `Opened note (`;
		if (0 < delta) {
			msg += "+";
		}
		msg += `${delta} week`;
		if (1 < Math.abs(delta)) {
			msg += "s";
		}
		msg += ")";
		new Notice(msg, 10000);
	}
};

export const DEFAULT_TEMPLATE = [
	"Week {{index}}",
	"prev: {{prev}}",
	"next: {{next}}\n",
	"# 月 {{Mon}}\n",
	"# 火 {{Tue}}\n",
	"# 水 {{Wed}}\n",
	"# 木 {{Thu}}\n",
	"# 金 {{Fri}}\n",
	"# 土 {{Sat}}\n",
	"# 日 {{Sun}}\n",
	"---",
	"",
].join("\n");

export const toDateString = (d: Date): string => {
	const mon = [
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
	][d.getMonth()];
	const dd = padZero(d.getDate());
	return `${mon}. ${dd}`;
};

class Holiday {
	private readonly date: Date | null;
	readonly name: string;
	constructor(date: string, name: string) {
		const t = Date.parse(date.trim());
		if (Number.isNaN(t)) {
			this.date = null;
		} else {
			this.date = new Date(t);
		}
		this.name = name.trim();
	}
	isEqualTo(d: Date): boolean {
		if (!this.date) {
			return false;
		}
		return (
			d.getFullYear() == this.date.getFullYear() &&
			d.getMonth() == this.date.getMonth() &&
			d.getDate() == this.date.getDate()
		);
	}
}

export class WeeklyNoteModal extends Modal {
	private template: string;
	private holidays: Holiday[];

	constructor(app: App, template: string, holidays: string[]) {
		super(app);
		this.template = template;
		this.holidays = holidays.map((s): Holiday => {
			const i = s.indexOf(" ");
			if (i != -1) {
				return new Holiday(s.substring(0, i), s.substring(i + 1));
			}
			return new Holiday(s, "");
		});
	}

	private getHolidaySuffix(d: Date): string {
		return (
			this.holidays
				.filter((holiday) => holiday.isEqualTo(d))
				.map((holiday) => {
					return holiday.name;
				})[0] || ""
		);
	}

	getContent(
		note: WeeklyNote,
		prev: WeeklyNote | null,
		next: WeeklyNote | null
	): string {
		let filled = this.template;
		["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].forEach((day, i) => {
			const d = new Date(
				note.start.Year,
				note.start.Month - 1,
				note.start.Day + i
			);
			const suffix = this.getHolidaySuffix(d);
			const date = `${toDateString(d)} ${suffix}`.trimEnd();
			const regex = new RegExp(`{{${day}}}`, "g");
			filled = filled.replace(regex, date);
		});
		filled = filled
			.replace(new RegExp(`{{prev}}`, "g"), () => {
				if (prev) return `[[${prev.path}]]`;
				return "";
			})
			.replace(new RegExp(`{{next}}`, "g"), () => {
				if (next) return `[[${next.path}]]`;
				return "";
			})
			.replace(new RegExp(`{{index}}`, "g"), String(note.weekIndex));
		return filled;
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
				ev.preventDefault();
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

		const notes = fromYear(y);
		for (let i = 0; i < notes.length; i++) {
			const note = notes[i];
			const notePath = note.path;
			if (this.app.vault.getFileByPath(notePath)) {
				new Notice(`${notePath} already exists.`);
			} else {
				await this.app.vault.create(
					notePath,
					this.getContent(
						note,
						notes[i - 1] || null,
						notes[i + 1] || null
					)
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
