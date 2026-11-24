// What the person can do about an API or network error, in the page's voice; used by SHARED.
import { ApiError } from "./environment";

export function problem(err: Error, doing: string, what = "PATCH"): string {
  const code = err instanceof ApiError ? err.code : "";
  if (code === "RATE_LIMITED") return "TOO MANY CHANGES. TRY AGAIN LATER.";
  if (code === "BAD_USER_INPUT") return err.message.toUpperCase();
  if (code === "FORBIDDEN") return `ONLY THE DEVICE THAT SAVED THIS ${what} CAN CHANGE IT.`;
  if (code === "NOT_FOUND") return `THAT ${what} IS GONE.`;
  return `COULD NOT ${doing}.`;
}
export const refusedName = (name: string) => `"${name}" ISN'T ALLOWED IN THE SHARED LIST. RENAME IT FIRST.`;
