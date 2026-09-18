-- AlterTable
CREATE TYPE "UserRole" AS ENUM ('member', 'admin');
CREATE TYPE "BookCategory" AS ENUM ('fiction', 'mystery', 'scifi', 'biography', 'history', 'children', 'poetry', 'nonfiction', 'romance');

ALTER TABLE "User" ADD COLUMN "role" "UserRole" NOT NULL DEFAULT 'member';
ALTER TABLE "Book" ADD COLUMN "category" "BookCategory" NOT NULL DEFAULT 'fiction';

CREATE INDEX "Book_category_status_idx" ON "Book"("category", "status");
