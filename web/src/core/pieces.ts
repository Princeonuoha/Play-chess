/* Original piece artwork (solid Staunton silhouettes, viewBox 0 0 45 45).
   Bold, weighty forms with a broad base — %RIM% marks (eye, bishop slit) take the
   piece's rim colour so they read on both black and white pieces. */
export const PIECE_PATHS: Record<string, string> = {
  p: '<circle cx="22.5" cy="12.5" r="5.1"/>' +
     '<path d="M16.4 31 L18.7 20.2 Q22.5 17 26.3 20.2 L28.6 31 Z"/>' +
     '<path d="M13.3 31 H31.7 L33.3 37 H11.7 Z"/>' +
     '<rect x="10" y="36.6" width="25" height="3.4" rx="1.5"/>',
  r: '<path d="M12 12.5 H16.2 V15.8 H19.6 V12.5 H25.4 V15.8 H28.8 V12.5 H33 V20.4 L30.4 23.4 H14.6 L12 20.4 Z"/>' +
     '<path d="M14.8 23.4 H30.2 L28.7 33 H16.3 Z"/>' +
     '<path d="M13 33 H32 L33.6 37 H11.4 Z"/>' +
     '<rect x="9.5" y="36.6" width="26" height="3.4" rx="1.5"/>',
  n: '<path d="M13.2 39.4 C12.4 31.6 14.7 26 19.6 22.1 C15.9 22.7 12.9 24.7 10.8 27.5 C10 24 12.2 19.9 16.4 17.2 C18.7 15.7 20.6 14.1 21.2 11.6 C21.4 10 20.7 8.5 19.4 7.6 C22.2 7 25.6 8.3 28.2 11.7 C31.7 16.3 32.8 22.9 32.8 31 V39.4 Z"/>' +
     '<circle cx="18.2" cy="15.6" r="1.2" fill="%RIM%"/>' +
     '<path d="M12 39 H33.4 L34.6 42.4 H10.8 Z"/>',
  b: '<circle cx="22.5" cy="7" r="2.4"/>' +
     '<path d="M22.5 8.8 C28.2 12 31.2 18 31.2 23.2 C31.2 28.1 27.3 31.4 22.5 31.4 C17.7 31.4 13.8 28.1 13.8 23.2 C13.8 18 16.8 12 22.5 8.8 Z"/>' +
     '<path d="M19.5 15 H25.5 L22.5 20.4 Z" fill="%RIM%"/>' +
     '<path d="M14.6 31.4 H30.4 L31.9 36 H13.1 Z"/>' +
     '<rect x="10.6" y="36" width="23.8" height="3.4" rx="1.5"/>',
  q: '<circle cx="9.3" cy="14.4" r="2.2"/><circle cx="16.3" cy="11.1" r="2.2"/><circle cx="22.5" cy="9.8" r="2.3"/><circle cx="28.7" cy="11.1" r="2.2"/><circle cx="35.7" cy="14.4" r="2.2"/>' +
     '<path d="M9.3 15.4 L12.7 28.4 H32.3 L35.7 15.4 L29.7 21.6 L26 12.4 L22.5 21.2 L19 12.4 L15.3 21.6 Z"/>' +
     '<path d="M12.7 28.4 H32.3 L30.7 34.2 H14.3 Z"/>' +
     '<path d="M12.2 34.2 H32.8 L34.4 38.4 H10.6 Z"/>' +
     '<rect x="9" y="38.4" width="27" height="3.4" rx="1.5"/>',
  k: '<rect x="20.9" y="2.6" width="3.2" height="10.2" rx="1"/>' +
     '<rect x="17.7" y="5.8" width="9.6" height="3.2" rx="1"/>' +
     '<path d="M12.8 21 C12.8 15.2 17.4 11.6 22.5 11.6 C27.6 11.6 32.2 15.2 32.2 21 C32.2 24.4 30.5 27.3 27.8 29.3 L29.6 34.4 H15.4 L17.2 29.3 C14.5 27.3 12.8 24.4 12.8 21 Z"/>' +
     '<path d="M12.2 34.4 H32.8 L34.4 38.4 H10.6 Z"/>' +
     '<rect x="9" y="38.4" width="27" height="3.4" rx="1.5"/>'
};

export function pieceSVG(type: string, color: string): string {
  // chess.com-style solid black / white pieces with a subtle defining rim.
  const fill = color === 'w' ? '#f7f6ef' : '#26241f';
  const rim = color === 'w' ? '#3a3934' : '#a7ab9d';
  const paths = PIECE_PATHS[type].replaceAll('%RIM%', rim);
  return `<svg viewBox="0 0 45 45" aria-hidden="true"><g fill="${fill}" stroke="${rim}" stroke-width="1.5" stroke-linejoin="round">${paths}</g></svg>`;
}
