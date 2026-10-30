// WHAT: Detects substantial repeated phrasing between a new and approved post.
// WHY: A single plain-language warning helps photographers keep venue stories distinct.
function shingles(value: string): Set<string> {
  const words = value.toLocaleLowerCase().match(/[a-z0-9]+/g) ?? [];
  const ignored = new Set(["about", "after", "again", "along", "around", "because", "before", "being", "between", "could", "every", "from", "have", "their", "there", "these", "this", "those", "through", "under", "until", "where", "which", "while", "with", "would", "your"]);
  const normalized = words.filter((word) => word.length > 2 && !ignored.has(word));
  const result = new Set<string>();
  for (let index = 0; index <= normalized.length - 5; index += 1) {
    result.add(normalized.slice(index, index + 5).join(" "));
  }
  return result;
}

export function resemblesApprovedWork(current: string, previous: string[]): boolean {
  const currentShingles = shingles(current);
  if (currentShingles.size < 3) return false;
  return previous.some((sample) => {
    const sampleShingles = shingles(sample);
    if (sampleShingles.size < 3) return false;
    let shared = 0;
    for (const shingle of currentShingles) {
      if (sampleShingles.has(shingle)) shared += 1;
    }
    return shared / (currentShingles.size + sampleShingles.size - shared) >= 0.18;
  });
}
