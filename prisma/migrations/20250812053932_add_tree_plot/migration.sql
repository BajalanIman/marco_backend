/*
  Warnings:

  - A unique constraint covering the columns `[plot_id,tree_no]` on the table `Tree` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `minutes` to the `TreeView` table without a default value. This is not possible if the table is not empty.
  - Added the required column `seconds` to the `TreeView` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "Tree_tree_no_key";

-- AlterTable
ALTER TABLE "Area" ALTER COLUMN "area_name" SET DATA TYPE VARCHAR(200),
ALTER COLUMN "area_information" SET DATA TYPE VARCHAR(1000);

-- AlterTable
ALTER TABLE "Plot" ALTER COLUMN "plot_information" SET DATA TYPE VARCHAR(1000);

-- AlterTable
ALTER TABLE "Tree" ADD COLUMN     "tree_letter" TEXT,
ADD COLUMN     "tree_plot" INTEGER;

-- AlterTable
ALTER TABLE "TreeView" ADD COLUMN     "minutes" INTEGER NOT NULL,
ADD COLUMN     "seconds" INTEGER NOT NULL;

-- CreateTable
CREATE TABLE "SoilSample" (
    "id" SERIAL NOT NULL,
    "plot_id" INTEGER NOT NULL,
    "depth" INTEGER NOT NULL,
    "location" VARCHAR(100) NOT NULL,
    "repetition" INTEGER NOT NULL,
    "x_coord" DECIMAL(12,4) NOT NULL,
    "y_coord" DECIMAL(12,4) NOT NULL,

    CONSTRAINT "SoilSample_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SoilVariable" (
    "id" SERIAL NOT NULL,
    "soil_sample_id" INTEGER NOT NULL,
    "variable_name" VARCHAR(100) NOT NULL,
    "value" DECIMAL(10,4) NOT NULL,

    CONSTRAINT "SoilVariable_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Tree_plot_id_tree_no_key" ON "Tree"("plot_id", "tree_no");

-- AddForeignKey
ALTER TABLE "SoilSample" ADD CONSTRAINT "SoilSample_plot_id_fkey" FOREIGN KEY ("plot_id") REFERENCES "Plot"("plot_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SoilVariable" ADD CONSTRAINT "SoilVariable_soil_sample_id_fkey" FOREIGN KEY ("soil_sample_id") REFERENCES "SoilSample"("id") ON DELETE CASCADE ON UPDATE CASCADE;
