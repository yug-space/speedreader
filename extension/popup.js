// Speed Reader Popup Script

class SpeedReader {
  constructor() {
    this.words = [];
    this.currentIndex = 0;
    this.isPlaying = false;
    this.wpm = 350;
    this.intervalId = null;

    // DOM elements
    this.sourceSelection = document.getElementById('source-selection');
    this.readerView = document.getElementById('reader-view');
    this.status = document.getElementById('status');

    this.wordBefore = document.getElementById('word-before');
    this.wordAnchor = document.getElementById('word-anchor');
    this.wordAfter = document.getElementById('word-after');

    this.progressFill = document.getElementById('progress-fill');
    this.wordCount = document.getElementById('word-count');
    this.timeRemaining = document.getElementById('time-remaining');

    this.btnMedium = document.getElementById('btn-medium');
    this.btnSelection = document.getElementById('btn-selection');
    this.btnPdf = document.getElementById('btn-pdf');
    this.pdfInput = document.getElementById('pdf-input');
    this.btnPlay = document.getElementById('btn-play');
    this.btnRestart = document.getElementById('btn-restart');
    this.btnBack = document.getElementById('btn-back');
    this.speedSlider = document.getElementById('speed-slider');
    this.wpmValue = document.getElementById('wpm-value');
    this.iconPlay = document.getElementById('icon-play');
    this.iconPause = document.getElementById('icon-pause');
    this.progressStatus = document.getElementById('progress-status');
    this.extractionProgress = document.getElementById('extraction-progress');
    this.extractionText = document.getElementById('extraction-text');

    this.init();
  }

  init() {
    // Load saved WPM and check for pending actions from context menu
    chrome.storage.local.get(['wpm', 'pendingText', 'pendingAction'], (result) => {
      if (result.wpm) {
        this.wpm = result.wpm;
        this.speedSlider.value = this.wpm;
        this.wpmValue.textContent = this.wpm;
      }

      // Handle pending actions from context menu
      if (result.pendingText && result.pendingAction === 'selection') {
        chrome.storage.local.remove(['pendingText', 'pendingAction']);
        this.loadText(result.pendingText);
        this.setStatus(`Loaded: ${this.words.length} words`, 'success');
        setTimeout(() => this.showReaderView(), 300);
      } else if (result.pendingAction === 'article') {
        chrome.storage.local.remove(['pendingAction']);
        this.loadMediumArticle();
      }
    });

    // Event listeners
    this.btnMedium.addEventListener('click', () => this.loadMediumArticle());
    this.btnSelection.addEventListener('click', () => this.loadSelectedText());
    this.btnPdf.addEventListener('click', () => this.pdfInput.click());
    this.pdfInput.addEventListener('change', (e) => this.handlePdfUpload(e));
    this.btnPlay.addEventListener('click', () => this.togglePlay());
    this.btnRestart.addEventListener('click', () => this.restart());
    this.btnBack.addEventListener('click', () => this.showSourceSelection());

    this.speedSlider.addEventListener('input', (e) => {
      this.wpm = parseInt(e.target.value);
      this.wpmValue.textContent = this.wpm;
      chrome.storage.local.set({ wpm: this.wpm });

      // Restart interval with new speed if playing
      if (this.isPlaying) {
        this.stopInterval();
        this.startInterval();
      }
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      if (this.readerView.classList.contains('hidden')) return;

      switch (e.code) {
        case 'Space':
          e.preventDefault();
          this.togglePlay();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          this.skipWords(-1);
          break;
        case 'ArrowRight':
          e.preventDefault();
          this.skipWords(1);
          break;
        case 'ArrowUp':
          e.preventDefault();
          this.skipWords(-10);
          break;
        case 'ArrowDown':
          e.preventDefault();
          this.skipWords(10);
          break;
        case 'KeyR':
          e.preventDefault();
          this.restart();
          break;
      }
    });
  }

  setStatus(message, type = '') {
    this.status.textContent = message;
    this.status.className = 'status ' + type;
  }

