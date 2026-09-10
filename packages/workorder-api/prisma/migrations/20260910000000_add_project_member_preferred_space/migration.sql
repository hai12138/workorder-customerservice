-- AlterTable
ALTER TABLE "project_members" ADD COLUMN "preferred_space_id" TEXT;

-- AddForeignKey
ALTER TABLE "project_members" ADD CONSTRAINT "project_members_preferred_space_id_fkey" FOREIGN KEY ("preferred_space_id") REFERENCES "spaces"("id") ON DELETE SET NULL ON UPDATE CASCADE;
