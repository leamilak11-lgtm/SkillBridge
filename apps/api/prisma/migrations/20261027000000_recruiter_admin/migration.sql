ALTER TABLE "companies"
ADD COLUMN "isApproved" BOOLEAN NOT NULL DEFAULT false;

UPDATE "companies"
SET "isApproved" = true
WHERE "isDemo" = true;

CREATE INDEX "companies_isApproved_isSuspended_name_idx"
ON "companies"("isApproved", "isSuspended", "name");
