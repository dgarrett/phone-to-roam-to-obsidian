import { App, moment, Notice, Plugin, PluginSettingTab, request, Setting } from 'obsidian';
import { createDailyNote, getAllDailyNotes, getDailyNote } from 'obsidian-daily-notes-interface';

interface PluginSettings {
	roam_key: string;
	auto_append: string;
	use_raw_text: boolean;
}

const DEFAULT_SETTINGS: PluginSettings = {
	roam_key: '',
	auto_append: '#phonetoroam',
	use_raw_text: false
}

export default class PhoneToRoamPlugin extends Plugin {
	settings: PluginSettings;

	async onload() {
		await this.loadSettings();

		this.addSettingTab(new PhoneToRoamSettingTab(this.app, this));

		this.registerInterval(window.setInterval(this.getPhoneToRoam.bind(this), 60 * 1000));
		this.getPhoneToRoam();
	}

	async getPhoneToRoam() {
		if (this.settings.roam_key.trim() === '') {
			return;
		}

		const obsidianApp = this.app;
		let url = 'https://app.phonetonote.com/messages.json?roam_key=' + this.settings.roam_key;
		const response = await fetch(url);

		if (response.ok) {
			const content = await response.json();

			// Sort by created_at since the API sorts by updated_at
			content.sort((a: any, b: any) => new Date(a['created_at']).getTime() - new Date(b['created_at']).getTime());

			for (const phoneNote of content) {
				const dailyNotes = getAllDailyNotes();
				const date = moment(phoneNote['created_at']);
				let dailyNote = getDailyNote(date, dailyNotes);
				if (!dailyNote) {
					dailyNote = await createDailyNote(date);
				}
				const prevNoteText = await obsidianApp.vault.read(dailyNote)

				const textProp = this.settings.use_raw_text ? 'body' : 'text';
				const phoneNoteText = phoneNote[textProp] + (this.settings.auto_append ? ' ' + this.settings.auto_append : '');
				let newNoteText = prevNoteText;
				if (newNoteText != '') {
					newNoteText += '\n';
				}
				newNoteText += phoneNoteText;

				await obsidianApp.vault.modify(dailyNote, newNoteText);

				new Notice('Added new Phone to Roam note to ' + dailyNote.path);

				// Mark as synced
				const messageUrl = 'https://app.phonetonote.com/feed/ptn-' + phoneNote.id + '.json';
				const response = await request({
					url: messageUrl, method: 'PATCH', body: JSON.stringify({
						roam_key: this.settings.roam_key,
						status: 'synced'
					}),
					headers: {
						"Content-type": "application/json; charset=UTF-8"
					}
				});
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

class PhoneToRoamSettingTab extends PluginSettingTab {
	plugin: PhoneToRoamPlugin;

	constructor(app: App, plugin: PhoneToRoamPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		let { containerEl } = this;

		containerEl.empty();

		containerEl.createEl('h2', { text: 'Phone to Roam to Obsidian Settings' });

		new Setting(containerEl)
			.setName('roam_key')
			.setDesc('From www.phonetoroam.com')
			.addText(text => text
				.setPlaceholder('Required')
				.setValue(this.plugin.settings.roam_key)
				.onChange(async (value) => {
					this.plugin.settings.roam_key = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Auto append')
			.setDesc('Hashtags or other text to append to every note')
			.addText(text => text
				.setPlaceholder('E.g. #phonetoroam')
				.setValue(this.plugin.settings.auto_append)
				.onChange(async (value) => {
					this.plugin.settings.auto_append = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Get raw text')
			.setDesc('Ignore Phone to Roam\'s parsed dates, etc')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.use_raw_text)
				.onChange(async (value) => {
					this.plugin.settings.use_raw_text = value;
					await this.plugin.saveSettings();
				}));
	}
}
