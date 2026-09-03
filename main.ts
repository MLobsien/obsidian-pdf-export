import { App, Plugin, PluginSettingTab, Setting, Notice, MarkdownView, TFile, Platform, MarkdownRenderer, Component, Modal } from 'obsidian';

interface PDFExportSettings {
	fontSize: number;
	lineHeight: number;
	includeTitle: boolean;
	embedImages: boolean;
	imageSize: 'original' | 'kompakt' | 'klein';
}

const DEFAULT_SETTINGS: PDFExportSettings = {
	fontSize: 14,
	lineHeight: 1.6,
	includeTitle: true,
	embedImages: true,
	imageSize: 'kompakt',
}

class PDFPreviewModal extends Modal {
	private content: string;
	private title: string;
	private settings: PDFExportSettings;
	private iframeEl: HTMLIFrameElement | null = null;

	constructor(app: App, content: string, title: string, settings: PDFExportSettings) {
		super(app);
		this.content = content;
		this.title = title;
		this.settings = settings;
	}

	onOpen(): void {
		const { contentEl, modalEl } = this;

		modalEl.addClass('pdf-export-modal');

		const toolbar = contentEl.createDiv({ cls: 'pdf-export-toolbar' });

		const instructions = toolbar.createDiv({ cls: 'pdf-export-instructions' });

		if (Platform.isMobile) {
			const strong1 = instructions.createEl('strong');
			strong1.setText('iOS export steps:');
			instructions.createEl('br');
			instructions.appendText('1. Click "Copy HTML" button below');
			instructions.createEl('br');
			instructions.appendText('2. Open Safari and paste URL');
			instructions.createEl('br');
			instructions.appendText('3. Use Share → Print → Save PDF');
			instructions.createEl('br');
			instructions.appendText('Bilder sind eingebettet');
		} else {
			const strong2 = instructions.createEl('strong');
			strong2.setText('Desktop:');
			instructions.appendText(' Click "Print" button or press Ctrl/Cmd+P');
		}

		const buttons = toolbar.createDiv({ cls: 'pdf-export-buttons' });

		const copyBtn = buttons.createEl('button', {
			text: 'Copy HTML',
			cls: 'pdf-export-btn pdf-export-btn-copy'
		});
		copyBtn.addEventListener('click', () => {
			this.copyHTML();
		});

		const printBtn = buttons.createEl('button', {
			text: 'Print preview',
			cls: 'pdf-export-btn pdf-export-btn-print'
		});
		printBtn.addEventListener('click', () => {
			this.triggerPrint();
		});

		const closeBtn = buttons.createEl('button', {
			text: 'Close',
			cls: 'pdf-export-btn pdf-export-btn-close'
		});
		closeBtn.addEventListener('click', () => {
			this.close();
		});

		const iframeContainer = contentEl.createDiv({ cls: 'pdf-export-iframe-container' });

		this.iframeEl = iframeContainer.createEl('iframe', { cls: 'pdf-export-iframe' });
		this.iframeEl.setAttribute('srcdoc', this.buildFullHTML());
	}

	private copyHTML(): void {
		const htmlContent = this.buildFullHTML();
		const dataUrl = 'data:text/html;charset=utf-8,' + encodeURIComponent(htmlContent);

		navigator.clipboard.writeText(dataUrl)
			.then(() => {
				new Notice('HTML data URL copied! Paste in Safari address bar');
			})
			.catch(() => {
				navigator.clipboard.writeText(htmlContent)
					.then(() => {
					new Notice('HTML-Code statt Daten-URL kopiert — der Safari-Flow braucht die Daten-URL');
					})
					.catch((err) => {
						console.error('Failed to copy:', err);
						new Notice('Failed to copy HTML');
					});
			});
	}

	private triggerPrint(): void {
		if (this.iframeEl?.contentWindow) {
			this.iframeEl.contentWindow.print();
		}
	}

