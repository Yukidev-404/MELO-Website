import argon2 from 'argon2';

const password = process.argv[2];
if (!password) {
  console.error('Usage: npm run hash-password -- "your-admin-password"');
  process.exit(1);
}

const hash = await argon2.hash(password, {
  type: argon2.argon2id,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1
});

console.log(hash);
