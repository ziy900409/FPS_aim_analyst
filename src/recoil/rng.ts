export type Rng = () => number;

const IA = 16807;
const IM = 2147483647;
const AM = 1.0 / IM;
const IQ = 127773;
const IR = 2836;
const NTAB = 32;
const NDIV = 1 + Math.floor((IM - 1) / NTAB);
const EPS = 1.2e-7;
const RNMX = 1.0 - EPS;

export function createRan1(seed: number): Rng {
  if (!Number.isFinite(seed)) {
    throw new Error('ran1 seed must be finite');
  }

  let idum = -Math.max(1, Math.abs(Math.trunc(seed)));
  let iy = 0;
  const iv = new Array<number>(NTAB).fill(0);

  return () => {
    if (idum <= 0 || iy === 0) {
      idum = -idum < 1 ? 1 : -idum;
      for (let j = NTAB + 7; j >= 0; j--) {
        const k = Math.floor(idum / IQ);
        idum = IA * (idum - k * IQ) - IR * k;
        if (idum < 0) idum += IM;
        if (j < NTAB) iv[j] = idum;
      }
      iy = iv[0];
    }

    const k = Math.floor(idum / IQ);
    idum = IA * (idum - k * IQ) - IR * k;
    if (idum < 0) idum += IM;
    const j = Math.floor(iy / NDIV);
    iy = iv[j];
    iv[j] = idum;

    const temp = AM * iy;
    return temp > RNMX ? RNMX : temp;
  };
}

export function randomFloat(rng: Rng, minInclusive: number, maxExclusive: number): number {
  return minInclusive + rng() * (maxExclusive - minInclusive);
}
