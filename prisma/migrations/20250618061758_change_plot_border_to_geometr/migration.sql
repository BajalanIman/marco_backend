/*
  Warnings:

  - You are about to alter the column `plot_border` on the `Plot` table. The data in that column could be lost. The data in that column will be cast from `JsonB` to `Unsupported("geometry")`.

*/
-- AlterTable
CREATE EXTENSION IF NOT EXISTS postgis;

ALTER TABLE "Plot"
ALTER COLUMN plot_border TYPE geometry(Geometry, 4326)
USING CASE 
     WHEN plot_border IS NOT NULL 
     THEN ST_SetSRID(ST_GeomFromGeoJSON(plot_border::text), 4326)
     ELSE NULL
END;
