/*
  Warnings:

  - The `plot_border` column on the `Plot` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- AlterTable
ALTER TABLE "Plot" ADD COLUMN     "plot_name" VARCHAR(150),
DROP COLUMN "plot_border",
ADD COLUMN     "plot_border" JSONB;
