/**
 * Manages rotation through multiple API keys for a single provider.
 * Supports:
 *   - Comma-separated keys: GROQ_API_KEY=key1,key2,key3
 *   - Numbered env vars:    GROQ_API_KEY_1=key1  GROQ_API_KEY_2=key2
 *   - Both combined
 */
export class KeyRotator {
  private keys: string[];
  private index: number = 0;
  readonly provider: string;

  constructor(envVarName: string, provider: string) {
    this.provider = provider;
    this.keys = [];

    // Numbered variables have no arbitrary upper bound. Deduplicate all entries.
    const variables = [envVarName, ...Object.keys(process.env)
      .filter(name => name.startsWith(`${envVarName}_`) && /^\d+$/.test(name.slice(envVarName.length + 1)))
      .sort((a, b) => Number(a.slice(envVarName.length + 1)) - Number(b.slice(envVarName.length + 1)))];
    this.keys = [...new Set(variables.flatMap(name =>
      (process.env[name] || '').split(',').map(key => key.trim()).filter(Boolean)))];

    if (this.keys.length > 1) {
      console.log(`[KeyRotator] ${provider}: ${this.keys.length} keys loaded for rotation 🔑`);
    }
  }

  get hasKeys(): boolean { return this.keys.length > 0; }
  get count(): number { return this.keys.length; }

  next(): string {
    if (this.keys.length === 0) throw new Error(`No API keys configured for ${this.provider}`);
    const key = this.keys[this.index % this.keys.length]!;
    this.index = (this.index + 1) % this.keys.length;
    return key;
  }

  all(): string[] { return [...this.keys]; }
}
