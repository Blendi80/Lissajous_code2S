import * as Tone from "tone";
import { Midi } from "@tonejs/midi";

class Lissajous {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.center = {
      x: canvas.width / 2,
      y: canvas.height / 2,
    };
    // paramètres de base pour la première musique (etta.mid)
    this.motion_radiusX = canvas.width / 2.5;
    this.motion_radiusY = canvas.height / 3;
    this.freqX = 3; // fréquence X pour etta.mid
    this.freqY = 2; // fréquence Y pour etta.mid
    this.angleX = 0;
    this.angleY = 0;
    this.ball = { x: 0, y: 0, size: 15 };
    this.isMusicFinished = false;
    this.isTouching = false;
    this.lastTouchPosition = null;
    this.touchEnabled = false;
    this.trailOpacity = 1;
    this.trailColor = "#FF4D00";
    this.secondTrailColor = "#1cb78f";
    this.fadeDuration = 4000;
    this.currentMidiFile = "etta.mid";
    this.lastTapTime = 0;
    this.doubleTapDelay = 300;
    this.useCircles = false;
    this.permanentTrail = [];
    this.permanentTrailOpacity = 0.2;
    this.lines = [];
    this.trail = [];
    this.maxTrailLength = 100;

    // couleur de la balle et de la traînée
    this.ballColor = "black";
    this.possibleColors = ["#cbe3f6", "#ff4d00", "#fddc46", "#1cb78f"];

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

    // charger le fichier MIDI
    this.loadMidiFile();