	private buildFullHTML(): string {
		const fontSize = this.settings.fontSize;
		const lineHeight = this.settings.lineHeight;
		const includeTitle = this.settings.includeTitle;

		return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>${this.escapeHTML(this.title)}</title>
	<style>
		*, *::before, *::after { box-sizing: border-box; }

		/* Base: white background, black text, override all Obsidian dark theme */
		body {
			font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Helvetica Neue", Helvetica, Arial, sans-serif;
			font-size: ${fontSize}px;
			line-height: ${lineHeight};
			color: #000 !important;
			background: #fff !important;
			margin: 0;
			padding: 20px;
		}

		/* Override Obsidian theme colors globally */
		.theme-dark, .app-container, .workspace, .view-content {
			color: #000 !important;
			background: transparent !important;
		}

		/* Headings */
		h1, h2, h3, h4, h5, h6 {
			color: #000 !important;
			margin-top: 1.5em;
			margin-bottom: 0.5em;
			font-weight: 600;
			line-height: 1.3;
		}
		h1 { font-size: 2em; border-bottom: 2px solid #333; padding-bottom: 0.3em; }
		h2 { font-size: 1.5em; border-bottom: 1px solid #666; padding-bottom: 0.3em; }
		h3 { font-size: 1.25em; }
		h4 { font-size: 1.1em; }
		h5 { font-size: 1em; }
		h6 { font-size: 0.9em; color: #666 !important; }

		/* Paragraphs */
		p { margin: 1em 0; }

		/* Links */
		a { color: #0366d6 !important; text-decoration: none; }

		/* Inline code */
		code {
			font-family: "SF Mono", Monaco, Menlo, Consolas, monospace;
			font-size: 0.9em;
			background-color: #f6f8fa !important;
			padding: 0.2em 0.4em;
			border-radius: 3px;
			color: #000 !important;
		}

		/* Code blocks */
		pre, .cm-s-obsidian pre {
			background-color: #f6f8fa !important;
			border: 1px solid #d1d5da !important;
			border-radius: 6px;
			padding: 16px;
			overflow-x: auto;
			font-size: 0.85em;
			line-height: 1.45;
			color: #000 !important;
		}
		pre code, .cm-s-obsidian pre code {
			background: none !important;
			padding: 0;
			font-size: inherit;
		}

		/* Blockquotes */
		blockquote {
			margin: 1em 0;
			padding: 0.5em 1em;
			border-left: 4px solid #dfe2e5 !important;
			color: #6a737d !important;
			background-color: #f8f9fa !important;
		}

		/* Lists */
		ul, ol { margin: 1em 0; padding-left: 2em; }
		li { margin: 0.25em 0; }

		/* Tables — both markdown tables and Obsidian table widget */
		table, .table-editor, .table-wrapper table {
			border-collapse: collapse;
			width: 100%;
			margin: 1em 0;
		}
		th, td, .table-editor th, .table-editor td {
			border: 1px solid #dfe2e5 !important;
			padding: 8px 12px;
			text-align: left;
			color: #000 !important;
			background: transparent !important;
		}
		th, .table-editor th {
			background-color: #f6f8fa !important;
			font-weight: 600;
		}

		/* Horizontal rules */
		hr, .cm-s-obsidian hr {
			border: none !important;
			border-top: 2px solid #dfe2e5 !important;
			margin: 2em 0;
		}

		/* Images */
		img { max-width: 100%; height: auto; }

		/* MathJax — already rendered by Obsidian, just ensure visibility */
		mjx-container {
			display: inline-block !important;
			color: #000 !important;
		}

		/* Desmos graph plugin */
		.block-language-desmos-graph {
			margin: 1em 0;
			text-align: center;
		}

		/* Callouts */
		.callout {
			background-color: #f8f9fa !important;
			border-color: #dfe2e5 !important;
			color: #000 !important;
		}
		.callout-title { color: #000 !important; }

		/* Strikethrough, highlight, etc. */
		del, s { color: #666 !important; }
		mark { background-color: #fff3b0 !important; color: #000 !important; }

		/* Document title */
		.document-title {
			font-size: 2.2em;
			font-weight: 700;
			margin-bottom: 1em;
			padding-bottom: 0.5em;
			border-bottom: 3px solid #333;
		}

		/* Obsidian-specific: reading view + CM live preview */
		/* Reading view elements */
		.markdown-preview-section {
			color: #000 !important;
		}
		.markdown-preview-section h1, .markdown-preview-section h2, .markdown-preview-section h3,
		.markdown-preview-section h4, .markdown-preview-section h5, .markdown-preview-section h6 {
			color: #000 !important;
		}
		.markdown-preview-section a { color: #0366d6 !important; }
		.markdown-preview-section pre,
		.markdown-preview-section code {
			background-color: #f6f8fa !important;
			color: #000 !important;
		}
		.markdown-preview-section blockquote {
			color: #6a737d !important;
			background-color: #f8f9fa !important;
			border-left-color: #dfe2e5 !important;
		}
		.markdown-preview-section table,
		.markdown-preview-section th,
		.markdown-preview-section td {
			color: #000 !important;
			border-color: #dfe2e5 !important;
			background: transparent !important;
		}
		.markdown-preview-section th { background-color: #f6f8fa !important; }

		/* CM live preview elements */
		.cm-s-obsidian .cm-line {
			white-space: pre-wrap;
			word-break: break-word;
		}
		.HyperMD-header { font-weight: 600; color: #000 !important; }
		.HyperMD-header-1 { font-size: 1.8em; }
		.HyperMD-header-2 { font-size: 1.5em; }
		.HyperMD-header-3 { font-size: 1.25em; }
		.cm-embed-block { margin: 0.5em 0; }
		.cm-table-widget {
			margin: 0.5em 0;
			width: 100%;
		}
		.table-wrapper table,
		.table-editor {
			border-collapse: collapse;
			width: 100%;
		}
		.table-wrapper th, .table-wrapper td,
		.table-editor th, .table-editor td {
			border: 1px solid #dfe2e5 !important;
			padding: 8px 12px;
			text-align: left;
			color: #000 !important;
			background: transparent !important;
		}
		.table-wrapper th, .table-editor th {
			background-color: #f6f8fa !important;
			font-weight: 600;
		}
		.internal-embed {
			display: block;
			margin: 0.5em 0;
		}
		.pdf-embed {
			/* Obsidian PDF embed — hide toolbar chrome */
		}
		.embed-actions,
		.pdf-toolbar {
			display: none !important;
		}

		/* Print optimizations */
		@media print {
			body { padding: 0; }
			h1, h2, h3, h4, h5, h6 { page-break-after: avoid; }
			pre, blockquote, table, img, .block-language-desmos-graph { page-break-inside: avoid; }
		}
	</style>
</head>
<body>
	${includeTitle ? `<h1 class="document-title">${this.escapeHTML(this.title)}</h1>` : ''}
	<div class="markdown-content">${this.content}</div>
</body>
</html>`;
	}

	private escapeHTML(text: string): string {
		const div = document.createElement('div');
		div.appendChild(document.createTextNode(text));
		return div.innerHTML;
	}

	onClose(): void {
		const { contentEl } = this;
		contentEl.empty();
		this.iframeEl = null;
	}
}

export default class PDFExportPlugin extends Plugin {
	settings: PDFExportSettings;

	async onload(): Promise<void> {
		await this.loadSettings();

		this.addCommand({
			id: 'export-current-note-to-pdf',
			name: 'Export current note to PDF',
			checkCallback: (checking: boolean) => {
				const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
				if (activeView) {
					if (!checking) {
						void this.exportCurrentNoteToPDF();
					}
					return true;
				}
				return false;
			}
		});

		this.registerEvent(
			this.app.workspace.on('file-menu', (menu, file) => {
				if (file instanceof TFile && file.extension === 'md') {
					menu.addItem((item) => {
						item
							.setTitle('Export to PDF')
							.setIcon('file-text')
							.onClick(() => {
								void this.exportFileToPDF(file);
							});
					});
				}
			})
		);

		this.addSettingTab(new PDFExportSettingTab(this.app, this));
	}

	async loadSettings(): Promise<void> {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
	}

	private async exportCurrentNoteToPDF(): Promise<void> {
		const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
		if (!activeView) {
			new Notice('No note is open');
			return;
		}

		const file = activeView.file;
		if (!file) {
			new Notice('Unable to get current file');
			return;
		}

		await this.exportFileToPDF(file);
	}

	private async exportFileToPDF(file: TFile): Promise<void> {
		try {
			new Notice('Preparing PDF preview...');

			// Try to capture the already-rendered DOM from the active view
			const renderedContent = this.captureRenderedContent();

			if (renderedContent) {
				// Successfully captured rendered DOM — inline images if needed
				const container = document.createElement('div');
				container.innerHTML = renderedContent;

				if (this.settings.embedImages) {
					const stats = await this.inlineImages(container, file.path);
					if (stats.failed > 0) {
						new Notice(`PDF-Export: ${stats.failed} Bild(er) konnten nicht eingebettet werden`);
					}
					if (stats.inlined > 0) {
						new Notice(`${stats.inlined} Bild(er) eingebettet (${stats.skipped} übersprungen)`);
					}
				}

				const modal = new PDFPreviewModal(this.app, container.innerHTML, file.basename, this.settings);
				modal.open();
			} else {
				// Fallback: re-render markdown (no live DOM available)
				const content = await this.app.vault.read(file);
				const renderedHTML = await this.renderMarkdownToHTML(content, file.path);
				const modal = new PDFPreviewModal(this.app, renderedHTML, file.basename, this.settings);
				modal.open();
			}

		} catch (error) {
			console.error('PDF export error:', error);
			const errorMessage = error instanceof Error ? error.message : 'Unknown error';
			new Notice('PDF export failed: ' + errorMessage, 10000);
		}
	}

	/**
	 * Capture the already-rendered DOM from Obsidian's live preview or reading view.
	 * Returns the cleaned innerHTML, or null if no rendered content is available.
	 */
	captureRenderedContent(): string | null {
		const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
		if (!activeView) return null;

		// Try reading view first: .markdown-preview-section has clean rendered HTML
		const previewSection = activeView.containerEl.querySelector('.markdown-preview-section');
		if (previewSection && previewSection.innerHTML.length > 1000) {
			const clone = previewSection.cloneNode(true) as HTMLElement;
			this.cleanPreviewUI(clone);
			return clone.innerHTML;
		}

		// Try live preview: .cm-sizer contains rendered content inside CM editor
		const cmSizer = activeView.containerEl.querySelector('.cm-sizer');
		if (cmSizer && cmSizer.innerHTML.length > 1000) {
			const clone = cmSizer.cloneNode(true) as HTMLElement;
			this.cleanEditorUI(clone);
			return clone.innerHTML;
		}

		// Fallback: try .cm-content (less clean but has content)
		const cmContent = activeView.containerEl.querySelector('.cm-content');
		if (cmContent && cmContent.innerHTML.length > 1000) {
			const clone = cmContent.cloneNode(true) as HTMLElement;
			this.cleanEditorUI(clone);
			return clone.innerHTML;
		}

		return null;
	}

	/**
	 * Remove editor-specific UI elements from a cloned DOM.
	 */
	cleanEditorUI(el: HTMLElement): void {
		// Remove cursor layers, selection layers, drag handles, fold indicators, widget buffers
		const selectors = [
			'.cm-cursorLayer',
			'.cm-selectionLayer',
			'.cm-cursor',
			'.cm-fat-cursor',
			'.cm-layer',
			'.cm-announced',
			'.cm-widgetBuffer',
			'.cm-fold-indicator',
			'.table-col-drag-handle',
			'.table-row-drag-handle',
			'.table-row-btn',
			'.table-col-btn',
			'.inline-title',
			'.metadata-container',
			'.embedded-backlinks',
		];
		for (const sel of selectors) {
			el.querySelectorAll(sel).forEach(e => e.remove());
	}
	}


	/**
	 * Clean the reading/preview view DOM for export.
	 */
	cleanPreviewUI(el: HTMLElement): void {
		const selectors = [
			'.inline-title',
			'.metadata-container',
			'.embedded-backlinks',
			'.markdown-preview-pusher',
			'.markdown-preview-section > h1:first-child',
		];
		for (const sel of selectors) {
			el.querySelectorAll(sel).forEach(e => e.remove());
		}
	}

	private async renderMarkdownToHTML(markdown: string, sourcePath: string = ''): Promise<string> {
		const container = document.createElement('div');
		const component = new Component();
		component.load();

		try {
			await MarkdownRenderer.render(
				this.app,
				markdown,
				container,
				'',
				component
			);
		} finally {
			component.unload();
		}

		// Inline images as base64 data URIs if enabled
		if (this.settings.embedImages) {
			const stats = await this.inlineImages(container, sourcePath);
			if (stats.failed > 0) {
				new Notice(`PDF-Export: ${stats.failed} Bild(er) konnten nicht eingebettet werden`);
			}
			if (stats.inlined > 0) {
				new Notice(`${stats.inlined} Bild(er) eingebettet (${stats.skipped} übersprungen)`);
			}
		}

		return container.innerHTML;
	}

	private async inlineImages(
		container: HTMLElement,
		sourcePath: string
	): Promise<{ inlined: number; skipped: number; failed: number }> {
		const { classifySrc, resolveVaultFile, mimeForExt, isRasterMime, bytesToBase64DataUri, needsDownscale } = await import('./src/image-inliner');

		const imgs = container.querySelectorAll('img[src]');
		const seen = new Set<string>();
		let inlined = 0;
		let skipped = 0;
		let failed = 0;

		const basePath = (this.app.vault.adapter as any)?.basePath as string | undefined;

		for (const img of Array.from(imgs)) {
			const src = img.getAttribute('src') || '';
			if (!src || seen.has(src)) continue;
			seen.add(src);

			const classified = classifySrc(src);

			// Skip passthrough classes
			if (classified.kind === 'data' || classified.kind === 'remote' || classified.kind === 'protocol-relative') {
				skipped++;
				continue;
			}

			// Blob is unresolvable
			if (classified.kind === 'blob') {
				failed++;
				continue;
			}

			// Resolve vault file
			const ctx = {
				basePath,
				getAbstractFileByPath: (p: string) => this.app.vault.getAbstractFileByPath(p),
				getFirstLinkpathDest: (link: string, src: string) => this.app.metadataCache.getFirstLinkpathDest(link, src),
				sourcePath,
			};
			const file = resolveVaultFile(classified.path, ctx);

			if (!file) {
				failed++;
				continue;
			}

			try {
				const bytes = new Uint8Array(await this.app.vault.readBinary(file as TFile));
				const ext = (file as TFile).extension ? `.${(file as TFile).extension}` : '';
				const mime = mimeForExt(ext);

				if (!mime) {
					failed++;
					continue;
				}

				// For now, use original bytes (raster ops in T6)
				const dataUri = bytesToBase64DataUri(bytes, mime);
				img.setAttribute('src', dataUri);
				inlined++;
			} catch {
				failed++;
			}
		}

		return { inlined, skipped, failed };
	}
}

class PDFExportSettingTab extends PluginSettingTab {
	plugin: PDFExportPlugin;

	constructor(app: App, plugin: PDFExportPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		new Setting(containerEl)
			.setName('PDF export')
			.setHeading();

		containerEl.createEl('p', {
			text: 'This plugin uses system native print functionality to generate PDF, with no memory limitations.'
		});

		new Setting(containerEl)
			.setName('Font size')
			.setDesc('Base font size for PDF (pixels)')
			.addSlider(slider => slider
				.setLimits(10, 24, 1)
				.setValue(this.plugin.settings.fontSize)
				.setDynamicTooltip()
				.onChange(async (value) => {
					this.plugin.settings.fontSize = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Line height')
			.setDesc('Text line height multiplier')
			.addSlider(slider => slider
				.setLimits(1.2, 2.0, 0.1)
				.setValue(this.plugin.settings.lineHeight)
				.setDynamicTooltip()
				.onChange(async (value) => {
					this.plugin.settings.lineHeight = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Include title')
			.setDesc('Show document title at the top of PDF')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.includeTitle)
				.onChange(async (value) => {
					this.plugin.settings.includeTitle = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Bilder einbetten (base64)')
			.setDesc('Bilder werden als base64 Data-URIs in die HTML eingebettet')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.embedImages)
				.onChange(async (value) => {
					this.plugin.settings.embedImages = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Bildgröße beim Einbetten')
			.setDesc('Originalgröße oder kompakt/klein verkleinern')
			.addDropdown(dropdown => dropdown
				.addOption('original', 'Original')
				.addOption('kompakt', 'Kompakt (max 1600px)')
				.addOption('klein', 'Klein (max 1024px)')
				.setValue(this.plugin.settings.imageSize)
				.onChange(async (value: 'original' | 'kompakt' | 'klein') => {
					this.plugin.settings.imageSize = value;
					await this.plugin.saveSettings();
				}));
	}
}
