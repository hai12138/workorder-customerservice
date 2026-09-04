-- CreateEnum
CREATE TYPE "SpaceType" AS ENUM ('BUILDING', 'FLOOR', 'ROOM', 'PUBLIC', 'PARKING');

-- CreateEnum
CREATE TYPE "SpaceStatus" AS ENUM ('AVAILABLE', 'DISABLED');

-- Data migration: Update existing type values to match enum
UPDATE "spaces" SET "type" = 'BUILDING' WHERE "type" IN ('楼栋', 'BUILDING');
UPDATE "spaces" SET "type" = 'FLOOR' WHERE "type" IN ('楼层', 'FLOOR');
UPDATE "spaces" SET "type" = 'ROOM' WHERE "type" IN ('房间', 'ROOM');
UPDATE "spaces" SET "type" = 'PUBLIC' WHERE "type" IN ('公区', 'PUBLIC');
UPDATE "spaces" SET "type" = 'PARKING' WHERE "type" IN ('车位', '车库', '公区 / 车库', 'PARKING');

-- Data migration: Update existing status values to match enum
UPDATE "spaces" SET "status" = 'AVAILABLE' WHERE "status" IN ('有效', '可用', 'AVAILABLE');
UPDATE "spaces" SET "status" = 'DISABLED' WHERE "status" IN ('停用', '无效', 'DISABLED');

-- AlterTable: Change column types to enum
ALTER TABLE "spaces" ALTER COLUMN "type" DROP DEFAULT;
ALTER TABLE "spaces" ALTER COLUMN "type" TYPE "SpaceType" USING ("type"::text::"SpaceType");
ALTER TABLE "spaces" ALTER COLUMN "type" SET DEFAULT 'BUILDING';

ALTER TABLE "spaces" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "spaces" ALTER COLUMN "status" TYPE "SpaceStatus" USING ("status"::text::"SpaceStatus");
ALTER TABLE "spaces" ALTER COLUMN "status" SET DEFAULT 'AVAILABLE';
