import express from "express";
import cors from "cors";
import bcrypt from "bcrypt";
import { PrismaClient } from "./generated/prisma/index.js";

const app = express();
const port = 8800;
const prisma = new PrismaClient();

app.use(cors());
app.use(express.static("public"));
app.use(express.json());

app.get("/", (req, res) => {
  res.json("Hello, this is the backend!");
});

// users (sing up) *************************************************
app.post("/users", async (req, res) => {
  const { username, email, password, full_name, role } = req.body;
  try {
    const hashedPassword = await bcrypt.hash(password, 10);

    const userData = {
      username,
      email,
      password: hashedPassword,
      full_name, // include it directly
      role: role?.trim() || "user",
    };

    const newUser = await prisma.user.create({
      data: userData,
    });

    console.log("Inserted user:", newUser);

    return res.status(201).json({
      message: "Record inserted successfully",
      user_id: newUser.user_id,
    });
  } catch (err) {
    console.error("Error inserting record:", err);

    if (err.code === "P2002") {
      return res.status(409).json({ error: "Email or username already taken" });
    }

    return res.status(500).json({ error: "Error inserting record" });
  }
});

// Login ***********************************************************
app.post("/login", async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const { password: _, ...userWithoutPassword } = user;

    return res.json({ message: "Login successful", user: userWithoutPassword });
  } catch (err) {
    console.error("Login error:", err);
    return res.status(500).json({ error: "Login failed" });
  }
});

//  area-admins/:userId **********************************************
app.get("/api/area-admins/:userId", async (req, res) => {
  const userId = Number(req.params.userId);

  try {
    const areaAdmin = await prisma.areaAdmins.findFirst({
      where: { user_id: userId },
      select: { area_id: true },
    });

    if (!areaAdmin) {
      return res.status(404).json({ error: "User is not an area admin." });
    }

    return res.json({ areaId: areaAdmin.area_id });
  } catch (error) {
    return res.status(500).json({ error: "Internal Server Error" });
  }
});

