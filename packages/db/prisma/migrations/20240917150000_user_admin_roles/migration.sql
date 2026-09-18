CREATE TYPE "UserRole_new" AS ENUM ('user', 'shop', 'superadmin', 'sales', 'marketing');

ALTER TABLE "User" ALTER COLUMN "role" DROP DEFAULT;

ALTER TABLE "User" ALTER COLUMN "role" TYPE "UserRole_new" USING (
  CASE
    WHEN role::text = 'admin' THEN 'superadmin'::"UserRole_new"
    WHEN role::text = 'member' THEN 'user'::"UserRole_new"
    ELSE 'user'::"UserRole_new"
  END
);

DROP TYPE "UserRole";
ALTER TYPE "UserRole_new" RENAME TO "UserRole";
ALTER TABLE "User" ALTER COLUMN "role" SET DEFAULT 'user';
