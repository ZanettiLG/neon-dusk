/**
 * Deterministic family seeds (FNV-1a 32-bit, zero dependencies).
 *
 * Family generations must be reproducible: the same (familyId, memberId) pair
 * always maps to the same seed, so re-running a family regenerates identical
 * images without storing any seed state anywhere.
 */

/**
 * Hash a "familyId:memberId" pair into a stable sampler seed.
 *
 * @param {string} familyId seed family id (registry.seedFamilies[].id)
 * @param {string} memberId family member id
 * @returns {number} integer in [0, 2^31) — same range as the random plain-mode seed picker
 */
export function familySeed(familyId, memberId) {
  const input = `${familyId}:${memberId}`;
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0) % 2 ** 31; // mesmo range do random atual: [0, 2^31)
}
