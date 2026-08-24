import bcrypt from "bcryptjs";

const password = process.argv[2];

if (!password) {
  console.error('Uso: npm run generate-password-hash --workspace backend -- "sua-senha"');
  process.exit(1);
}

console.log(bcrypt.hashSync(password, 10));
