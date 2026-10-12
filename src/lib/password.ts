import { randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from "node:crypto";

// Hash de senha com scrypt, que já vem no Node (D-24): sem binário nativo e
// sem dependência nova. A senha NUNCA é guardada — só o resultado do hash.
//
// Formato guardado: scrypt$N$r$p$<sal base64>$<hash base64>
// Os parâmetros vão junto, então dá para endurecer no futuro sem quebrar as
// senhas antigas (a verificação usa os parâmetros de cada hash).

const PARAMS = { N: 2 ** 15, r: 8, p: 1 }; // ~32 MB de memória por hash
const KEY_LENGTH = 64;
const SALT_BYTES = 16;
const MAX_MEMORY = 64 * 1024 * 1024;

function derive(
  password: string,
  salt: Buffer,
  keyLength: number,
  options: ScryptOptions,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password.normalize("NFKC"), salt, keyLength, options, (error, key) =>
      error ? reject(error) : resolve(key),
    );
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_BYTES);
  const key = await derive(password, salt, KEY_LENGTH, { ...PARAMS, maxmem: MAX_MEMORY });
  return [
    "scrypt",
    PARAMS.N,
    PARAMS.r,
    PARAMS.p,
    salt.toString("base64"),
    key.toString("base64"),
  ].join("$");
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, n, r, p, saltB64, keyB64] = stored.split("$");
  if (scheme !== "scrypt" || !saltB64 || !keyB64) return false;

  const expected = Buffer.from(keyB64, "base64");
  const actual = await derive(password, Buffer.from(saltB64, "base64"), expected.length, {
    N: Number(n),
    r: Number(r),
    p: Number(p),
    maxmem: MAX_MEMORY,
  });

  // comparação em tempo constante (não vaza, pelo tempo, quantos bytes batem)
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

// Hash "de mentira" usado quando o e-mail não existe: o login demora o mesmo
// tempo com ou sem conta, e o tempo de resposta não revela quem é cliente.
let dummyHash: Promise<string> | null = null;
export function getDummyHash(): Promise<string> {
  dummyHash ??= hashPassword(randomBytes(16).toString("hex"));
  return dummyHash;
}
