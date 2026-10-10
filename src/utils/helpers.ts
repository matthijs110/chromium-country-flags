/** Normalizes a hostname by converting it to lowercase and removing a trailing dot. */
export const normalizeHostname = (hostname: string): string =>
  hostname.toLowerCase().replace(/\.$/, '');

type HostnameValidation = { valid: true; hostname: string } | { valid: false };

/** Validates a string as either a URL or a hostname and returns the normalized hostname if valid. */
export const isValidUrlOrHostname = (input: string): HostnameValidation => {
  try {
    const value = input.trim();

    if (!value || /\s/.test(value)) {
      return { valid: false };
    }

    // URL parsing normalizes internationalized domains and drops paths/ports.
    // Prefix a scheme for users who enter a bare hostname.
    const url = new URL(value.includes('://') ? value : `https://${value}`);
    const hostname = normalizeHostname(url.hostname);

    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
      return { valid: false };
    }

    const valid =
      hostname === 'localhost' ||
      /^\[[\da-f:]+\]$/i.test(hostname) ||
      (hostname.length <= 253 &&
        hostname.includes('.') &&
        hostname.split('.').every((label) => /^[a-z\d](?:[a-z\d-]{0,61}[a-z\d])?$/.test(label)));

    return valid ? { valid: true, hostname } : { valid: false };
  } catch {
    return { valid: false };
  }
};

/** Checks if a hostname matches a domain, considering subdomains. */
export const hostnameMatches = (hostname: string, domain: string): boolean => {
  const host = normalizeHostname(hostname);
  const normalizedDomain = normalizeHostname(domain);

  // The dot boundary excludes unrelated names such as notexample.com while
  // allowing an entry for example.com to cover sub.example.com.
  return host === normalizedDomain || host.endsWith(`.${normalizedDomain}`);
};

/** Generates a random ID using the crypto API. */
export const generateRandomId = (): string => crypto.randomUUID();
