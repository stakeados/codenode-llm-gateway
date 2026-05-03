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

    // Parse primary env var (comma-separated)
    const primary = process.env[envVarName];
    if (primary) {
      this.keys.push(...primary.split(',').map(k => k.trim()).filter(Boolean));
    }

    // Scan for numbered variants: GROQ_API_KEY_1 .. GROQ_API_KEY_10
    for (let i = 1; i <= 10; i++) {
      const numbered = process.env[`${envVarName}_${i}`];
      if (numbered && !this.keys.includes(numbered.trim())) {
        this.keys.push(numbered.trim());
      }
    }

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
