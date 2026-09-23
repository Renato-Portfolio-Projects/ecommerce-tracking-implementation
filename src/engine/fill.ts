/**
 * Puts values into the blanks of a piece of text. A blank is a name in braces, like {product}. Every
 * blank must be given a value and every value must have a blank, so a typo on either side shows up
 * at once and not on a page.
 */
export function fill(template: string, values: Record<string, string | number> = {}): string {
  const blanks = [...template.matchAll(/\{(\w+)\}/g)].map((match) => match[1]);

  const missing = blanks.find((name) => !(name in values));
  if (missing !== undefined) throw new Error(`No value was given for {${missing}} in: ${template}`);

  const unused = Object.keys(values).find((name) => !blanks.includes(name));
  if (unused !== undefined) throw new Error(`There is no blank for {${unused}} in: ${template}`);

  return template.replace(/\{(\w+)\}/g, (_blank, name: string) => String(values[name]));
}
