import * as Tone from "tone";
import { Midi } from "@tonejs/midi";

// Classe principale pour gérer l'animation et la musique
class Lissajous {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");

    // Centre et paramètres du mouvement
    this.center = {
      x: canvas.width / 2,
      y: canvas.height / 2,
    };
    this.motion_radiusX = canvas.width / 2.5;
    this.motion_radiusY = canvas.height / 3;
    this.freqX = 3;
    this.freqY = 2;

    // Balle animée
    this.ball = { x: 0, y: 0, size: 15 };
    this.isMusicFinished = false;
    this.trailOpacity = 1;
    this.trailColor = "#FF4D00";
    this.secondTrailColor = "#1cb78f";
    this.fadeDuration = 4000;
    this.currentMidiFile = "etta.mid";
    this.doubleTapDelay = 300;
    this.useCircles = false;
    this.permanentTrail = [];
    this.permanentTrailOpacity = 0.2;
    this.lines = [];
    this.trail = [];
    this.maxTrailLength = 100;
    this.ballColor = "black";
    this.possibleColors = ["#cbe3f6", "#ff4d00", "#fddc46", "#1cb78f"];
    this.lastTapTime = 0;
    this.isTouching = false;
    this.lastTouchPosition = null;

    // initialiser l'instrument
    this.synth = new Tone.Sampler({
      urls: {
        C4: "C4.mp3",
        "D#4": "Ds4.mp3",
        "F#4": "Fs4.mp3",
        A4: "A4.mp3",
      },
      baseUrl: "https://tonejs.github.io/audio/salamander/",
      onload: () => {
        console.log("Samples chargés");
      },
    }).toDestination();