    // animation frame pour les effets
    this.animationFrame = 0;
  }

  async loadMidiFile() {
    try {
      console.log("Chargement du fichier MIDI...");
      const response = await fetch(`/${this.currentMidiFile}`);
      const arrayBuffer = await response.arrayBuffer();

      // Réinitialiser l'état
      this.isMusicFinished = false;
      this.trail = [];
      this.visualMidiNotes = [];
      this.trailOpacity = 1;
      this.permanentTrail = [];

      // Réinitialiser la position de la balle au point de départ
      const t = 0;
      this.ball.x =
        this.center.x + Math.cos(t * this.freqX) * this.motion_radiusX;
      this.ball.y =
        this.center.y + Math.sin(t * this.freqY) * this.motion_radiusY;

      // Ajouter le point de départ au tracé permanent
      this.permanentTrail.push({ x: this.ball.x, y: this.ball.y });

      // Afficher le logo au début
      const logo = document.querySelector(".center-image");
      if (logo) {
        logo.style.display = "block";
      }

      // Analyser le fichier MIDI avec @tonejs/midi
      const midi = new Midi(arrayBuffer);
      console.log("Fichier MIDI chargé:", midi);

      // Extraire toutes les notes de toutes les pistes
      const notes = [];
      midi.tracks.forEach((track) => {
        if (track.notes && track.notes.length > 0) {
          notes.push(...track.notes);
        }
      });

      this.playMidiSequenceWithTimeout(notes);
    } catch (error) {
      console.error("Erreur lors du chargement du fichier MIDI:", error);
      this.generateRandomLines(50);
    }
  }

  playMidiSequenceWithTimeout(notes) {
    // cacher le logo
    const logo = document.querySelector(".center-image");
    if (logo) {
      logo.classList.add("hidden");
    }

    this.visualMidiNotes = [];
    this.TOTAL_TIME = Math.max(
      ...notes.map((note) => note.time + note.duration)
    );
    console.log("max time", this.TOTAL_TIME);
    const totalwidth = this.canvas.width;

    // trier les notes par temps
    notes.sort((a, b) => a.time - b.time);

    notes.forEach((note) => {
      const freq = Tone.Frequency(note.midi, "midi");
      const duration = note.duration;
      const velocity = note.velocity;
      const time = note.time;
      const timeout = time * 1000;

      // utiliser les fréquences spécifiques à chaque musique pour le positionnement des notes
      const t = (time / this.TOTAL_TIME) * Math.PI * 2;
      const x = this.center.x + Math.cos(t * this.freqX) * this.motion_radiusX;
      const y = this.center.y + Math.sin(t * this.freqY) * this.motion_radiusY;

      // ajouter des paramètres aléatoires pour l'effet de vague
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
        // paramètres pour la déformation du cercle
        circleDeformPoints: Math.floor(4 + Math.random() * 4),
        circleDeformAngles: Array.from(
          { length: 8 },
          () => Math.random() * Math.PI * 2
        ),
        circleDeformStrength: 0.2 + Math.random() * 0.3,
      };

      this.visualMidiNotes.push({
        x: x,
        y: y,
        midi: note.midi,
        freq: freq,
        duration: duration,
        velocity: velocity,
        triggered: false,
        time: time,
        visible: false,
        color: "#ffffff",
        waveParams: waveParams,
        lastPlayed: 0,
        playCount: 0,
      });
    });

    // démarrer la lecture
    this.startTime = new Date().getTime();
    Tone.start();
  }

  generateRandomLines(count) {
    const sections = count;
    const sectionSize = (Math.PI * 2) / sections;

    for (let i = 0; i < count; i++) {
      // position sur la courbe avec une petite variation aléatoire
      const baseT = i * sectionSize;
      const t = baseT + (Math.random() * 0.5 - 0.25) * sectionSize;

      const x = this.center.x + Math.cos(t * 3) * this.motion_radiusX;
      const y = this.center.y + Math.sin(t * 2) * this.motion_radiusY;

      const angle = Math.random() * Math.PI * 2;

      // longueur aléatoire du trait
      const length = 15 + Math.random() * 35;

      this.lines.push({
        x: x,
        y: y,
        angle: angle,
        length: length,
        triggered: false,
      });
    }
  }

  move() {
    if (this.startTime && this.TOTAL_TIME) {
      const currentTime = new Date().getTime();
      const percentage =
        (currentTime - this.startTime) / (this.TOTAL_TIME * 1000);
      const t = percentage * Math.PI * 2;

      // calculer la nouvelle position
      const newX =
        this.center.x + Math.cos(t * this.freqX) * this.motion_radiusX;
      const newY =
        this.center.y + Math.sin(t * this.freqY) * this.motion_radiusY;

      // vérifier si la position a changé significativement
      const dx = newX - this.ball.x;
      const dy = newY - this.ball.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      // ne mettre à jour la position que si le changement est significatif
      if (distance > 0.1) {
        this.ball.x = newX;
        this.ball.y = newY;

        // ajouter la position au tracé permanent pendant la première phase
        if (!this.isMusicFinished) {
          this.permanentTrail.push({ x: this.ball.x, y: this.ball.y });
        }
      }

      // mettre à jour la traînée avec effet de lueur
      if (!this.isMusicFinished) {
        // ajouter la position actuelle à la traînée
        this.trail.push({ x: this.ball.x, y: this.ball.y });

        // limiter la longueur de la traînée
        if (this.trail.length > this.maxTrailLength) {
          this.trail.shift();
        }
      }

      // rendre visible les notes exactement au moment où elles doivent être jouées
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

      // vérifier si la musique est terminée
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

      // gérer l'effet de fondu après la fin de la musique
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

  checkCollisions() {
    if (this.isMusicFinished) return;

    const ballRadius = this.ball.size / 2;
    const currentTime = Date.now();
    const minTimeBetweenPlays = 100;

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

            // ne jouer le son que si la note n'a pas déjà été jouée
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

    // vérifier les collisions avec les lignes existantes
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

  // nouvelle méthode pour gérer les interactions tactiles
  handleTouchStart(event) {
    const touch = event.touches[0];
    const currentTime = new Date().getTime();
    const tapLength = currentTime - this.lastTapTime;

    // vérifier si c'est un double-tap
    if (tapLength < this.doubleTapDelay && tapLength > 0) {
      // double-tap détecté, changer de musique
      this.switchMidiFile();
      this.lastTapTime = 0; // réinitialiser pour éviter les triples-taps
      return;
    }

    this.lastTapTime = currentTime;

    // permettre l'interaction tactile même si la musique n'est pas terminée
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

    // vérifier les collisions avec les notes
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

  switchMidiFile() {
    this.currentMidiFile =
      this.currentMidiFile === "etta.mid" ? "blind.mid" : "etta.mid";
    this.useCircles = this.currentMidiFile === "blind.mid";

    // effacer le tracé permanent
    this.permanentTrail = [];

    // changer la couleur du tracé selon la musique
    this.trailColor =
      this.currentMidiFile === "blind.mid" ? this.secondTrailColor : "#FF4D00";

    // changer les paramètres de la courbe selon la musique
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

    // réinitialiser la position de la balle au point de départ
    const t = 0;
    this.ball.x =
      this.center.x + Math.cos(t * this.freqX) * this.motion_radiusX;
    this.ball.y =
      this.center.y + Math.sin(t * this.freqY) * this.motion_radiusY;

    // ajouter le point de départ au tracé permanent
    this.permanentTrail.push({ x: this.ball.x, y: this.ball.y });

    console.log(
      `Changement vers le fichier MIDI: ${this.currentMidiFile}, useCircles: ${this.useCircles}`
    );
    this.loadMidiFile();
  }

  update() {
    this.move();
    this.draw();
    requestAnimationFrame(() => this.update());
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const canvas = document.getElementById("canvas");

  function resizeCanvas() {
    // obtenir les dimensions de l'écran
    const width = window.innerWidth;
    const height = window.innerHeight;

    // définir la taille du canvas
    canvas.width = width;
    canvas.height = height;

    // ajuster la taille du canvas pour les telephones
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    canvas.style.position = "fixed";
    canvas.style.top = "0";
    canvas.style.left = "0";

    // désactiver le zoom sur tél
    document.addEventListener(
      "touchmove",
      function (event) {
        if (event.scale !== 1) {
          event.preventDefault();
        }
      },
      { passive: false }
    );
  }

  // appeler resizeCanvas au chargement
  resizeCanvas();

  // réajuster lors du changement d'orientation
  window.addEventListener("resize", resizeCanvas);
  window.addEventListener("orientationchange", resizeCanvas);

  document.addEventListener("click", () => {
    const lissajous = new Lissajous(canvas);

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
