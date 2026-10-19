import { CommonModule } from '@angular/common';
import { Component, ElementRef, HostListener, OnDestroy, OnInit, ViewChild, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

interface Memory { id: number; image: string; title: string; date: string; note: string; }
interface TimelineMoment { id: number; title: string; date: string; text: string; image: string; }
interface LoveData {
  name: string; dedication: string; startDate: string; letter: string; reasons: string[];
  hugMessage: string; memories: Memory[]; timeline: TimelineMoment[]; music: string;
}

const DEFAULT_DATA: LoveData = {
  name: 'Mi amor',
  dedication: 'Este rincón guarda lo que las palabras a veces no alcanzan a decir: la suerte inmensa de coincidir contigo.',
  startDate: '2022-10-20',
  letter: 'Aquí puedes escribir tu carta. Cuéntale qué cambió desde que llegó, qué admiras de ella y todos esos pequeños detalles que hacen que tu mundo sea más bonito. Este texto es completamente editable desde el modo edición.',
  reasons: [
    'Porque contigo hasta los días normales se sienten especiales.',
    'Por la forma en que tu sonrisa cambia el ánimo de todo un lugar.',
    'Porque puedo ser yo cuando estoy contigo.',
    'Por todos los pequeños detalles que solo tú sabes tener.',
    'Porque elegirte se siente como volver a casa.',
  ],
  hugMessage: 'Respira despacio. Aunque no esté justo a tu lado, quiero que sientas mis brazos rodeándote y recuerdes que nunca estás sola.',
  memories: [],
  timeline: [
    { id: 1, title: 'Cómo empezó todo', date: 'Añade la fecha', text: 'Escribe aquí cómo comenzó vuestra historia.', image: '' },
    { id: 2, title: 'Nuestra primera salida', date: 'Añade la fecha', text: 'Guarda aquí aquello que ninguno de los dos quiere olvidar.', image: '' },
    { id: 3, title: 'Un día para siempre', date: 'Añade la fecha', text: 'Cuenta qué convirtió este momento en uno de vuestros favoritos.', image: '' },
  ],
  music: '',
};

@Component({
  selector: 'app-root',
  imports: [CommonModule, FormsModule],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App implements OnInit, OnDestroy {
  @ViewChild('audioPlayer') audioPlayer?: ElementRef<HTMLAudioElement>;
  readonly unlocked = signal(false);
  readonly unlocking = signal(false);
  readonly error = signal(false);
  readonly editing = signal(false);
  readonly letterOpen = signal(false);
  readonly hugOpen = signal(false);
  readonly memoryOpen = signal<number | null>(null);
  readonly reasonIndex = signal(0);
  readonly musicPlaying = signal(false);
  readonly saved = signal(false);
  wheels = [3, 7, 24];
  data: LoveData = structuredClone(DEFAULT_DATA);
  now = new Date();
  private clock?: ReturnType<typeof setInterval>;
  private dragStartY: number | null = null;
  private draggingWheel = 0;

  ngOnInit(): void {
    const stored = localStorage.getItem('solo-tu-tienes-la-clave');
    if (stored) {
      try { this.data = { ...structuredClone(DEFAULT_DATA), ...JSON.parse(stored) }; }
      catch { /* Keep safe defaults if old data is invalid. */ }
    }
    this.clock = setInterval(() => (this.now = new Date()), 1000);
  }
  ngOnDestroy(): void { if (this.clock) clearInterval(this.clock); }

  get elapsed(): { years: number; months: number; days: number; hours: number } {
    const start = new Date(`${this.data.startDate}T00:00:00`);
    if (Number.isNaN(start.getTime()) || start > this.now) return { years: 0, months: 0, days: 0, hours: 0 };
    let years = this.now.getFullYear() - start.getFullYear();
    let months = this.now.getMonth() - start.getMonth();
    let days = this.now.getDate() - start.getDate();
    if (days < 0) { months--; days += new Date(this.now.getFullYear(), this.now.getMonth(), 0).getDate(); }
    if (months < 0) { years--; months += 12; }
    return { years, months, days, hours: this.now.getHours() };
  }

  adjustWheel(index: number, delta: number): void {
    this.wheels[index] = (this.wheels[index] + delta + 100) % 100;
    this.error.set(false);
  }
  onWheel(event: WheelEvent, index: number): void { event.preventDefault(); this.adjustWheel(index, event.deltaY > 0 ? 1 : -1); }
  startDrag(event: PointerEvent, index: number): void {
    this.dragStartY = event.clientY; this.draggingWheel = index;
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  }
  drag(event: PointerEvent): void {
    if (this.dragStartY === null) return;
    const distance = this.dragStartY - event.clientY;
    if (Math.abs(distance) >= 18) { this.adjustWheel(this.draggingWheel, distance > 0 ? 1 : -1); this.dragStartY = event.clientY; }
  }
  endDrag(): void { this.dragStartY = null; }

  openWorld(): void {
    if (this.wheels.join('-') !== '20-10-22') {
      this.error.set(true); setTimeout(() => this.error.set(false), 1800); return;
    }
    this.error.set(false); this.unlocking.set(true);
    setTimeout(() => { this.unlocked.set(true); document.body.classList.add('world-open'); window.scrollTo({ top: 0, behavior: 'smooth' }); }, 1450);
  }
  scrollToStory(): void { document.getElementById('recuerdos')?.scrollIntoView({ behavior: 'smooth' }); }
  scrollTop(): void { window.scrollTo({ top: 0, behavior: 'smooth' }); }
  toggleEditing(): void { this.editing.update((value) => !value); }

  save(): void {
    try {
      localStorage.setItem('solo-tu-tienes-la-clave', JSON.stringify(this.data));
      this.saved.set(true); setTimeout(() => this.saved.set(false), 1800);
    } catch { alert('No queda espacio en este navegador. Prueba con fotos más pequeñas o exporta tu regalo.'); }
  }

  async addImages(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    for (const file of Array.from(input.files ?? [])) {
      const image = await this.compressImage(file);
      this.data.memories.push({ id: Date.now() + Math.random(), image, title: 'Nuestro recuerdo', date: '', note: 'Escribe aquí lo que hace especial este instante.' });
    }
    input.value = ''; this.save();
  }
  async setTimelineImage(event: Event, moment: TimelineMoment): Promise<void> {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return; moment.image = await this.compressImage(file); this.save();
  }
  async setMusic(event: Event): Promise<void> {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    if (file.size > 4_500_000) { alert('Para guardarla en el navegador, elige una canción de menos de 4.5 MB.'); return; }
    this.data.music = await dataUrlFromFile(file); this.save();
  }
  removeMemory(index: number): void {
    if (confirm('¿Eliminar este recuerdo?')) { this.data.memories.splice(index, 1); this.memoryOpen.set(null); this.save(); }
  }
  moveMemory(index: number, direction: number): void {
    const target = index + direction;
    if (target < 0 || target >= this.data.memories.length) return;
    [this.data.memories[index], this.data.memories[target]] = [this.data.memories[target], this.data.memories[index]];
    this.memoryOpen.set(target); this.save();
  }
  nextMemory(direction: number): void {
    const current = this.memoryOpen();
    if (current === null || !this.data.memories.length) return;
    this.memoryOpen.set((current + direction + this.data.memories.length) % this.data.memories.length);
  }
  addTimelineMoment(): void {
    this.data.timeline.push({ id: Date.now(), title: 'Un nuevo capítulo', date: 'Añade la fecha', text: 'Escribe aquí este recuerdo.', image: '' }); this.save();
  }
  removeTimelineMoment(index: number): void { this.data.timeline.splice(index, 1); this.save(); }
  nextReason(): void { if (this.data.reasons.length) this.reasonIndex.set((this.reasonIndex() + 1) % this.data.reasons.length); }
  addReason(): void { this.data.reasons.push('Escribe aquí otra razón para quererla.'); }
  removeReason(index: number): void { this.data.reasons.splice(index, 1); this.reasonIndex.set(0); this.save(); }
  async toggleMusic(): Promise<void> {
    const audio = this.audioPlayer?.nativeElement; if (!audio || !this.data.music) return;
    if (audio.paused) { try { await audio.play(); this.musicPlaying.set(true); } catch { /* Browser may reject playback. */ } }
    else { audio.pause(); this.musicPlaying.set(false); }
  }

  exportGift(): void {
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([JSON.stringify(this.data)], { type: 'application/json' }));
    link.download = 'nuestro-regalo.json'; link.click(); URL.revokeObjectURL(link.href);
  }
  importGift(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try { this.data = { ...structuredClone(DEFAULT_DATA), ...JSON.parse(String(reader.result)) }; this.save(); }
      catch { alert('Este archivo de regalo no es válido.'); }
    };
    reader.readAsText(file);
  }

  @HostListener('document:keydown.escape') closeOverlays(): void { this.memoryOpen.set(null); this.hugOpen.set(false); }
  private compressImage(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader(); reader.onerror = reject;
      reader.onload = () => {
        const image = new Image(); image.onerror = reject;
        image.onload = () => {
          const scale = Math.min(1, 1400 / Math.max(image.width, image.height));
          const canvas = document.createElement('canvas'); canvas.width = Math.round(image.width * scale); canvas.height = Math.round(image.height * scale);
          canvas.getContext('2d')?.drawImage(image, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL('image/jpeg', 0.82));
        };
        image.src = String(reader.result);
      };
      reader.readAsDataURL(file);
    });
  }
}

function dataUrlFromFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = reject; reader.readAsDataURL(file); });
}