    // Chargement du fichier MIDI initial
    this.loadMidiFile();
    this.animationFrame = 0;
  }

  async loadMidiFile() {
    try {
      const response = await fetch(`/${this.currentMidiFile}`);
      const arrayBuffer = await response.arrayBuffer();
      this.isMusicFinished = false;
      this.trail = [];
      this.visualMidiNotes = [];
      this.trailOpacity = 1;
      this.permanentTrail = [];
      // Positionne la balle au début
      const t = 0;
      this.ball.x =
        this.center.x + Math.cos(t * this.freqX) * this.motion_radiusX;
      this.ball.y =
        this.center.y + Math.sin(t * this.freqY) * this.motion_radiusY;
      this.permanentTrail.push({ x: this.ball.x, y: this.ball.y });
      // Affiche le logo si présent
      const logo = document.querySelector(".center-image");
      if (logo) logo.style.display = "block";
      // Parse le MIDI
      const midi = new Midi(arrayBuffer);
      const notes = [];
      midi.tracks.forEach((track) => {
        if (track.notes && track.notes.length > 0) notes.push(...track.notes);
      });
      this.playMidiSequenceWithTimeout(notes);
    } catch (error) {
      console.error("Erreur lors du chargement du fichier MIDI:", error);
      // Si erreur, génère des lignes aléatoires pour l'affichage
      this.generateRandomLines(50);
    }
  }

  // --- Prépare les notes MIDI pour l'animation et le son ---
  playMidiSequenceWithTimeout(notes) {
    const logo = document.querySelector(".center-image");
    if (logo) logo.classList.add("hidden");
    this.visualMidiNotes = [];
    // Calcule la durée totale de la séquence
    this.TOTAL_TIME = Math.max(
      ...notes.map((note) => note.time + note.duration)
    );
    notes.sort((a, b) => a.time - b.time);
    notes.forEach((note) => {
      const freq = Tone.Frequency(note.midi, "midi");
      const t = (note.time / this.TOTAL_TIME) * Math.PI * 2;
      const x = this.center.x + Math.cos(t * this.freqX) * this.motion_radiusX;
      const y = this.center.y + Math.sin(t * this.freqY) * this.motion_radiusY;
      // Paramètres pour les effets visuels
      const waveParams = {
        phase1: Math.random() * Math.PI * 2,
        phase2: Math.random() * Math.PI * 2,
        phase3: Math.random() * Math.PI * 2,
        freq1: 0.05 + Math.random() * 0.1,
        freq2: 0.1 + Math.random() * 0.15,
        freq3: 0.15 + Math.random() * 0.2,
        amp1: 15 + Math.random() * 10,
        amp2: 5 + Math.random() * 8,
        amp3: 2 + Math.random() * 5,
        circleDeformPoints: Math.floor(4 + Math.random() * 4),
        circleDeformAngles: Array.from(
          { length: 8 },
          () => Math.random() * Math.PI * 2
        ),
        circleDeformStrength: 0.2 + Math.random() * 0.3,
      };
      this.visualMidiNotes.push({
        x,
        y,
        midi: note.midi,
        freq,
        duration: note.duration,
        velocity: note.velocity,
        triggered: false,
        time: note.time,
        visible: false,
        color: "#ffffff",
        waveParams,
        lastPlayed: 0,
        playCount: 0,
      });
    });
    this.startTime = new Date().getTime();
    Tone.start(); // Nécessaire pour activer l'audio après interaction utilisateur
  }

  // --- Génère des lignes aléatoires si pas de MIDI ---
  generateRandomLines(count) {
    const sections = count;
    const sectionSize = (Math.PI * 2) / sections;
    for (let i = 0; i < count; i++) {
      const baseT = i * sectionSize;
      const t = baseT + (Math.random() * 0.5 - 0.25) * sectionSize;
      const x = this.center.x + Math.cos(t * 3) * this.motion_radiusX;
      const y = this.center.y + Math.sin(t * 2) * this.motion_radiusY;
      const angle = Math.random() * Math.PI * 2;
      const length = 15 + Math.random() * 35;
      this.lines.push({ x, y, angle, length, triggered: false });
    }
  }

  // --- Animation principale : mouvement de la balle, gestion des notes, fondu ---
  move() {
    if (this.startTime && this.TOTAL_TIME) {
      const currentTime = new Date().getTime();
      const percentage =
        (currentTime - this.startTime) / (this.TOTAL_TIME * 1000);
      const t = percentage * Math.PI * 2;
      const newX =
        this.center.x + Math.cos(t * this.freqX) * this.motion_radiusX;
      const newY =
        this.center.y + Math.sin(t * this.freqY) * this.motion_radiusY;
      const dx = newX - this.ball.x;
      const dy = newY - this.ball.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      if (distance > 0.1) {
        this.ball.x = newX;
        this.ball.y = newY;
        if (!this.isMusicFinished) {
          this.permanentTrail.push({ x: this.ball.x, y: this.ball.y });
        }
      }
      // Ajoute la position actuelle à la traînée
      if (!this.isMusicFinished) {
        this.trail.push({ x: this.ball.x, y: this.ball.y });
        if (this.trail.length > this.maxTrailLength) this.trail.shift();
      }
      // Active les notes à jouer selon le temps
      if (this.visualMidiNotes) {
        this.visualMidiNotes.forEach((note) => {
          const noteTime = note.time / this.TOTAL_TIME;
          const timeUntilNote = noteTime - percentage;
          if (timeUntilNote <= 0 && !note.visible) {
            note.visible = true;
            note.opacity = 1;
          }
        });
      }
      // Déclenche le fondu à la fin de la séquence
      if (percentage >= 1 && !this.isMusicFinished) {
        this.isMusicFinished = true;
        this.fadeStartTime = Date.now();
        if (this.visualMidiNotes) {
          this.visualMidiNotes.forEach((note) => {
            note.triggered = false;
            note.fadeStartTime = Date.now();
          });
        }
      }
      // Gère le fondu visuel des notes et de la traînée
      if (this.isMusicFinished && this.fadeStartTime) {
        const timeSinceFade = Date.now() - this.fadeStartTime;
        const fadeProgress = Math.min(1, timeSinceFade / this.fadeDuration);
        const easedProgress = 1 - Math.pow(1 - fadeProgress, 3);
        this.trailOpacity = Math.max(0, 1 - easedProgress);
        if (this.visualMidiNotes) {
          this.visualMidiNotes.forEach((note) => {
            note.opacity = Math.max(0, 1 - easedProgress);
          });
        }
      }
      this.checkCollisions();
    }
  }

  // --- Détection des collisions entre la balle et les notes/lignes ---
  checkCollisions() {
    if (this.isMusicFinished) return;
    const ballRadius = this.ball.size / 2;
    const currentTime = Date.now();
    const minTimeBetweenPlays = 100;
    // Collision avec les notes MIDI
    if (this.visualMidiNotes) {
      this.visualMidiNotes.forEach((note) => {
        const dx = this.ball.x - note.x;
        const dy = this.ball.y - note.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance < ballRadius + 5 && !note.triggered && note.visible) {
          if (currentTime - note.lastPlayed > minTimeBetweenPlays) {
            note.triggered = true;
            note.hitTime = currentTime;
            note.lastPlayed = currentTime;
            note.playCount++;
            note.color =
              this.possibleColors[
                Math.floor(Math.random() * this.possibleColors.length)
              ];
            if (note.playCount === 1) {
              this.synth.triggerAttackRelease(
                note.freq,
                note.duration,
                undefined,
                note.velocity
              );
            }
            setTimeout(() => {
              note.triggered = false;
            }, 1000);
          }
        }
      });
    }
    // Collision avec les lignes aléatoires (si générées)
    this.lines.forEach((line) => {
      const dx = this.ball.x - line.x;
      const dy = this.ball.y - line.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      if (distance < ballRadius + line.length / 2 && !line.triggered) {
        line.triggered = true;
        line.hitTime = currentTime;
        line.color =
          this.possibleColors[
            Math.floor(Math.random() * this.possibleColors.length)
          ];
        if (line.note && !line.hasPlayed) {
          const freq = Tone.Frequency(line.note.midi, "midi");
          this.synth.triggerAttackRelease(
            freq,
            line.note.duration,
            undefined,
            line.note.velocity
          );
          line.hasPlayed = true;
        }
        setTimeout(() => {
          line.triggered = false;
        }, 1000);
      }
    });
  }

  // --- Dessin principal (trails, notes, effets) ---
  draw() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.animationFrame++;
    // dessiner le tracé permanent en premier (toujours visible)
    if (this.permanentTrail.length > 1) {
      this.ctx.beginPath();
      this.ctx.strokeStyle = this.trailColor;
      this.ctx.globalAlpha = this.permanentTrailOpacity;
      this.ctx.lineWidth = 1;
      this.ctx.lineCap = "round";
      this.ctx.lineJoin = "round";

      this.ctx.moveTo(this.permanentTrail[0].x, this.permanentTrail[0].y);
      for (let i = 1; i < this.permanentTrail.length; i++) {
        this.ctx.lineTo(this.permanentTrail[i].x, this.permanentTrail[i].y);
      }
      this.ctx.stroke();
    }

    // dessiner la traînée avec effet de lueur (disparaît progressivement)
    if (this.trail.length > 1 && !this.isMusicFinished) {
      // effet de lueur
      for (let i = 0; i < this.trail.length - 1; i++) {
        const start = this.trail[i];
        const end = this.trail[i + 1];
        const progress = i / (this.trail.length - 1);
        const opacity = (0.1 + progress * 0.9) * this.trailOpacity;

        // dessiner plusieurs fois le trait avec des largeurs et opacités différentes pour l'effet de lueur
        for (let j = 0; j < 3; j++) {
          const glowWidth = (2 + progress * 3) * (3 - j);
          const glowOpacity = opacity * (0.3 - j * 0.1);

          this.ctx.beginPath();
          this.ctx.strokeStyle = this.trailColor;
          this.ctx.globalAlpha = glowOpacity;
          this.ctx.lineWidth = glowWidth;
          this.ctx.lineCap = "round";
          this.ctx.lineJoin = "round";
          this.ctx.moveTo(start.x, start.y);
          this.ctx.lineTo(end.x, end.y);
          this.ctx.stroke();
        }

        // ajouter un point lumineux à la fin du tracé
        if (i === this.trail.length - 2) {
          const endPoint = this.trail[this.trail.length - 1];
          const gradient = this.ctx.createRadialGradient(
            endPoint.x,
            endPoint.y,
            0,
            endPoint.x,
            endPoint.y,
            15
          );
          gradient.addColorStop(0, `rgba(255, 77, 0, ${opacity * 0.8})`);
          gradient.addColorStop(1, "rgba(255, 77, 0, 0)");

          this.ctx.beginPath();
          this.ctx.fillStyle = gradient;
          this.ctx.arc(endPoint.x, endPoint.y, 15, 0, Math.PI * 2);
          this.ctx.fill();
        }
      }

      this.ctx.globalAlpha = 1;
    }

    // dessine les notes
    if (this.visualMidiNotes) {
      this.visualMidiNotes.forEach((note) => {
        if (note.visible) {
          // calculer l'opacité pour l'effet de fondu uniquement après la première lecture
          if (this.isMusicFinished) {
            if (note.fadeStartTime) {
              const timeSinceFade = Date.now() - note.fadeStartTime;
              const fadeProgress = Math.min(
                1,
                timeSinceFade / this.fadeDuration
              );
              const easedProgress = 1 - Math.pow(1 - fadeProgress, 3);
              note.opacity = Math.max(0, 1 - easedProgress);
            }
          }

          // dessiner la note si elle est visible (opacité > 0)
          if (note.opacity > 0) {
            this.ctx.beginPath();
            const size = note.midi * (this.useCircles ? 0.4 : 1.5);

            this.ctx.strokeStyle = note.color;
            this.ctx.globalAlpha = note.opacity;
            this.ctx.lineWidth = this.useCircles ? 8 : 8; // Réduction de l'épaisseur pour les cercles

            if (this.useCircles) {
              // calculer l'effet d'agrandissement et de déformation si la note est déclenchée
              let currentSize = size;
              let deformations = [];

              if (note.triggered) {
                const timeSinceHit = Date.now() - note.hitTime;
                if (timeSinceHit < 1000) {
                  const intensity = 1 - timeSinceHit / 1000;
                  currentSize = size * (1 + intensity * 0.3);

                  // calculer les déformations pour chaque point du cercle
                  const segments = 32;
                  for (let i = 0; i < segments; i++) {
                    const angle = (i / segments) * Math.PI * 2;
                    let deformation = 0;

                    for (
                      let j = 0;
                      j < note.waveParams.circleDeformPoints;
                      j++
                    ) {
                      const deformAngle = note.waveParams.circleDeformAngles[j];
                      const angleDiff = Math.abs(angle - deformAngle);
                      if (angleDiff < Math.PI / 3) {
                        // zone d'influence plus large
                        // utiliser une fonction plus douce pour la déformation
                        const deformIntensity =
                          Math.pow(Math.cos(angleDiff * 1.5), 2) * intensity;
                        deformation +=
                          Math.sin(this.animationFrame * 0.15 + j) *
                          note.waveParams.circleDeformStrength *
                          currentSize *
                          deformIntensity;
                      }
                    }
                    deformations.push(deformation);
                  }
                }
              }

              // dessiner le cercle avec déformation
              this.ctx.beginPath();
              const segments = 32;
              for (let i = 0; i <= segments; i++) {
                const angle = (i / segments) * Math.PI * 2;
                const radius = currentSize + (deformations[i % segments] || 0);
                const x = note.x + Math.cos(angle) * radius;
                const y = note.y + Math.sin(angle) * radius;

                if (i === 0) {
                  this.ctx.moveTo(x, y);
                } else {
                  this.ctx.lineTo(x, y);
                }
              }
              this.ctx.closePath();
              this.ctx.stroke();

              // ajouter un effet de lueur au cercle si la note est déclenchée
              if (note.triggered) {
                const timeSinceHit = Date.now() - note.hitTime;
                if (timeSinceHit < 1000) {
                  const intensity = 1 - timeSinceHit / 1000;
                  const glowRadius = currentSize * (1 + intensity * 0.2);

                  this.ctx.beginPath();
                  this.ctx.strokeStyle = note.color;
                  this.ctx.globalAlpha = note.opacity * 0.5 * intensity;
                  this.ctx.lineWidth = 6; // augmentation de l'épaisseur de la lueur
                  this.ctx.arc(note.x, note.y, glowRadius, 0, Math.PI * 2);
                  this.ctx.stroke();
                }
              }
            } else {
              // effet de vague pour les traits
              const segments = 15; // augmentation du nombre de segments pour plus de détail
              const segmentLength = size / segments;

              this.ctx.beginPath();
              this.ctx.lineCap = "butt"; // extrémités droites
              this.ctx.lineJoin = "miter"; // jointures pointues

              // point de départ
              let startY = note.y - size / 2;
              this.ctx.moveTo(note.x, startY);

              // dessiner chaque segment avec un effet de vague complexe
              for (let i = 0; i < segments; i++) {
                const segmentStartY = startY + i * segmentLength;
                const segmentEndY = segmentStartY + segmentLength;

                let waveOffset = 0;
                if (note.triggered) {
                  const timeSinceHit = Date.now() - note.hitTime;
                  if (timeSinceHit < 1000) {
                    const intensity = 1 - timeSinceHit / 1000;

                    // utiliser les paramètres aléatoires uniques pour chaque trait
                    const wavePhase1 =
                      (i / segments) * Math.PI * 2 +
                      this.animationFrame * note.waveParams.freq1 +
                      note.waveParams.phase1;
                    const wavePhase2 =
                      (i / segments) * Math.PI * 4 +
                      this.animationFrame * note.waveParams.freq2 +
                      note.waveParams.phase2;
                    const wavePhase3 =
                      (i / segments) * Math.PI * 6 +
                      this.animationFrame * note.waveParams.freq3 +
                      note.waveParams.phase3;

                    // combiner plusieurs ondes avec des amplitudes différentes
                    const wave1 =
                      Math.sin(wavePhase1) * note.waveParams.amp1 * intensity;
                    const wave2 =
                      Math.sin(wavePhase2) * note.waveParams.amp2 * intensity;
                    const wave3 =
                      Math.sin(wavePhase3) * note.waveParams.amp3 * intensity;

                    // ajouter une variation d'amplitude basée sur la position
                    const positionFactor =
                      Math.sin((i / segments) * Math.PI) * 0.5 + 0.5;
                    waveOffset = (wave1 + wave2 + wave3) * positionFactor;
                  }
                }

                // dessiner le segment avec l'effet de vague
                this.ctx.lineTo(note.x + waveOffset, segmentEndY);
              }

              this.ctx.stroke();

              // ajouter un effet de lueur si la note est déclenchée
              if (note.triggered) {
                const timeSinceHit = Date.now() - note.hitTime;
                if (timeSinceHit < 1000) {
                  const intensity = 1 - timeSinceHit / 1000;
                  this.ctx.beginPath();
                  this.ctx.strokeStyle = note.color;
                  this.ctx.globalAlpha = note.opacity * 0.3 * intensity;
                  this.ctx.lineWidth = 12;
                  this.ctx.stroke();
                }
              }
            }
          }
        }
      });
      this.ctx.globalAlpha = 1;
    }
  }

  // --- Gestion du tactile pour mobile/tablette ---
  handleTouchStart(event) {
    const touch = event.touches[0];
    const currentTime = new Date().getTime();
    const tapLength = currentTime - this.lastTapTime;
    if (tapLength < this.doubleTapDelay && tapLength > 0) {
      this.switchMidiFile();
      this.lastTapTime = 0;
      return;
    }
    this.lastTapTime = currentTime;
    this.isTouching = true;
    const rect = this.canvas.getBoundingClientRect();
    this.lastTouchPosition = {
      x: touch.clientX - rect.left,
      y: touch.clientY - rect.top,
    };
  }

  handleTouchMove(event) {
    if (!this.isTouching) return;
    const touch = event.touches[0];
    const rect = this.canvas.getBoundingClientRect();
    const currentPosition = {
      x: touch.clientX - rect.left,
      y: touch.clientY - rect.top,
    };
    // Déclenche les notes si on touche près d'une note visible
    if (this.visualMidiNotes) {
      this.visualMidiNotes.forEach((note) => {
        if (note.visible) {
          const dx = currentPosition.x - note.x;
          const dy = currentPosition.y - note.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          if (distance < 20 && !note.triggered) {
            note.triggered = true;
            note.hitTime = Date.now();
            note.color =
              this.possibleColors[
                Math.floor(Math.random() * this.possibleColors.length)
              ];
            note.opacity = 1;
            note.fadeStartTime = Date.now();
            this.synth.triggerAttackRelease(
              note.freq,
              note.duration,
              undefined,
              note.velocity
            );
            setTimeout(() => {
              note.triggered = false;
            }, 1000);
          }
        }
      });
    }
    this.lastTouchPosition = currentPosition;
  }

  handleTouchEnd() {
    this.isTouching = false;
    this.lastTouchPosition = null;
  }

  // --- Permet de changer de fichier MIDI (double tap) ---
  switchMidiFile() {
    this.currentMidiFile =
      this.currentMidiFile === "etta.mid" ? "blind.mid" : "etta.mid";
    this.useCircles = this.currentMidiFile === "blind.mid";
    this.permanentTrail = [];
    this.trailColor =
      this.currentMidiFile === "blind.mid" ? this.secondTrailColor : "#FF4D00";
    if (this.currentMidiFile === "blind.mid") {
      this.motion_radiusX = this.canvas.width / 3;
      this.motion_radiusY = this.canvas.height / 2.5;
      this.freqX = 5;
      this.freqY = 3;
    } else {
      this.motion_radiusX = this.canvas.width / 2.5;
      this.motion_radiusY = this.canvas.height / 3;
      this.freqX = 3;
      this.freqY = 2;
    }
    // Repositionne la balle au début
    const t = 0;
    this.ball.x =
      this.center.x + Math.cos(t * this.freqX) * this.motion_radiusX;
    this.ball.y =
      this.center.y + Math.sin(t * this.freqY) * this.motion_radiusY;
    this.permanentTrail.push({ x: this.ball.x, y: this.ball.y });
    this.loadMidiFile();
  }

  // --- Boucle principale d'animation ---
  update() {
    this.move();
    this.draw();
    requestAnimationFrame(() => this.update());
  }
}

