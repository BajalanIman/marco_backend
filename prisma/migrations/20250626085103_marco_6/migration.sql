/*
  Warnings:

  - A unique constraint covering the columns `[plot_id,tree_no]` on the table `Tree` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `minutes` to the `TreeView` table without a default value. This is not possible if the table is not empty.
  - Added the required column `seconds` to the `TreeView` table without a default value. This is not possible if the table is not empty.

*/
CREATE EXTENSION IF NOT EXISTS postgis;

ALTER TABLE "Plot"
ALTER COLUMN plot_border TYPE geometry(Geometry, 4326)
USING CASE 
     WHEN plot_border IS NOT NULL 
     THEN ST_SetSRID(ST_GeomFromGeoJSON(plot_border::text), 4326)
     ELSE NULL
END;