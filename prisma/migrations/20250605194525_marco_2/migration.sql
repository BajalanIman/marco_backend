-- CreateTable
CREATE TABLE "TreeView" (
    "tree_view_id" SERIAL NOT NULL,
    "start_seconds" INTEGER NOT NULL,
    "start_milliseconds" TEXT NOT NULL,
    "duration" INTEGER NOT NULL,
    "tree_id" INTEGER NOT NULL,
    "video_id" INTEGER NOT NULL,

    CONSTRAINT "TreeView_pkey" PRIMARY KEY ("tree_view_id")
);

-- CreateTable
CREATE TABLE "Video" (
    "video_id" SERIAL NOT NULL,
    "video_name" TEXT,
    "video_url_id" TEXT NOT NULL,
    "recorded_at" TIMESTAMP(3),

    CONSTRAINT "Video_pkey" PRIMARY KEY ("video_id")
);

-- CreateTable
CREATE TABLE "Tree" (
    "tree_id" SERIAL NOT NULL,
    "odmf_name" TEXT,
    "tree_no" INTEGER NOT NULL,
    "species" VARCHAR(100),
    "species_code" VARCHAR(10),
    "row_id" INTEGER,
    "latitude" DECIMAL(11,8),
    "longitude" DECIMAL(11,8),
    "elevation" DECIMAL(5,2),
    "height" DECIMAL(5,2),
    "year_planted" INTEGER,
    "comment" TEXT,
    "odmf_id" INTEGER,
    "plot_id" INTEGER NOT NULL,

    CONSTRAINT "Tree_pkey" PRIMARY KEY ("tree_id")
);

-- CreateTable
CREATE TABLE "Plot" (
    "plot_id" SERIAL NOT NULL,
    "plot_border" TEXT,
    "plot_information" VARCHAR(150),
    "area_id" INTEGER NOT NULL,

    CONSTRAINT "Plot_pkey" PRIMARY KEY ("plot_id")
);

-- CreateTable
CREATE TABLE "Area" (
    "area_id" SERIAL NOT NULL,
    "area_name" VARCHAR(50),
    "area_information" VARCHAR(150),

    CONSTRAINT "Area_pkey" PRIMARY KEY ("area_id")
);

-- CreateTable
CREATE TABLE "TreeStatus" (
    "tree_status_id" SERIAL NOT NULL,
    "DBH" DECIMAL(5,2),
    "height_increment" DECIMAL(4,2),
    "harvest_weight" DECIMAL(7,2),
    "recorded_at" TIMESTAMP(3),
    "tree_id" INTEGER NOT NULL,

    CONSTRAINT "TreeStatus_pkey" PRIMARY KEY ("tree_status_id")
);

-- CreateTable
CREATE TABLE "AreaAdmins" (
    "area_admins_id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "area_id" INTEGER NOT NULL,

    CONSTRAINT "AreaAdmins_pkey" PRIMARY KEY ("area_admins_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Video_video_url_id_key" ON "Video"("video_url_id");

-- CreateIndex
CREATE UNIQUE INDEX "Tree_tree_no_key" ON "Tree"("tree_no");

-- AddForeignKey
ALTER TABLE "TreeView" ADD CONSTRAINT "TreeView_tree_id_fkey" FOREIGN KEY ("tree_id") REFERENCES "Tree"("tree_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TreeView" ADD CONSTRAINT "TreeView_video_id_fkey" FOREIGN KEY ("video_id") REFERENCES "Video"("video_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tree" ADD CONSTRAINT "Tree_plot_id_fkey" FOREIGN KEY ("plot_id") REFERENCES "Plot"("plot_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Plot" ADD CONSTRAINT "Plot_area_id_fkey" FOREIGN KEY ("area_id") REFERENCES "Area"("area_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TreeStatus" ADD CONSTRAINT "TreeStatus_tree_id_fkey" FOREIGN KEY ("tree_id") REFERENCES "Tree"("tree_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AreaAdmins" ADD CONSTRAINT "AreaAdmins_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AreaAdmins" ADD CONSTRAINT "AreaAdmins_area_id_fkey" FOREIGN KEY ("area_id") REFERENCES "Area"("area_id") ON DELETE CASCADE ON UPDATE CASCADE;