// --- Initialisation de l'application au chargement de la page ---
document.addEventListener("DOMContentLoaded", () => {
  const canvas = document.getElementById("canvas");

  // Fonction pour adapter le canvas à la taille de la fenêtre
  function resizeCanvas() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    canvas.width = width;
    canvas.height = height;
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    canvas.style.position = "fixed";
    canvas.style.top = "0";
    canvas.style.left = "0";
    // Empêche le zoom sur mobile/tablette
    document.addEventListener(
      "touchmove",
      function (event) {
        if (event.scale !== 1) event.preventDefault();
      },
      { passive: false }
    );
  }
  resizeCanvas();
  window.addEventListener("resize", resizeCanvas);
  window.addEventListener("orientationchange", resizeCanvas);

  // Création de l'instance Lissajous et gestion des événements
  document.addEventListener("click", () => {
    const lissajous = new Lissajous(canvas);
    // Gestion du tactile
    canvas.addEventListener("touchstart", (e) => {
      e.preventDefault();
      lissajous.handleTouchStart(e);
    });
    canvas.addEventListener("touchmove", (e) => {
      e.preventDefault();
      lissajous.handleTouchMove(e);
    });
    canvas.addEventListener("touchend", (e) => {
      e.preventDefault();
      lissajous.handleTouchEnd();
    });
    lissajous.update();
  });
});
