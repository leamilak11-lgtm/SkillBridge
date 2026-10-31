ALTER TABLE "users" ADD COLUMN "username" VARCHAR(40);
ALTER TABLE "users" ADD COLUMN "phone" VARCHAR(32);

UPDATE "users"
SET "username" = 'user_' || substring(replace("id"::text, '-', '') from 1 for 16),
    "phone" = NULL
WHERE "username" IS NULL OR "phone" IS NULL;

ALTER TABLE "users" ALTER COLUMN "username" SET NOT NULL;
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");
