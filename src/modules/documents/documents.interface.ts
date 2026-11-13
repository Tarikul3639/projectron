// Describes safe metadata returned when inspecting a supported text document.
export interface DocumentInfo {
  path: string;
  format: string;
  bytes: number;
  characters: number;
  words: number;
  lines: number;
  modifiedAt: string;
}
