import { App, Plugin, Notice, Setting, PluginSettingTab } from "obsidian";

import { NoteMakerModal, getNoteByWeek } from "Modals/Notemaker";

const COMMAND_MakeNotes = "1年分のノートを作る";
const COMMAND_OpenWeeklyNote = "今週のノートを開く";

interface WeeklyNoteSettings {
	templatePath: string;
}

const DEFAULT_SETTINGS: WeeklyNoteSettings = {
	templatePath: "",
};

export default class WeeklyNotePlugin extends Plugin {
	settings: WeeklyNoteSettings;

	async onload() {
		await this.loadSettings();

		this.addCommand({
			id: "weeklynote-make-notes",
			name: COMMAND_MakeNotes,
			checkCallback: (checking: boolean) => {
				if (checking) {
					return true;
				}
				new NoteMakerModal(this.app, this.settings.templatePath).open();
			},
		});
		this.addCommand({
			id: "weeklynote-open-note",
			name: COMMAND_OpenWeeklyNote,
			checkCallback: (checking: boolean) => {
				if (checking) {
					return true;
				}
				const note = getNoteByWeek(0);
				const notePath = note.path;
				if (this.app.vault.getFileByPath(notePath)) {
					this.app.workspace.openLinkText(notePath, "", false);
				} else {
					new Notice(`"${notePath}" not found!`);
				}
			},
		});
		this.addSettingTab(new WeeklyNoteSettingTab(this.app, this));
	}

	onunload() {}
	async loadSettings() {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			await this.loadData()
		);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}

class WeeklyNoteSettingTab extends PluginSettingTab {
	plugin: WeeklyNotePlugin;

	constructor(app: App, plugin: WeeklyNotePlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		new Setting(containerEl)
			.setName("Template path")
			.setDesc(
				"Path of template file for weekly note. `{{Mon}}` and `{{Tue}}` will be converted to dates like `Jan. 01` and `Jan. 02`."
			)
			.addText((text) =>
				text
					.setValue(this.plugin.settings.templatePath)
					.onChange(async (value) => {
						this.plugin.settings.templatePath = value;
						await this.plugin.saveSettings();
					})
			);
	}
}
