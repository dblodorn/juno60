// Saving a file from the page, and reading files the player picks. Browser-only.

export function download(text: string, filename: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** A .json file name from a patch's name. */
export const fileName = (name: string): string => (name.trim() || "JUNO-60").replace(/[^\w -]/g, "").replace(/\s+/g, "-") + ".json";