  async loadMediumArticle() {
    this.setStatus('Extracting article...');

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

      // Inject content script if not already injected
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['content.js']
        });
      } catch (e) {
        // Script might already be injected
      }

      const response = await chrome.tabs.sendMessage(tab.id, { action: 'getMediumArticle' });

      if (response.success) {
        this.loadText(response.text);
        this.setStatus(`Loaded: ${response.wordCount} words`, 'success');
        setTimeout(() => this.showReaderView(), 500);
      } else {
        this.setStatus(response.error || 'Failed to extract article', 'error');
      }
    } catch (error) {
      this.setStatus('Error: Could not access page. Try refreshing.', 'error');
    }
  }

  async loadSelectedText() {
    this.setStatus('Getting selected text...');

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

      // Inject content script if not already injected
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['content.js']
        });
      } catch (e) {
        // Script might already be injected
      }

      const response = await chrome.tabs.sendMessage(tab.id, { action: 'getSelectedText' });

      if (response.success && response.text) {
        this.loadText(response.text);
        const wordCount = this.words.length;
        this.setStatus(`Loaded: ${wordCount} words`, 'success');
        setTimeout(() => this.showReaderView(), 500);
      } else {
        this.setStatus('No text selected. Highlight some text first.', 'error');
      }
    } catch (error) {
      this.setStatus('Error: Could not access page. Try refreshing.', 'error');
    }
  }

  async handlePdfUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      this.setStatus('Please select a PDF file.', 'error');
      return;
    }

    // Disable buttons during processing
    this.setButtonsEnabled(false);
    this.showExtractionProgress(true);
    this.setStatus('');

    try {
      const processor = new PDFProcessor((progress, message) => {
        this.updateExtractionProgress(progress, message);
      });

      const text = await processor.extractText(file);

      this.loadText(text);
      const wordCount = this.words.length;

      this.showExtractionProgress(false);
      this.setStatus(`Loaded: ${wordCount} words from PDF`, 'success');

      setTimeout(() => this.showReaderView(), 500);
    } catch (error) {
      console.error('PDF extraction failed:', error);
      this.showExtractionProgress(false);
      this.setStatus(error.message || 'Failed to extract text from PDF.', 'error');
    } finally {
      this.setButtonsEnabled(true);
      // Reset file input so the same file can be selected again
      this.pdfInput.value = '';
    }
  }

  setButtonsEnabled(enabled) {
    this.btnMedium.disabled = !enabled;
    this.btnSelection.disabled = !enabled;
    this.btnPdf.disabled = !enabled;
  }

  showExtractionProgress(show) {
    if (show) {
      this.progressStatus.classList.remove('hidden');
      this.extractionProgress.style.width = '0%';
    } else {
      this.progressStatus.classList.add('hidden');
    }
  }

  updateExtractionProgress(percent, message) {
    this.extractionProgress.style.width = `${percent}%`;
    this.extractionText.textContent = message;
  }

  loadText(text) {
    // Split text into words
    this.words = text
      .replace(/\s+/g, ' ')
      .trim()
      .split(' ')
      .filter(word => word.length > 0);

    this.currentIndex = 0;
    this.isPlaying = false;
    this.updateDisplay();
    this.updateProgress();
  }

  showSourceSelection() {
    this.stopInterval();
    this.isPlaying = false;
    this.sourceSelection.classList.remove('hidden');
    this.readerView.classList.add('hidden');
    this.setStatus('');
  }

  showReaderView() {
    this.sourceSelection.classList.add('hidden');
    this.readerView.classList.remove('hidden');
  }

  // Calculate ORP (Optimal Recognition Point) index
  getORPIndex(word) {
    const len = word.length;
    if (len <= 1) return 0;
    if (len <= 3) return 0;
    if (len <= 5) return 1;
    if (len <= 9) return 2;
    if (len <= 13) return 3;
    return 4;
  }

  updateDisplay() {
    const word = this.words[this.currentIndex] || '';

    if (!word) {
      this.wordBefore.textContent = '';
      this.wordAnchor.textContent = '';
      this.wordAfter.textContent = '';
      return;
    }

    const orpIndex = this.getORPIndex(word);
    this.wordBefore.textContent = word.slice(0, orpIndex);
    this.wordAnchor.textContent = word[orpIndex] || '';
    this.wordAfter.textContent = word.slice(orpIndex + 1);
  }

  updateProgress() {
    const progress = this.words.length > 0
      ? ((this.currentIndex + 1) / this.words.length) * 100
      : 0;

    this.progressFill.style.width = `${progress}%`;
    this.wordCount.textContent = `${this.currentIndex + 1} / ${this.words.length}`;

    // Calculate time remaining
    const wordsRemaining = this.words.length - this.currentIndex - 1;
    const secondsRemaining = wordsRemaining > 0 ? (wordsRemaining / this.wpm) * 60 : 0;
    const minutes = Math.floor(secondsRemaining / 60);
    const seconds = Math.floor(secondsRemaining % 60);
    this.timeRemaining.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }

  togglePlay() {
    if (this.words.length === 0) return;

    this.isPlaying = !this.isPlaying;

    if (this.isPlaying) {
      this.iconPlay.classList.add('hidden');
      this.iconPause.classList.remove('hidden');
      this.startInterval();
    } else {
      this.iconPlay.classList.remove('hidden');
      this.iconPause.classList.add('hidden');
      this.stopInterval();
    }
  }

  startInterval() {
    const intervalMs = (60 / this.wpm) * 1000;

    this.intervalId = setInterval(() => {
      if (this.currentIndex >= this.words.length - 1) {
        this.isPlaying = false;
        this.iconPlay.classList.remove('hidden');
        this.iconPause.classList.add('hidden');
        this.stopInterval();
        return;
      }

      this.currentIndex++;
      this.updateDisplay();
      this.updateProgress();
    }, intervalMs);
  }

  stopInterval() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  skipWords(count) {
    if (this.words.length === 0) return;

    this.currentIndex = Math.max(0, Math.min(this.words.length - 1, this.currentIndex + count));
    this.updateDisplay();
    this.updateProgress();
  }

  restart() {
    this.currentIndex = 0;
    this.isPlaying = false;
    this.iconPlay.classList.remove('hidden');
    this.iconPause.classList.add('hidden');
    this.stopInterval();
    this.updateDisplay();
    this.updateProgress();
  }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  new SpeedReader();
});
