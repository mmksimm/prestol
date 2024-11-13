declare global {
    interface Window {
        Telegram: {
            WebApp: any;
        };
    }
}

class VinylPlayer {
    private tg = window.Telegram.WebApp;
    private audioContext: AudioContext;
    private audioBuffer: AudioBuffer | null = null;
    private audioSource: AudioBufferSourceNode | null = null;
    private isPlaying = false;
    private platinumDisk: HTMLElement;
    private isScratchMode = false;
    private previousAngle = 0;
    private scratchFilter: BiquadFilterNode;

    constructor() {
        this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        this.platinumDisk = document.getElementById('platinumDisk')!;
        this.scratchFilter = this.audioContext.createBiquadFilter();
        this.setupScratchEffect();
        this.initializeTelegram();
        this.setupEventListeners();
    }

    private setupScratchEffect(): void {
        this.scratchFilter.type = 'bandpass';
        this.scratchFilter.frequency.value = 1000;
        this.scratchFilter.Q.value = 10;
    }

    private initializeTelegram(): void {
        this.tg.expand();
        this.tg.MainButton.setText('Play');
        this.tg.MainButton.onClick(() => this.togglePlayback());
        this.tg.MainButton.show();

        this.tg.onEvent('themeChanged', () => {
            document.body.style.backgroundColor = this.tg.backgroundColor;
            document.body.style.color = this.tg.color;
        });

        this.tg.onEvent('viewportChanged', () => {
            const width = Math.min(window.innerWidth * 0.9, 600);
            this.platinumDisk.style.width = `${width}px`;
            this.platinumDisk.style.height = `${width}px`;
        });
    }

    private setupEventListeners(): void {
        this.platinumDisk.addEventListener('touchstart', this.handleTouchStart.bind(this), { passive: false });
        document.addEventListener('touchmove', this.handleTouchMove.bind(this), { passive: false });
        document.addEventListener('touchend', this.handleTouchEnd.bind(this));
    }

    private handleTouchStart(e: TouchEvent): void {
        e.preventDefault();
        const touch = e.touches[0];
        const rect = this.platinumDisk.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        
        this.previousAngle = Math.atan2(touch.clientY - centerY, touch.clientX - centerX);
        this.isScratchMode = true;
        
        if (this.audioSource) {
            this.audioSource.playbackRate.value = 0;
            this.scratchFilter.frequency.value = 2000;
        }
        
        this.tg.HapticFeedback.impactOccurred('medium');
        this.platinumDisk.classList.add('paused');
    }

    private handleTouchMove(e: TouchEvent): void {
        if (!this.isScratchMode) return;
        e.preventDefault();
        
        const touch = e.touches[0];
        const rect = this.platinumDisk.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        
        const currentAngle = Math.atan2(touch.clientY - centerY, touch.clientX - centerX);
        let angleDelta = currentAngle - this.previousAngle;
        
        if (angleDelta > Math.PI) angleDelta -= Math.PI * 2;
        if (angleDelta < -Math.PI) angleDelta += Math.PI * 2;
        
        if (this.audioSource) {
            this.audioSource.playbackRate.value = angleDelta * 10;
            this.scratchFilter.frequency.value = 1000 + Math.abs(angleDelta) * 2000;
        }
        
        this.platinumDisk.style.transform = `rotate(${currentAngle * 180 / Math.PI}deg)`;
        this.previousAngle = currentAngle;
        
        if (Math.abs(angleDelta) > 0.1) {
            this.tg.HapticFeedback.impactOccurred('light');
        }
    }

    private handleTouchEnd(): void {
        this.isScratchMode = false;
        if (this.audioSource && this.isPlaying) {
            this.audioSource.playbackRate.value = 1;
            this.scratchFilter.frequency.value = 1000;
        }
        this.platinumDisk.style.transform = '';
        this.platinumDisk.classList.remove('paused');
        this.tg.HapticFeedback.notificationOccurred('success');
    }

    private async loadMusic(): Promise<void> {
        try {
            const response = await fetch('/audio/track.mp3');
            const arrayBuffer = await response.arrayBuffer();
            this.audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
        } catch (error) {
            console.error('Error loading audio:', error);
        }
    }

    private playMusic(): void {
        if (!this.audioBuffer) return;
        
        if (this.audioSource) {
            this.audioSource.stop();
        }
        
        this.audioSource = this.audioContext.createBufferSource();
        this.audioSource.buffer = this.audioBuffer;
        this.audioSource.loop = true;
        
        const filter = this.audioContext.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 1000;
        
        this.audioSource.connect(filter);
        filter.connect(this.audioContext.destination);
        
        this.audioSource.start(0);
        this.isPlaying = true;
        this.platinumDisk.classList.remove('paused');
    }

    private stopMusic(): void {
        if (this.audioSource) {
            this.audioSource.stop();
            this.isPlaying = false;
            this.platinumDisk.classList.add('paused');
        }
    }

    private togglePlayback(): void {
        if (!this.isPlaying) {
            this.playMusic();
            this.tg.MainButton.setText('Stop');
        } else {
            this.stopMusic();
            this.tg.MainButton.setText('Play');
        }
        this.tg.HapticFeedback.notificationOccurred('success');
    }

    public async initialize(): Promise<void> {
        await this.loadMusic();
    }
}

// Initialize the application
const player = new VinylPlayer();
player.initialize();