import express from "express";
import cors from "cors";
import bcrypt from "bcrypt";
import { PrismaClient } from "./generated/prisma/index.js";

const app = express();
const port = 8800;
const prisma = new PrismaClient();

app.use(
  cors({
    origin: "https://https://roots-and-robots.netlify.app/",
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true,
  })
);
app.use(express.static("public"));
app.use(express.json({ limit: "10mb" }));

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
// app.get("/api/plots", async (req, res) => {
//   try {
//     const plots = await prisma.plot.findMany({
//       select: {
//         plot_name: true,
//         plot_information: true,
//         area_id: true,
//         plot_id: true,
//       },
//     });

//     res.json(plots);
//   } catch (err) {
//     console.error("Error fetching all plots:", err);
//     res.status(500).json({ error: "Internal Server Error" });
//   }
// });
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

// tree: get ********************************************************************
app.get("/api/trees", async (req, res) => {
  try {
    const { plot_id } = req.query;

    const whereClause = plot_id ? { where: { plot_id: Number(plot_id) } } : {};

    const trees = await prisma.tree.findMany({
      ...whereClause,
      select: {
        tree_id: true,
        tree_no: true,
        species: true,
        latitude: true,
        longitude: true,
        plot_id: true,
        elevation: true,
        height: true,
        year_planted: true,
        tree_plot: true,
        tree_letter: true,
      },
    });

    const formattedTrees = trees
      .filter((tree) => tree.latitude && tree.longitude)
      .map((tree) => ({
        tree_id: tree.tree_id,
        tree_no: tree.tree_no,
        species: tree.species,
        lat: parseFloat(tree.latitude),
        lng: parseFloat(tree.longitude),
        plot_id: tree.plot_id,
        elevation: parseFloat(tree.elevation),
        height: parseFloat(tree.height),
        year_planted: tree.year_planted,
        tree_plot: tree.tree_plot,
        tree_letter: tree.tree_letter,
      }));

    res.json(formattedTrees);
  } catch (err) {
    console.error("Error fetching trees:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

//******************************************************************************
// GET: Get all videos (TreeView) for a specific tree
app.get("/api/tree/:treeId/videos", async (req, res) => {
  const treeId = parseInt(req.params.treeId);

  if (isNaN(treeId)) {
    return res.status(400).json({ error: "Invalid tree ID" });
  }

  try {
    const treeViews = await prisma.treeView.findMany({
      where: { tree_id: treeId },
      include: {
        video: true,
      },
    });

    if (!treeViews || treeViews.length === 0) {
      return res.status(404).json({ error: "No videos found for this tree" });
    }

    res.json(treeViews);
  } catch (error) {
    console.error("Failed to fetch tree videos:", error);
    res.status(500).json({ error: "Internal Server Error" });
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
        // console.log(`Not found — Video: ${videoName}, Tree: ${odmfName}`);
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
// Soil/post  ******************************************************************
app.post("/api/soil", async (req, res) => {
  try {
    const samples = req.body?.samples;
    const providedPlotId = req.body?.plot_id ?? null;

    if (!Array.isArray(samples) || samples.length === 0) {
      return res
        .status(400)
        .json({ error: "Missing or invalid 'samples' array in request body" });
    }

    // validate plot_id (use providedPlotId or first sample.plot_id)
    const plotIdToUse = providedPlotId ?? samples[0]?.plot_id;
    if (!plotIdToUse && plotIdToUse !== 0) {
      return res.status(400).json({
        error:
          "Missing plot_id (pass plot_id in request body or in each sample)",
      });
    }

    // ensure plot exists
    const plot = await prisma.plot.findUnique({
      where: { plot_id: Number(plotIdToUse) },
    });
    if (!plot) {
      return res
        .status(400)
        .json({ error: `Plot with id=${plotIdToUse} not found` });
    }

    const formatDecimalStr = (v, precision = 4) => {
      if (v === null || v === undefined || v === "") return null;
      const num = Number(String(v).replace(",", "."));
      if (!Number.isFinite(num)) return null;
      // return string for Prisma Decimal
      return num.toFixed(precision);
    };

    const insertedIds = [];
    const errors = [];

    for (let i = 0; i < samples.length; i++) {
      const row = samples[i] || {};

      // create soil sample
      let createdSample;
      try {
        createdSample = await prisma.soilSample.create({
          data: {
            plot_id: Number(plotIdToUse),
            depth:
              row.depth === "" || row.depth == null
                ? null
                : Number.parseInt(String(row.depth).replace(",", "."), 10),
            location: row.location ?? null,
            repetition:
              row.repetition === "" || row.repetition == null
                ? null
                : Number.parseInt(String(row.repetition).replace(",", "."), 10),
            x_coord: formatDecimalStr(row.x_coord, 4),
            y_coord: formatDecimalStr(row.y_coord, 4),
          },
        });
      } catch (err) {
        console.error("Failed creating SoilSample for row", i + 1, err);
        errors.push({
          row: i + 1,
          error: `Failed to create SoilSample: ${err.message ?? String(err)}`,
        });
        continue;
      }

      // prepare variables
      const vars = (row.variables || [])
        .filter((v) => v && v.variable_name)
        .map((v) => {
          const val = formatDecimalStr(v.value, 4);
          return val === null
            ? null
            : {
                soil_sample_id: createdSample.id,
                variable_name: String(v.variable_name).trim(),
                value: val,
              };
        })
        .filter(Boolean);

      if (vars.length > 0) {
        try {
          await prisma.soilVariable.createMany({ data: vars });
        } catch (err) {
          console.error(
            "Failed inserting variables for sample",
            createdSample.id,
            err
          );
          errors.push({
            row: i + 1,
            error: `Sample created (id=${
              createdSample.id
            }) but failed to insert variables: ${err.message ?? String(err)}`,
          });
          // keep sample ID; continue
        }
      } else {
        // No numeric variables found — record as error or warning
        errors.push({
          row: i + 1,
          error: "No numeric variables found for this sample",
        });
        // optionally delete createdSample if you don't want empty samples:
        // await prisma.soilSample.delete({ where: { id: createdSample.id } });
        // continue;
      }

      insertedIds.push(createdSample.id);
    }

    if (insertedIds.length === 0) {
      return res.status(500).json({ error: "No records inserted", errors });
    }

    return res.status(201).json({
      message: "Records processed",
      insertedCount: insertedIds.length,
      insertedIds,
      errors,
    });
  } catch (err) {
    console.error("Import failed:", err);
    return res.status(500).json({
      error: "Failed to import samples",
      details: err.message ?? String(err),
    });
  }
});
// Soil/Get ******************************************************************

// GET /api/soil?plot_id=123
app.get("/api/soil", async (req, res) => {
  try {
    const plotIdRaw =
      req.query.plot_id ?? req.query.plotId ?? req.body?.plot_id;
    const plotId = plotIdRaw !== undefined ? Number(plotIdRaw) : NaN;

    if (Number.isNaN(plotId)) {
      return res
        .status(400)
        .json({ error: "Missing or invalid plot_id query parameter" });
    }

    // Fetch samples with variables
    const samples = await prisma.soilSample.findMany({
      where: { plot_id: plotId },
      include: { variables: true },
      orderBy: { depth: "asc" },
    });

    // Map Decimal (or other) types into JSON-friendly strings/numbers
    const mapped = samples.map((s) => ({
      id: s.id,
      plot_id: s.plot_id,
      depth: s.depth,
      location: s.location,
      repetition: s.repetition,
      x_coord:
        s.x_coord === null || s.x_coord === undefined
          ? null
          : String(s.x_coord),
      y_coord:
        s.y_coord === null || s.y_coord === undefined
          ? null
          : String(s.y_coord),
      variables: (s.variables || []).map((v) => ({
        id: v.id,
        variable_name: v.variable_name,
        // Prisma Decimal might be an object; serialise to string. Frontend can convert to Number if needed.
        value:
          v.value === null || v.value === undefined ? null : String(v.value),
      })),
      createdAt: s.createdAt ?? null, // if you have timestamps, else ignore
    }));

    return res.json({ samples: mapped });
  } catch (err) {
    console.error("Failed to fetch soil samples:", err);
    return res.status(500).json({
      error: "Failed to fetch soil samples",
      details: err.message ?? String(err),
    });
  }
});

// ******************************************************************
app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
