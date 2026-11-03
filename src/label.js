// Riconoscimento etichetta, usato da main.js.
//  - parseLabel(testoOCR): dal testo letto con ML Kit a nome, produttore, annata, tipo (gratis, sul telefono)
//  - identifyLabel(fotoDataUrl): lettura con l'IA di Claude (richiede la chiave API; se non legge nulla genera un errore e main.js ripiega sull'OCR)
export { parseLabel } from './parse.js';
export { identifyLabelAI as identifyLabel } from './ai.js';