// areas/:areaId ******************************************************************
app.get("/api/areas/:areaId", async (req, res) => {
  const areaId = Number(req.params.areaId);

  try {
    const area = await prisma.area.findUnique({
      where: { area_id: areaId },
      select: {
        area_name: true,
        area_information: true,
      },
    });

    if (!area) {
      return res.status(404).json({ error: "Area not found." });
    }

    res.json(area);
  } catch (err) {
    console.error("Error fetching area:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// plot post ******************************************************************
import { Pool } from "pg";

// Create a connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

app.post("/api/plots", async (req, res) => {
  const { plot_name, plot_information, area_id, plot_border } = req.body;

  try {
    const geometry =
      typeof plot_border === "string" ? JSON.parse(plot_border) : plot_border;

    if (!["Polygon", "MultiPolygon"].includes(geometry?.type)) {
      return res.status(400).json({
        error: "Only Polygon or MultiPolygon geometries are supported",
      });
    }

    const client = await pool.connect();

    try {
      const result = await client.query(
        `INSERT INTO "Plot" (
          plot_name, 
          plot_information, 
          area_id, 
          plot_border
        ) VALUES ($1, $2, $3, ST_SetSRID(ST_GeomFromGeoJSON($4), 4326))
        RETURNING plot_id`,
        [plot_name, plot_information, area_id, JSON.stringify(geometry)]
      );

      res.status(201).json({
        message: "Plot created successfully",
        plot_id: result.rows[0].plot_id,
      });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error("Error saving plot:", err);
    res.status(500).json({
      error: "Internal server error",
      details: err.message,
    });
  }
});

// plots/:areaId ******************************************************************
app.get("/api/plots", async (req, res) => {
  try {
    const plots = await prisma.plot.findMany({
      select: {
        plot_name: true,
        plot_information: true,
        area_id: true,
        plot_id: true,
      },
    });

    res.json(plots);
  } catch (err) {
    console.error("Error fetching all plots:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});
// plots/:get ******************************************************************

app.get("/api/plots", async (req, res) => {
  try {
    const plots = await prisma.$queryRaw`
      SELECT 
        plot_id,
        plot_name,
        plot_information,
        area_id,
        ST_AsGeoJSON(plot_border)::json AS geojson
      FROM "Plot"
    `;

    const formattedPlots = plots.map((plot) => {
      let coords = [];

      if (plot.geojson?.type === "Polygon") {
        coords = plot.geojson.coordinates[0]; // outer ring
      } else if (plot.geojson?.type === "MultiPolygon") {
        coords = plot.geojson.coordinates[0][0]; // first polygon's outer ring
      }

      return {
        plot_id: plot.plot_id,
        plot_name: plot.plot_name,
        plot_information: plot.plot_information,
        area_id: plot.area_id,
        coordinates: coords,
      };
    });

    res.json(formattedPlots);
  } catch (err) {
    console.error("Error fetching all plots:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

//trees: post ******************************************************************
app.post("/api/trees", async (req, res) => {
  try {
    const { trees, plotId } = req.body;

    const createdTrees = await Promise.all(
      trees.map(async (tree) => {
        return await prisma.tree.create({
          data: {
            odmf_name: tree.odmf_name || null,
            tree_no: parseInt(tree.tree_no),
            species: tree.species || null,
            species_code: tree.species_code || null,
            row_id: tree.row_id ? parseInt(tree.row_id) : null,
            latitude: tree.latitude ? parseFloat(tree.latitude) : null,
            longitude: tree.longitude ? parseFloat(tree.longitude) : null,
            elevation: tree.elevation ? parseFloat(tree.elevation) : null,
            height: tree.height ? parseFloat(tree.height) : null,
            year_planted: tree.year_planted
              ? parseInt(tree.year_planted)
              : null,
            comment: tree.comment || null,
            odmf_id: tree.odmf_id ? parseInt(tree.odmf_id) : null,
            tree_plot: tree.tree_plot ? parseInt(tree.tree_plot) : null,
            tree_letter: tree.tree_letter ? tree.tree_letter : null,
            plot_id: parseInt(plotId), // comes from the frontend
          },
        });
      })
    );

    res.status(201).json({
      message: "Trees inserted successfully",
      count: createdTrees.length,
    });
  } catch (error) {
    console.error("Failed to insert trees:", error);
    res.status(500).json({ error: "Failed to insert tree data" });
  }
});

//video: post  ******************************************************************

app.post("/video", async (req, res) => {
  try {
    const { video_name, video_url_id, recorded_at } = req.body;

    const newVideo = await prisma.video.create({
      data: {
        video_name,
        video_url_id,
        recorded_at: recorded_at ? new Date(recorded_at) : null,
      },
    });

    res.status(201).json(newVideo);
  } catch (error) {
    console.error("Failed to insert video:", error);
    res.status(500).json({ error: "Failed to insert video data" });
  }
});

//  video: Get ******************************************************************
app.get("/video", async (req, res) => {
  try {
    const videos = await prisma.video.findMany();
    res.json(videos);
  } catch (error) {
    console.error("Failed to fetch videos:", error);
    res.status(500).json({ error: "Failed to fetch videos" });
  }
});

//treeview: post  ******************************************************************

app.post("/tree-view/import", async (req, res) => {
  const data = req.body.data;

  if (!Array.isArray(data)) {
    return res.status(400).json({ error: "Invalid CSV data" });
  }

  let notFound = [];
  let imported = 0;
  let skipped = 0;

  for (const row of data) {
    try {
      const { video_name, ODMF_Name, total_seconds, minutes, seconds } = row;

      // Check if required fields exist
      if (
        !video_name ||
        !ODMF_Name ||
        total_seconds == null ||
        minutes == null ||
        seconds == null
      ) {
        skipped++;
        continue;
      }

      // Clean input
      const videoName = video_name.trim();
      const odmfName = ODMF_Name.trim();

      // Validate references
      const video = await prisma.video.findFirst({
        where: { video_name: videoName },
      });

      const tree = await prisma.tree.findFirst({
        where: { odmf_name: odmfName },
      });

      if (!video || !tree) {
        notFound.push({
          video_name: videoName,
          odmf_name: odmfName,
          reason: !video ? "Video not found" : "Tree not found",
        });
        skipped++;
        continue;
      }

      // Insert tree view row
      await prisma.treeView.create({
        data: {
          tree_id: tree.tree_id,
          video_id: video.video_id,
          start_seconds: parseInt(total_seconds),
          start_milliseconds: "000", // you can update this if you have milliseconds later
          duration: 2, // adjust if needed
          minutes: parseInt(minutes),
          seconds: parseInt(seconds),
        },
      });

      imported++;
    } catch (error) {
      console.error("Error importing row:", error);
      skipped++;
    }
  }

  res.json({
    message: `Import completed: ${imported} added, ${skipped} skipped.`,
    unmatched: notFound,
  });
});

// ******************************************************************
app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
