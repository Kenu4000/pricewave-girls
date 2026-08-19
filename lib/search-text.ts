export function normalizeSearchText(value: string): string {
  return value.normalize("NFKC").toLocaleLowerCase("ja");
}

export function includesSearchText(value: string, query: string): boolean {
  const normalizedQuery = normalizeSearchText(query.trim());
  return normalizedQuery.length === 0 || normalizeSearchText(value).includes(normalizedQuery);
}
