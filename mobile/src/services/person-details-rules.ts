export type PersonDetails = {
  id: number;
  name: string;
  biography: string | null;
  birthday: string | null;
  knownFor: string[];
};

export function normalizePersonDetails(value: unknown, expectedId: number): PersonDetails | null {
  if (!value || typeof value !== 'object') return null;
  const person = value as Record<string, unknown>;
  if (person.id !== expectedId || typeof person.name !== 'string'
    || (person.biography !== null && typeof person.biography !== 'string')
    || (person.birthday !== null && typeof person.birthday !== 'string')
    || !Array.isArray(person.knownFor)
    || person.knownFor.some((item) => typeof item !== 'string')) return null;
  return {
    id: expectedId,
    name: person.name.trim(),
    biography: typeof person.biography === 'string' && person.biography.trim() ? person.biography.trim() : null,
    birthday: person.birthday as string | null,
    knownFor: person.knownFor.map((item) => item.trim()).filter(Boolean).slice(0, 5),
  };
}
