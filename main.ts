import { get } from 'https';
import { App, Modal, moment, Notice, Plugin, PluginSettingTab, Setting } from 'obsidian';
import { createDailyNote, getAllDailyNotes, getDailyNote } from 'obsidian-daily-notes-interface';

interface MyPluginSettings {
	roam_key: string;
}

const DEFAULT_SETTINGS: MyPluginSettings = {
	roam_key: ''
}

export default class MyPlugin extends Plugin {
	settings: MyPluginSettings;

	async onload() {
		await this.loadSettings();

		this.addCommand({
			id: 'sync-phone-to-roam-to-obsidian',
			name: 'Get new notes',
			callback: () => {
				this.getPhoneToRoam();
			}
		});

		this.addSettingTab(new SampleSettingTab(this.app, this));

		this.registerInterval(window.setInterval(this.getPhoneToRoam.bind(this), 10 * 1000));
		this.getPhoneToRoam();
	}

	async getPhoneToRoam() {
		const obsidianApp = this.app;
		let url = 'https://www.phonetoroam.com/messages.json?roam_key=' + this.settings.roam_key;
		const response = await fetch(url);
		if (response.ok) {
			const content = await response.json();
			content.sort((a: any, b: any) => new Date(a['created_at']).getTime() - new Date(b['created_at']).getTime());
			// console.log(content);
			for (const phoneNote of content) {
				const dailyNotes = getAllDailyNotes();
				const date = moment(phoneNote['created_at']);
				let dailyNote = getDailyNote(date, dailyNotes);
				if (!dailyNote) {
					dailyNote = await createDailyNote(date);
				}
				let result = await obsidianApp.vault.read(dailyNote)
				const phoneNoteText = phoneNote['text'] + " #phonetoroam";
				let newNoteText = result;
				if (newNoteText != "") {
					newNoteText += "\n";
				}
				newNoteText += phoneNoteText;
				await obsidianApp.vault.modify(dailyNote, newNoteText);
				new Notice("Added new phonetoroam note to " + dailyNote.path);
			}
		}
	}

	onunload() {
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}

class SampleSettingTab extends PluginSettingTab {
	plugin: MyPlugin;

	constructor(app: App, plugin: MyPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		let {containerEl} = this;

		containerEl.empty();

		containerEl.createEl('h2', {text: 'Phone to Roam to Obsidian Settings'});

		new Setting(containerEl)
			.setName('roam_key')
			.setDesc('From https://www.phonetoroam.com')
			.addText(text => text
				.setPlaceholder('Enter your roam_key')
				.setValue(this.plugin.settings.roam_key)
				.onChange(async (value) => {
					this.plugin.settings.roam_key = value;
					await this.plugin.saveSettings();
				}));
	}
}
