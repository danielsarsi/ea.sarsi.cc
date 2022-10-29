export function capitalize(value: string): string {
  return value
    .split(" ")
    .map(
      (word) => `${word[0]?.toUpperCase()}${word.substring(1).toLowerCase()}`
    )
    .join(" ");
}

export function parsePercentage(value: string): number {
  return parseFloat(value.replace(",", "."));
}

export const dateTimeFormat = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "medium",
});

export const numberFormat = new Intl.NumberFormat("pt-BR");
